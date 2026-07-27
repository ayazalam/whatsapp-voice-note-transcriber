/**
 * Gurmukhi / Punjabi (U+0A00-U+0A7F) -> Roman.
 *
 * Same abugida machinery as the Devanagari module. Punjabi drops the inherent
 * schwa the way Hindi does, so the word-final rule plus the classic VC_CV
 * medial rule both apply, and the vowel spellings follow the conventions
 * people actually type (aa/ee/oo, short -a/-i/-u word-finally).
 *
 * Gurmukhi-specific behaviour:
 *   - addak (ੱ) doubles the consonant that follows it: ਪੱਕਾ -> pakka, ਅੱਜ -> ajj
 *   - tippi (ੰ) and bindi (ਂ) are both nasals; adak bindi (ਁ) too
 *   - the pairin-bindi (nuqta) letters ਸ਼ ਖ਼ ਗ਼ ਜ਼ ਫ਼ ਲ਼ are handled both
 *     precomposed and as base + U+0A3C
 *   - ੳ / ੲ / ਅ are vowel bearers: they take the following matra
 *   - subjoined haha (੍ਹ), rara (੍ਰ), vava (੍ਵ), yakash (ੵ) all stack normally
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0a00, 0x0a7f]];

  const VIRAMA = "੍";       // ੍
  const NUKTA = "਼";        // ਼
  const ADDAK = "ੱ";        // ੱ
  const TIPPI = "ੰ";        // ੰ
  const BINDI = "ਂ";        // ਂ
  const ADAK_BINDI = "ਁ";   // ਁ
  const VISARGA = "ਃ";      // ਃ
  const YAKASH = "ੵ";       // ੵ

  // Sentinel for a nasal whose realisation (n vs m) depends on the next onset.
  const NASAL = "\u0001";

  const CONS = {
    "ਕ": "k",  "ਖ": "kh", "ਗ": "g",  "ਘ": "gh", "ਙ": "ng",
    "ਚ": "ch", "ਛ": "chh","ਜ": "j",  "ਝ": "jh", "ਞ": "n",
    "ਟ": "t",  "ਠ": "th", "ਡ": "d",  "ਢ": "dh", "ਣ": "n",
    "ਤ": "t",  "ਥ": "th", "ਦ": "d",  "ਧ": "dh", "ਨ": "n",
    "ਪ": "p",  "ਫ": "ph", "ਬ": "b",  "ਭ": "bh", "ਮ": "m",
    "ਯ": "y",  "ਰ": "r",  "ਲ": "l",  "ਵ": "v",  "ੜ": "r",
    "ਸ": "s",  "ਹ": "h",
    // precomposed pairin-bindi letters (NFC decomposes these, but text in the
    // wild carries them either way)
    "ਲ਼": "l",  "ਸ਼": "sh", "ਖ਼": "kh", "ਗ਼": "g",  "ਜ਼": "z", "ਫ਼": "f"
  };

  // base consonant followed by U+0A3C NUKTA (pairin bindi)
  const NUQTA = {
    "ਸ": "sh", "ਖ": "kh", "ਗ": "g", "ਜ": "z",
    "ਫ": "f",  "ਲ": "l",  "ਕ": "q", "ਡ": "r", "ਢ": "rh"
  };

  const INDEP = {
    "ਆ": "aa", "ਇ": "i",  "ਈ": "ee", "ਉ": "u",
    "ਊ": "oo", "ਏ": "e",  "ਐ": "ai", "ਓ": "o", "ਔ": "au"
  };

  // ੳ ura, ੲ iri, ਅ aira -- carriers that take the following matra
  const BEARER = { "ੳ": "u", "ੲ": "i", "ਅ": "a" };

  const MATRA = {
    "ਾ": "aa", "ਿ": "i",  "ੀ": "ee", "ੁ": "u",
    "ੂ": "oo", "ੇ": "e",  "ੈ": "ai", "ੋ": "o", "ੌ": "au"
  };

  const DIGITS = {
    "੦": "0", "੧": "1", "੨": "2", "੩": "3", "੪": "4",
    "੫": "5", "੬": "6", "੭": "7", "੮": "8", "੯": "9"
  };

  const PUNCT = {
    "ੑ": "",              // udaat
    "ੴ": "ik onkar",      // ek onkar
    "੶": ".",             // abbreviation sign
    "।": ".",             // danda (Devanagari block, used with Gurmukhi text)
    "॥": "."
  };

  // Gemination prefix: "kh" doubles as "kkh", "ch" as "chch", "n" as "nn".
  const GEM = {
    "kh": "k", "gh": "g", "ch": "ch", "chh": "ch", "jh": "j",
    "th": "t", "dh": "d", "ph": "p", "bh": "b", "sh": "s",
    "rh": "r", "ng": "ng"
  };

  const LABIALS = new Set(["p", "ph", "b", "bh", "m", "f"]);

  const RAW_DICT = {
    // greetings, names, places
    "ਸਤਿ": "sat", "ਸ੍ਰੀ": "sri", "ਅਕਾਲ": "akal", "ਸਤਿਨਾਮ": "satnam",
    "ਵਾਹਿਗੁਰੂ": "waheguru", "ਵਾਹਿਗੁਰੂਜੀ": "waheguruji", "ਗੁਰੂ": "guru",
    "ਸਾਹਿਬ": "sahib", "ਸਿੰਘ": "Singh", "ਕੌਰ": "Kaur", "ਖਾਲਸਾ": "Khalsa",
    "ਫਤਿਹ": "fateh", "ਗੁਰਦੁਆਰਾ": "gurdwara", "ਰੱਬ": "rabb",
    "ਪੰਜਾਬ": "punjab", "ਪੰਜਾਬੀ": "punjabi", "ਭਾਰਤ": "bharat",
    "ਹਿੰਦੁਸਤਾਨ": "hindustan", "ਅੰਮ੍ਰਿਤਸਰ": "Amritsar",
    "ਲੁਧਿਆਣਾ": "Ludhiana", "ਚੰਡੀਗੜ੍ਹ": "Chandigarh", "ਜਲੰਧਰ": "Jalandhar",
    "ਦਿੱਲੀ": "Delhi", "ਲਾਹੌਰ": "Lahore", "ਕੈਨੇਡਾ": "Canada",
    // pronouns
    "ਮੈਂ": "main", "ਮੇਰਾ": "mera", "ਮੇਰੀ": "meri", "ਮੇਰੇ": "mere",
    "ਮੈਨੂੰ": "mainu", "ਅਸੀਂ": "asi", "ਸਾਡਾ": "sada", "ਸਾਡੀ": "sadi",
    "ਸਾਨੂੰ": "sanu", "ਤੂੰ": "tu", "ਤੇਰਾ": "tera", "ਤੇਰੀ": "teri",
    "ਤੈਨੂੰ": "tainu", "ਤੁਸੀਂ": "tusi", "ਤੁਹਾਡਾ": "tuhada",
    "ਤੁਹਾਡੀ": "tuhadi", "ਤੁਹਾਨੂੰ": "tuhanu",
    "ਉਹ": "oh", "ਇਹ": "eh", "ਉਸ": "us", "ਇਸ": "is", "ਉਹਨਾਂ": "ohna",
    "ਇਹਨਾਂ": "ehna", "ਆਪਣਾ": "apna", "ਆਪਣੀ": "apni", "ਆਪ": "aap",
    // question words
    "ਕੀ": "ki", "ਕੌਣ": "kaun", "ਕਿਉਂ": "kyun", "ਕਿਵੇਂ": "kiven",
    "ਕਿੱਥੇ": "kithe", "ਕਦੋਂ": "kadon", "ਕਿੰਨਾ": "kinna", "ਕਿਹੜਾ": "kehra",
    "ਕਿਹੜੀ": "kehri", "ਕਿੰਨੇ": "kinne",
    // yes / no / being
    "ਹਾਂ": "haan", "ਨਹੀਂ": "nahi", "ਨਹੀ": "nahi", "ਨਾ": "na",
    "ਹੈ": "hai", "ਹਨ": "han", "ਹੋ": "ho", "ਸੀ": "si", "ਸਨ": "san",
    "ਹੋਵੇਗਾ": "hovega", "ਹੋਇਆ": "hoya", "ਹੋਈ": "hoi", "ਹੋਏ": "hoye",
    "ਹੁੰਦਾ": "hunda", "ਹੁੰਦੀ": "hundi",
    // verbs
    "ਕਰ": "kar", "ਕਰਨਾ": "karna", "ਕੀਤਾ": "kita", "ਕਰਦਾ": "karda",
    "ਕਰਦੀ": "kardi", "ਕਰਾਂਗਾ": "karanga", "ਕਰੋ": "karo", "ਕਰਕੇ": "karke",
    "ਜਾ": "ja", "ਜਾਣਾ": "jana", "ਗਿਆ": "gya", "ਗਏ": "gaye", "ਗਈ": "gayi",
    "ਆ": "aa", "ਆਉਣਾ": "auna", "ਆਇਆ": "aaya", "ਆਓ": "aao",
    "ਦੇ": "de", "ਦਿੱਤਾ": "ditta", "ਲੈ": "lai", "ਲਿਆ": "liya",
    "ਵੇਖ": "vekh", "ਦੇਖ": "dekh", "ਸੁਣ": "sun", "ਬੋਲ": "bol",
    "ਕਹਿ": "keh", "ਕਿਹਾ": "kiha", "ਦੱਸ": "dass", "ਭੇਜ": "bhej",
    "ਪਤਾ": "pata", "ਚਾਹੀਦਾ": "chahida", "ਮਿਲ": "mil", "ਰਹਿ": "reh",
    "ਚਾਹੀਦੇ": "chahide", "ਚਾਹੀਦੀ": "chahidi", "ਮਹੀਨੇ": "mahine",
    "ਪਹੀਏ": "pahiye", "ਵਧੀਆਂ": "vadhian", "ਕਹੀਦਾ": "kahida",
    // courtesy
    "ਧੰਨਵਾਦ": "dhannvaad", "ਮਿਹਰਬਾਨੀ": "meharbani", "ਸ਼ੁਕਰੀਆ": "shukriya",
    "ਮਾਫ": "maaf", "ਮਾਫ਼": "maaf", "ਜੀ": "ji", "ਸਰ": "sir",
    // qualities
    "ਚੰਗਾ": "changa", "ਚੰਗੀ": "changi", "ਵਧੀਆ": "vadhia", "ਮਾੜਾ": "mara",
    "ਠੀਕ": "theek", "ਬਹੁਤ": "bahut", "ਥੋੜਾ": "thora", "ਸਾਰਾ": "sara",
    "ਸਭ": "sab", "ਸਾਰੇ": "sare", "ਕੁਝ": "kujh", "ਹੋਰ": "hor",
    "ਵੱਡਾ": "vadda", "ਛੋਟਾ": "chhota", "ਨਵਾਂ": "nawan", "ਪੁਰਾਣਾ": "purana",
    // time
    "ਅੱਜ": "ajj", "ਕੱਲ੍ਹ": "kal", "ਕੱਲ": "kal", "ਹੁਣ": "hun",
    "ਫਿਰ": "phir", "ਫੇਰ": "pher", "ਪਹਿਲਾਂ": "pehlan", "ਬਾਅਦ": "baad",
    "ਸਵੇਰ": "saver", "ਦੁਪਹਿਰ": "dupehar", "ਸ਼ਾਮ": "shaam", "ਰਾਤ": "raat",
    "ਦਿਨ": "din", "ਵੇਲਾ": "vela", "ਸਮਾਂ": "samaan", "ਸਾਲ": "saal",
    "ਮਹੀਨਾ": "mahina", "ਹਫ਼ਤਾ": "hafta", "ਹਫਤਾ": "hafta",
    // money and numbers
    "ਪੈਸਾ": "paisa", "ਪੈਸੇ": "paise", "ਰੁਪਿਆ": "rupaya", "ਹਜ਼ਾਰ": "hazaar",
    "ਲੱਖ": "lakh", "ਕਰੋੜ": "crore", "ਇੱਕ": "ikk", "ਦੋ": "do",
    "ਤਿੰਨ": "tinn", "ਚਾਰ": "chaar", "ਪੰਜ": "panj", "ਛੇ": "chhe",
    "ਸੱਤ": "satt", "ਅੱਠ": "atth", "ਨੌਂ": "naun", "ਦਸ": "das",
    // places and things
    "ਘਰ": "ghar", "ਪਿੰਡ": "pind", "ਸ਼ਹਿਰ": "shehar", "ਦੁਕਾਨ": "dukan",
    "ਬਾਜ਼ਾਰ": "bazaar", "ਸਕੂਲ": "school", "ਦਫ਼ਤਰ": "daftar",
    "ਹਸਪਤਾਲ": "haspatal", "ਸੜਕ": "sarak", "ਖੇਤ": "khet",
    "ਗੱਡੀ": "gaddi", "ਬੱਸ": "bus", "ਫ਼ੋਨ": "phone", "ਫੋਨ": "phone",
    "ਮੋਬਾਈਲ": "mobile", "ਨੰਬਰ": "number", "ਸੁਨੇਹਾ": "suneha",
    "ਪਾਣੀ": "paani", "ਚਾਹ": "chah", "ਰੋਟੀ": "roti", "ਖਾਣਾ": "khana",
    "ਦੁੱਧ": "dudh", "ਲੱਸੀ": "lassi",
    // people
    "ਮਾਂ": "maa", "ਪਿਓ": "pyo", "ਪਿਤਾ": "pita", "ਭਰਾ": "bhra",
    "ਭੈਣ": "bhain", "ਪੁੱਤ": "putt", "ਧੀ": "dhee", "ਬੱਚਾ": "bachcha",
    "ਯਾਰ": "yaar", "ਵੀਰ": "veer", "ਦੋਸਤ": "dost", "ਪਰਿਵਾਰ": "parivar",
    "ਬੰਦਾ": "banda", "ਲੋਕ": "lok", "ਬਾਈ": "bai",
    // work
    "ਕੰਮ": "kamm", "ਗੱਲ": "gall", "ਗੱਲਾਂ": "gallan", "ਨੌਕਰੀ": "naukri",
    "ਲੋੜ": "lor", "ਮਸਲਾ": "masla", "ਮੁਸ਼ਕਲ": "mushkil", "ਖ਼ਬਰ": "khabar",
    // function words
    "ਜੇ": "je", "ਪਰ": "par", "ਅਤੇ": "ate", "ਤੇ": "te", "ਜਾਂ": "jaan",
    "ਕਿਉਂਕਿ": "kyunki", "ਤਾਂ": "taan", "ਵੀ": "vi", "ਹੀ": "hi",
    "ਵਿੱਚ": "vich", "ਨਾਲ": "naal", "ਤੋਂ": "ton", "ਲਈ": "layi",
    "ਉੱਤੇ": "utte", "ਹੇਠਾਂ": "hethan", "ਕੋਲ": "kol", "ਵੱਲ": "vall",
    "ਬਾਰੇ": "bare", "ਬਿਨਾਂ": "binan", "ਕਿ": "ki"
  };

  function nfc(s) {
    try {
      return s.normalize("NFC");
    } catch (_) {
      return s;
    }
  }

  const DICT = Object.create(null);
  for (const k in RAW_DICT) {
    if (Object.prototype.hasOwnProperty.call(RAW_DICT, k)) DICT[nfc(k)] = RAW_DICT[k];
  }

  const isCons = (ch) => ch !== undefined && Object.prototype.hasOwnProperty.call(CONS, ch);
  const isMark = (ch) =>
    ch === TIPPI || ch === BINDI || ch === ADAK_BINDI || ch === VISARGA;

  function readTail(src, i) {
    let tail = "";
    while (i < src.length && isMark(src[i])) {
      tail += src[i] === VISARGA ? "h" : NASAL;
      i += 1;
    }
    return tail;
  }

  function tailLength(src, i) {
    let n = 0;
    while (i + n < src.length && isMark(src[i + n])) n += 1;
    return n;
  }

  function gemPrefix(unit) {
    return Object.prototype.hasOwnProperty.call(GEM, unit) ? GEM[unit] : unit;
  }

  /**
   * Split one Gurmukhi word into syllables:
   *   units    = onset consonant units
   *   c        = onset spelled out
   *   v        = vowel ("a" = inherent schwa, "" = none)
   *   inherent = true when v is the implicit schwa (only those may be deleted)
   *   tail     = nasal / visarga after the vowel
   */
  function syllabify(src) {
    const syls = [];
    let i = 0;
    const n = src.length;
    let addak = false;

    while (i < n) {
      const ch = src[i];

      if (ch === ADDAK) {
        addak = true;
        i += 1;
        continue;
      }

      if (isCons(ch)) {
        const units = [];
        let dead = false;

        for (;;) {
          const cc = src[i];
          let latin = CONS[cc];
          if (src[i + 1] === NUKTA && Object.prototype.hasOwnProperty.call(NUQTA, cc)) {
            latin = NUQTA[cc];
            i += 1;
          }
          units.push(latin);
          i += 1;
          if (src[i] === YAKASH) {
            units.push("y");
            i += 1;
          }
          if (src[i] === VIRAMA) {
            i += 1;
            if (isCons(src[i])) continue; // conjunct: keep stacking
            dead = true;
          }
          break;
        }

        if (addak && units.length) {
          units.unshift(gemPrefix(units[0]));
          addak = false;
        }
        const c = units.join("");

        if (dead) {
          syls.push({ units, c, v: "", inherent: false, tail: "" });
          continue;
        }

        let v = "a";
        let inherent = true;
        if (MATRA[src[i]] !== undefined) {
          v = MATRA[src[i]];
          inherent = false;
          i += 1;
        }
        syls.push({ units, c, v, inherent, tail: readTail(src, i) });
        i += tailLength(src, i);
        continue;
      }

      if (BEARER[ch] !== undefined) {
        let v = BEARER[ch];
        let j = i + 1;
        if (MATRA[src[j]] !== undefined) {
          v = MATRA[src[j]];
          j += 1;
        }
        syls.push({ units: [], c: "", v, inherent: false, tail: readTail(src, j) });
        i = j + tailLength(src, j);
        continue;
      }

      if (INDEP[ch] !== undefined) {
        const v = INDEP[ch];
        const j = i + 1;
        syls.push({ units: [], c: "", v, inherent: false, tail: readTail(src, j) });
        i = j + tailLength(src, j);
        continue;
      }

      if (DIGITS[ch] !== undefined) {
        syls.push({ units: [], c: DIGITS[ch], v: "", inherent: false, tail: "", literal: true });
        i += 1;
        continue;
      }

      if (PUNCT[ch] !== undefined) {
        if (PUNCT[ch]) {
          syls.push({ units: [], c: PUNCT[ch], v: "", inherent: false, tail: "", literal: true });
        }
        i += 1;
        continue;
      }

      i += 1; // stray marks, anything unmapped
    }

    return syls;
  }

  /** Punjabi schwa deletion -- the Hindi rules apply almost unchanged. */
  function deleteSchwa(syls) {
    const n = syls.length;
    if (n === 0) return;

    const last = syls[n - 1];
    if (n > 1 && last.inherent && last.c && !last.tail && !last.literal) {
      last.v = "";
    }

    for (let i = n - 2; i >= 1; i--) {
      const s = syls[i];
      if (!s.inherent || s.tail || !s.c || s.literal) continue;
      // a ya-phala onset keeps its vowel: ਧਨਯਵਾਦ-style spellings stay readable
      if (s.units.length > 1 && s.units[s.units.length - 1] === "y") continue;
      const prev = syls[i - 1];
      const next = syls[i + 1];
      if (!prev.v || prev.literal) continue;
      if (!next.c || !next.v || next.literal) continue;
      s.v = "";
    }
  }

  function spell(syls) {
    let out = "";
    for (let i = 0; i < syls.length; i++) {
      const s = syls[i];
      let v = s.v;

      // how people actually type it: karnaa -> karna, vii -> vi, guruu -> guru
      if (i === syls.length - 1 && !s.tail && (syls.length > 1 || s.c)) {
        if (v === "aa") v = "a";
        else if (v === "ee") v = "i";
        else if (v === "oo") v = "u";
      }

      let tail = s.tail;
      if (tail.indexOf(NASAL) !== -1) {
        const next = syls[i + 1];
        let nasal = "n";
        if (next && next.units && next.units.length && LABIALS.has(next.units[0])) nasal = "m";
        tail = tail.split(NASAL).join(nasal);
      }
      out += s.c + v + tail;
    }
    return out;
  }

  function romanize(word) {
    if (!word) return "";
    const src = nfc(word);
    if (DICT[src] !== undefined) return DICT[src];

    const syls = syllabify(src);
    if (!syls.length) return "";
    deleteSchwa(syls);
    let out = spell(syls);
    out = out.replace(/(.)aay/g, "$1ay");
    out = out.replace(/([a-z])\1{2,}/g, "$1$1");
    return out;
  }

  const mod = {
    id: "gurmukhi",
    languages: ["Punjabi"],
    ranges,
    romanize
  };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
