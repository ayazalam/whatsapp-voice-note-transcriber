/**
 * WhatsApp Web voice note transcriber.
 *
 * Injects a "Transcribe" button into every voice note bubble, grabs the already
 * decrypted audio Blob out of the page, sends it to ElevenLabs Scribe v2 via the
 * service worker, and renders the transcript under the bubble.
 */
(() => {
  "use strict";

  const CACHE_PREFIX = "wvt:tx:";
  const CACHE_LIMIT = 600;

  const DEFAULTS = {
    apiKey: "",
    style: "hinglish", // hinglish | devanagari | both
    langMode: "auto", // auto | hi
    diarize: false
  };

  let settings = { ...DEFAULTS };

  // ---------------------------------------------------------------- utilities

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Reloading the extension orphans every content script already running in the
   * page: chrome.* still exists but every call throws. Detect it and say so in
   * plain words instead of leaking "Extension context invalidated".
   */
  const RELOAD_MSG = "Extension was updated — press Ctrl+R to reload this tab.";

  function contextAlive() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  }

  const isOrphaned = (err) =>
    /context invalidated|Extension context|message port closed/i.test(
      (err && err.message) || String(err)
    );

  let observer = null;
  let timer = null;
  let stopped = false;

  /** Go quiet and tell the user why, rather than throwing on a loop. */
  function shutdown() {
    if (stopped) return;
    stopped = true;
    try {
      if (timer) clearInterval(timer);
      if (observer) observer.disconnect();
    } catch (_) {}
    document.querySelectorAll(".wvt-wrap").forEach((wrap) => {
      const status = wrap.querySelector(".wvt-status");
      const btn = wrap.querySelector(".wvt-btn");
      if (btn) btn.disabled = true;
      if (status) {
        status.textContent = RELOAD_MSG;
        status.className = "wvt-status wvt-error";
      }
    });
  }

  function waitFor(fn, timeout = 8000, step = 25) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        let v;
        try {
          v = fn();
        } catch (_) {
          v = null;
        }
        if (v) return resolve(v);
        if (Date.now() - started > timeout) return resolve(null);
        setTimeout(tick, step);
      };
      tick();
    });
  }

  // ------------------------------------------------------- page-world bridge

  let bridgeSeq = 0;
  const pending = new Map();

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || !ev.data || ev.data.__wvt !== "res") return;
    const resolve = pending.get(ev.data.id);
    if (resolve) {
      pending.delete(ev.data.id);
      resolve(ev.data);
    }
  });

  function askPage(action, extra = {}, timeout = 5000) {
    return new Promise((resolve) => {
      const id = ++bridgeSeq;
      pending.set(id, resolve);
      window.postMessage({ __wvt: "req", id, action, ...extra }, "*");
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ ok: false, error: "timeout" });
        }
      }, timeout);
    });
  }

  // ------------------------------------------------------------ audio access
  async function fetchBlob(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return blob && blob.size > 0 ? blob : null;
    } catch (_) {
      return null;
    }
  }

  const VOICE_HINTS =
    '[data-icon="ptt-status"], [aria-label="Voice message"], [aria-label="Play voice message"]';

  /**
   * A real press, not just .click(). React surfaces frequently bind pointer
   * handlers, and a bare click() never reaches those.
   */
  function press(el) {
    const opts = { bubbles: true, cancelable: true, composed: true };
    try {
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
    } catch (_) {}
    try {
      el.click();
    } catch (_) {}
  }

  /**
   * The play control, without depending on the interface language.
   *
   * Matching aria-label text only works on an English WhatsApp. On any other
   * language the label differs, the old chain fell through to the ptt-status
   * icon, and clicking that did nothing: no download, no audio, a 30 second
   * timeout. So the English labels are a fast path only, and the real lookup is
   * structural.
   *
   * Inside a voice note the play control is the icon-only button. The playback
   * speed control always renders visible text ("1.5x"), which is what separates
   * them in every language.
   */
  function iconOnlyButtons(scope) {
    return [...scope.querySelectorAll('button, [role="button"]')].filter((b) => {
      if (b.getAttribute("role") === "slider" || b.closest('[role="slider"]')) return false;
      if ((b.textContent || "").trim()) return false; // speed toggle shows "1.5x"
      return !!b.querySelector("svg");
    });
  }

  function voiceNoteScope(row) {
    // The progress bar is exposed as a slider in every language, so it is a
    // reliable anchor for the player's own container.
    const slider = row.querySelector('[role="slider"], [aria-label*="progress" i]');
    if (slider) {
      const box = slider.closest("div")?.parentElement;
      if (box) return box;
    }
    return row;
  }

  function findPlayButton(row) {
    const exact =
      row.querySelector('[aria-label="Play voice message"]') ||
      row.querySelector('[aria-label^="Play voice" i]');
    if (exact) return exact.closest('button, [role="button"]') || exact;

    const scoped = iconOnlyButtons(voiceNoteScope(row));
    if (scoped.length) return scoped[0];

    const anywhere = iconOnlyButtons(row);
    return anywhere.length ? anywhere[0] : null;
  }

  function findPauseButton(row) {
    const exact =
      row.querySelector('[aria-label="Pause voice message"]') ||
      row.querySelector('[aria-label^="Pause voice" i]');
    if (exact) return exact.closest('button, [role="button"]') || exact;
    // Same element toggles between play and pause, so reuse the structural lookup.
    return findPlayButton(row);
  }

  /**
   * Get the audio without playing it.
   *
   * WhatsApp keeps voice-note audio entirely out of the DOM: it decrypts in a
   * worker and plays through a detached `new Audio()`. The only reliable handle
   * is play() itself, so we arm a capture in the page world, click WhatsApp's
   * own play control to make it download and decrypt, and the hook grabs the
   * blob URL off the element and returns a resolved promise instead of calling
   * the real play(). The audio pipeline is never engaged — nothing is audible.
   */
  async function captureAudio(row, onStatus) {
    const playBtn = findPlayButton(row);
    if (!playBtn) throw new Error("Couldn't find this note's play control.");

    // Without the page hook there is nothing suppressing playback, and clicking
    // play would just play the note out loud. Refuse rather than do that.
    const alive = await askPage("ping", {}, 2000);
    if (!alive.ok) {
      throw new Error("Page hook not active — reload the WhatsApp tab (Ctrl+Shift+R).");
    }

    const id = ++bridgeSeq;
    const captured = new Promise((resolve) => {
      pending.set(id, resolve);
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ ok: false, error: "Timed out. WhatsApp did not start downloading the audio." });
        }
      }, 30000);
    });

    // Arm before clicking: the hook must be suppressing when WhatsApp calls play().
    window.postMessage({ __wvt: "req", id, action: "arm", ms: 35000 }, "*");
    await sleep(0);

    onStatus("Fetching audio…");
    press(playBtn);

    let res;
    try {
      res = await captured;
    } finally {
      // WhatsApp assigns .src and calls play() a beat later, so hold suppression
      // past the grab, stop anything already running, then release.
      await askPage("hold", { ms: 2500 });
      await askPage("silence");

      const pauseBtn = findPauseButton(row);
      if (pauseBtn) {
        try {
          press(pauseBtn);
        } catch (_) {}
      }

      await sleep(1200);
      await askPage("silence");
      await askPage("disarm");
    }

    if (!res.ok || !res.blob) {
      throw new Error(res.error || "Could not capture the audio.");
    }
    return res.blob;
  }

  async function getAudioBlob(row, onStatus) {
    // If a future WhatsApp puts the element back in the DOM, this is cheaper.
    const audio = row.querySelector("audio");
    if (audio && audio.src) {
      const direct = await fetchBlob(audio.src);
      if (direct) return direct;
      const reopened = await askPage("reopen", { url: audio.src });
      if (reopened.ok && reopened.blob) return reopened.blob;
    }

    return captureAudio(row, onStatus);
  }

  // ------------------------------------------------------------------- cache

  const msgId = (row) => {
    const el = row.querySelector("[data-id]") || row.closest("[data-id]");
    return el ? el.getAttribute("data-id") : null;
  };

  async function cacheGet(id) {
    if (!id || !contextAlive()) return null;
    try {
      const key = CACHE_PREFIX + id;
      const got = await chrome.storage.local.get(key);
      return got[key] || null;
    } catch (err) {
      if (isOrphaned(err)) shutdown();
      return null;
    }
  }

  async function cacheSet(id, value) {
    if (!id || !contextAlive()) return;
    try {
      await chrome.storage.local.set({ [CACHE_PREFIX + id]: value });
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
      if (keys.length > CACHE_LIMIT) {
        keys
          .sort((a, b) => (all[a].ts || 0) - (all[b].ts || 0))
          .slice(0, keys.length - CACHE_LIMIT)
          .forEach((k) => chrome.storage.local.remove(k));
      }
    } catch (err) {
      if (isOrphaned(err)) shutdown();
    }
  }

  // ---------------------------------------------------------------------- UI

  // Built with createElement rather than innerHTML: web.whatsapp.com enforces
  // Trusted Types, and this sidesteps the question entirely.
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function transcriptIcon() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z");
    svg.appendChild(path);
    return svg;
  }

  function buildUI(row) {
    const wrap = el("div", "wvt-wrap");

    const bar = el("div", "wvt-bar");
    const btn = el("button", "wvt-btn");
    btn.type = "button";
    btn.title = "Transcribe with ElevenLabs Scribe v2";
    const label = el("span", "wvt-btn-label", "Transcribe");
    btn.append(transcriptIcon(), label);
    const status = el("span", "wvt-status");
    bar.append(btn, status);

    const result = el("div", "wvt-result");
    result.hidden = true;
    const text = el("div", "wvt-text");
    const actions = el("div", "wvt-actions");
    const toggle = el("button", "wvt-link wvt-toggle");
    toggle.type = "button";
    toggle.hidden = true;
    const copy = el("button", "wvt-link wvt-copy", "Copy");
    copy.type = "button";
    const redo = el("button", "wvt-link wvt-redo", "Redo");
    redo.type = "button";
    actions.append(toggle, copy, redo);
    result.append(text, actions);

    wrap.append(bar, result);

    // WhatsApp listens for clicks on the bubble; keep ours to ourselves.
    ["click", "mousedown", "mouseup", "dblclick", "pointerdown"].forEach((t) =>
      wrap.addEventListener(t, (e) => e.stopPropagation())
    );

    const els = { wrap, btn, label, status, result, text, toggle, copy, redo };

    els.btn.addEventListener("click", () => run(row, els, false));
    els.redo.addEventListener("click", () => run(row, els, true));
    els.copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(els.text.textContent || "");
        els.copy.textContent = "Copied";
        setTimeout(() => (els.copy.textContent = "Copy"), 1500);
      } catch (_) {
        els.copy.textContent = "Copy failed";
      }
    });

    return els;
  }

  function render(els, data) {
    const hinglish = data.hinglish || "";
    const original = data.text || "";
    // Any script we romanise changes the text; if nothing changed it was already
    // Latin and there is nothing to toggle between.
    const hasDev = !!hinglish && hinglish !== original;

    let showing = settings.style === "devanagari" || !hasDev ? "original" : "hinglish";

    const paint = () => {
      if (settings.style === "both" && hasDev) {
        els.text.replaceChildren(
          el("div", null, hinglish),
          el("div", "wvt-secondary", original)
        );
        els.toggle.hidden = true;
      } else {
        els.text.textContent = showing === "hinglish" ? hinglish : original;
        els.toggle.hidden = !hasDev;
        els.toggle.textContent = showing === "hinglish" ? "Original script" : "Roman";
      }
    };

    els.toggle.onclick = () => {
      showing = showing === "hinglish" ? "original" : "hinglish";
      paint();
    };

    paint();
    els.result.hidden = false;
    els.label.textContent = "Transcribe";
    els.btn.hidden = true;
    els.status.textContent = data.lang && data.lang !== "hi" ? data.lang : "";
    els.status.className = "wvt-status";
  }

  function setBusy(els, msg) {
    els.btn.disabled = true;
    els.label.textContent = "Transcribing";
    els.status.textContent = msg;
    els.status.className = "wvt-status wvt-busy";
  }

  function setError(els, msg) {
    els.btn.disabled = false;
    els.btn.hidden = false;
    els.label.textContent = "Retry";
    els.status.textContent = msg;
    els.status.className = "wvt-status wvt-error";
  }

  // ----------------------------------------------------------------- pipeline

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  const inFlight = new WeakSet();

  async function run(row, els, force) {
    if (inFlight.has(row)) return;
    inFlight.add(row);

    const id = msgId(row);
    try {
      if (!contextAlive()) {
        shutdown();
        setError(els, RELOAD_MSG);
        return;
      }
      if (!settings.apiKey) {
        setError(els, "Add your ElevenLabs API key in the extension settings.");
        return;
      }

      if (!force) {
        const cached = await cacheGet(id);
        if (cached) {
          render(els, cached);
          return;
        }
      }

      setBusy(els, "Reading audio…");
      const blob = await getAudioBlob(row, (m) => setBusy(els, m));

      setBusy(els, "Sending to Scribe…");
      const base64 = toBase64(await blob.arrayBuffer());

      const res = await chrome.runtime.sendMessage({
        type: "transcribe",
        base64,
        mimeType: blob.type || "audio/ogg",
        language: settings.langMode === "hi" ? "hi" : null,
        diarize: !!settings.diarize
      });

      if (!res || !res.ok) throw new Error((res && res.error) || "Transcription failed.");

      const text = (res.text || "").trim();
      if (!text) throw new Error("Scribe returned nothing — the note may be silent.");

      const data = {
        text,
        hinglish: window.WVT_translit ? window.WVT_translit(text) : text,
        lang: res.language || "",
        ts: Date.now()
      };
      await cacheSet(id, data);
      render(els, data);
    } catch (err) {
      if (isOrphaned(err)) {
        shutdown();
        setError(els, RELOAD_MSG);
      } else {
        setError(els, (err && err.message) || String(err));
      }
    } finally {
      inFlight.delete(row);
    }
  }

  // ---------------------------------------------------------------- scanning

  function isVoiceNote(row) {
    if (row.querySelector(VOICE_HINTS)) return true;
    if (row.querySelector('[aria-label*="voice message" i], [aria-label*="voice note" i]')) {
      return true;
    }
    return !!row.querySelector("audio");
  }

  /**
   * WhatsApp's bubble classes are generated atoms now (x1n2onr6, x78zum5, …) and
   * there is no .message-in/.message-out to hook, so we hang the UI off the row
   * itself and work out the side geometrically.
   */
  function isOutgoing(row) {
    const anchor = row.querySelector(VOICE_HINTS) || row.firstElementChild;
    if (!anchor) return false;
    const a = anchor.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    if (!r.width) return false;
    return (a.left + a.right) / 2 > (r.left + r.right) / 2;
  }

  async function attach(row) {
    row.dataset.wvtDone = "1";

    const els = buildUI(row);
    els.wrap.classList.add(isOutgoing(row) ? "wvt-out" : "wvt-in");
    row.appendChild(els.wrap);

    const cached = await cacheGet(msgId(row));
    if (cached) render(els, cached);
  }

  function scan(root = document) {
    const rows = root.querySelectorAll
      ? root.querySelectorAll('div[role="row"], div[data-id]')
      : [];
    for (const row of rows) {
      // React can recycle a row and drop our node — re-attach if it vanished.
      if (row.dataset.wvtDone === "1" && row.querySelector(".wvt-wrap")) continue;
      if (!isVoiceNote(row)) continue;
      // Skip nested duplicates: only handle the outermost matching container.
      if (row.parentElement && row.parentElement.closest('div[role="row"]')) continue;
      attach(row);
    }
  }

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }

  // ------------------------------------------------------------------- boot

  async function loadSettings() {
    if (!contextAlive()) return;
    try {
      const got = await chrome.storage.local.get("settings");
      settings = { ...DEFAULTS, ...(got.settings || {}) };
    } catch (err) {
      if (isOrphaned(err)) shutdown();
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings) {
        settings = { ...DEFAULTS, ...(changes.settings.newValue || {}) };
      }
    });
  } catch (_) {}

  (async () => {
    await loadSettings();
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setInterval(() => {
      // An orphaned script would otherwise scan and throw every 2s forever.
      if (!contextAlive()) return shutdown();
      scan();
    }, 2000); // safety net for WhatsApp's virtualised list
    scan();
  })();
})();
