/**
 * Odia (U+0B00-U+0B7F) -> Roman.
 *
 * Same abugida machinery as the Devanagari module -- syllabify, drop the
 * inherent vowel where the language actually drops it, spell out -- but Odia
 * handles the inherent vowel very differently from Hindi, and that is what most
 * of this file is about.
 *
 *   1. NO medial schwa deletion. Odia is a vowel-retaining language: ଜଗନ୍ନାଥ is
 *      jagannath, not "jagnnath"; ସାଗର is sagar, not "sagr"; ନମସ୍କାର is
 *      namaskar. Running the Hindi VC_CV rule here mangles the language.
 *   2. Word-final inherent vowel drops ONLY if at least two vowels survive it.
 *      ଧନ୍ୟବାଦ -> dhanyabad and କଟକ -> katak, but ଭଲ stays bhala, ଘର stays
 *      ghara, ଦିନ stays dina -- Odia does not reduce a word to one syllable.
 *      It also stays after a conjunct: ଶବ୍ଦ -> shabda, ଅନ୍ୟ -> anya.
 *   3. Vowel length is not doubled. Because Odia never needed the aa/ee/oo
 *      trick, ା is a plain "a" and everything comes out as ami/pani/bhata.
 *
 * The inherent vowel is phonetically [ɔ], nearer Bengali's "o" than Hindi's
 * "a", but every romanisation Odia speakers actually use writes it "a" --
 * dhanyabad, namaskar, Jagannath, Bhubaneswar, Sambalpur, Cuttack -- so "a" is
 * what this module emits.
 *
 * Other Odia-specific behaviour:
 *   - ଯ = j on its own (ଯିବା -> jiba) but y as a ya-phala (ଧନ୍ୟ -> dhanya);
 *     ୟ = y always
 *   - ଡ଼ = d, ଢ଼ = dh (ଓଡ଼ିଶା -> odisha), ୱ = w, ଳ = l
 *   - ଶ ଷ = sh, ସ = s, ଜ୍ଞ = gy, କ୍ଷ = ksh
 *   - ଋ / ୃ are [ru]: ଅମୃତ -> amruta, କୃଷ୍ଣ -> krushna
 *   - ୍ବ after a stop is a w-glide: ସ୍ବାଗତ -> swagata, ଈଶ୍ୱର -> ishwara
 *   - ଂ anusvara is ng finally or before a velar, m before a labial, n
 *     elsewhere (ଏବଂ -> ebang, ସଂସାର -> sansara); ଁ candrabindu is plain n
 *   - ଙ in front of a velar is the plain homorganic nasal: ଗଙ୍ଗା -> ganga,
 *     ଅଙ୍କ -> anka, ସଙ୍ଗୀତ -> sangit
 *   - a word-final ୟ / ୱ / ହ keeps its vowel: ଭାରତୀୟ -> bharatiya,
 *     ସମୟ -> samaya, ସ୍ନେହ -> sneha
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0b00, 0x0b7f]];

  const VIRAMA = "୍";       // ୍
  const NUKTA = "଼";        // ଼
  const ANUSVARA = "ଂ";     // ଂ
  const CANDRABINDU = "ଁ";  // ଁ
  const VISARGA = "ଃ";      // ଃ
  const YA = "ଯ";           // ଯ
  const YYA = "ୟ";          // ୟ
  const BA = "ବ";           // ବ

  // Sentinels for nasals whose realisation depends on the following onset.
  const NASAL = "\u0001";      // ଂ  anusvara: ng / m / n
  const NASAL_N = "\u0002";    // ଁ  candrabindu: always n

  const INHERENT = "a";

  const CONS = {
    "କ": "k",  "ଖ": "kh", "ଗ": "g",  "ଘ": "gh", "ଙ": "ng",
    "ଚ": "ch", "ଛ": "chh","ଜ": "j",  "ଝ": "jh", "ଞ": "n",
    "ଟ": "t",  "ଠ": "th", "ଡ": "d",  "ଢ": "dh", "ଣ": "n",
    "ତ": "t",  "ଥ": "th", "ଦ": "d",  "ଧ": "dh", "ନ": "n",
    "ପ": "p",  "ଫ": "ph", "ବ": "b",  "ଭ": "bh", "ମ": "m",
    "ଯ": "j",  "ର": "r",  "ଲ": "l",  "ଳ": "l",  "ଵ": "b",
    "ଶ": "sh", "ଷ": "sh", "ସ": "s",  "ହ": "h",
    "ୟ": "y",  "ୱ": "w",
    // precomposed nukta letters (NFC decomposes these, but text in the wild
    // carries them either way)
    "ଡ଼": "d",  "ଢ଼": "dh"
  };

  // base consonant followed by U+0B3C NUKTA
  const NUQTA = {
    "ଡ": "d",  // ଡ଼ -- the flap in ଓଡ଼ିଶା, written d in every Odia romanisation
    "ଢ": "dh", // ଢ଼
    "ଯ": "y",  // ୟ
    "କ": "k", "ଗ": "g", "ଜ": "j", "ଫ": "ph", "ବ": "b", "ର": "r"
  };

  const INDEP = {
    "ଅ": "a",  "ଆ": "a",  "ଇ": "i",  "ଈ": "i",
    "ଉ": "u",  "ଊ": "u",  "ଋ": "ru", "ଌ": "lu",
    "ଏ": "e",  "ଐ": "ai", "ଓ": "o",  "ଔ": "au",
    "ୠ": "ru", "ୡ": "lu"
  };

  const MATRA = {
    "ା": "a",  "ି": "i",  "ୀ": "i",  "ୁ": "u",
    "ୂ": "u",  "ୃ": "ru", "ୄ": "ru", "େ": "e",
    "ୈ": "ai", "ୋ": "o",  "ୌ": "au", "ୖ": "ai",
    "ୗ": "au", "ୢ": "lu", "ୣ": "lu"
  };

  // Odia writes ୈ ୋ ୌ as େ + a length mark; NFC recomposes them, but decomposed
  // text still turns up, so fold the pairs back together here.
  const COMBINE = {
    "e+a": "o",    // େ + ା
    "e+ai": "ai",  // େ + ୖ
    "e+au": "au"   // େ + ୗ
  };

  const DIGITS = {
    "୦": "0", "୧": "1", "୨": "2", "୩": "3", "୪": "4",
    "୫": "5", "୬": "6", "୭": "7", "୮": "8", "୯": "9"
  };

  // Everything else that can legally show up inside the block.
  const PUNCT = {
    "ଽ": "",       // avagraha
    "୰": "",       // isshar
    "୲": "1/4",    // fraction one quarter
    "୳": "1/2",    // fraction one half
    "୴": "3/4",    // fraction three quarters
    "୵": "1/16",   // fraction one sixteenth
    "୶": "1/8",    // fraction one eighth
    "୷": "3/16",   // fraction three sixteenths
    "।": ".",      // danda (lives in the Devanagari block, used with Odia)
    "॥": "."
  };

  // Conjuncts whose mechanical spelling is not what the cluster sounds like.
  const CLUSTER = {
    "ଜଞ": ["gy"],   // ଜ୍ଞ -> gy (ଜ୍ଞାନ -> gyana)
    "ଶର": ["shr"],  // ଶ୍ର
    "ହମ": ["hm"]
  };

  // ୍ବ is heard as a w-glide after these, and as a plain b after r / m / n / l.
  const BA_GLIDE = new Set([
    "k", "kh", "g", "gh", "ch", "chh", "j", "jh",
    "t", "th", "d", "dh", "p", "s", "sh", "h"
  ]);

  const LABIALS = new Set(["p", "ph", "b", "bh", "m", "w"]);
  const VELARS = new Set(["k", "kh", "g", "gh", "ng"]);

  const RAW_DICT = {
    // pronouns
    "ମୁଁ": "mun", "ମୋର": "mora", "ମୋତେ": "mote", "ମୋ": "mo",
    "ଆମେ": "ame", "ଆମର": "amara", "ଆମକୁ": "amaku",
    "ତୁମେ": "tume", "ତୁମର": "tumara", "ତୁମକୁ": "tumaku", "ତୁମ": "tuma",
    "ତୁ": "tu", "ତୋର": "tora", "ଆପଣ": "apana", "ଆପଣଙ୍କ": "apananka",
    "ସେ": "se", "ତାର": "tara", "ତାଙ୍କ": "tanka", "ତାଙ୍କୁ": "tanku",
    "ସେମାନେ": "semane", "ଏମାନେ": "emane", "ଏହା": "eha", "ଏଇ": "ei",
    "ଏହି": "ehi", "ସେଇ": "sei", "ସେହି": "sehi", "ନିଜେ": "nije",
    // question words
    "କଣ": "kana", "କ": "ka", "ଣ": "na", "କିଏ": "kie", "କାହିଁକି": "kahinki",
    "କେମିତି": "kemiti", "କେତେ": "kete", "କେଉଁ": "keun", "କେଉଁଠି": "keunthi",
    "କେବେ": "kebe", "କାହାକୁ": "kahaku", "କାହାର": "kahara",
    // being and negation
    "ଅଛି": "achhi", "ଅଛନ୍ତି": "achhanti", "ଅଛ": "achha", "ଅଛୁ": "achhu",
    "ଥିଲା": "thila", "ଥିଲି": "thili", "ଥିଲେ": "thile", "ଥାଏ": "thae",
    "ହେଉଛି": "heuchhi", "ହୋଇଛି": "hoichhi", "ହେବ": "heba", "ହେଲା": "hela",
    "ନାହିଁ": "nahin", "ନୁହେଁ": "nuhen", "ନା": "na", "ହଁ": "han",
    // verbs
    "କରିବା": "kariba", "କରୁଛି": "karuchhi", "କରିଛି": "karichhi",
    "କର": "kara", "କରନ୍ତୁ": "karantu", "କରିଦେବି": "karidebi",
    "ଯିବା": "jiba", "ଯାଉଛି": "jauchhi", "ଗଲା": "gala", "ଯାଅ": "jaa",
    "ଆସିବା": "asiba", "ଆସୁଛି": "asuchhi", "ଆସ": "asa", "ଆସିଛି": "asichhi",
    "ଦେବା": "deba", "ଦିଅ": "dia", "ଦେଇଛି": "deichhi", "ନେବା": "neba",
    "ନିଅ": "nia", "ଦେଖ": "dekha", "ଦେଖୁଛି": "dekhuchhi", "ଶୁଣ": "suna",
    "କହ": "kaha", "କହିଲା": "kahila", "କହୁଛି": "kahuchhi",
    "ଖାଇବା": "khaiba", "ପଢ଼ିବା": "padhiba", "ଲେଖିବା": "lekhiba",
    "ପାଇବା": "paiba", "ଜାଣିଛି": "janichhi", "ବୁଝିଲି": "bujhili",
    "ପଠାଇବା": "pathaiba", "ରହିବା": "rahiba", "ଲାଗୁଛି": "laguchhi",
    "ମିଳିଲା": "milila", "ଭେଟିବା": "bhetiba",
    // courtesy
    "ଧନ୍ୟବାଦ": "dhanyabad", "ନମସ୍କାର": "namaskar", "ଦୟାକରି": "dayakari",
    "କ୍ଷମା": "kshama", "ଜୟ": "jaya", "ଜଗନ୍ନାଥ": "Jagannath",
    "ସାର୍": "sir", "ମାଡ଼ାମ": "madam",
    // qualities
    "ଭଲ": "bhala", "ଖରାପ": "kharap", "ଠିକ୍": "thik", "ଠିକ": "thika",
    "ବହୁତ": "bahuta", "ଟିକେ": "tike", "ଅନେକ": "aneka", "ସବୁ": "sabu",
    "କିଛି": "kichhi", "ବଡ଼": "bada", "ଛୋଟ": "chhota", "ନୂଆ": "nua",
    "ପୁରୁଣା": "puruna", "ସୁନ୍ଦର": "sundara", "ଅଧିକ": "adhika",
    "କମ୍": "kam", "ପୂରା": "pura",
    // time
    "ଆଜି": "aji", "କାଲି": "kali", "ଏବେ": "ebe", "ପରେ": "pare",
    "ଆଗ": "aga", "ସକାଳ": "sakala", "ଦିନ": "dina", "ରାତି": "rati",
    "ସମୟ": "samaya", "ବର୍ଷ": "barsha", "ମାସ": "masa", "ସପ୍ତାହ": "saptaha",
    "ଘଣ୍ଟା": "ghanta", "ମିନିଟ୍": "minit", "ସନ୍ଧ୍ୟା": "sandhya",
    // numbers and money
    "ଏକ": "eka", "ଦୁଇ": "dui", "ତିନି": "tini", "ଚାରି": "chari",
    "ପାଞ୍ଚ": "pancha", "ଛଅ": "chhaa", "ସାତ": "sata", "ଆଠ": "atha",
    "ନଅ": "naa", "ଦଶ": "dasha", "ଶହ": "shaha", "ହଜାର": "hajara",
    "ଲକ୍ଷ": "lakhya", "କୋଟି": "koti", "ଟଙ୍କା": "tanka", "ପଇସା": "paisa",
    "ଦାମ": "dama",
    // work and places
    "କାମ": "kama", "ଚାକିରି": "chakiri", "ବ୍ୟବସାୟ": "byabasaya",
    "ଅଫିସ": "office", "ଦୋକାନ": "dokana", "ବଜାର": "bajara",
    "ଘର": "ghara", "ଗାଁ": "gaan", "ସହର": "sahara", "ରାସ୍ତା": "rasta",
    "ଗାଡ଼ି": "gadi", "ସ୍କୁଲ": "school", "ଡାକ୍ତରଖାନା": "daktarkhana",
    "ଓଡ଼ିଶା": "odisha", "ଓଡ଼ିଆ": "odia", "ଭୁବନେଶ୍ୱର": "Bhubaneswar",
    "କଟକ": "Cuttack", "ପୁରୀ": "Puri", "କୋଣାର୍କ": "Konark",
    "ସମ୍ବଲପୁର": "Sambalpur", "ରାଉରକେଲା": "Rourkela",
    "ବ୍ରହ୍ମପୁର": "Brahmapur", "ଭାରତ": "bharata",
    // people and food
    "ମା": "maa", "ବାପା": "bapa", "ଭାଇ": "bhai", "ଭଉଣୀ": "bhauni",
    "ପୁଅ": "pua", "ଝିଅ": "jhia", "ସାଙ୍ଗ": "sanga", "ବନ୍ଧୁ": "bandhu",
    "ପରିବାର": "paribara", "ଲୋକ": "loka", "ପିଲା": "pila",
    "ପାଣି": "pani", "ଭାତ": "bhata", "ଡାଲି": "dali", "ମାଛ": "machha",
    "ଚା": "cha", "ଖାଦ୍ୟ": "khadya", "ଦୁଧ": "dudha", "ମିଠା": "mitha",
    // function words
    "ଓ": "o", "କିନ୍ତୁ": "kintu", "ଯଦି": "jadi", "ତେବେ": "tebe",
    "ପାଇଁ": "pain", "ସହିତ": "sahita", "ସହ": "saha", "ଠାରୁ": "tharu",
    "ରୁ": "ru", "କୁ": "ku", "ର": "ra", "ରେ": "re", "ଉପରେ": "upare",
    "ତଳେ": "tale", "ଭିତରେ": "bhitare", "ବାହାରେ": "bahare",
    "ପାଖରେ": "pakhare", "ମଧ୍ୟ": "madhya", "ବି": "bi", "ହିଁ": "hin",
    "ତେଣୁ": "tenu", "କାରଣ": "karana", "ଅବା": "aba", "ଯେ": "je",
    // english written in Odia script
    "ଫୋନ୍": "phone", "ମୋବାଇଲ୍": "mobile", "ମେସେଜ୍": "message",
    "ନମ୍ବର": "number", "ପେମେଣ୍ଟ": "payment", "ଅର୍ଡର": "order",
    "ମିଟିଂ": "meeting", "ବିଲ୍": "bill", "ବ୍ୟାଙ୍କ": "bank",
    "ରିପୋର୍ଟ": "report", "କମ୍ପାନୀ": "company", "କଲେଜ": "college",
    "ଡେଲିଭରି": "delivery", "ଚେକ୍": "cheque", "ଇମେଲ": "email"
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

  const has = (o, k) => k !== undefined && Object.prototype.hasOwnProperty.call(o, k);
  const isCons = (ch) => has(CONS, ch);
  const isMark = (ch) => ch === ANUSVARA || ch === CANDRABINDU || ch === VISARGA;

  function readTail(src, i) {
    let tail = "";
    while (i < src.length && isMark(src[i])) {
      // ଃ before a consonant is not an audible "h" -- it lengthens/geminates the
      // following stop, so ଦୁଃଖ is dukha, not "duhkha".
      if (src[i] === VISARGA) tail += isCons(src[i + 1]) ? "" : "h";
      else if (src[i] === ANUSVARA) tail += NASAL;
      else tail += NASAL_N;
      i += 1;
    }
    return tail;
  }

  function tailLength(src, i) {
    let n = 0;
    while (i + n < src.length && isMark(src[i + n])) n += 1;
    return n;
  }

  /** Read one vowel sign, folding decomposed e + length-mark pairs back. */
  function readVowel(src, i) {
    if (!has(MATRA, src[i])) return null;
    let v = MATRA[src[i]];
    let len = 1;
    while (has(MATRA, src[i + len])) {
      const combo = COMBINE[v + "+" + MATRA[src[i + len]]];
      if (combo === undefined) break;
      v = combo;
      len += 1;
    }
    return { v, len };
  }

  /** Turn a raw consonant run into Latin units, applying the phala rules. */
  function buildCluster(raw) {
    let key = "";
    for (let k = 0; k < raw.length; k++) key += raw[k].ch;
    if (has(CLUSTER, key)) return CLUSTER[key].slice();

    const units = [];
    for (let k = 0; k < raw.length; k++) {
      const r = raw[k];

      // ya-phala: ଯ is [dʒ] on its own but a plain y inside a cluster,
      // which is what keeps ଧନ୍ୟବାଦ readable as dhanyabad. ର୍ଯ୍ୟ stacks two of
      // them (ସୂର୍ଯ୍ୟ) and they spell a single y: surya, not "suryya".
      if (k > 0 && !r.nuqta && (r.ch === YA || r.ch === YYA)) {
        if (units[units.length - 1] !== "y") units.push("y");
        continue;
      }

      // ba-phala: a w-glide after a stop, a plain b after a sonorant.
      if (k > 0 && !r.nuqta && r.ch === BA) {
        const prev = units[units.length - 1];
        units.push(BA_GLIDE.has(prev) ? "w" : "b");
        continue;
      }

      units.push(r.latin);
    }
    // ଙ in front of a velar is just the homorganic nasal: ଗଙ୍ଗା is ganga and
    // ଅଙ୍କ is anka, never "gangga" / "angka".
    for (let k = 0; k < units.length - 1; k++) {
      if (units[k] === "ng" && VELARS.has(units[k + 1])) units[k] = "n";
    }
    if (!units.length) units.push("");
    return units;
  }

  /**
   * Split one Odia word into syllables:
   *   units    = onset consonant units (["n","dh"] for ନ୍ଧ)
   *   c        = onset spelled out
   *   v        = vowel ("a" = inherent, "" = none)
   *   inherent = true when v is the implicit vowel (only those may be deleted)
   *   tail     = nasal / visarga after the vowel
   */
  function syllabify(src) {
    const syls = [];
    let i = 0;
    const n = src.length;

    while (i < n) {
      const ch = src[i];

      if (isCons(ch)) {
        const raw = [];
        let dead = false;

        for (;;) {
          const cc = src[i];
          let latin = CONS[cc];
          let nuqta = false;
          if (src[i + 1] === NUKTA && has(NUQTA, cc)) {
            latin = NUQTA[cc];
            nuqta = true;
            i += 1;
          }
          raw.push({ ch: cc, latin, nuqta });
          i += 1;
          if (src[i] === VIRAMA) {
            i += 1;
            if (isCons(src[i])) continue; // conjunct: keep stacking
            dead = true;
          }
          break;
        }

        const units = buildCluster(raw);
        const c = units.join("");

        if (dead) {
          syls.push({ units, c, v: "", inherent: false, tail: "" });
          continue;
        }

        let v = INHERENT;
        let inherent = true;
        const vow = readVowel(src, i);
        if (vow) {
          v = vow.v;
          inherent = false;
          i += vow.len;
        }
        syls.push({ units, c, v, inherent, tail: readTail(src, i) });
        i += tailLength(src, i);
        continue;
      }

      if (has(INDEP, ch)) {
        let v = INDEP[ch];
        let j = i + 1;
        const vow = readVowel(src, j);
        if (vow && v === "a") {
          // ଆ written as ଅ + ା, and similar carrier spellings
          v = vow.v;
          j += vow.len;
        }
        syls.push({ units: [], c: "", v, inherent: false, tail: readTail(src, j) });
        i = j + tailLength(src, j);
        continue;
      }

      if (has(DIGITS, ch)) {
        syls.push({ units: [], c: DIGITS[ch], v: "", inherent: false, tail: "", literal: true });
        i += 1;
        continue;
      }

      if (has(PUNCT, ch)) {
        if (PUNCT[ch]) {
          syls.push({ units: [], c: PUNCT[ch], v: "", inherent: false, tail: "", literal: true });
        }
        i += 1;
        continue;
      }

      i += 1; // stray marks, avagraha, anything unmapped
    }

    return syls;
  }

  /**
   * Odia inherent-vowel deletion.
   *
   * There is no medial deletion at all -- ଜଗନ୍ନାଥ is jagannath and ସାଗର is
   * sagar, never "jagnnath" / "sagr". Word-finally the vowel drops only when
   * the word can spare it: at least two vowels must survive (ଭଲ -> bhala,
   * ଦିନ -> dina, but ଧନ୍ୟବାଦ -> dhanyabad), and never after a conjunct
   * (ଶବ୍ଦ -> shabda, ଅନ୍ୟ -> anya).
   */
  function deleteSchwa(syls) {
    const n = syls.length;
    if (n === 0) return;

    const last = syls[n - 1];
    if (!last.inherent || !last.c || last.tail || last.literal) return;
    if (last.units.length !== 1) return;
    // a bare glide cannot end the word: ଭାରତୀୟ is bharatiya and ସମୟ is samaya,
    // never "bharatiy" / "samay"
    if (last.units[0] === "y" || last.units[0] === "w") return;
    // word-final ହ keeps its vowel too: ସ୍ନେହ sneha, ଉତ୍ସାହ utsaha, ଆଗ୍ରହ agraha
    if (last.units[0] === "h") return;

    let survivors = 0;
    for (let i = 0; i < n - 1; i++) {
      if (syls[i].v && !syls[i].literal) survivors += 1;
    }
    if (survivors >= 2) last.v = "";
  }

  function spell(syls) {
    let out = "";
    for (let i = 0; i < syls.length; i++) {
      const s = syls[i];
      let tail = s.tail;

      if (tail.indexOf(NASAL) !== -1 || tail.indexOf(NASAL_N) !== -1) {
        const next = syls[i + 1];
        const onset = next && next.units && next.units.length ? next.units[0] : "";
        let nasal;
        if (LABIALS.has(onset)) nasal = "m";
        else if (!onset || VELARS.has(onset)) nasal = "ng"; // word-final or velar
        else nasal = "n";
        tail = tail.split(NASAL).join(nasal).split(NASAL_N).join("n");
      }
      out += s.c + s.v + tail;
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
    // collapse artefacts like "nnnn" from stacked marks
    out = out.replace(/([a-z])\1{2,}/g, "$1$1");
    return out;
  }

  const mod = {
    id: "odia",
    languages: ["Odia"],
    ranges,
    romanize
  };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
