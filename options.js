"use strict";

const DEFAULTS = {
  apiKey: "",
  style: "original",
  diarize: false
};

const $ = (id) => document.getElementById(id);
const timers = new Map();
let saveQueue = Promise.resolve();
let savedKey = "";

function displayStyle(style) {
  if (style === "hinglish") return "latin";
  if (style === "devanagari") return "original";
  return ["latin", "original", "both"].includes(style) ? style : DEFAULTS.style;
}

function feedback(id, text, kind = "", timeout = 0) {
  const el = $(id);
  clearTimeout(timers.get(id));
  el.textContent = text;
  el.className = id === "cacheMsg" ? "hint" : "feedback";
  if (kind) el.classList.add(kind);
  if (timeout) timers.set(id, setTimeout(() => {
    el.textContent = "";
    el.classList.remove(kind);
  }, timeout));
}

function updateSettings(patch) {
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const got = await chrome.storage.local.get("settings");
    const { langMode: _oldLanguageChoice, ...saved } = got.settings || {};
    await chrome.storage.local.set({
      settings: { ...DEFAULTS, ...saved, ...patch }
    });
  });
  return saveQueue;
}

async function loadCacheCount() {
  const all = await chrome.storage.local.get(null);
  const count = Object.keys(all).filter((key) => key.startsWith("wvt:tx:")).length;
  $("clear").textContent = `Clear transcript cache (${count})`;
  $("clear").disabled = count === 0;
}

async function load() {
  try {
    const got = await chrome.storage.local.get("settings");
    const settings = { ...DEFAULTS, ...(got.settings || {}) };
    savedKey = settings.apiKey;
    $("apiKey").value = settings.apiKey;
    $("style").value = displayStyle(settings.style);
    $("diarize").checked = !!settings.diarize;
    await loadCacheCount();
  } catch (_) {
    feedback("keyMsg", "Could not load settings. Reopen the extension.", "err");
  }
}

async function saveKey() {
  try {
    const key = $("apiKey").value.trim();
    await updateSettings({ apiKey: key });
    savedKey = key;
    feedback("keyMsg", key
      ? "Key saved in this browser."
      : "Key removed from this browser.", "ok", 4000);
  } catch (_) {
    feedback("keyMsg", "Could not save the key. Try again.", "err");
  }
}

async function savePreference(patch) {
  feedback("prefsMsg", "Saving…");
  try {
    await updateSettings(patch);
    feedback("prefsMsg", "Saved automatically.", "ok", 2500);
  } catch (_) {
    feedback("prefsMsg", "Could not save. Try again.", "err");
  }
}

$("saveKey").addEventListener("click", saveKey);
$("apiKey").addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveKey();
});
$("apiKey").addEventListener("input", () => {
  feedback("keyMsg", "Key changes are not saved yet.");
});

$("reveal").addEventListener("click", () => {
  const field = $("apiKey");
  const showing = field.type === "password";
  field.type = showing ? "text" : "password";
  $("reveal").textContent = showing ? "Hide" : "Show";
  $("reveal").setAttribute("aria-label", showing ? "Hide API key" : "Show API key");
  $("reveal").title = showing ? "Hide API key" : "Show API key";
});

$("style").addEventListener("change", () => {
  savePreference({ style: $("style").value });
});
$("diarize").addEventListener("change", () => {
  savePreference({ diarize: $("diarize").checked });
});

$("test").addEventListener("click", async () => {
  const key = $("apiKey").value.trim();
  if (!key) return feedback("keyMsg", "Enter a key first.", "err");
  $("test").disabled = true;
  feedback("keyMsg", "Verifying…");
  try {
    const res = await chrome.runtime.sendMessage({ type: "testKey", key });
    if (!res || !res.ok) {
      feedback("keyMsg", (res && res.error) || "Could not verify key.", "err");
      return;
    }
    if (res.note) return feedback("keyMsg", res.note, "ok");
    const quota = Number.isFinite(res.used) && Number.isFinite(res.limit)
      ? ` · ${res.used.toLocaleString()}/${res.limit.toLocaleString()} credits used`
      : "";
    const savedNote = key === savedKey ? "." : ". Save it to use it.";
    feedback("keyMsg", `Key works${res.tier ? ` (${res.tier})` : ""}${quota}${savedNote}`, "ok");
  } catch (_) {
    feedback("keyMsg", "Could not verify key. Try again.", "err");
  } finally {
    $("test").disabled = false;
  }
});

$("clear").addEventListener("click", async () => {
  $("clear").disabled = true;
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith("wvt:tx:"));
    if (keys.length) await chrome.storage.local.remove(keys);
    await loadCacheCount();
    feedback("cacheMsg", `Cleared ${keys.length} transcript${keys.length === 1 ? "" : "s"}.`, "", 4000);
  } catch (_) {
    $("clear").disabled = false;
    feedback("cacheMsg", "Could not clear cache.", "", 4000);
  }
});

load();
