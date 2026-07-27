/**
 * Lao -> Roman.
 *
 * Structurally the same problem as Thai — leading vowels ເ ແ ໂ ໃ ໄ are typed
 * before the consonant but spoken after it, so the syllable reader has to
 * reorder — but the orthography is much kinder: Lao spells vowels out instead
 * of leaving them implicit, and finals are a short, regular list.
 *
 * Spellings follow the way Lao names are actually written in Latin
 * (Vientiane, Luang Prabang, sabaidi): kh/th/ph for the aspirates, ny for ຍ,
 * v for ວ at the start of a syllable and -o for it at the end. Tone marks are
 * dropped.
 *
 * Lao does write spaces between phrases, so word segmentation is far less of a
 * problem here than in Thai; a dictionary still supplies the handful of very
 * common words whose conventional spelling is not the mechanical one.
 */
(() => {
  "use strict";

  const ranges = [[0x0e80, 0x0eff]];

  // [initial sound, final sound]; "" as a final means silent there.
  const CONS = {
    "ກ": ["k", "k"],
    "ຂ": ["kh", "k"],
    "ຄ": ["kh", "k"],
    "ຆ": ["kh", "k"],
    "ງ": ["ng", "ng"],
    "ຈ": ["ch", "t"],
    "ຉ": ["ch", "t"],
    "ຊ": ["s", "t"],
    "ຌ": ["s", "t"],
    "ຍ": ["ny", "i"],
    "ຎ": ["ny", "n"],
    "ຏ": ["d", "t"],
    "ຐ": ["th", "t"],
    "ຑ": ["th", "t"],
    "ຒ": ["th", "t"],
    "ຓ": ["n", "n"],
    "ດ": ["d", "t"],
    "ຕ": ["t", "t"],
    "ຖ": ["th", "t"],
    "ທ": ["th", "t"],
    "ຘ": ["th", "t"],
    "ນ": ["n", "n"],
    "ບ": ["b", "p"],
    "ປ": ["p", "p"],
    "ຜ": ["ph", "t"],
    "ຝ": ["f", "t"],
    "ພ": ["ph", "p"],
    "ຟ": ["f", "p"],
    "ຠ": ["ph", "p"],
    "ມ": ["m", "m"],
    "ຢ": ["y", "i"],
    "ຣ": ["r", "n"],
    "ລ": ["l", "n"],
    "ວ": ["v", "o"],
    "ຨ": ["s", "t"],
    "ຩ": ["s", "t"],
    "ສ": ["s", "t"],
    "ຫ": ["h", ""],
    "ຬ": ["l", "n"],
    "ອ": ["", ""],     // carrier: the vowel stands alone
    "ຮ": ["h", ""],
    "ໜ": ["n", "n"],   // precomposed ຫ+ນ
    "ໝ": ["m", "m"],   // precomposed ຫ+ມ
    "ໞ": ["ng", "ng"],
    "ໟ": ["ny", "n"]
  };

  // ຫ + one of these is a silent h carrying only the tone class.
  const SILENT_H = "ງຍນມລວຣ";
  // Second element of a real initial cluster.
  const CLUSTER2 = "ວລຣ";

  const LEAD = { "ເ": 1, "ແ": 1, "ໂ": 1, "ໃ": 1, "ໄ": 1 };

  const VOWEL_SIGNS = "ະັາຳິີຶືຸູົຽໍ";
  const TONES = "່້໊໋";
  const CANCEL = "໌";      // silences the letter it sits on
  const SUB_LO = "ຼ";      // subscript lo, an l inside a cluster
  const VIRAMA = "຺";
  const REPEAT = "ໆ";

  const DIGITS = {
    "໐": "0", "໑": "1", "໒": "2", "໓": "3", "໔": "4",
    "໕": "5", "໖": "6", "໗": "7", "໘": "8", "໙": "9"
  };

  const PUNCT = { "ຯ": "." };   // ellipsis / abbreviation mark

  const inBlock = (ch) => { const c = ch.charCodeAt(0); return c >= 0x0e80 && c <= 0x0eff; };
  const isCons = (ch) => ch !== undefined && CONS[ch] !== undefined;
  const isVowelSign = (ch) => ch !== undefined && VOWEL_SIGNS.indexOf(ch) !== -1;
  const isTone = (ch) => ch !== undefined && TONES.indexOf(ch) !== -1;
  const isLead = (ch) => ch !== undefined && LEAD[ch] === 1;

  /** True for marks that bind to the letter before them. */
  const attaches = (ch) =>
    ch !== undefined &&
    (isVowelSign(ch) || isTone(ch) || ch === CANCEL || ch === SUB_LO || ch === VIRAMA);

  function skipTones(w, i) {
    while (i < w.length && (isTone(w[i]) || w[i] === VIRAMA)) i += 1;
    return i;
  }

  /** Initial consonant or cluster at i -> { c, i }. */
  function readInitial(w, i) {
    const ch = w[i];
    if (!isCons(ch)) return null;
    let c = CONS[ch][0];
    let j = i + 1;

    if (w[j] === CANCEL) return { c: "", i: j + 1 };

    if (w[j] === SUB_LO) {
      // ຫຼ is the silent-h spelling of plain "l" (ຫຼາຍ lai, ຕະຫຼາດ talat);
      // after any other consonant ຼ is the second half of a cluster (ຄຼ, ປຼ).
      c = ch === "ຫ" ? "l" : c + "l";
      j += 1;
    } else if (ch === "ຫ" && w[j] !== undefined && SILENT_H.indexOf(w[j]) !== -1) {
      const after = skipTones(w, j + 1);
      if (after >= w.length || isVowelSign(w[after]) || isCons(w[after]) || isLead(w[after])) {
        c = CONS[w[j]][0];
        j += 1;
      }
    } else if (
      w[j] !== undefined &&
      CLUSTER2.indexOf(w[j]) !== -1 &&
      isVowelSign(w[skipTones(w, j + 1)])
    ) {
      c += w[j] === "ວ" ? "w" : "l";
      j += 1;
    }

    return { c, i: skipTones(w, j) };
  }

  /** One syllable at i -> { text, i } or null. */
  function readSyllable(w, i) {
    const start = i;
    let lead = "";
    if (isLead(w[i])) {
      lead = w[i];
      i += 1;
    }

    const init = readInitial(w, i);
    if (!init) {
      if (lead) {
        return { text: lead === "ແ" ? "ae" : lead === "ໂ" ? "o" : lead === "ເ" ? "e" : "ai", i };
      }
      return null;
    }
    const c = init.c;
    i = init.i;

    let v = "";
    let allowFinal = true;
    const a = w[i];
    const bi = skipTones(w, i + 1);
    const b = w[bi];

    if (lead === "ເ") {
      if (a === "ຽ") { v = "ia"; i += 1; }
      else if (a === "ຍ" && !isVowelSign(b)) { v = "ia"; i += 1; allowFinal = false; }
      else if ((a === "ຶ" || a === "ື") && b === "ອ") { v = "uea"; i = bi + 1; }
      else if (a === "ິ" || a === "ີ") { v = "oe"; i += 1; }
      else if (a === "ົ" && b === "າ") { v = "ao"; i = bi + 1; allowFinal = false; }
      else if (a === "າ" && b === "ະ") { v = "o"; i = bi + 1; allowFinal = false; }
      else if (a === "າ") { v = "ao"; i += 1; allowFinal = false; }
      else if (a === "ະ") { v = "e"; i += 1; allowFinal = false; }
      else if (a === "ັ") { v = "e"; i += 1; }
      else v = "e";
    } else if (lead === "ແ") {
      if (a === "ະ") { v = "ae"; i += 1; allowFinal = false; }
      else { v = "ae"; if (a === "ັ") i += 1; }
    } else if (lead === "ໂ") {
      if (a === "ະ") { v = "o"; i += 1; allowFinal = false; }
      else { v = "o"; if (a === "ັ") i += 1; }
    } else if (lead === "ໃ" || lead === "ໄ") {
      v = "ai";
      allowFinal = false;
    } else if (a === "ົ") {
      if (b === "ວ") { v = "ua"; i = bi + 1; }
      else { v = "o"; i += 1; }
    } else if (a === "ັ") {
      if (b === "ວ") { v = "ua"; i = bi + 1; }
      else { v = "a"; i += 1; }
    } else if (a === "ະ") { v = "a"; i += 1; allowFinal = false; }
    else if (a === "າ") { v = "a"; i += 1; }
    else if (a === "ຳ") { v = "am"; i += 1; allowFinal = false; }
    else if (a === "ໍ") {
      // ໍ + າ is the decomposed spelling of ຳ
      if (b === "າ") { v = "am"; i = bi + 1; allowFinal = false; }
      else { v = "o"; i += 1; }
    } else if (a === "ິ" || a === "ີ") { v = "i"; i += 1; }
    else if (a === "ຶ" || a === "ື") {
      v = "ue";
      i += 1;
      if (w[skipTones(w, i)] === "ອ") { v = "uea"; i = skipTones(w, i) + 1; }
    } else if (a === "ຸ" || a === "ູ") { v = "u"; i += 1; }
    else if (a === "ຽ") { v = "ia"; i += 1; }
    else if (a === "ອ" && !isVowelSign(b) && !isLead(b)) { v = "o"; i += 1; }
    else if (a === "ວ" && isCons(b) && !isVowelSign(w[skipTones(w, bi + 1)])) { v = "ua"; i += 1; }
    else {
      // No written vowel: either a closed syllable with short "o" or the first
      // half of a two-syllable word with an unwritten "a".
      const cand = w[i];
      if (isCons(cand)) {
        const k = skipTones(w, i + 1);
        const nxt = w[k];
        if (nxt !== undefined && (isVowelSign(nxt) || nxt === CANCEL || nxt === SUB_LO)) {
          v = "a";
          allowFinal = false;
        } else {
          v = "o";
        }
      } else {
        v = "o";
        allowFinal = false;
      }
    }

    i = skipTones(w, i);

    let fin = "";
    if (allowFinal && isCons(w[i])) {
      const k = skipTones(w, i + 1);
      const nxt = w[k];
      if (nxt === CANCEL) {
        i = k + 1;
      } else if (nxt === undefined || !isVowelSign(nxt)) {
        fin = CONS[w[i]][1];
        i = skipTones(w, i + 1);
        if ((fin === "i" || fin === "o") && v.charAt(v.length - 1) === fin) fin = "";
      }
    }

    if (i === start) return null;
    return { text: c + v + fin, i };
  }

  const DICT = {
    "ລາວ": "lao", "ສະບາຍດີ": "sabaidi", "ຂອບໃຈ": "khopchai", "ຂໍໂທດ": "khothot",
    "ຂ້ອຍ": "khoi", "ເຈົ້າ": "chao", "ເຮົາ": "hao", "ພວກເຮົາ": "phuakhao",
    "ບໍ່": "bo", "ແມ່ນ": "maen", "ໄດ້": "dai", "ມີ": "mi", "ເປັນ": "pen",
    "ຢູ່": "yu", "ໄປ": "pai", "ມາ": "ma", "ກິນ": "kin", "ເຮັດ": "het",
    "ຫຍັງ": "nyang", "ຫຼາຍ": "lai", "ໜ້ອຍ": "noi", "ດີ": "di", "ງາມ": "ngam",
    "ຄົນ": "khon", "ບ້ານ": "ban", "ນ້ຳ": "nam", "ອາຫານ": "ahan", "ເຂົ້າ": "khao",
    "ວຽງຈັນ": "viangchan", "ຫຼວງພະບາງ": "luang phabang", "ພາສາ": "phasa",
    "ພາສາລາວ": "phasa lao", "ປະເທດ": "pathet", "ໄທ": "thai", "ເງິນ": "ngoen",
    "ວັນນີ້": "wanni", "ມື້ນີ້": "muni", "ແລ້ວ": "laeo", "ຍັງ": "nyang",
    "ແລະ": "lae", "ຫຼື": "lue", "ແຕ່": "tae", "ຖ້າ": "tha", "ທີ່": "thi",
    "ຂອງ": "khong", "ກັບ": "kap", "ໃຫ້": "hai", "ຈາກ": "chak", "ໃນ": "nai",
    "ໜຶ່ງ": "nueng", "ສອງ": "song", "ສາມ": "sam", "ສີ່": "si", "ຫ້າ": "ha",
    "ຫົກ": "hok", "ເຈັດ": "chet", "ແປດ": "paet", "ເກົ້າ": "kao", "ສິບ": "sip",
    "ຮ້ອຍ": "hoi", "ພັນ": "phan", "ລ້ານ": "lan", "ສະບາຍດີບໍ່": "sabaidi bo",
    // Provinces and landmarks, whose Latin spelling is fixed by usage.
    "ຫຼວງນ້ຳທາ": "luang namtha", "ສະຫວັນນະເຂດ": "savannakhet",
    "ຈຳປາສັກ": "champasak", "ຄຳມ່ວນ": "khammuan", "ອຸດົມໄຊ": "oudomxai",
    "ບໍລິຄຳໄຊ": "borikhamxai", "ຊຽງຂວາງ": "xiangkhouang",
    "ຫຼວງພະບາງ": "luang phabang", "ພະທາດຫຼວງ": "pha that luang",
    "ແມ່ຂອງ": "mekhong", "ແມ່ນ້ຳຂອງ": "mekhong", "ບໍ່ແກ້ວ": "bokeo",
    "ຫົວພັນ": "houaphan", "ຜົ້ງສາລີ": "phongsali", "ໄຊຍະບູລີ": "xaignabouli",
    "ອັດຕະປື": "attapeu", "ເຊກອງ": "sekong", "ສາລະວັນ": "salavan"
  };

  let MAX_DICT = 1;
  for (const k of Object.keys(DICT)) if (k.length > MAX_DICT) MAX_DICT = k.length;

  const MAX_BLOB = 5;

  /**
   * A dictionary match may not stop in the middle of a syllable. ມີ is a word
   * ("have"), but the ມີ of ມີດ ("knife") is not — the ດ there is that
   * syllable's final. Checking only for an attaching mark after the match is
   * not enough, because a plain consonant does not attach; ask the syllable
   * reader how far the syllable starting at i actually reaches.
   */
  function dictEdgeOk(w, i, len) {
    if (attaches(w[i + len])) return false;
    const syl = readSyllable(w, i);
    return !syl || syl.i <= i + len;
  }

  function romanize(run) {
    const w = run;
    const tokens = [];
    let blob = "";
    let blobSyls = 0;

    const flush = () => {
      if (blob) tokens.push(blob);
      blob = "";
      blobSyls = 0;
    };

    let i = 0;
    let guard = 0;
    while (i < w.length && guard++ < 4000) {
      const ch = w[i];

      if (ch === REPEAT) {
        flush();
        if (tokens.length) tokens.push(tokens[tokens.length - 1]);
        i += 1;
        continue;
      }
      if (DIGITS[ch] !== undefined) {
        let num = "";
        while (i < w.length && DIGITS[w[i]] !== undefined) {
          num += DIGITS[w[i]];
          i += 1;
        }
        flush();
        tokens.push(num);
        continue;
      }
      if (PUNCT[ch] !== undefined) {
        flush();
        tokens.push(PUNCT[ch]);
        i += 1;
        continue;
      }
      if (isTone(ch) || ch === CANCEL || ch === VIRAMA || ch === SUB_LO) {
        i += 1;
        continue;
      }
      if (ch.charCodeAt(0) < 0x0e80 || ch.charCodeAt(0) > 0x0eff) {
        // Foreign text the router did not split off: keep it in one piece,
        // one token per run rather than one token per letter.
        flush();
        let lit = "";
        while (i < w.length && !inBlock(w[i])) {
          if (w[i].charCodeAt(0) >= 0x20 && w[i].charCodeAt(0) < 0x7f) lit += w[i];
          i += 1;
        }
        if (lit) tokens.push(lit);
        continue;
      }

      let hit = null;
      const maxLen = Math.min(MAX_DICT, w.length - i);
      for (let len = maxLen; len >= 1; len--) {
        const sub = w.substr(i, len);
        // A match may not stop in the middle of a syllable.
        if (DICT[sub] !== undefined && dictEdgeOk(w, i, len)) {
          hit = { text: DICT[sub], len };
          break;
        }
      }
      if (hit) {
        flush();
        tokens.push(hit.text);
        i += hit.len;
        continue;
      }

      const syl = readSyllable(w, i);
      if (syl) {
        if (blobSyls >= MAX_BLOB) flush();
        blob += syl.text;
        blobSyls += 1;
        i = syl.i;
        continue;
      }

      i += 1;
    }
    flush();

    return tokens
      .join(" ")
      .replace(/\s+([.,])/g, "$1")
      .replace(/  +/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  }

  const mod = { id: "lao", languages: ["Lao"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
