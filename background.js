/**
 * Service worker: talks to ElevenLabs.
 *
 * The API key never leaves here — the content script only sends audio bytes.
 * Doing the request from the worker also sidesteps web.whatsapp.com's CORS and
 * CSP, which would block a direct call from the page.
 */
"use strict";

const STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const MODEL_ID = "scribe_v2";

function base64ToBlob(base64, mimeType) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "audio/ogg" });
}

async function getApiKey() {
  const got = await chrome.storage.local.get("settings");
  return ((got.settings && got.settings.apiKey) || "").trim();
}

function extensionFor(mimeType) {
  const t = (mimeType || "").toLowerCase();
  if (t.includes("ogg") || t.includes("opus")) return "ogg";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
  if (t.includes("wav")) return "wav";
  if (t.includes("webm")) return "webm";
  return "ogg";
}

async function readError(res) {
  let detail = "";
  try {
    const body = await res.json();
    const d = body && body.detail;
    if (typeof d === "string") detail = d;
    else if (d && d.message) detail = d.message;
    else if (Array.isArray(d) && d.length) detail = d[0].msg || JSON.stringify(d[0]);
    else if (body && body.message) detail = body.message;
  } catch (_) {
    try {
      detail = (await res.text()).slice(0, 200);
    } catch (__) {}
  }

  if (res.status === 401 || res.status === 403) {
    return "ElevenLabs rejected the API key" + (detail ? ` (${detail})` : "") + ".";
  }
  if (res.status === 429) return "Rate limited by ElevenLabs — try again in a moment.";
  if (res.status === 413) return "Voice note is too large for the API.";
  return `ElevenLabs error ${res.status}${detail ? `: ${detail}` : ""}`;
}

async function transcribe(msg) {
  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, error: "No API key set." };

  const blob = base64ToBlob(msg.base64, msg.mimeType);
  if (!blob.size) return { ok: false, error: "Empty audio." };

  const form = new FormData();
  form.append("file", blob, `voice.${extensionFor(msg.mimeType)}`);
  form.append("model_id", MODEL_ID);
  form.append("tag_audio_events", "false");
  if (msg.diarize) form.append("diarize", "true");

  let res;
  try {
    res = await fetch(STT_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form
    });
  } catch (e) {
    return { ok: false, error: `Network error reaching ElevenLabs: ${e.message}` };
  }

  if (!res.ok) return { ok: false, error: await readError(res) };

  const data = await res.json();

  // Single-channel responses carry `text`; multichannel returns `transcripts`.
  let text = data.text || "";
  if (!text && Array.isArray(data.transcripts)) {
    text = data.transcripts.map((t) => t.text || "").join(" ").trim();
  }

  return {
    ok: true,
    text,
    language: data.language_code || "",
    confidence: data.language_probability
  };
}

/**
 * Verify the key against the endpoint the extension actually uses.
 *
 * The obvious check, GET /v1/user/subscription, needs the `user_read` scope. A key
 * scoped only to speech-to-text does not have it, so that check reported "Key
 * rejected" for keys that transcribe perfectly well.
 *
 * Instead: POST to speech-to-text with no file. Authentication is evaluated before
 * the body is validated, so a working key comes back with a validation error while a
 * bad one comes back 401. Nothing is transcribed, so nothing is billed.
 */
async function testKey(key) {
  const apiKey = (key || "").trim();
  if (!apiKey) return { ok: false, error: "No key entered." };

  let res;
  try {
    const probe = new FormData();
    probe.append("model_id", MODEL_ID); // deliberately no file
    res = await fetch(STT_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: probe
    });
  } catch (e) {
    return { ok: false, error: `Network error reaching ElevenLabs: ${e.message}` };
  }

  if (res.status === 401 || res.status === 403) {
    let detail = "";
    try {
      const body = await res.json();
      const d = body && body.detail;
      detail = (d && (d.message || d.status)) || (typeof d === "string" ? d : "");
    } catch (_) {}
    if (/permission/i.test(detail)) {
      return {
        ok: false,
        error: "Key is valid but lacks Speech to Text permission. Enable it on the key in your ElevenLabs dashboard."
      };
    }
    return { ok: false, error: "Key rejected by ElevenLabs." + (detail ? ` (${detail})` : "") };
  }

  if (res.status === 429) {
    return { ok: true, note: "Key works. You are currently rate limited." };
  }

  // Any other status means authentication succeeded; the empty body was rejected,
  // which is exactly what we expect from this probe.
  const info = await quota(apiKey);
  return { ok: true, ...info };
}

/** Quota display is a bonus. A key without `user_read` still works for transcription. */
async function quota(apiKey) {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey }
    });
    if (!res.ok) return {};
    const data = await res.json();
    return {
      tier: data.tier || "",
      used: data.character_count,
      limit: data.character_limit
    };
  } catch (_) {
    return {};
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "transcribe") {
    transcribe(msg)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }

  if (msg.type === "testKey") {
    testKey(msg.key)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
});
