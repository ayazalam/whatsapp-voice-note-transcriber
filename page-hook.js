/**
 * Runs in the PAGE (MAIN) world at document_start.
 *
 * WhatsApp Web does not put voice-note audio in the DOM. It decrypts media in a
 * worker, mints the blob: URL there, and plays it through a detached `new Audio()`
 * that never gets appended. So neither a DOM scan nor a main-thread
 * URL.createObjectURL hook can see it.
 *
 * The choke point that always fires is HTMLMediaElement.prototype.play(). While a
 * capture is armed we read the blob URL, fetch the audio ourselves, and return a
 * resolved promise WITHOUT calling the real play(), so the audio pipeline is never
 * engaged.
 *
 * Suppression is time-boxed rather than tied to the grab: WhatsApp assigns .src
 * first and calls play() a beat later, so disarming the moment we have the bytes
 * would let that later play() through. Suppression stays up until the content
 * script explicitly disarms.
 */
(() => {
  "use strict";

  const MAX_RETAINED = 40;
  const MAX_SEEN = 30;
  const MAX_BYTES = 25 * 1024 * 1024;

  /** @type {Map<string, Blob>} */
  const retained = new Map();

  /** Every media element that has attempted playback, so we can silence them. */
  const seen = new Set();

  /** @type {{id:number, done:boolean}|null} */
  let capture = null;
  let suppressUntil = 0;

  const suppressing = () => Date.now() < suppressUntil;
  const reply = (id, payload) => window.postMessage({ __wvt: "res", id, ...payload }, "*");

  const looksLikeAudio = (blob) => {
    const t = (blob.type || "").toLowerCase();
    if (t.startsWith("audio/")) return true;
    if (t === "" || t === "application/octet-stream") return blob.size <= MAX_BYTES;
    return false;
  };

  const remember = (node) => {
    seen.add(node);
    while (seen.size > MAX_SEEN) seen.delete(seen.values().next().value);
  };

  function silenceAll() {
    let stopped = 0;
    for (const node of seen) {
      try {
        if (!node.paused) stopped++;
        node.pause();
        node.currentTime = 0;
        node.muted = false;
        node.volume = 1;
      } catch (_) {}
    }
    return stopped;
  }

  // ---- capture ---------------------------------------------------------------

  async function grab(url) {
    if (!capture || capture.done || typeof url !== "string" || !url.startsWith("blob:")) return;
    capture.done = true;
    const id = capture.id;
    try {
      const res = await fetch(url);
      if (!res.ok) return reply(id, { ok: false, error: `blob fetch ${res.status}` });
      const blob = await res.blob();
      if (!blob || !blob.size) return reply(id, { ok: false, error: "empty blob" });
      // Blob survives structured clone, so the content script gets the real thing.
      reply(id, { ok: true, blob, type: blob.type, size: blob.size });
    } catch (e) {
      reply(id, { ok: false, error: String((e && e.message) || e) });
    }
  }

  // ---- patches ---------------------------------------------------------------

  const origCreate = URL.createObjectURL.bind(URL);
  const origRevoke = URL.revokeObjectURL.bind(URL);

  URL.createObjectURL = function (obj) {
    const url = origCreate(obj);
    try {
      if (obj instanceof Blob && !(obj instanceof File) && looksLikeAudio(obj)) {
        retained.set(url, obj);
        while (retained.size > MAX_RETAINED) retained.delete(retained.keys().next().value);
        grab(url);
      }
    } catch (_) {}
    return url;
  };

  const origPlay = HTMLMediaElement.prototype.play;
  const origPause = HTMLMediaElement.prototype.pause;

  HTMLMediaElement.prototype.play = function () {
    try {
      remember(this);
      grab(this.src || this.currentSrc);
    } catch (_) {}

    if (suppressing()) {
      try {
        this.muted = true;
        this.volume = 0;
        // Some callers read .paused right after; keep it consistent.
        origPause.call(this);
      } catch (_) {}
      return Promise.resolve();
    }
    return origPlay.apply(this, arguments);
  };

  // Catch the URL as early as possible — before play() is reached.
  try {
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
    if (srcDesc && srcDesc.set) {
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        configurable: true,
        enumerable: srcDesc.enumerable,
        get() {
          return srcDesc.get.call(this);
        },
        set(v) {
          try {
            remember(this);
            grab(v);
          } catch (_) {}
          return srcDesc.set.call(this, v);
        }
      });
    }
  } catch (_) {}

  // new Audio(url) sets src internally, bypassing the accessor above.
  try {
    const OrigAudio = window.Audio;
    const Patched = function (src) {
      const a = new OrigAudio(src);
      try {
        remember(a);
        if (src) grab(src);
      } catch (_) {}
      return a;
    };
    Patched.prototype = OrigAudio.prototype;
    window.Audio = Patched;
  } catch (_) {}

  // ---- bridge ----------------------------------------------------------------

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || !ev.data || ev.data.__wvt !== "req") return;
    const { id, action, url, ms } = ev.data;

    try {
      if (action === "ping") {
        reply(id, { ok: true, version: 3 });
      } else if (action === "arm") {
        // Deferred reply: resolves when we actually have the audio.
        suppressUntil = Date.now() + (ms || 30000);
        capture = { id, done: false };
      } else if (action === "hold") {
        suppressUntil = Date.now() + (ms || 3000);
        reply(id, { ok: true });
      } else if (action === "silence") {
        reply(id, { ok: true, stopped: silenceAll() });
      } else if (action === "disarm") {
        suppressUntil = 0;
        capture = null;
        reply(id, { ok: true, stopped: silenceAll() });
      } else if (action === "reopen") {
        const blob = retained.get(url);
        if (!blob) return reply(id, { ok: false, error: "not-retained" });
        reply(id, { ok: true, blob, type: blob.type, size: blob.size });
      } else if (action === "release") {
        origRevoke(url);
        reply(id, { ok: true });
      } else {
        reply(id, { ok: false, error: "unknown-action" });
      }
    } catch (e) {
      reply(id, { ok: false, error: String((e && e.message) || e) });
    }
  });
})();
