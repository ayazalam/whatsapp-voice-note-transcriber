/**
 * Cyrillic -> Roman transliteration (U+0400-U+04FF, U+0500-U+052F).
 *
 * BGN/PCGN-flavoured common usage, ASCII only: zh, kh, ts, ch, sh, shch, yu,
 * ya, yo. Hard and soft signs vanish rather than becoming apostrophes, because
 * "Tatyana" reads and "Tat'yana" does not.
 *
 * A word is romanised in one of two modes, picked from the letters it actually
 * contains, because the same code point says different things in different
 * languages:
 *
 *   h-mode   triggered by i/yi/ye/ghe-upturn/short-u (i i e g w) -> the word is
 *            Ukrainian, Belarusian or Rusyn, so g becomes "h" and и becomes "y"
 *            (Kyiv, Kharkiv, Lviv). Suppressed when Kazakh/Tajik/Bashkir
 *            letters are present, since those alphabets also use і but keep g.
 *   default  Russian/Bulgarian/Serbian/Macedonian/Kazakh/Mongolian.
 *
 * Two more judgement calls that matter more than they look:
 *   - е is spelled "ye" at the start of a word and after a vowel or a hard/soft
 *     sign (Yeltsin, Dostoyevsky, obyekt) and plain "e" after a consonant.
 *   - ъ drops before е ё ю я и (the Russian job) but becomes "a" elsewhere,
 *     which is the Bulgarian vowel: Balgariya, not Blgariya. In a word carrying
 *     Kazakh/Tajik/Bashkir letters it always drops, because there it is a
 *     glottal stop: Ҷумъа -> Juma.
 *
 * Exposes the standard module shape: { id, languages, ranges, romanize }.
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0400, 0x04ff], [0x0500, 0x052f]];

  /**
   * Every assigned letter in both blocks, keyed by its lowercase form; the
   * caser below restores capitals, so uppercase keys are only needed for the
   * handful of code points that carry no case mapping.
   */
  const BASE = {
    // U+0430-U+044F -- the core Russian / Bulgarian / Serbian alphabet
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l",
    "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s",
    "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch",
    "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e",
    "ю": "yu", "я": "ya",

    // U+0450-U+045F -- Ukrainian, Serbian, Macedonian, Belarusian
    "ѐ": "e", "ё": "yo", "ђ": "dj", "ѓ": "gj", "є": "ye", "ѕ": "dz",
    "і": "i", "ї": "yi", "ј": "j", "љ": "lj", "њ": "nj", "ћ": "c",
    "ќ": "kj", "ѝ": "i", "ў": "w", "џ": "dz",

    // U+0460-U+0481 -- Church Slavonic / historic orthography
    "ѡ": "o", "ѣ": "e", "ѥ": "ye", "ѧ": "ya", "ѩ": "ya", "ѫ": "u",
    "ѭ": "yu", "ѯ": "ks", "ѱ": "ps", "ѳ": "f", "ѵ": "i", "ѷ": "i",
    "ѹ": "u", "ѻ": "o", "ѽ": "o", "ѿ": "ot", "ҁ": "k",
    "҂": "", // thousands sign

    // U+048A-U+04CF -- minority-language extensions
    "ҋ": "y", "ҍ": "", "ҏ": "r", "ґ": "g", "ғ": "gh", "ҕ": "g",
    "җ": "zh", "ҙ": "z", "қ": "q", "ҝ": "k", "ҟ": "k", "ҡ": "k",
    "ң": "ng", "ҥ": "ng", "ҧ": "p", "ҩ": "h", "ҫ": "s", "ҭ": "t",
    "ү": "u", "ұ": "u", "ҳ": "h", "ҵ": "ts", "ҷ": "j", "ҹ": "j",
    "һ": "h", "ҽ": "ch", "ҿ": "ch",
    "ӏ": "", "Ӏ": "", // palochka, both cases
    "ӂ": "j", "ӄ": "k", "ӆ": "l", "ӈ": "ng", "ӊ": "n", "ӌ": "ch",
    "ӎ": "m",

    // U+04D0-U+04FF -- Turkic, Uralic, Caucasian vowels and consonants
    "ӑ": "a", "ӓ": "a", "ӕ": "ae", "ӗ": "e", "ә": "a", "ӛ": "a",
    "ӝ": "zh", "ӟ": "z", "ӡ": "dz", "ӣ": "i", "ӥ": "i", "ӧ": "o",
    "ө": "o", "ӫ": "o", "ӭ": "e", "ӯ": "u", "ӱ": "u", "ӳ": "u",
    "ӵ": "ch", "ӷ": "g", "ӹ": "y", "ӻ": "g", "ӽ": "h", "ӿ": "h",

    // U+0500-U+052F -- Cyrillic Supplement (Komi, Khanty, Aleut, Kurdish)
    "ԁ": "d", "ԃ": "d", "ԅ": "zh", "ԇ": "dz", "ԉ": "l", "ԋ": "n",
    "ԍ": "sh", "ԏ": "ch", "ԑ": "e", "ԓ": "l", "ԕ": "lh", "ԗ": "rh",
    "ԙ": "ya", "ԛ": "q", "ԝ": "w", "ԟ": "k", "ԡ": "l", "ԣ": "n",
    "ԥ": "p", "ԧ": "h", "ԩ": "n", "ԫ": "dzh", "ԭ": "dch", "ԯ": "l"
  };

  const HARD = "ъ";

  // Letters after which е is spelled "ye" (all vowels, plus the two signs and
  // short i, which is exactly the BGN/PCGN condition).
  const YE_AFTER = new Set(
    ("аеёиоуыэюяіїєѐѝѣѡѫѭѧѩѹәөұүӑӓӕӗӛӣӥӧӫӭӯӱӳӹъьйў").split("")
  );

  // ъ is a silent separator in Russian only before these; anywhere else it is
  // the Bulgarian vowel.
  const HARD_SILENT_BEFORE = new Set(("еёюяиєѣ").split(""));

  // Letters that make a word Ukrainian / Belarusian / Rusyn.
  const H_MARKERS = new Set(("іїєґў").split(""));

  // ...unless one of these is present, which means Kazakh, Tajik, Bashkir,
  // Tatar or another alphabet that borrows і but keeps a hard g.
  const G_MARKERS = new Set(("әғқңөұүһҳҷӣӯҙҫҡӑӗӛӯғ").split(""));

  // The subset of the above that Mongolian does NOT share (Mongolian Cyrillic is
  // the Russian alphabet plus ө and ү, nothing else). A word carrying one of
  // these is Kazakh/Tajik/Bashkir/Tatar/Uzbek, where BGN/PCGN spells е plainly
  // "e" and ъ is a glottal stop rather than the Bulgarian vowel:
  // Әуезов -> Auezov, Ҷумъа -> Juma.
  const TURKIC_MARKERS = new Set(("әғқңұһҳҷӣӯҙҫҡ").split(""));

  const isCombining = (code) =>
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x0483 && code <= 0x0489) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20f0) ||
    (code >= 0x2de0 && code <= 0x2dff) ||
    (code >= 0xa66f && code <= 0xa672);

  function normalize(word) {
    try {
      return word.normalize("NFC");
    } catch (_) {
      return word;
    }
  }

  /**
   * Split a word into letter records: { raw, ch, up, cased }.
   * ch is the lowercase form used for lookup; combining marks are discarded
   * (NFC has already folded the ones that form real letters, such as и + breve
   * -> й), so nothing downstream has to think about them.
   */
  function letters(word) {
    const out = [];
    for (const raw of normalize(word)) {
      const code = raw.codePointAt(0);
      if (isCombining(code)) continue;
      const lower = raw.toLowerCase();
      out.push({
        raw,
        ch: lower,
        up: lower !== raw,
        cased: raw.toLowerCase() !== raw.toUpperCase()
      });
    }
    return out;
  }

  /** True when the word is written in capitals and should stay that way. */
  function isAllCaps(items) {
    let cased = 0;
    for (const it of items) {
      if (!it.cased) continue;
      if (!it.up) return false;
      cased += 1;
    }
    return cased >= 2;
  }

  /** Latin for one letter, given its neighbours and the mode of the word. */
  function mapLetter(items, i, hMode, turkic) {
    const ch = items[i].ch;
    const next = i + 1 < items.length ? items[i + 1].ch : "";
    const prev = i > 0 ? items[i - 1].ch : "";

    if (ch === HARD) {
      // In the Turkic/Iranian alphabets ъ is a glottal stop, never a vowel.
      if (turkic) return "";
      if (!next || HARD_SILENT_BEFORE.has(next)) return "";
      return "a"; // Bulgarian: въпрос -> vapros
    }
    if (ch === "г") return hMode ? "h" : "g";
    if (ch === "и") return hMode ? "y" : "i";
    if (ch === "е") {
      if (hMode) return "e"; // Ukrainian spells the y-glide with є
      if (turkic) return "e"; // Kazakh/Tajik е has no y-glide in BGN/PCGN
      return i === 0 || YE_AFTER.has(prev) ? "ye" : "e";
    }
    if (ch === "ї") return i === 0 ? "yi" : "i"; // Київ -> Kyiv
    if (ch === "є") return i === 0 ? "ye" : "ie";

    const latin = BASE[ch];
    if (typeof latin === "string") return latin;

    // Unassigned code point inside the block: drop it rather than leak it.
    const code = items[i].raw.codePointAt(0);
    if ((code >= 0x0400 && code <= 0x04ff) || (code >= 0x0500 && code <= 0x052f)) return "";
    // Anything else only reaches us by accident; keep it if it is already ASCII.
    return code < 0x80 ? items[i].raw : "";
  }

  /**
   * Endings people never actually type in full: -ый/-ий collapse to -y.
   * The -иy half is Russian/Bulgarian only -- Ukrainian -ій wants to stay "iy"
   * (Serhiy, Andriy). The doubled y, however, is wrong in every language:
   * h-mode turns -ський into "skyy", which no standard spells that way, so that
   * half runs in both modes (Львівський -> Lvivsky).
   */
  function tidy(out, hMode) {
    if (out.length < 4) return out;
    out = out.replace(/([Yy])[Yy]$/, "$1"); // novyy -> novy, Lvivskyy -> Lvivsky
    if (hMode) return out;
    out = out.replace(/[Ii]([Yy])$/, (m, y) => (y === "Y" ? "Y" : "y")); // Dmitriy -> Dmitry
    return out;
  }

  // romanize(word) receives ONE maximal run of consecutive characters from these
  // ranges (whitespace and punctuation already split them, so this is a word).
  function romanize(word) {
    if (!word) return "";
    const items = letters(word);
    if (!items.length) return "";

    const lowered = items.map((it) => it.ch);
    let hMode = false;
    let gMode = false;
    let turkic = false;
    for (const ch of lowered) {
      if (H_MARKERS.has(ch)) hMode = true;
      if (G_MARKERS.has(ch)) gMode = true;
      if (TURKIC_MARKERS.has(ch)) turkic = true;
    }
    if (gMode) hMode = false;

    const allCaps = isAllCaps(items);
    let out = "";
    // A capital that maps to nothing (palochka, a leading hard sign) hands its
    // capitalisation to the next letter that does produce something.
    let pendingCap = false;
    for (let i = 0; i < items.length; i++) {
      let piece = mapLetter(items, i, hMode, turkic);
      if (!piece) {
        if (items[i].up) pendingCap = true;
        continue;
      }
      if (allCaps) piece = piece.toUpperCase();
      else if (items[i].up || pendingCap) piece = piece.charAt(0).toUpperCase() + piece.slice(1);
      pendingCap = false;
      out += piece;
    }
    return tidy(out, hMode);
  }

  const mod = {
    id: "cyrillic",
    languages: [
      "Russian", "Ukrainian", "Bulgarian", "Serbian", "Macedonian",
      "Belarusian", "Kazakh", "Kyrgyz", "Mongolian", "Tajik"
    ],
    ranges,
    romanize
  };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
