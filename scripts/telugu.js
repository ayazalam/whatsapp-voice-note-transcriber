/**
 * Telugu -> Roman transliteration (U+0C00-U+0C7F).
 *
 * Telugu spells its voicing and aspiration, so unlike Tamil there is nothing
 * positional to guess: క k, ఖ kh, గ g, ఘ gh straight down the varga table. The
 * judgement calls are elsewhere:
 *
 *   - Long vowels get one Latin letter (ఆ -> a, ఈ -> i, ఊ -> u), because that
 *     is how Telugu is actually written in Latin: telugu, namaskaram,
 *     dhanyavadalu, Vijayawada, Guntur.
 *   - Retroflex and dental series collapse together (ట and త are both t, డ and
 *     ద are both d). Nobody types dots under letters on a phone.
 *   - The inherent vowel is never deleted. Telugu keeps its final vowel, which
 *     is the most audible difference from Hindi: ధన్యవాద -> dhanyavada, not
 *     "dhanyavad", and the very common final ు stays -u (telugu, unnaru).
 *   - ం is n or m depending on what follows: andam, santosham, kompa.
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0c00, 0x0c7f]];

  const VIRAMA = "్";
  const NUKTA = "఼";
  const NASAL = ""; // sentinel: n or m, decided by the next onset
  const AI_LENGTH = "ౖ";
  const LENGTH = "ౕ";

  const CONS = {
    "క": "k", "ఖ": "kh", "గ": "g", "ఘ": "gh", "ఙ": "ng",
    "చ": "ch", "ఛ": "chh", "జ": "j", "ఝ": "jh", "ఞ": "nj",
    "ట": "t", "ఠ": "th", "డ": "d", "ఢ": "dh", "ణ": "n",
    "త": "t", "థ": "th", "ద": "d", "ధ": "dh", "న": "n",
    "ప": "p", "ఫ": "ph", "బ": "b", "భ": "bh", "మ": "m",
    "య": "y", "ర": "r", "ఱ": "r", "ల": "l", "ళ": "l", "ఴ": "l",
    "వ": "v", "శ": "sh", "ష": "sh", "స": "s", "హ": "h",
    "ౘ": "ts", "ౙ": "dz", "ౚ": "r", "ౝ": "n"
  };

  // Nasals when they carry a virama and lean on the next letter.
  const DEAD = { "ఙ": "n", "ఞ": "n", "ణ": "n", "న": "n", "మ": "m" };

  // dead X + Y spelled as one thing
  const PAIR = { "జఞ": "gn" };

  const INDEP = {
    "అ": "a", "ఆ": "a", "ఇ": "i", "ఈ": "i", "ఉ": "u", "ఊ": "u",
    "ఋ": "ri", "ౠ": "ri", "ఌ": "lu", "ౡ": "lu",
    "ఎ": "e", "ఏ": "e", "ఐ": "ai", "ఒ": "o", "ఓ": "o", "ఔ": "au"
  };

  const SIGN = {
    "ా": "a", "ి": "i", "ీ": "i", "ు": "u", "ూ": "u",
    "ృ": "ri", "ౄ": "ri", "ౢ": "lu", "ౣ": "lu",
    "ె": "e", "ే": "e", "ై": "ai", "ొ": "o", "ో": "o", "ౌ": "au"
  };

  // U+0C04 is the combining anusvara above; it nasalises exactly like ం and
  // must not be dropped, or the nasal vanishes from the word.
  const MARKS = { "ఀ": NASAL, "ఁ": NASAL, "ం": NASAL, "ఄ": NASAL, "ః": "h" };

  const LIT = {
    "౦": "0", "౧": "1", "౨": "2", "౩": "3", "౪": "4",
    "౫": "5", "౬": "6", "౭": "7", "౮": "8", "౯": "9",
    "౸": "0", "౹": "1/4", "౺": "1/2", "౻": "3/4",
    "౼": "1/16", "౽": "1/8", "౾": "3/16"
  };

  const LABIAL = { p: 1, b: 1, m: 1, f: 1, v: 1 };

  const DICT = {
    "తెలుగు": "telugu", "తెలంగాణ": "telangana", "ఆంధ్ర": "andhra",
    "ఆంధ్రప్రదేశ్": "Andhra Pradesh", "హైదరాబాద్": "Hyderabad",
    "విజయవాడ": "Vijayawada", "విశాఖపట్నం": "Visakhapatnam",
    "తిరుపతి": "Tirupati", "గుంటూరు": "Guntur", "భారత": "bharat",
    "నేను": "nenu", "నువ్వు": "nuvvu", "మీరు": "meeru", "మేము": "memu",
    "మనం": "manam", "వాడు": "vadu", "ఆమె": "ame", "అతను": "athanu",
    "వాళ్ళు": "vallu", "వారు": "varu", "నీ": "nee", "నా": "naa",
    "ఏమిటి": "emiti", "ఏంటి": "enti", "ఎక్కడ": "ekkada", "ఎప్పుడు": "eppudu",
    "ఎందుకు": "enduku", "ఎవరు": "evaru", "ఎంత": "entha", "ఎలా": "ela",
    "ఏమి": "emi", "ఏది": "edi", "ఇక్కడ": "ikkada", "అక్కడ": "akkada",
    "అవును": "avunu", "కాదు": "kadu", "లేదు": "ledu", "ఉంది": "undi",
    "ఉన్నారు": "unnaru", "ఉన్నాను": "unnanu", "ఉన్నాయి": "unnayi",
    "సరే": "sare", "మంచిది": "manchidi", "బాగుంది": "bagundi",
    "బాగున్నారా": "bagunnara", "బాగున్నాను": "bagunnanu",
    "నమస్కారం": "namaskaram", "ధన్యవాదాలు": "dhanyavadalu",
    "ధన్యవాదములు": "dhanyavadamulu", "క్షమించండి": "kshaminchandi",
    "దయచేసి": "dayachesi", "చెప్పండి": "cheppandi", "వినండి": "vinandi",
    "చాలా": "chala", "కొంచెం": "koncham", "కొద్దిగా": "koddiga",
    "ఇప్పుడు": "ippudu", "తర్వాత": "tarvata", "ముందు": "mundu",
    "ఈరోజు": "eeroju", "రేపు": "repu", "నిన్న": "ninna", "మళ్ళీ": "malli",
    "ఉదయం": "udayam", "సాయంత్రం": "sayantram", "రాత్రి": "ratri",
    "సమయం": "samayam", "గంట": "ganta", "రోజు": "roju", "వారం": "varam",
    "నెల": "nela", "సంవత్సరం": "samvatsaram", "ఏడాది": "edadi",
    "అన్నం": "annam", "నీళ్ళు": "nillu", "నీరు": "neeru", "పాలు": "palu",
    "టీ": "tea", "కాఫీ": "coffee", "ఇల్లు": "illu", "ఊరు": "ooru",
    "పని": "pani", "డబ్బు": "dabbu", "డబ్బులు": "dabbulu", "జీతం": "jeetam",
    "అమ్మ": "amma", "నాన్న": "nanna", "అన్న": "anna", "అక్క": "akka",
    "తమ్ముడు": "tammudu", "చెల్లి": "chelli", "కొడుకు": "koduku",
    "కూతురు": "koothuru", "పిల్లలు": "pillalu", "ఫ్రెండ్": "friend",
    "ప్రేమ": "prema", "స్నేహం": "sneham", "సంతోషం": "santosham",
    "దేవుడు": "devudu", "గుడి": "gudi", "కృష్ణ": "krishna", "రామ": "rama",
    "అమృతం": "amrutham", "శ్రీ": "sri", "పండుగ": "panduga",
    "సంక్రాంతి": "sankranti", "దీపావళి": "deepavali",
    "మంచి": "manchi", "చెడు": "chedu", "పెద్ద": "pedda", "చిన్న": "chinna",
    "కావాలి": "kavali", "వద్దు": "vaddu", "తెలుసు": "telusu",
    "తెలియదు": "teliyadu", "అర్థమైంది": "arthamaindi", "వచ్చింది": "vachindi",
    "వెళ్ళు": "vellu", "రండి": "randi", "పోదాం": "podam", "చూడు": "chudu",
    // English written in Telugu script
    "ఫోన్": "phone", "మొబైల్": "mobile", "మెసేజ్": "message",
    "ఆఫీస్": "office", "ఆర్డర్": "order", "పేమెంట్": "payment",
    "మీటింగ్": "meeting", "కస్టమర్": "customer", "డెలివరీ": "delivery",
    "బిల్లు": "bill", "రేటు": "rate", "స్టాక్": "stock", "నంబర్": "number",
    "అడ్రస్": "address", "కంపెనీ": "company", "డాక్టర్": "doctor",
    "హాస్పిటల్": "hospital", "స్కూల్": "school", "కాలేజ్": "college",
    "బస్": "bus", "కారు": "car", "ట్రైన్": "train", "ఓకే": "ok",
    "థాంక్స్": "thanks", "సారీ": "sorry", "వాట్సాప్": "WhatsApp",
    "బ్యాంక్": "bank", "అకౌంట్": "account", "ఈమెయిల్": "email"
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

      // A mark with nothing to attach to (leading anusvara, stray visarga).
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
        // so ధ్ధ is dh and not dhdh.
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
    return "m"; // word-final anusvara: santosham, andam
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

  const mod = { id: "telugu", languages: ["Telugu"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
