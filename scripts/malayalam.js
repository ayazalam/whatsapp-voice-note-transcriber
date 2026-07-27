/**
 * Malayalam -> Roman transliteration (U+0D00-U+0D7F).
 *
 * Same abugida machinery as the Devanagari module, but Malayalam has three
 * habits of its own that decide whether the output reads like Manglish or like
 * mush:
 *
 *   - Chillus. ൻ ർ ൽ ൾ ൺ ൿ are pure consonants with no vowel at all, so
 *     ഞാൻ -> njan and സ്കൂൾ -> skool. The legacy spellings (ന + chandrakkala +
 *     ZWJ) mean exactly the same thing and get folded into the atomic letters
 *     before anything else runs.
 *   - Samvrutokaram. A word-final chandrakkala is not silence, it is a half-u:
 *     അത് -> athu, ഉണ്ട് -> undu, വീട് -> veedu. Malayalam never drops its
 *     final vowel the way Hindi drops schwa, and getting this wrong is the most
 *     audible mistake a Malayalam romaniser can make.
 *   - ട voices between vowels. കട -> kada, പാടം -> padam, വീട് -> veedu, but
 *     ടിക്കറ്റ് -> t..., ഇഷ്ടം -> ishtam and ട്ട -> tt. The other stops keep
 *     their written value, which is what people actually type.
 *
 * Long vowels: ാ is a plain "a" (malayalam, sukhamano) while ീ and ൂ double up
 * (veedu, nooru, nee) — that is the spelling everybody uses.
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0d00, 0x0d7f]];

  const VIRAMA = "്";        // ് chandrakkala
  const VIRAMA_BAR = "഻";    // ᳚ vertical bar virama
  const VIRAMA_CIRC = "഼";   // circular virama
  const NASAL = "";         // sentinel: n or m, decided by the next onset

  const AA_SIGN = "ാ";       // ാ
  const E_SIGN = "െ";        // െ
  const EE_SIGN = "േ";       // േ
  const AU_LENGTH = "ൗ";     // ൗ
  const TTA = "ട";           // ട

  const CONS = {
    "ക": "k", "ഖ": "kh", "ഗ": "g", "ഘ": "gh", "ങ": "ng",
    "ച": "ch", "ഛ": "chh", "ജ": "j", "ഝ": "jh", "ഞ": "nj",
    "ട": "t", "ഠ": "th", "ഡ": "d", "ഢ": "dh", "ണ": "n",
    "ത": "th", "ഥ": "th", "ദ": "d", "ധ": "dh", "ന": "n", "ഩ": "n",
    "പ": "p", "ഫ": "ph", "ബ": "b", "ഭ": "bh", "മ": "m",
    "യ": "y", "ര": "r", "റ": "r", "ല": "l", "ള": "l", "ഴ": "zh", "വ": "v",
    "ശ": "sh", "ഷ": "sh", "സ": "s", "ഹ": "h", "ഺ": "t"
  };

  // Chillus: consonants that carry no vowel and never will.
  const CHILLU = {
    "ൺ": "n", "ൻ": "n", "ർ": "r", "ൽ": "l", "ൾ": "l", "ൿ": "k",
    "ൔ": "m", "ൕ": "y", "ൖ": "zh", "ൎ": "r"
  };

  // Nasals in their vowel-less form.
  const DEAD_NASAL = {
    "ങ": "n", "ഞ": "n", "ണ": "n", "ന": "n", "ഩ": "n", "മ": "m",
    "ൺ": "n", "ൻ": "n", "ൔ": "m"
  };

  // dead X + Y spelled as one unit: [what the dead half prints, what Y prints]
  const PAIR = {
    "നറ": ["n", "t"],   // ന്റ -> nt   (ente, avante, ninte)
    "ൻറ": ["n", "t"],   // legacy spelling of the same thing
    "ററ": ["", "tt"],   // റ്റ -> tt   (kuttam, pattilla, ettavum)
    "ണട": ["n", "d"],   // ണ്ട -> nd   (undu, randu, kandu)
    "ജഞ": ["", "gn"]    // ജ്ഞ -> gn  (gnanam, vignanam, yagnam); printing the
                        // two letters separately gives the garble "jnj"
  };

  const INDEP = {
    "അ": "a", "ആ": "a", "ഇ": "i", "ഈ": "ee", "ഉ": "u", "ഊ": "oo",
    "ഋ": "ri", "ൠ": "ri", "ഌ": "lu", "ൡ": "lu",
    "എ": "e", "ഏ": "e", "ഐ": "ai", "ഒ": "o", "ഓ": "o", "ഔ": "au",
    "ൟ": "ee", "ഄ": "a"
  };

  const SIGN = {
    "ാ": "a", "ി": "i", "ീ": "ee", "ു": "u", "ൂ": "oo",
    "ൃ": "ri", "ൄ": "ri", "ൢ": "lu", "ൣ": "lu",
    "െ": "e", "േ": "e", "ൈ": "ai", "ൊ": "o", "ോ": "o", "ൌ": "au",
    "ൗ": "au"
  };

  const MARKS = { "ഀ": NASAL, "ഁ": NASAL, "ം": NASAL, "ഃ": "h" };

  const LIT = {
    "൦": "0", "൧": "1", "൨": "2", "൩": "3", "൪": "4",
    "൫": "5", "൬": "6", "൭": "7", "൮": "8", "൯": "9",
    "൰": "10", "൱": "100", "൲": "1000",
    "൳": "1/4", "൴": "1/2", "൵": "3/4",
    "൶": "1/16", "൷": "1/8", "൸": "3/16", "൹": "date",
    "൘": "1/160", "൙": "1/40", "൚": "3/80", "൛": "1/20",
    "൜": "1/10", "൝": "3/20", "൞": "1/5", "൏": "para"
  };

  // ം is an m at heart and only fronts before a velar or a dental:
  // sambhavam, samsaram, samshayam, but sangathi and santhosham.
  const FRONTING = { k: 1, g: 1, c: 1, j: 1, t: 1, d: 1, n: 1 };

  // Where the mechanical output is not what anyone actually types.
  const DICT = {
    // pronouns and the question words
    "ഞാൻ": "njan", "ഞങ്ങൾ": "njangal", "നമ്മൾ": "nammal", "നാം": "nam",
    "നീ": "nee", "നിങ്ങൾ": "ningal", "താങ്കൾ": "thankal",
    "അവൻ": "avan", "അവൾ": "aval", "അവർ": "avar", "അയാൾ": "ayal",
    "അത്": "athu", "ഇത്": "ithu", "ഏത്": "ethu", "ഇവിടെ": "ivide",
    "അവിടെ": "avide", "എവിടെ": "evide", "എവിടെയാണ്": "evideyanu",
    "എന്ത്": "enthu", "എന്താ": "entha", "എന്താണ്": "enthanu",
    "ആര്": "aaru", "ആരാ": "aara", "ആരാണ്": "aaranu",
    "എപ്പോൾ": "eppol", "എപ്പോ": "eppo", "എങ്ങനെ": "engane",
    "എന്തിന്": "enthinu", "എന്തുകൊണ്ട്": "enthukondu", "എത്ര": "ethra",
    "ഇപ്പോൾ": "ippol", "ഇപ്പോ": "ippo", "അപ്പോൾ": "appol",
    "എന്റെ": "ente", "നിന്റെ": "ninte", "അവന്റെ": "avante",
    "അവളുടെ": "avalude", "നമ്മുടെ": "nammude", "എനിക്ക്": "enikku",
    "നിനക്ക്": "ninakku", "അവന്": "avanu", "ഞങ്ങൾക്ക്": "njangalkku",

    // the yes/no/know/want core
    "ആണ്": "aanu", "അല്ല": "alla", "ഇല്ല": "illa", "ഉണ്ട്": "undu",
    "ഉവ്വ്": "uvvu", "വേണം": "venam", "വേണ്ട": "venda", "മതി": "mathi",
    "ശരി": "sheri", "അറിയാം": "ariyam", "അറിയില്ല": "ariyilla",
    "മനസ്സിലായി": "manassilayi", "മനസ്സിലായോ": "manassilayo",
    "പറ്റും": "pattum", "പറ്റില്ല": "pattilla", "കഴിയും": "kazhiyum",
    "ഒന്നും": "onnum", "എല്ലാം": "ellam", "ചിലത്": "chilathu",
    "എന്തെങ്കിലും": "enthenkilum", "ആരെങ്കിലും": "aarenkilum",

    // greetings and courtesy
    "നന്ദി": "nandi", "നമസ്കാരം": "namaskaram", "സുഖമാണോ": "sukhamano",
    "സുഖമാണ്": "sukhamanu", "സുഖം": "sukham", "സന്തോഷം": "santhosham",
    "ക്ഷമിക്കണം": "kshamikkanam", "ദയവായി": "dayavayi",
    "അഭിനന്ദനങ്ങൾ": "abhinandanangal", "ആശംസകൾ": "aashamsakal",
    "സ്വാഗതം": "swagatham", "വിട": "vida",

    // verbs people actually send
    "വരൂ": "varu", "വരാം": "varam", "വന്നു": "vannu", "വരുന്നു": "varunnu",
    "പോകാം": "pokam", "പോയി": "poyi", "പോകുന്നു": "pokunnu",
    "പറയൂ": "parayu", "പറഞ്ഞു": "paranju", "പറയാം": "parayam",
    "കേട്ടു": "kettu", "നോക്കൂ": "nokku", "നോക്കാം": "nokkam",
    "ചെയ്യാം": "cheyyam", "ചെയ്തു": "cheythu", "അയച്ചു": "ayachu",
    "കിട്ടി": "kitti", "തരാം": "tharam", "എടുക്കൂ": "edukku",
    "കാണാം": "kanam", "കണ്ടു": "kandu", "വിളിക്കാം": "vilikkam",
    "വിളിച്ചു": "vilichu", "കാത്തിരിക്കൂ": "kathirikku",

    // people
    "അമ്മ": "amma", "അച്ഛൻ": "achan", "ചേട്ടൻ": "chettan", "ചേച്ചി": "chechi",
    "അനിയൻ": "aniyan", "അനിയത്തി": "aniyathi", "മകൻ": "makan",
    "മകൾ": "makal", "കുട്ടി": "kutty", "കുട്ടികൾ": "kuttikal",
    "പെണ്ണ്": "pennu", "ആൺകുട്ടി": "aankutty", "ഭാര്യ": "bharya",
    "ഭർത്താവ്": "bharthavu", "കൂട്ടുകാരൻ": "koottukaran",
    "സുഹൃത്ത്": "suhruthu", "ആള്": "aalu", "ആളുകൾ": "aalukal",

    // food, house, money, work
    "ഭക്ഷണം": "bhakshanam", "ചോറ്": "choru", "വെള്ളം": "vellam",
    "പാൽ": "paal", "ചായ": "chaya", "കാപ്പി": "kappi", "മീൻ": "meen",
    "മുട്ട": "mutta", "ദോശ": "dosha", "വീട്": "veedu", "വീട്ടിൽ": "veettil",
    "നാട്": "nadu", "സ്ഥലം": "sthalam", "ജോലി": "joli", "പണം": "panam",
    "ശമ്പളം": "sambalam", "കട": "kada", "വില": "vila", "കണക്ക്": "kanakku",

    // time
    "സമയം": "samayam", "മണി": "mani", "ഇന്ന്": "innu", "നാളെ": "naale",
    "ഇന്നലെ": "innale", "രാവിലെ": "ravile", "ഉച്ച": "ucha",
    "വൈകുന്നേരം": "vaikunneram", "രാത്രി": "rathri", "ദിവസം": "divasam",
    "ആഴ്ച": "azhcha", "മാസം": "masam", "വർഷം": "varsham", "പിന്നെ": "pinne",
    "ഉടനെ": "udane", "വേഗം": "vegam", "പതുക്കെ": "pathukke",

    // places and festivals
    "കേരളം": "keralam", "മലയാളം": "malayalam", "ഇന്ത്യ": "india",
    "കൊച്ചി": "Kochi", "തിരുവനന്തപുരം": "Thiruvananthapuram",
    "കോഴിക്കോട്": "Kozhikode", "തൃശ്ശൂർ": "Thrissur", "എറണാകുളം": "Ernakulam",
    "കണ്ണൂർ": "Kannur", "കൊല്ലം": "Kollam", "ദൈവം": "daivam",
    "അമ്പലം": "ambalam", "പള്ളി": "palli", "ഓണം": "Onam", "വിഷു": "Vishu",
    "പെരുന്നാൾ": "perunnal", "ക്രിസ്മസ്": "Christmas", "ശ്രീ": "Sri",

    // qualities and quantities
    "നല്ല": "nalla", "നല്ലത്": "nallathu", "ചീത്ത": "cheetha",
    "വലിയ": "valiya", "ചെറിയ": "cheriya", "കുറച്ച്": "kurachu",
    "ഒരുപാട്": "orupadu", "കുറേ": "kure", "മാത്രം": "mathram",
    "ഒന്ന്": "onnu", "രണ്ട്": "randu", "മൂന്ന്": "moonnu", "നാല്": "naalu",
    "അഞ്ച്": "anchu", "ആറ്": "aaru", "ഏഴ്": "ezhu", "എട്ട്": "ettu",
    "ഒൻപത്": "onpathu", "പത്ത്": "pathu", "നൂറ്": "nooru",
    "ആയിരം": "aayiram", "ലക്ഷം": "laksham",

    // English written in Malayalam script -> spell it back in English
    "ഫോൺ": "phone", "മൊബൈൽ": "mobile", "മെസേജ്": "message",
    "ഓഫീസ്": "office", "ഓർഡർ": "order", "പേമെന്റ്": "payment",
    "മീറ്റിംഗ്": "meeting", "കസ്റ്റമർ": "customer", "ഡെലിവറി": "delivery",
    "ബില്ല്": "bill", "റേറ്റ്": "rate", "സ്റ്റോക്ക്": "stock",
    "നമ്പർ": "number", "അഡ്രസ്": "address", "കമ്പനി": "company",
    "ഡോക്ടർ": "doctor", "ആശുപത്രി": "hospital", "സ്കൂൾ": "school",
    "കോളേജ്": "college", "ബസ്": "bus", "കാർ": "car", "ട്രെയിൻ": "train",
    "ഓകെ": "ok", "താങ്ക്സ്": "thanks", "സോറി": "sorry",
    "വാട്സാപ്പ്": "WhatsApp", "ബാങ്ക്": "bank", "അക്കൗണ്ട്": "account",
    "ഇമെയിൽ": "email", "ടിക്കറ്റ്": "ticket", "ലീവ്": "leave",
    "ഫോട്ടോ": "photo", "വീഡിയോ": "video", "ഇന്റർനെറ്റ്": "internet"
  };

  const has = (obj, k) => k !== undefined && Object.prototype.hasOwnProperty.call(obj, k);
  const isVirama = (ch) => ch === VIRAMA || ch === VIRAMA_BAR || ch === VIRAMA_CIRC;

  // Legacy chillus: consonant + chandrakkala + ZWJ means the atomic letter.
  const LEGACY_CHILLU = {
    "ണ": "ൺ", "ന": "ൻ", "ര": "ർ", "ല": "ൽ", "ള": "ൾ", "ക": "ൿ",
    "മ": "ൔ", "യ": "ൕ", "ഴ": "ൖ"
  };

  function normalize(word) {
    let s = word;
    try {
      s = s.normalize("NFC");
    } catch (_) { /* older engines: use the string as-is */ }
    s = s.replace(
      /([ണനരലളകമയഴ])[\u0d4d\u0d3b\u0d3c]\u200d/g,
      (m, c) => LEGACY_CHILLU[c]
    );
    // Everything else invisible is presentation-only: ZWNJ after a chandrakkala
    // just makes the samvrutokaram visible, which we already spell as -u.
    return s.replace(/[\u200b-\u200f\u2060\ufeff]/g, "");
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
   * Reads the vowel that follows the consonant at position i, coping with the
   * two-part signs in case they arrive decomposed (െ + ാ = ൊ, േ + ാ = ോ,
   * െ + ൗ = ൌ, െ + െ = ൈ).
   */
  function readVowel(w, i) {
    let v = SIGN[w[i]];
    let n = 1;
    if (w[i] === E_SIGN || w[i] === EE_SIGN) {
      const nx = w[i + 1];
      if (nx === AA_SIGN) {
        v = "o";
        n = 2;
      } else if (nx === AU_LENGTH) {
        v = "au";
        n = 2;
      } else if (nx === E_SIGN) {
        v = "ai";
        n = 2;
      }
    }
    return { v, n };
  }

  /**
   * Flat token list. Each token is one of
   *   { t: "c", ch, dead, chillu, v, tail }   a consonant with its vowel
   *   { t: "v", v, tail }                     an independent vowel
   *   { t: "lit", s }                         a digit or symbol
   */
  function parse(w) {
    const items = [];
    let i = 0;

    while (i < w.length) {
      const ch = w[i];

      if (has(CHILLU, ch)) {
        items.push({ t: "c", ch, dead: true, chillu: true, v: "", tail: "" });
        i += 1;
        continue;
      }

      if (has(CONS, ch)) {
        i += 1;
        let dead = false;
        let v = "a";
        if (isVirama(w[i])) {
          dead = true;
          i += 1;
        } else if (has(SIGN, w[i])) {
          const got = readVowel(w, i);
          v = got.v;
          i += got.n;
          // ു + ് is samvrutokaram, the half-u — not a killed vowel.
          if (v === "u" && isVirama(w[i])) i += 1;
        }
        const tail = dead ? "" : readTail(w, i);
        if (!dead) i += tailLength(w, i);
        items.push({ t: "c", ch, dead, chillu: false, v: dead ? "" : v, tail });
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

      // A mark with nothing to lean on (leading anusvara, stray visarga).
      if (has(MARKS, ch)) {
        items.push({ t: "lit", s: MARKS[ch] === NASAL ? "m" : MARKS[ch] });
        i += 1;
        continue;
      }

      i += 1; // avagraha, unassigned, anything unmapped
    }

    return items;
  }

  const isDeadNasal = (it) => it && it.t === "c" && it.dead && has(DEAD_NASAL, it.ch);

  /** ട is the one stop whose value moves: kada, padam, veedu — but ishtam, tt. */
  function ttaLatin(items, idx) {
    const it = items[idx];
    const prev = items[idx - 1];
    const next = items[idx + 1];
    if (prev && prev.t === "c" && prev.dead && prev.ch === TTA) return "tt";
    if (it.dead && next && next.t === "c" && next.ch === TTA) return "";
    if (!prev || prev.t === "lit") return "t";        // word-initial
    if (prev.t === "c" && prev.dead) return isDeadNasal(prev) ? "d" : "t";
    return "d";                                       // after a vowel
  }

  /** Spelling of the consonant at items[idx], given what surrounds it. */
  function consLatin(items, idx) {
    const it = items[idx];
    const ch = it.ch;
    const prev = items[idx - 1];
    const next = items[idx + 1];
    const base = it.chillu ? CHILLU[ch] : CONS[ch];

    // Second half of a pair. The dead half already printed PAIR[0] on the
    // promise that this letter prints PAIR[1], so honour it whether this half
    // is live (ente, undu) or itself dead at the end of a word (pattu, entu) —
    // otherwise word-final റ്റ് / ന്റ് decay to a bare "r".
    if (prev && prev.t === "c" && prev.dead && has(PAIR, prev.ch + ch)) {
      return PAIR[prev.ch + ch][1];
    }

    if (it.dead) {
      if (next && next.t === "c" && has(PAIR, ch + next.ch)) return PAIR[ch + next.ch][0];
      if (ch === TTA) return ttaLatin(items, idx);
      // The live half of a geminate spells the whole thing, so ത്ത is th and
      // not thth, ച്ച is ch and not chch.
      if (next && next.t === "c" && next.ch === ch && base.length > 1) return "";
      if (has(DEAD_NASAL, ch)) return DEAD_NASAL[ch];
      return base;
    }

    if (ch === TTA) return ttaLatin(items, idx);
    return base;
  }

  /** n or m, whichever the following onset wants. */
  function nasalFor(items, idx) {
    for (let j = idx + 1; j < items.length; j++) {
      const nx = items[j];
      if (nx.t !== "c") return "m";
      const latin = consLatin(items, j);
      if (!latin) continue;
      return has(FRONTING, latin[0]) ? "n" : "m";
    }
    return "m"; // word-final: malayalam, samayam, panam
  }

  function spell(items) {
    let out = "";
    const last = items.length - 1;
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
      // Samvrutokaram: a word-final chandrakkala is a half-u, not silence.
      if (it.t === "c" && it.dead && !it.chillu && i === last && head) out += "u";
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

  const mod = { id: "malayalam", languages: ["Malayalam"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
