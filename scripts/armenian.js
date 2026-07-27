/**
 * Armenian -> Roman.
 *
 * A 1:1 alphabet with a handful of digraphs, so it is a table walk plus three
 * rules that everyone who reads romanised Armenian expects:
 *
 *   - ու is one vowel, "u" (it is o + yiwn on paper, never "ov")
 *   - word-initial ե = "ye", word-initial ո = "vo" (Երևան -> Yerevan, որ -> vor)
 *   - the ligature և = "ev", "yev" when it starts a word (բարև -> barev)
 *
 * Values are Eastern Armenian in the shape people actually type: ղ=gh, ձ=dz,
 * ճ/չ=ch, շ=sh, ջ=j, ռ/ր=r, ց/ծ=ts, խ=kh, ժ=zh. Aspiration pairs (կ/ք, պ/փ,
 * տ/թ) collapse, because the apostrophes of the scholarly systems are noise on
 * a phone. Capitals are preserved: leading capital stays a capital, an all-caps
 * word stays all caps.
 *
 * The table is indexed by code point, not keyed by literal characters - the
 * letters in the comments are decoration, the offsets are the data.
 */
(() => {
  "use strict";

  // ranges: Armenian block + the five Armenian ligatures in Alphabetic
  // Presentation Forms.
  const ranges = [[0x0530, 0x058f], [0xfb13, 0xfb17]];

  const LOWER_BASE = 0x0561; // ա
  const UPPER_BASE = 0x0531; // Ա

  // Index = code point - U+0561. Covers U+0561..U+0586; the capitals
  // U+0531..U+0556 use the same indices.
  const ALPHABET = [
    "a",   //  0 ա/Ա ayb
    "b",   //  1 բ/Բ ben
    "g",   //  2 գ/Գ gim
    "d",   //  3 դ/Դ da
    "e",   //  4 ե/Ե ech      (word-initial -> ye)
    "z",   //  5 զ/Զ za
    "e",   //  6 է/Է eh
    "e",   //  7 ը/Ը et       (schwa)
    "t",   //  8 թ/Թ to
    "zh",  //  9 ժ/Ժ zhe
    "i",   // 10 ի/Ի ini
    "l",   // 11 լ/Լ liwn
    "kh",  // 12 խ/Խ xeh
    "ts",  // 13 ծ/Ծ ca
    "k",   // 14 կ/Կ ken
    "h",   // 15 հ/Հ ho
    "dz",  // 16 ձ/Ձ ja
    "gh",  // 17 ղ/Ղ ghad
    "ch",  // 18 ճ/Ճ cheh
    "m",   // 19 մ/Մ men
    "y",   // 20 յ/Յ yi
    "n",   // 21 ն/Ն now
    "sh",  // 22 շ/Շ sha
    "o",   // 23 ո/Ո vo       (word-initial -> vo, in ու -> u)
    "ch",  // 24 չ/Չ cha
    "p",   // 25 պ/Պ peh
    "j",   // 26 ջ/Ջ jheh
    "r",   // 27 ռ/Ռ ra
    "s",   // 28 ս/Ս seh
    "v",   // 29 վ/Վ vew
    "t",   // 30 տ/Տ tiwn
    "r",   // 31 ր/Ր reh
    "ts",  // 32 ց/Ց co
    "v",   // 33 ւ/Ւ yiwn     (only free-standing in classical spelling)
    "p",   // 34 փ/Փ piwr
    "k",   // 35 ք/Ք keh
    "o",   // 36 օ/Օ oh
    "f"    // 37 ֆ/Ֆ feh
  ];

  const IDX_ECH = 4;   // ե
  const IDX_INI = 10;  // ի
  const IDX_VO = 23;   // ո
  const IDX_VEW = 29;  // վ
  const IDX_YIWN = 33; // ւ

  // Standalone letters outside the two case runs.
  const ODD = {
    0x0560: { i: -1, s: "a", upper: false },  // ՠ turned ayb
    0x0587: { i: -1, s: "ev", upper: false }, // և ech-yiwn ligature
    0x0588: { i: -1, s: "y", upper: false }   // ֈ yi with stroke
  };

  // Alphabetic Presentation Forms: Armenian ligatures.
  const LIGATURES = {
    0xfb13: "mn",  // ﬓ մն
    0xfb14: "me",  // ﬔ մե
    0xfb15: "mi",  // ﬕ մի
    0xfb16: "vn",  // ﬖ վն
    0xfb17: "mkh"  // ﬗ մխ
  };

  const PUNCT = {
    0x0559: "",      // ՙ modifier left half ring
    0x055a: "'",     // ՚ apostrophe
    0x055b: "",      // ՛ emphasis mark
    0x055c: "!",     // ՜ exclamation mark
    0x055d: ",",     // ՝ comma
    0x055e: "?",     // ՞ question mark
    0x055f: "",      // ՟ abbreviation mark
    0x0589: ".",     // ։ full stop
    0x058a: "-",     // ֊ hyphen
    0x058d: "",      // ֍ right-facing eternity sign
    0x058e: "",      // ֎ left-facing eternity sign
    0x058f: "dram"   // ֏ dram sign
  };

  /** Classify one code point: letter index + case, ligature, or nothing. */
  function classify(cp) {
    if (cp >= LOWER_BASE && cp - LOWER_BASE < ALPHABET.length) {
      return { i: cp - LOWER_BASE, s: ALPHABET[cp - LOWER_BASE], upper: false };
    }
    if (cp >= UPPER_BASE && cp - UPPER_BASE < ALPHABET.length) {
      return { i: cp - UPPER_BASE, s: ALPHABET[cp - UPPER_BASE], upper: true };
    }
    if (cp === 0x0587) return ODD[0x0587];
    if (ODD[cp]) return ODD[cp];
    if (LIGATURES[cp] !== undefined) return { i: -1, s: LIGATURES[cp], upper: false };
    return null;
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /** One run of Armenian letters (punctuation already split off). */
  function romanizeWord(letters) {
    const n = letters.length;
    const pieces = [];
    let i = 0;
    let atStart = true;

    while (i < n) {
      const cur = letters[i];
      const next = i + 1 < n ? letters[i + 1] : null;
      let s = cur.s;

      // ու / ՈՒ / Ուbase digraph -> u
      if (cur.i === IDX_VO && next && next.i === IDX_YIWN) {
        pieces.push({ s: "u", upper: cur.upper });
        i += 2;
        atStart = false;
        continue;
      }
      // իւ (classical) -> yu
      if (cur.i === IDX_INI && next && next.i === IDX_YIWN) {
        pieces.push({ s: "yu", upper: cur.upper });
        i += 2;
        atStart = false;
        continue;
      }

      if (atStart) {
        if (cur.i === IDX_ECH) s = "ye";       // ե- -> ye-
        // ո- is /vo/ (որ vor, ոչ voch, ոսկի voski) with one standing
        // exception: the interrogative ով / ովքեր is "ov", never "vov".
        else if (cur.i === IDX_VO) s = next && next.i === IDX_VEW ? "o" : "vo";
        else if (cur.s === "ev") s = "yev";    // և- -> yev-
      }

      pieces.push({ s: s, upper: cur.upper });
      i += 1;
      atStart = false;
    }

    let caps = 0;
    let cased = 0;
    for (const p of pieces) {
      if (!p.s) continue;
      cased += 1;
      if (p.upper) caps += 1;
    }

    let out = "";
    const allCaps = cased > 1 && caps === cased;
    for (const p of pieces) {
      out += p.upper && !allCaps ? capitalize(p.s) : p.s;
    }
    return allCaps ? out.toUpperCase() : out;
  }

  function romanize(word) {
    let src = word;
    try {
      src = word.normalize("NFC");
    } catch (e) {
      src = word;
    }

    let out = "";
    let buf = [];
    const flush = () => {
      if (buf.length) {
        out += romanizeWord(buf);
        buf = [];
      }
    };

    for (const ch of src) {
      const cp = ch.codePointAt(0);
      const letter = classify(cp);
      if (letter) {
        buf.push(letter);
        continue;
      }
      flush();
      if (PUNCT[cp] !== undefined) out += PUNCT[cp];
      else if (cp < 0x80) out += ch; // stray ASCII swept into the run
      // unassigned code points are dropped
    }
    flush();
    return out.replace(/[^\x20-\x7E]/g, "");
  }

  const mod = { id: "armenian", languages: ["Armenian"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
