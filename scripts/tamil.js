/**
 * Tamil -> Roman transliteration (U+0B80-U+0BFF).
 *
 * Tamil writes one letter per plosive series, so the script never tells you
 * whether a stop is voiced: க is k or g, த is th or dh, ப is p or b, ச is s or
 * j, ற is r or dr. Voicing is positional, and getting that rule right is the
 * whole difference between readable Tanglish and mush:
 *
 *   word-initial          unvoiced    கடை  -> kadai      (k..., then d)
 *   doubled (geminate)    unvoiced    சாப்பாடு -> sappadu
 *   after another stop    unvoiced    அர்த்தம் -> artham
 *   between vowels        voiced      அது  -> adhu
 *   after a nasal         voiced      நன்றி -> nandri, வாங்க -> vanga
 *
 * Long vowels are spelled with a single Latin letter (ஆ -> a, ஈ -> i, ஊ -> u)
 * because that is what people type: vanakkam, sappadu, nandri, tamilnadu. A
 * dictionary of very common words overrides the generic output where the
 * spelling everybody uses differs (naan, veedu, tamil).
 *
 * Tamil does not delete its inherent vowel the way Hindi does, so a live
 * consonant always keeps its "a": வர -> vara, not "var".
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0b80, 0x0bff]];

  const VIRAMA = "்";      // ் pulli
  const AYTHAM = "ஃ";      // ஃ
  const ANUSVARA = "ஂ";    // ஂ
  const AU_LENGTH = "ௗ";   // ௗ
  const NASAL = "\u0001"; // sentinel: n or m, decided by the next onset

  // Positional forms of the six stops.
  //   i = word-initial, g = geminate, v = intervocalic (voiced),
  //   n = after a nasal (voiced), c = after any other consonant, d = dead form
  const PLOSIVE = {
    "க": { i: "k", g: "kk", v: "g", n: "g", c: "k", d: "k" },
    "ச": { i: "s", g: "ch", v: "s", n: "j", c: "s", d: "ch" },
    "ட": { i: "d", g: "tt", v: "d", n: "d", c: "t", d: "t" },
    "த": { i: "th", g: "th", v: "dh", n: "dh", c: "th", d: "th" },
    "ப": { i: "p", g: "pp", v: "b", n: "b", c: "p", d: "p" },
    "ற": { i: "r", g: "ttr", v: "r", n: "dr", c: "r", d: "r" }
  };

  // Nasals as a dead (pulli-bearing) consonant.
  const NASAL_DEAD = {
    "ங": "n", "ஞ": "n", "ண": "n", "ந": "n", "ன": "n", "ம": "m"
  };

  const CONS = {
    "க": "k", "ங": "ng", "ச": "s", "ஞ": "nj", "ட": "t", "ண": "n",
    "த": "th", "ந": "n", "ன": "n", "ப": "p", "ம": "m",
    "ய": "y", "ர": "r", "ற": "r", "ல": "l", "ள": "l", "ழ": "zh", "வ": "v",
    // grantha letters, used for Sanskrit and English loans
    "ஜ": "j", "ஶ": "sh", "ஷ": "sh", "ஸ": "s", "ஹ": "h"
  };

  const INDEP = {
    "அ": "a", "ஆ": "a", "இ": "i", "ஈ": "i", "உ": "u", "ஊ": "u",
    "எ": "e", "ஏ": "e", "ஐ": "ai", "ஒ": "o", "ஓ": "o", "ஔ": "au"
  };

  const SIGN = {
    "ா": "a", "ி": "i", "ீ": "i", "ு": "u", "ூ": "u",
    "ெ": "e", "ே": "e", "ை": "ai", "ொ": "o", "ோ": "o", "ௌ": "au"
  };

  // ஃ + stop is how modern Tamil writes f, z and x.
  const AYTHAM_MAP = { "ப": "f", "ஜ": "z", "ஸ": "s", "ஹ": "h", "க": "kh", "ச": "s" };

  const LIT = {
    "௦": "0", "௧": "1", "௨": "2", "௩": "3", "௪": "4",
    "௫": "5", "௬": "6", "௭": "7", "௮": "8", "௯": "9",
    "௰": "10", "௱": "100", "௲": "1000",
    "௳": "day", "௴": "month", "௵": "year",
    "௶": "debit", "௷": "credit", "௸": "as above",
    "௹": "Rs", "௺": "No.", "ௐ": "om"
  };

  const LABIAL = { p: 1, b: 1, m: 1, f: 1, v: 1 };

  // Where the mechanical output is not what anyone actually types.
  const DICT = {
    "தமிழ்": "tamil", "தமிழ": "tamizha", "தமிழ்நாடு": "tamilnadu",
    "இந்தியா": "india", "சென்னை": "chennai", "மதுரை": "madurai",
    "கோயம்புத்தூர்": "coimbatore", "திருச்சி": "trichy", "பெங்களூரு": "bengaluru",
    // Place names whose English spelling is fixed by usage. The positional
    // voicing rule is right for native words but over-applies inside Sanskrit
    // and English-fixed compounds (kumbagonam, kanniyagumari, tharmaburi).
    "ஈரோடு": "Erode", "திருநெல்வேலி": "Tirunelveli", "கும்பகோணம்": "Kumbakonam",
    "வேலூர்": "Vellore", "தூத்துக்குடி": "Thoothukudi", "கன்னியாகுமரி": "Kanyakumari",
    "ராமேஸ்வரம்": "Rameswaram", "திண்டுக்கல்": "Dindigul", "கடலூர்": "Cuddalore",
    "நாகர்கோவில்": "Nagercoil", "புதுச்சேரி": "Puducherry", "திருப்பூர்": "Tiruppur",
    "விழுப்புரம்": "Villupuram", "கரூர்": "Karur", "நாமக்கல்": "Namakkal",
    "தர்மபுரி": "Dharmapuri", "சேலம்": "Salem", "தஞ்சாவூர்": "Thanjavur",
    "திருச்சிராப்பள்ளி": "Tiruchirappalli", "கோவை": "Coimbatore",
    "நான்": "naan", "நீ": "nee", "நீங்க": "neenga", "நீங்கள்": "neengal",
    "நாங்க": "naanga", "நாங்கள்": "naangal", "நாம": "naama", "நாம்": "naam",
    "யார்": "yaar", "யாரு": "yaaru", "ஏன்": "yen",
    "வீடு": "veedu", "வீட்டுக்கு": "veettukku", "வீட்டில்": "veettil",
    "வீட்ல": "veetla", "ஊர்": "oor", "ஊருக்கு": "oorukku",
    "பூ": "poo", "மீன்": "meen", "தண்ணீர்": "thanneer", "பால்": "paal",
    "சீக்கிரம்": "seekiram", "மூன்று": "moondru", "மூணு": "moonu",
    "ஆறு": "aaru", "நூறு": "nooru", "ஆயிரம்": "aayiram", "ஏழு": "ezhu",
    "வாங்க": "vaanga", "வாங்கோ": "vaango", "பாருங்க": "paarunga",
    "இருக்கீங்க": "irukkeenga", "இருக்கீங்களா": "irukkeengala",
    "கீழ": "keezha", "கீழே": "keezhe", "மேலே": "mele",
    "நேத்து": "nethu", "தூக்கம்": "thookkam", "தூங்கு": "thoongu",
    "பள்ளிக்கூடம்": "pallikoodam", "பிரச்சனை": "prachanai",
    "பிரச்சினை": "prachanai", "சந்தோஷம்": "santhosham",
    "தீபாவளி": "deepavali", "மார்கழி": "margazhi", "பொங்கல்": "pongal",
    "லட்சம்": "laksham", "ரூபாய்": "rupai", "கார்": "car",
    "தாத்தா": "thatha", "பாட்டி": "paatti", "அண்ணே": "anne",
    "மச்சான்": "machan", "மாமா": "maama", "அத்தை": "aththai",
    // English written in Tamil script -> spell it back in English
    "ஃபோன்": "phone", "போன்": "phone", "மொபைல்": "mobile",
    "மெசேஜ்": "message", "மேசேஜ்": "message", "ஆபீஸ்": "office",
    "ஆஃபீஸ்": "office", "பேமெண்ட்": "payment", "பேமென்ட்": "payment",
    "ஆர்டர்": "order", "மீட்டிங்": "meeting", "கஸ்டமர்": "customer",
    "டெலிவரி": "delivery", "பில்": "bill", "ரேட்": "rate",
    "ஸ்டாக்": "stock", "நம்பர்": "number", "அட்ரஸ்": "address",
    "கம்பெனி": "company", "டாக்டர்": "doctor", "ஆஸ்பத்திரி": "hospital",
    "ஸ்கூல்": "school", "காலேஜ்": "college", "பஸ்": "bus",
    "ட்ரெயின்": "train", "ஓகே": "ok", "தேங்க்ஸ்": "thanks",
    "சாரி": "sorry", "பாஸ்": "boss", "பிரண்ட்": "friend",
    "டைம்": "time", "வாட்ஸ்அப்": "WhatsApp", "இன்டர்நெட்": "internet",
    "ஈமெயில்": "email", "பேங்க்": "bank", "அக்கவுண்ட்": "account",
    "லோன்": "loan", "சிம்": "SIM", "ரீசார்ஜ்": "recharge",
    // very common words the generic rules already get right, pinned so they
    // never drift when the rules are tuned
    "வணக்கம்": "vanakkam", "நன்றி": "nandri", "சாப்பாடு": "sappadu",
    "சாப்பிட்டீங்களா": "sappitteengala", "எப்படி": "eppadi",
    "என்ன": "enna", "எங்க": "enga", "இங்க": "inga", "அங்க": "anga",
    "சரி": "sari", "இல்லை": "illai", "இல்ல": "illa", "ஆமாம்": "amaam",
    "ஆம்": "aam", "வேண்டாம்": "vendam", "வேணும்": "venum",
    "தெரியும்": "theriyum", "தெரியாது": "theriyadhu", "தெரியல": "theriyala",
    "புரியல": "puriyala", "முடியும்": "mudiyum", "முடியாது": "mudiyadhu",
    "ரொம்ப": "romba", "கொஞ்சம்": "konjam", "நிறைய": "niraiya",
    "எல்லாம்": "ellam", "சும்மா": "summa", "அப்புறம்": "appuram",
    "இப்போ": "ippo", "அப்போ": "appo", "இன்னிக்கு": "innikku",
    "நாளைக்கு": "nalaikku", "நேரம்": "neram", "மணி": "mani",
    "பணம்": "panam", "காசு": "kasu", "வேலை": "velai", "சம்பளம்": "sambalam",
    "அம்மா": "amma", "அப்பா": "appa", "அண்ணா": "anna", "அக்கா": "akka",
    "தம்பி": "thambi", "தங்கை": "thangai", "பையன்": "paiyan",
    "பொண்ணு": "ponnu", "கடவுள்": "kadavul", "கோயில்": "koyil",
    "வந்து": "vandhu", "வந்தேன்": "vandhen", "போனேன்": "ponen",
    "சொன்னேன்": "sonnen", "பண்றேன்": "pandren", "வர்றேன்": "varren",
    "கண்டிப்பா": "kandippa", "நிச்சயம்": "nichayam", "நல்லா": "nalla",
    "ஒன்னும்": "onnum", "எதுவும்": "edhuvum", "ஏதாவது": "edhavadhu"
  };

  const has = (obj, k) => k !== undefined && Object.prototype.hasOwnProperty.call(obj, k);

  function normalize(word) {
    let s = word;
    try {
      s = s.normalize("NFC");
    } catch (_) { /* older engines: use the string as-is */ }
    return s.replace(/[\u200b-\u200f\u2060\ufeff]/g, "");
  }

  /** Reads the nasal marks that follow position i. */
  function readTail(w, i) {
    let tail = "";
    while (i < w.length && w[i] === ANUSVARA) {
      tail += NASAL;
      i += 1;
    }
    return tail;
  }

  function tailLength(w, i) {
    let n = 0;
    while (i + n < w.length && w[i + n] === ANUSVARA) n += 1;
    return n;
  }

  /**
   * Flat token list. Each token is one of
   *   { t: "c", ch, dead, v, tail, forced }   a consonant with its vowel
   *   { t: "v", v, tail }                     an independent vowel
   *   { t: "lit", s }                         a digit or symbol
   */
  function parse(w) {
    const items = [];
    let i = 0;

    while (i < w.length) {
      let forced = null;

      if (w[i] === AYTHAM) {
        if (has(AYTHAM_MAP, w[i + 1])) {
          forced = AYTHAM_MAP[w[i + 1]];
          i += 1;
        } else {
          items.push({ t: "lit", s: "h" });
          i += 1;
          continue;
        }
      }

      const ch = w[i];

      if (has(CONS, ch)) {
        i += 1;
        let dead = false;
        let v = "a";
        if (w[i] === VIRAMA) {
          dead = true;
          i += 1;
        } else if (has(SIGN, w[i])) {
          v = SIGN[w[i]];
          i += 1;
          if (w[i] === AU_LENGTH) {
            v = "au";
            i += 1;
          }
        } else if (w[i] === AU_LENGTH) {
          v = "au";
          i += 1;
        }
        const tail = dead ? "" : readTail(w, i);
        i += dead ? 0 : tailLength(w, i);
        items.push({ t: "c", ch, dead, v: dead ? "" : v, tail, forced });
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

      i += 1; // stray mark, avagraha, anything unmapped
    }

    return items;
  }

  /** Spelling of the consonant at items[idx], given what surrounds it. */
  function consLatin(items, idx) {
    const it = items[idx];
    if (it.forced) return it.forced;

    const ch = it.ch;
    const prev = items[idx - 1];
    const next = items[idx + 1];
    const base = has(CONS, ch) ? CONS[ch] : "";
    const p = has(PLOSIVE, ch) ? PLOSIVE[ch] : null;

    if (it.dead) {
      const twin = next && next.t === "c" && next.ch === ch;
      // The live half of a geminate spells the whole thing (க்க -> kk, ச்ச ->
      // ch), and ங்ங / ஞ்ஞ would otherwise stutter as ngng / njnj.
      if (twin && (p || base.length > 1)) return "";
      if (has(NASAL_DEAD, ch)) return NASAL_DEAD[ch];
      if (p) return p.d;
      return base;
    }

    if (!p) return base;

    if (prev && prev.t === "c" && prev.dead && prev.ch === ch) return p.g;
    if (!prev || prev.t === "lit") return p.i;          // word-initial
    if (prev.t === "v") return p.v;                     // after a vowel
    if (prev.t === "c" && !prev.dead) return p.v;       // after a live syllable
    if (prev.t === "c" && prev.dead) {
      return has(NASAL_DEAD, prev.ch) ? p.n : p.c;
    }
    return p.i;
  }

  /** n or m, whichever the following onset wants. */
  function nasalFor(items, idx) {
    for (let j = idx + 1; j < items.length; j++) {
      const nx = items[j];
      if (nx.t === "lit") return "n";
      if (nx.t === "v") return "n";
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

  const mod = { id: "tamil", languages: ["Tamil"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
