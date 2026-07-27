/**
 * Greek -> Roman transliteration (U+0370-U+03FF, U+1F00-U+1FFF polytonic).
 *
 * Modern practical romanisation, ASCII only: th, f, ch, ps, x, v, and no
 * macrons, breathings or tonos anywhere in the output.
 *
 * Accents are stripped by decomposing to NFD and dropping the combining marks,
 * which handles the whole polytonic block (all 250-odd precomposed forms) for
 * free. The marks are not thrown away blindly though -- Greek orthography uses
 * them to *break* digraphs, so they are remembered per letter:
 *
 *   - a diaeresis on the second vowel splits the pair: proteini, proypothesi
 *     (not "protini", "prouposethi")
 *   - an accent on the first vowel splits it too: aypnos, not "afpnos"
 *
 * Digraphs: ou, ai, ei, oi, yi; av/af and ev/ef and iv/if depending on whether
 * what follows is voiced; ng, gk, nch, nx; μπ and ντ are "b"/"d" at the start
 * of a word and plain "mp"/"nt" inside it, which is what ELOT 743 and every
 * established spelling do: Santorini, Olympia, Konstantinos, pente.
 *
 * Exposes the standard module shape: { id, languages, ranges, romanize }.
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0370, 0x03ff], [0x1f00, 0x1fff]];

  /**
   * Every base letter, keyed by lowercase. Everything in Greek Extended
   * decomposes into one of these plus combining marks, so this table plus NFD
   * covers both blocks. Code points that are easy to confuse by eye are written
   * as escapes.
   */
  const BASE = {
    // U+03B1-U+03C9 -- the alphabet
    "α": "a",   // alpha
    "β": "v",   // beta
    "γ": "g",   // gamma
    "δ": "d",   // delta
    "ε": "e",   // epsilon
    "ζ": "z",   // zeta
    "η": "i",   // eta
    "θ": "th",  // theta
    "ι": "i",   // iota
    "κ": "k",   // kappa
    "λ": "l",   // lambda
    "μ": "m",   // mu
    "ν": "n",   // nu
    "ξ": "x",   // xi
    "ο": "o",   // omicron
    "π": "p",   // pi
    "ρ": "r",   // rho
    "ς": "s",   // final sigma
    "σ": "s",   // sigma
    "τ": "t",   // tau
    "υ": "y",   // upsilon
    "φ": "f",   // phi
    "χ": "ch",  // chi
    "ψ": "ps",  // psi
    "ω": "o",   // omega

    // variant glyphs used in maths and older typesetting
    "ϐ": "v",   // beta symbol
    "ϑ": "th",  // theta symbol
    "ϒ": "y",   // upsilon with hook
    "ϕ": "f",   // phi symbol
    "ϖ": "p",   // pi symbol
    "ϰ": "k",   // kappa symbol
    "ϱ": "r",   // rho symbol
    "ϲ": "s",   // lunate sigma
    "Ϲ": "s",   // capital lunate sigma
    "ϴ": "th",  // capital theta symbol
    "ϵ": "e",   // lunate epsilon
    "϶": "e",   // reversed lunate epsilon
    "ϳ": "j",   // yot
    "Ϳ": "j",   // capital yot

    // archaic letters and numerals
    "ͱ": "h",  "Ͱ": "h",   // heta
    "ͳ": "ss", "Ͳ": "ss",  // archaic sampi
    "ͷ": "w",  "Ͷ": "w",   // pamphylian digamma
    "ϗ": "kai", "Ϗ": "kai", // kai symbol
    "ϙ": "k",  "Ϙ": "k",   // archaic koppa
    "ϛ": "st", "Ϛ": "st",  // stigma
    "ϝ": "w",  "Ϝ": "w",   // digamma
    "ϟ": "k",  "Ϟ": "k",   // koppa
    "ϡ": "ss", "Ϡ": "ss",  // sampi
    "ϸ": "sh", "Ϸ": "sh",  // sho
    "ϻ": "s",  "Ϻ": "s",   // san
    "ϼ": "r",                   // rho with stroke
    "ͻ": "s",  "Ͻ": "s",   // reversed lunate sigma
    "ͼ": "s",  "Ͼ": "s",   // dotted lunate sigma
    "ͽ": "s",  "Ͽ": "s",   // reversed dotted lunate sigma

    // Coptic letters that still live in the Greek block
    "ϣ": "sh", "Ϣ": "sh",  // shei
    "ϥ": "f",  "Ϥ": "f",   // fei
    "ϧ": "kh", "Ϧ": "kh",  // khei
    "ϩ": "h",  "Ϩ": "h",   // hori
    "ϫ": "g",  "Ϫ": "g",   // gangia
    "ϭ": "ch", "Ϭ": "ch",  // shima
    "ϯ": "ti", "Ϯ": "ti",  // dei

    // NFD folds the two Greek punctuation marks onto code points outside the
    // block, so the decomposed forms need entries of their own or they fall
    // through to the passthrough at the bottom of single().
    ";": "?",       // U+037E greek question mark -> ASCII semicolon
    "·": ";",  // U+0387 ano teleia -> U+00B7 middle dot

    // punctuation and spacing marks that live inside the blocks
    "ʹ": "",   // numeral sign
    "͵": "",   // lower numeral sign
    "ͺ": "",   // spacing ypogegrammeni
    "΄": "",   // tonos
    "΅": "",   // dialytika tonos
    ";": "?",  // greek question mark (drawn like ';', means '?')
    "·": ";",  // ano teleia
    "᾽": "",   // koronis
    "ι": "i",  // prosgegrammeni
    "᾿": "",   // psili
    "῀": "",   // perispomeni
    "῁": "",   // dialytika and perispomeni
    "´": "",   // oxia
    "῾": "",   // dasia

    // leftovers NFD can expose from Greek Extended
    "¨": "",   // diaeresis
    "´": "",   // acute accent
    "`": ""    // grave accent
  };

  const DIAERESIS = "̈";
  const ACCENTS = new Set([
    "̀", // varia / grave
    "́", // tonos / oxia / acute
    "͂", // perispomeni
    "̀", // legacy grave
    "́", // legacy acute
    "̍"  // vertical line above
  ]);

  // ευ/αυ/ηυ are voiced before a vowel or a voiced consonant, unvoiced before
  // anything else (including the end of the word).
  const VOICED_NEXT = new Set([
    "α", "ε", "η", "ι", "ο", "υ", "ω", // vowels
    "β", "γ", "δ", "ζ", "λ", "μ", "ν", "ρ"
  ]);

  const A = "α", E = "ε", H = "η", I = "ι";
  const O = "ο", U = "υ";
  const G = "γ", K = "κ", X = "ξ", CH = "χ";
  const M = "μ", N = "ν", P = "π", T = "τ";

  const isCombining = (code) =>
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20f0);

  function decompose(word) {
    try {
      return word.normalize("NFD");
    } catch (_) {
      return word;
    }
  }

  /**
   * Split a word into letter records: { raw, ch, up, cased, accented, diaeresis }
   * with the combining marks folded into flags on the letter they belong to.
   */
  function letters(word) {
    const out = [];
    for (const raw of decompose(word)) {
      const code = raw.codePointAt(0);
      if (isCombining(code)) {
        const last = out[out.length - 1];
        if (!last) continue;
        if (raw === DIAERESIS) last.diaeresis = true;
        else if (ACCENTS.has(raw)) last.accented = true;
        continue;
      }
      const lower = raw.toLowerCase();
      out.push({
        raw,
        ch: lower,
        up: lower !== raw,
        cased: raw.toLowerCase() !== raw.toUpperCase(),
        accented: false,
        diaeresis: false
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

  function voicedAfter(items, j) {
    if (j >= items.length) return false;
    return VOICED_NEXT.has(items[j].ch);
  }

  /** Latin for the two-letter cluster starting at i, or null if there is none. */
  function digraph(items, i) {
    const a = items[i];
    const b = items[i + 1];
    if (!b) return null;
    const x = a.ch;
    const y = b.ch;

    // consonant clusters -- accents never sit on these, so no break check
    if (x === G) {
      if (y === G) return "ng";   // angelos
      if (y === K) return "gk";
      if (y === CH) return "nch"; // anchos
      if (y === X) return "nx";
    }
    // μπ/ντ are "b"/"d" only at the start of a word (Μπύρα -> Byra, Ντίνα ->
    // Dina). Inside a word ELOT 743 keeps the letters apart -- "mp"/"nt" -- and
    // that is what every established spelling uses: Santorini, Olympia,
    // Konstantinos, pente. Returning null here lets them fall through to the
    // single-letter table, which is exactly m+p and n+t.
    if (x === M && y === P) return i === 0 ? "b" : null;
    if (x === N && y === T) return i === 0 ? "d" : null;

    // vowel pairs -- an accent on the first vowel or a diaeresis on the second
    // means these are two separate sounds, not a digraph
    if (a.accented || b.diaeresis) return null;

    if (y === I) {
      if (x === A) return "ai";
      if (x === E) return "ei";
      if (x === O) return "oi";
      if (x === U) return "yi";
    }
    if (y === U) {
      if (x === O) return "ou";
      const voiced = voicedAfter(items, i + 2);
      if (x === A) return voiced ? "av" : "af";
      if (x === E) return voiced ? "ev" : "ef";
      if (x === H) return voiced ? "iv" : "if";
    }
    return null;
  }

  function single(item) {
    const latin = BASE[item.ch];
    if (typeof latin === "string") return latin;
    const code = item.raw.codePointAt(0);
    // Unassigned code point inside the block: drop it rather than leak it.
    if ((code >= 0x0370 && code <= 0x03ff) || (code >= 0x1f00 && code <= 0x1fff)) return "";
    // Anything else only reaches us by accident; keep it if it is already ASCII.
    return code < 0x80 ? item.raw : "";
  }

  // romanize(word) receives ONE maximal run of consecutive characters from these
  // ranges (whitespace and punctuation already split them, so this is a word).
  function romanize(word) {
    if (!word) return "";
    const items = letters(word);
    if (!items.length) return "";

    const allCaps = isAllCaps(items);
    let out = "";
    // A capital that maps to nothing (a spacing breathing mark) hands its
    // capitalisation to the next letter that does produce something.
    let pendingCap = false;
    let i = 0;
    while (i < items.length) {
      const pair = digraph(items, i);
      const step = pair === null ? 1 : 2;
      let piece = pair === null ? single(items[i]) : pair;
      if (piece) {
        if (allCaps) piece = piece.toUpperCase();
        else if (items[i].up || pendingCap) piece = piece.charAt(0).toUpperCase() + piece.slice(1);
        pendingCap = false;
        out += piece;
      } else if (items[i].up) {
        pendingCap = true;
      }
      i += step;
    }
    return out;
  }

  const mod = { id: "greek", languages: ["Greek"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
