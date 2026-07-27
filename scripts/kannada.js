/**
 * Kannada -> Roman transliteration (U+0C80-U+0CFF).
 *
 * Structurally the same job as Telugu: the script spells voicing and
 * aspiration, so the consonant table is a straight varga walk and there is
 * nothing positional to infer.
 *
 *   - Long vowels get one Latin letter (ಆ -> a, ಈ -> i, ಊ -> u): kannada,
 *     namaskara, dhanyavada, Karnataka, Bengaluru, Mysuru.
 *   - Retroflex and dental collapse (ಟ and ತ are both t, ಡ and ದ both d).
 *   - No schwa deletion. Kannada keeps its final vowel and that is the whole
 *     sound of the language: ಧನ್ಯವಾದ -> dhanyavada (not "dhanyavad"),
 *     ಕನ್ನಡ -> kannada, and final ು stays -u (Bengaluru, beku, hogu).
 *   - ಂ is n or m depending on the next onset: bengaluru, sambhala, tindi.
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0c80, 0x0cff]];

  const VIRAMA = "್";
  const NUKTA = "಼";
  const NASAL = "\u0001"; // sentinel: n or m, decided by the next onset
  const LENGTH = "ೕ";
  const AI_LENGTH = "ೖ";

  const CONS = {
    "ಕ": "k", "ಖ": "kh", "ಗ": "g", "ಘ": "gh", "ಙ": "ng",
    "ಚ": "ch", "ಛ": "chh", "ಜ": "j", "ಝ": "jh", "ಞ": "nj",
    "ಟ": "t", "ಠ": "th", "ಡ": "d", "ಢ": "dh", "ಣ": "n",
    "ತ": "t", "ಥ": "th", "ದ": "d", "ಧ": "dh", "ನ": "n",
    "ಪ": "p", "ಫ": "ph", "ಬ": "b", "ಭ": "bh", "ಮ": "m",
    "ಯ": "y", "ರ": "r", "ಱ": "r", "ಲ": "l", "ಳ": "l", "ೞ": "l",
    "ವ": "v", "ಶ": "sh", "ಷ": "sh", "ಸ": "s", "ಹ": "h"
  };

  const DEAD = { "ಙ": "n", "ಞ": "n", "ಣ": "n", "ನ": "n", "ಮ": "m" };

  // dead X + Y spelled as one thing
  const PAIR = { "ಜಞ": "gn" };

  const INDEP = {
    "ಅ": "a", "ಆ": "a", "ಇ": "i", "ಈ": "i", "ಉ": "u", "ಊ": "u",
    "ಋ": "ri", "ೠ": "ri", "ಌ": "lu", "ೡ": "lu",
    "ಎ": "e", "ಏ": "e", "ಐ": "ai", "ಒ": "o", "ಓ": "o", "ಔ": "au"
  };

  const SIGN = {
    "ಾ": "a", "ಿ": "i", "ೀ": "i", "ು": "u", "ೂ": "u",
    "ೃ": "ri", "ೄ": "ri", "ೢ": "lu", "ೣ": "lu",
    "ೆ": "e", "ೇ": "e", "ೈ": "ai", "ೊ": "o", "ೋ": "o", "ೌ": "au"
  };

  // U+0CF3 is the combining anusvara above right; it nasalises exactly like ಂ
  // and must not be dropped, or the nasal vanishes from the word.
  const MARKS = { "ಀ": NASAL, "ಁ": NASAL, "ಂ": NASAL, "ೳ": NASAL, "ಃ": "h" };

  const LIT = {
    "೦": "0", "೧": "1", "೨": "2", "೩": "3", "೪": "4",
    "೫": "5", "೬": "6", "೭": "7", "೮": "8", "೯": "9",
    // nakaara pollu: a bare n that never takes a vowel
    "ೝ": "n",
    // jihvamuliya and upadhmaniya are fricative marks leaning on the next
    // stop, not syllables — they take no inherent vowel.
    "ೱ": "h", "ೲ": "h"
  };

  const LABIAL = { p: 1, b: 1, m: 1, f: 1, v: 1 };

  const DICT = {
    "ಕನ್ನಡ": "kannada", "ಕರ್ನಾಟಕ": "Karnataka", "ಬೆಂಗಳೂರು": "Bengaluru",
    "ಮೈಸೂರು": "Mysuru", "ಮಂಗಳೂರು": "Mangaluru", "ಹುಬ್ಬಳ್ಳಿ": "Hubballi",
    "ಬೆಳಗಾವಿ": "Belagavi", "ಭಾರತ": "bharata",
    "ನಾನು": "nanu", "ನೀನು": "ninu", "ನೀವು": "neevu", "ನಾವು": "navu",
    "ಅವನು": "avanu", "ಅವಳು": "avalu", "ಅವರು": "avaru", "ಅದು": "adu",
    "ಇದು": "idu", "ಯಾರು": "yaru", "ಏನು": "enu", "ಎಲ್ಲಿ": "elli",
    "ಯಾವಾಗ": "yavaga", "ಏಕೆ": "eke", "ಯಾಕೆ": "yake", "ಹೇಗೆ": "hege",
    "ಎಷ್ಟು": "eshtu", "ಇಲ್ಲಿ": "illi", "ಅಲ್ಲಿ": "alli",
    "ಹೌದು": "haudu", "ಇಲ್ಲ": "illa", "ಸರಿ": "sari", "ಗೊತ್ತಿಲ್ಲ": "gottilla",
    "ಗೊತ್ತು": "gottu", "ಬೇಕು": "beku", "ಬೇಡ": "beda", "ಆಯ್ತು": "aytu",
    "ನಮಸ್ಕಾರ": "namaskara", "ನಮಸ್ಕಾರಗಳು": "namaskaragalu",
    "ಧನ್ಯವಾದ": "dhanyavada", "ಧನ್ಯವಾದಗಳು": "dhanyavadagalu",
    "ಹೇಗಿದ್ದೀರಿ": "hegiddiri", "ಚೆನ್ನಾಗಿದ್ದೇನೆ": "chennagiddene",
    "ಚೆನ್ನಾಗಿದೆ": "chennagide", "ಕ್ಷಮಿಸಿ": "kshamisi", "ದಯವಿಟ್ಟು": "dayavittu",
    "ಮಾಡು": "madu", "ಮಾಡಿ": "madi", "ಹೋಗು": "hogu", "ಹೋಗಿ": "hogi",
    "ಬನ್ನಿ": "banni", "ಹೇಳಿ": "heli", "ಕೇಳಿ": "keli", "ನೋಡಿ": "nodi",
    "ತಿಳಿಸಿ": "tilisi", "ಕೊಡಿ": "kodi", "ತೆಗೆದುಕೊಳ್ಳಿ": "tegedukolli",
    "ಊಟ": "oota", "ತಿಂಡಿ": "tindi", "ನೀರು": "neeru", "ಹಾಲು": "halu",
    "ಚಹಾ": "chaha", "ಕಾಫಿ": "coffee", "ಅನ್ನ": "anna", "ರೊಟ್ಟಿ": "rotti",
    "ಮನೆ": "mane", "ಊರು": "ooru", "ಕೆಲಸ": "kelasa", "ದುಡ್ಡು": "duddu",
    "ಹಣ": "hana", "ಸಂಬಳ": "sambala", "ಸಮಯ": "samaya", "ಗಂಟೆ": "gante",
    "ಇವತ್ತು": "ivattu", "ನಾಳೆ": "nale", "ನಿನ್ನೆ": "ninne", "ಈಗ": "eega",
    "ಆಮೇಲೆ": "amele", "ಮೊದಲು": "modalu", "ಬೆಳಿಗ್ಗೆ": "beligge",
    "ಸಂಜೆ": "sanje", "ರಾತ್ರಿ": "ratri", "ದಿನ": "dina", "ವಾರ": "vara",
    "ತಿಂಗಳು": "tingalu", "ವರ್ಷ": "varsha",
    "ಅಮ್ಮ": "amma", "ಅಪ್ಪ": "appa", "ಅಣ್ಣ": "anna", "ಅಕ್ಕ": "akka",
    "ತಮ್ಮ": "tamma", "ತಂಗಿ": "tangi", "ಮಗ": "maga", "ಮಗಳು": "magalu",
    "ಮಕ್ಕಳು": "makkalu", "ಗಂಡ": "ganda", "ಹೆಂಡತಿ": "hendati",
    "ಸ್ನೇಹಿತ": "snehita", "ಗೆಳೆಯ": "geleya", "ಪ್ರೀತಿ": "preeti",
    "ಸಂತೋಷ": "santosha", "ದೇವರು": "devaru", "ದೇವಸ್ಥಾನ": "devasthana",
    "ಕೃಷ್ಣ": "krishna", "ಶ್ರೀ": "sri", "ಹಬ್ಬ": "habba", "ದೀಪಾವಳಿ": "deepavali",
    "ಒಳ್ಳೆಯದು": "olleyadu", "ಕೆಟ್ಟದು": "kettadu", "ದೊಡ್ಡ": "dodda",
    "ಚಿಕ್ಕ": "chikka", "ಸ್ವಲ್ಪ": "svalpa", "ತುಂಬಾ": "tumba",
    "ಜಾಸ್ತಿ": "jasti", "ಕಡಿಮೆ": "kadime", "ಬೇಗ": "bega", "ನಿಧಾನ": "nidhana",
    // English written in Kannada script
    "ಫೋನ್": "phone", "ಮೊಬೈಲ್": "mobile", "ಮೆಸೇಜ್": "message",
    "ಆಫೀಸ್": "office", "ಆರ್ಡರ್": "order", "ಪೇಮೆಂಟ್": "payment",
    "ಮೀಟಿಂಗ್": "meeting", "ಕಸ್ಟಮರ್": "customer", "ಡೆಲಿವರಿ": "delivery",
    "ಬಿಲ್": "bill", "ರೇಟ್": "rate", "ಸ್ಟಾಕ್": "stock", "ನಂಬರ್": "number",
    "ಅಡ್ರೆಸ್": "address", "ಕಂಪನಿ": "company", "ಡಾಕ್ಟರ್": "doctor",
    "ಆಸ್ಪತ್ರೆ": "aspatre", "ಸ್ಕೂಲ್": "school", "ಕಾಲೇಜ್": "college",
    "ಬಸ್": "bus", "ಕಾರು": "car", "ಟ್ರೈನ್": "train", "ಓಕೆ": "ok",
    "ಥ್ಯಾಂಕ್ಸ್": "thanks", "ಸಾರಿ": "sorry", "ವಾಟ್ಸಾಪ್": "WhatsApp",
    "ಬ್ಯಾಂಕ್": "bank", "ಅಕೌಂಟ್": "account", "ಈಮೇಲ್": "email"
  };

  const has = (obj, k) => k !== undefined && Object.prototype.hasOwnProperty.call(obj, k);

  function normalize(word) {
    let s = word;
    try {
      s = s.normalize("NFC");
    } catch (_) { /* older engines: use the string as-is */ }
    return s.replace(/[​-‏⁠﻿]/g, "");
  }

  function readTail(w, i) {
    let tail = "";
    while (i < w.length && has(MARKS, w[i])) {
      tail += MARKS[w[i]];
      i += 1;
    }
    return tail;
  }

  function tailLength(w, i) {
    let n = 0;
    while (i + n < w.length && has(MARKS, w[i + n])) n += 1;
    return n;
  }

  /**
   * Flat token list:
   *   { t: "c", ch, dead, v, tail }   consonant with its vowel
   *   { t: "v", v, tail }             independent vowel
   *   { t: "lit", s }                 digit or symbol
   */
  function parse(w) {
    const items = [];
    let i = 0;

    while (i < w.length) {
      const ch = w[i];

      if (has(CONS, ch)) {
        i += 1;
        if (w[i] === NUKTA) i += 1;
        let dead = false;
        let v = "a";
        if (w[i] === VIRAMA) {
          dead = true;
          i += 1;
        } else if (has(SIGN, w[i])) {
          v = SIGN[w[i]];
          i += 1;
          while (w[i] === LENGTH || w[i] === AI_LENGTH) {
            if (w[i] === AI_LENGTH) v = "ai";
            i += 1;
          }
        } else if (w[i] === AI_LENGTH) {
          v = "ai";
          i += 1;
        } else if (w[i] === LENGTH) {
          i += 1;
        }
        const tail = dead ? "" : readTail(w, i);
        if (!dead) i += tailLength(w, i);
        items.push({ t: "c", ch, dead, v: dead ? "" : v, tail });
        continue;
      }

      if (has(INDEP, ch)) {
        const tail = readTail(w, i + 1);
        items.push({ t: "v", v: INDEP[ch], tail });
        i += 1 + tailLength(w, i + 1);
        continue;
      }

      if (has(LIT, ch)) {
        items.push({ t: "lit", s: LIT[ch] });
        i += 1;
        continue;
      }

      if (has(MARKS, ch)) {
        items.push({ t: "lit", s: MARKS[ch] === NASAL ? "n" : MARKS[ch] });
        i += 1;
        continue;
      }

      i += 1; // avagraha, unassigned, anything unmapped
    }

    return items;
  }

  function consLatin(items, idx) {
    const it = items[idx];
    const ch = it.ch;
    const prev = items[idx - 1];
    const next = items[idx + 1];
    const base = has(CONS, ch) ? CONS[ch] : "";

    if (it.dead) {
      if (next && next.t === "c") {
        if (has(PAIR, ch + next.ch)) return "";
        // The live half spells a geminate whose base is already a digraph,
        // so ಧ್ಧ is dh and not dhdh.
        if (next.ch === ch && base.length > 1) return "";
      }
      if (has(DEAD, ch)) return DEAD[ch];
      return base;
    }

    if (prev && prev.t === "c" && prev.dead) {
      if (has(PAIR, prev.ch + ch)) return PAIR[prev.ch + ch];
      if (prev.ch === ch && base.length > 1) return base;
    }
    return base;
  }

  function nasalFor(items, idx) {
    for (let j = idx + 1; j < items.length; j++) {
      const nx = items[j];
      if (nx.t !== "c") return "n";
      const latin = consLatin(items, j);
      if (!latin) continue;
      return has(LABIAL, latin[0]) ? "m" : "n";
    }
    return "m"; // word-final anusvara
  }

  function spell(items) {
    let out = "";
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.t === "lit") {
        out += it.s;
        continue;
      }
      const head = it.t === "c" ? consLatin(items, i) : "";
      let tail = it.tail || "";
      if (tail.indexOf(NASAL) !== -1) {
        tail = tail.split(NASAL).join(nasalFor(items, i));
      }
      out += head + (it.v || "") + tail;
    }
    return out;
  }

  function tidy(s) {
    return s.replace(/([a-z])\1{2,}/g, "$1$1");
  }

  // romanize(word) receives ONE maximal run of consecutive characters from these
  // ranges (whitespace and punctuation already split them, so this is a word).
  function romanize(word) {
    if (!word) return "";
    const w = normalize(word);
    if (has(DICT, w)) return DICT[w];
    const items = parse(w);
    if (!items.length) return "";
    return tidy(spell(items));
  }

  const mod = { id: "kannada", languages: ["Kannada"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
