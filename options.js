"use strict";

const DEFAULTS = {
  apiKey: "",
  style: "hinglish",
  langMode: "auto",
  diarize: false
};

const $ = (id) => document.getElementById(id);
const msg = $("msg");

let msgTimer = null;
function say(text, kind = "") {
  msg.textContent = text;
  msg.className = "msg " + kind;
  clearTimeout(msgTimer);
  if (text) msgTimer = setTimeout(() => (msg.textContent = ""), 4000);
}

async function load() {
  const got = await chrome.storage.local.get("settings");
  const s = { ...DEFAULTS, ...(got.settings || {}) };
  $("apiKey").value = s.apiKey;
  $("style").value = s.style;
  $("langMode").value = s.langMode;
  $("diarize").checked = !!s.diarize;
}

async function save() {
  const settings = {
    apiKey: $("apiKey").value.trim(),
    style: $("style").value,
    langMode: $("langMode").value,
    diarize: $("diarize").checked
  };
  await chrome.storage.local.set({ settings });
  say("Saved.", "ok");
}

$("save").addEventListener("click", save);

$("reveal").addEventListener("click", () => {
  const f = $("apiKey");
  f.type = f.type === "password" ? "text" : "password";
});

$("test").addEventListener("click", async () => {
  const key = $("apiKey").value.trim();
  if (!key) return say("Enter a key first.", "err");
  say("Checking…");
  const res = await chrome.runtime.sendMessage({ type: "testKey", key });
  if (res && res.ok) {
    const quota =
      Number.isFinite(res.used) && Number.isFinite(res.limit)
        ? ` · ${res.used.toLocaleString()}/${res.limit.toLocaleString()} credits used`
        : "";
    say(`Key works${res.tier ? ` (${res.tier})` : ""}${quota}`, "ok");
  } else {
    say((res && res.error) || "Could not verify key.", "err");
  }
});

$("clear").addEventListener("click", async () => {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("wvt:tx:"));
  await chrome.storage.local.remove(keys);
  say(`Cleared ${keys.length} cached transcript${keys.length === 1 ? "" : "s"}.`, "ok");
});

// Enter in the key field saves.
$("apiKey").addEventListener("keydown", (e) => {
  if (e.key === "Enter") save();
});

load();
