/**
 * Script router.
 *
 * Each romanizer module registers itself on window.WVT_SCRIPTS as
 * { id, languages, ranges: [[lo, hi], …], romanize(word) -> string }.
 *
 * This walks the text, groups consecutive characters by which module claims their
 * codepoint, and hands each run to that module. Latin (and anything unclaimed)
 * passes through untouched, which is what makes code-switched speech read well:
 * Scribe returns English in Latin already, so only the non-Latin runs get converted.
 *
 * Exposes window.WVT_translit(text) — the single entry point content.js calls.
 */
(() => {
  "use strict";

  /** Codepoint -> module, memoised per lookup burst. */
  const cache = new Map();
  let known = -1;

  function moduleFor(cp) {
    const mods = window.WVT_SCRIPTS || [];
    // Modules can register after the first lookup (lazy loading), which would
    // otherwise leave a cached miss shadowing a module that now exists.
    if (mods.length !== known) {
      known = mods.length;
      cache.clear();
    }
    if (cache.has(cp)) return cache.get(cp);
    let found = null;
    for (const m of mods) {
      if (!m || !m.ranges || typeof m.romanize !== "function") continue;
      for (const r of m.ranges) {
        if (cp >= r[0] && cp <= r[1]) {
          found = m;
          break;
        }
      }
      if (found) break;
    }
    // Registration is append-only at load time, so caching a miss is safe once
    // the content scripts have all run. Keep it bounded anyway.
    if (cache.size > 20000) cache.clear();
    cache.set(cp, found);
    return found;
  }

  function translit(text) {
    if (!text) return "";

    let src;
    try {
      src = text.normalize("NFC");
    } catch (_) {
      src = text;
    }

    let out = "";
    let buf = "";
    let current = null;

    const flush = () => {
      if (!buf) {
        current = null;
        return;
      }
      try {
        const done = current.romanize(buf);
        // A string — including "" — is a legitimate answer: some runs are nothing
        // but silent marks. Only fall back to the original when a module breaks
        // its contract, otherwise those codepoints leak back into ASCII output.
        out += typeof done === "string" ? done : buf;
      } catch (_) {
        out += buf;
      }
      buf = "";
      current = null;
    };

    for (const ch of src) {
      const mod = moduleFor(ch.codePointAt(0));
      if (mod) {
        if (current && mod !== current) flush();
        current = mod;
        buf += ch;
      } else {
        if (current) flush();
        out += ch;
      }
    }
    flush();

    return tidy(out);
  }

  /**
   * Syllable-spaced scripts (Pinyin) and punctuation modules that emit a trailing
   * space leave artefacts like "ni hao , wo shi". Clean those up without touching
   * line structure.
   */
  function tidy(s) {
    return s
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([,.!?;:])/g, "$1")
      .replace(/[ \t]+$/gm, "");
  }

  /** Debug/settings helper: what's actually loaded. */
  function scriptsInfo() {
    return (window.WVT_SCRIPTS || []).map((m) => ({
      id: m.id,
      languages: m.languages || [],
      ranges: (m.ranges || []).map((r) => r.map((n) => n.toString(16).toUpperCase()).join("-"))
    }));
  }

  window.WVT_translit = translit;
  window.WVT_scriptsInfo = scriptsInfo;
})();
