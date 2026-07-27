/**
 * Bengali / Assamese (U+0980-U+09FF) -> Roman.
 *
 * Same abugida machinery as the Devanagari module: syllabify, delete the
 * inherent vowel where the language actually drops it, then spell out.
 *
 * The one rule that matters most: Bengali's inherent vowel is "o", not "a"
 * (কর -> kor, ধন্য -> dhonno). Because "o" carries the inherent slot, the
 * matra া is free to be a plain "a" -- so Bengali comes out as bangla / ami /
 * bhalo rather than the doubled-vowel Hinglish spellings.
 *
 * Other Bengali-specific behaviour:
 *   - ব = b (there is no v), শ ষ = sh, স = sh unless it heads a conjunct,
 *     য = j, য় = y, ড় = r, ঢ় = rh, ৎ (khanda ta) = t
 *   - ং = ng (রং rong, বাংলা bangla) but n in front of a velar, where the g is
 *     already written: সংগীত shongit, লঙ্কা lonka; ঁ = nasal n/m
 *   - medially Bengali keeps its inherent vowel (জনতা jonota, ক্ষমতা khomota):
 *     only র / ল drop one, which is what gives kolkata / shorkar / jhorna
 *   - ya-phala (্য) geminates the consonant it hangs off: ন্য -> nn, ধ্য -> ddh
 *   - ba-phala (্ব) is a glide: বিশ্বাস -> bishwash, স্বাধীন -> swadhin
 *   - the inherent vowel survives after a conjunct: শব্দ -> shobdo, কষ্ট -> koshto,
 *     and after a word-final হ: দেহ -> deho, সিংহ -> shingho
 *   - Assamese ৰ / ৱ are handled as r / w
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0980, 0x09ff]];

  const VIRAMA = "্";      // ্  hasant
  const NUKTA = "়";       // ়
  const ANUSVARA = "ং";    // ং
  const CANDRABINDU = "ঁ"; // ঁ
  const VISARGA = "ঃ";     // ঃ
  const KHANDA_TA = "ৎ";   // ৎ
  const YA = "য";          // য
  const BA = "ব";          // ব
  const RA = "র";          // র
  const SA = "স";          // স

  // Sentinel for a nasal whose realisation (n vs m) depends on the next onset.
  // (ং gets its own sentinel below: it is "ng", but a plain n before a velar.)
  const NASAL = "\u0001";

  const NASAL_NG = "\u0002";

  const INHERENT = "o";

  const VELARS = new Set(["k", "kh", "g", "gh", "ng"]);

  const CONS = {
    "ক": "k",  "খ": "kh", "গ": "g",  "ঘ": "gh", "ঙ": "ng",
    "চ": "ch", "ছ": "chh","জ": "j",  "ঝ": "jh", "ঞ": "n",
    "ট": "t",  "ঠ": "th", "ড": "d",  "ঢ": "dh", "ণ": "n",
    "ত": "t",  "থ": "th", "দ": "d",  "ধ": "dh", "ন": "n",
    "প": "p",  "ফ": "ph", "ব": "b",  "ভ": "bh", "ম": "m",
    "য": "j",  "র": "r",  "ল": "l",
    "শ": "sh", "ষ": "sh", "স": "sh", "হ": "h",
    // precomposed nuqta letters (NFC actually decomposes these, but text in the
    // wild carries them either way)
    "ড়": "r",  "ঢ়": "rh", "য়": "y",
    // Assamese
    "ৰ": "r",  "ৱ": "w",
    "ৼ": "n"   // vedic anusvara letter
  };

  // base consonant followed by U+09BC NUKTA
  const NUQTA = {
    "ড": "r",  // ড় rra
    "ঢ": "rh", // ঢ় rha
    "য": "y",  // য় yya
    "ক": "k", "গ": "g", "জ": "z", "ফ": "f", "ব": "b"
  };

  const INDEP = {
    "অ": "o",  "আ": "a",  "ই": "i",  "ঈ": "i",
    "উ": "u",  "ঊ": "u",  "ঋ": "ri", "ঌ": "li",
    "এ": "e",  "ঐ": "oi", "ও": "o",  "ঔ": "ou",
    "ৠ": "ri", "ৡ": "li"
  };

  const MATRA = {
    "া": "a",  "ি": "i",  "ী": "i",  "ু": "u",
    "ূ": "u",  "ৃ": "ri", "ৄ": "ri", "ে": "e",
    "ৈ": "oi", "ো": "o",  "ৌ": "ou", "ৗ": "u",
    "ৢ": "ri", "ৣ": "ri"
  };

  const DIGITS = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9"
  };

  // Everything else that can legally show up inside the block.
  const PUNCT = {
    "ঀ": "",     // anji
    "ঽ": "",     // avagraha
    "৲": "Rs",   // rupee mark
    "৳": "Tk",   // rupee sign (taka)
    "৴": "1", "৵": "2", "৶": "3", "৷": "4",
    "৸": "15", "৹": "16",
    "৺": "",     // isshar
    "৻": "",     // ganda mark
    "৽": ".",    // abbreviation sign
    "৾": "",     // sandhi mark
    "।": ".",    // danda (lives in the Devanagari block but is used here)
    "॥": "."
  };

  // Conjuncts whose mechanical spelling is not what the cluster sounds like.
  const CLUSTER = {
    "কষ": ["k", "kh"],   // ক্ষ -> kkh
    "জঞ": ["g", "g"],    // জ্ঞ -> gg
    "ঙগ": ["n", "g"],    // ঙ্গ -> ng
    "চছ": ["c", "ch"],   // চ্ছ -> cch
    "চচ": ["c", "ch"],   // চ্চ -> cch
    "হম": ["m", "m"],    // হ্ম -> mm
    "ঞচ": ["n", "ch"],   // ঞ্চ -> nch
    "ঞছ": ["n", "chh"],  // ঞ্ছ -> nchh
    "ঞজ": ["n", "j"]     // ঞ্জ -> nj
  };

  const CLUSTER_INITIAL = {
    "কষ": ["kh"],        // ক্ষমা -> khoma
    "জঞ": ["gy"]         // জ্ঞান -> gyan
  };

  // Gemination prefix: "dh" doubles as "ddh", "sh" as "ssh", "n" as "nn".
  const GEM = {
    "kh": "k", "gh": "g", "ch": "ch", "chh": "ch", "jh": "j",
    "th": "t", "dh": "d", "ph": "p", "bh": "b", "sh": "s",
    "rh": "r", "ng": "ng"
  };

  // ্ব is heard as a w-glide after these, and as a plain b after r / m / n / l.
  const BA_GLIDE = new Set([
    "k", "kh", "g", "gh", "ch", "chh", "j", "jh",
    "t", "th", "d", "dh", "p", "s", "sh", "h"
  ]);

  const LABIALS = new Set(["p", "ph", "b", "bh", "m", "f", "w"]);

  const RAW_DICT = {
    // pronouns and determiners
    "আমি": "ami", "আমার": "amar", "আমাকে": "amake", "আমরা": "amra",
    "আমাদের": "amader", "আমাদেরকে": "amaderke",
    "তুমি": "tumi", "তোমার": "tomar", "তোমাকে": "tomake", "তোমরা": "tomra",
    "তোমাদের": "tomader", "তুই": "tui", "তোর": "tor", "তোকে": "toke",
    "আপনি": "apni", "আপনার": "apnar", "আপনাকে": "apnake", "আপনারা": "apnara",
    "আপনাদের": "apnader",
    "সে": "she", "তার": "tar", "তাকে": "take", "তারা": "tara", "তাদের": "tader",
    "তিনি": "tini", "তাঁর": "tanr", "উনি": "uni",
    "এই": "ei", "ওই": "oi", "সেই": "shei", "এটা": "eta", "ওটা": "ota",
    "সেটা": "sheta", "এটাই": "etai", "এসব": "eshob", "ওরা": "ora",
    // question words
    "কি": "ki", "কী": "ki", "কে": "ke", "কেন": "keno", "কোথায়": "kothay",
    "কখন": "kokhon", "কেমন": "kemon", "কত": "koto", "কোন": "kon",
    "কোনটা": "konta", "কিভাবে": "kibhabe", "কীভাবে": "kibhabe", "কারা": "kara",
    // yes / no / being
    "হ্যাঁ": "hyan", "হা": "ha", "না": "na", "নেই": "nei", "নয়": "noy",
    "আছে": "ache", "আছি": "achi", "আছেন": "achen", "আছো": "acho",
    "ছিল": "chhilo", "ছিলাম": "chhilam", "ছিলেন": "chhilen", "ছিলে": "chhile",
    "হবে": "hobe", "হয়েছে": "hoyeche", "হচ্ছে": "hochhe", "হয়": "hoy",
    "হোক": "hok", "হয়ে": "hoye",
    // common verbs
    "করছি": "korchi", "করছে": "korche", "করছেন": "korchen", "করব": "korbo",
    "করেছি": "korechi", "করে": "kore", "করো": "koro", "করুন": "korun",
    "করতে": "korte", "করার": "korar",
    "যাচ্ছি": "jachhi", "যাব": "jabo", "যাও": "jao", "যান": "jan",
    "গেছে": "geche", "গেছি": "gechi", "গিয়ে": "giye",
    "দাও": "dao", "দিয়েছি": "diyechi", "দেব": "debo", "দিন": "din",
    "বলছি": "bolchi", "বলো": "bolo", "বলেছি": "bolechi", "বলে": "bole",
    "দেখো": "dekho", "দেখছি": "dekhchi", "দেখুন": "dekhun",
    "এসো": "esho", "আসছি": "aschi", "আসবে": "ashbe", "আসুন": "ashun",
    "খাচ্ছি": "khachhi", "নিয়ে": "niye", "দিয়ে": "diye", "পারি": "pari",
    "পারব": "parbo", "জানি": "jani", "বুঝেছি": "bujhechi", "লাগবে": "lagbe",
    "পাঠাও": "pathao", "পাঠিয়েছি": "pathiyechi",
    // greetings and courtesy
    "ধন্যবাদ": "dhonnobad", "নমস্কার": "nomoshkar", "সালাম": "salam",
    "আসসালামু": "assalamu", "ওয়ালাইকুম": "oyalaikum", "আলাইকুম": "alaikum",
    "স্বাগতম": "shagotom", "দুঃখিত": "dukkhito", "মাফ": "maf",
    "প্লিজ": "please", "সরি": "sorry", "ওকে": "ok",
    // qualities and quantity
    "ভালো": "bhalo", "ভাল": "bhalo", "খারাপ": "kharap", "ঠিক": "thik",
    "ভালোবাসি": "bhalobashi", "বেশি": "beshi", "কম": "kom", "একটু": "ektu",
    "অনেক": "onek", "সব": "shob", "কিছু": "kichu", "কিছুই": "kichui",
    "খুব": "khub", "একদম": "ekdom", "সত্যি": "shotti", "মোটামুটি": "motamuti",
    // time
    "আজ": "aj", "কাল": "kal", "কালকে": "kalke", "গতকাল": "gotokal",
    "আগামীকাল": "agamikal", "এখন": "ekhon", "তখন": "tokhon", "পরে": "pore",
    "আগে": "age", "সকাল": "shokal", "দুপুর": "dupur", "বিকাল": "bikal",
    // weekdays and a few loans keep the Hindi-style medial drop that Bengali
    // does not do by rule
    "সোমবার": "shombar", "বুধবার": "budhbar", "মসজিদ": "moshjid",
    "আমদানি": "amdani", "রপ্তানি": "roptani",
    "বিকেল": "bikel", "সন্ধ্যা": "shondha", "রাত": "rat", "সময়": "shomoy",
    "ঘণ্টা": "ghonta", "মিনিট": "minit", "সপ্তাহ": "shoptaho", "মাস": "mash",
    "বছর": "bochor", "তারিখ": "tarikh",
    // money and numbers
    "টাকা": "taka", "পয়সা": "poysha", "দাম": "dam", "হাজার": "hajar",
    "লাখ": "lakh", "কোটি": "koti", "এক": "ek", "দুই": "dui", "তিন": "tin",
    "চার": "char", "পাঁচ": "panch", "ছয়": "chhoy", "সাত": "shat",
    "আট": "at", "দশ": "dosh", "শত": "shoto",
    // places
    "বাড়ি": "bari", "ঘর": "ghor", "দোকান": "dokan", "বাজার": "bajar",
    "স্কুল": "school", "কলেজ": "college", "হাসপাতাল": "hashpatal",
    "অফিস": "office", "রাস্তা": "rasta", "গ্রাম": "gram", "শহর": "shohor",
    "বাংলা": "bangla", "বাংলাদেশ": "Bangladesh", "ভারত": "bharot",
    "কলকাতা": "Kolkata", "ঢাকা": "Dhaka", "চট্টগ্রাম": "Chittagong",
    "ইংরেজি": "ingreji", "পশ্চিমবঙ্গ": "Poshchimbongo", "রাজশাহী": "Rajshahi",
    "হুগলি": "Hooghly", "হাওড়া": "Howrah", "সিলেট": "Sylhet",
    "খুলনা": "Khulna", "বরিশাল": "Barisal", "যশোর": "Jessore",
    "ময়মনসিংহ": "Mymensingh", "রংপুর": "Rangpur",
    // Perso-Arabic loans that drop a medial vowel Bengali otherwise keeps
    "মতলব": "motlob", "মজবুত": "mojbut", "বদমাশ": "bodmash",
    // people
    "মা": "ma", "বাবা": "baba", "ভাই": "bhai", "বোন": "bon", "ছেলে": "chhele",
    "মেয়ে": "meye", "বন্ধু": "bondhu", "পরিবার": "poribar", "স্যার": "sir",
    "ম্যাডাম": "madam", "ভাইয়া": "bhaiya", "আপু": "apu", "দাদা": "dada",
    "দিদি": "didi", "কাকা": "kaka", "মামা": "mama", "লোক": "lok",
    // work and things
    "কাজ": "kaj", "ব্যবসা": "bebsha", "চাকরি": "chakri", "বেতন": "beton",
    "সমস্যা": "shomossa", "দরকার": "dorkar", "খবর": "khobor", "কথা": "kotha",
    "জিনিস": "jinish", "ছবি": "chhobi", "গাড়ি": "gari", "পানি": "pani",
    "জল": "jol", "চা": "cha", "খাবার": "khabar", "ভাত": "bhat",
    "মাছ": "machh", "ডিম": "dim", "দুধ": "dudh",
    // function words
    "আর": "ar", "বা": "ba", "কিন্তু": "kintu", "তবে": "tobe", "যদি": "jodi",
    "তাহলে": "tahole", "কারণ": "karon", "এবং": "ebong", "অথবা": "othoba",
    "জন্য": "jonno", "সাথে": "shathe", "সঙ্গে": "shonge", "থেকে": "theke",
    "পর্যন্ত": "porjonto", "দিকে": "dike", "মধ্যে": "moddhe", "উপর": "upor",
    "নিচে": "niche", "ভিতরে": "bhitore", "বাইরে": "baire", "পাশে": "pashe",
    // english written in Bengali script
    "পেমেন্ট": "payment", "অর্ডার": "order", "মিটিং": "meeting",
    "ডেলিভারি": "delivery", "কাস্টমার": "customer", "ফোন": "phone",
    "মোবাইল": "mobile", "কল": "call", "মেসেজ": "message", "নম্বর": "number",
    "প্রজেক্ট": "project", "টাইম": "time", "কোম্পানি": "company",
    "থ্যাংকস": "thanks", "বিল": "bill", "চেক": "cheque", "ব্যাংক": "bank",
    "রিপোর্ট": "report", "অ্যাকাউন্ট": "account", "ভিডিও": "video",
    "বাস": "bus", "ট্রেন": "train", "ঠিকানা": "thikana"
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
  const isMark = (ch) => ch === ANUSVARA || ch === CANDRABINDU || ch === VISARGA;

  function readTail(src, i) {
    let tail = "";
    while (i < src.length && isMark(src[i])) {
      // ঃ before a consonant is not an audible "h" -- it doubles the stop that
      // follows, so দুঃখ is dukh and নিঃশব্দ is nishobdo, not "duhkh".
      if (src[i] === VISARGA) tail += isCons(src[i + 1]) ? "" : "h";
      else if (src[i] === ANUSVARA) tail += NASAL_NG;
      else tail += NASAL;
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

  /** Turn a raw consonant run into Latin units, applying the phala rules. */
  function buildCluster(raw, initial) {
    let key = "";
    for (let k = 0; k < raw.length; k++) key += raw[k].ch;
    const table = initial ? CLUSTER_INITIAL : CLUSTER;
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key].slice();
    if (!initial && Object.prototype.hasOwnProperty.call(CLUSTER, key)) return CLUSTER[key].slice();

    const units = [];
    for (let k = 0; k < raw.length; k++) {
      const r = raw[k];

      if (k > 0 && r.ch === YA && !r.nuqta) {
        // ya-phala
        if (initial) { units.push("y"); continue; }
        if (units.length === 1) {
          const prev = units[0];
          if (prev === "r") units.push("j");          // reph + ya -> shurjo
          else units.splice(units.length - 1, 0, gemPrefix(prev));
          continue;
        }
        continue; // after a real cluster it is simply absorbed: সন্ধ্যা -> shondha
      }

      if (k > 0 && r.ch === BA && !r.nuqta) {
        // ba-phala
        const prev = units[units.length - 1];
        if (units.length === 1 && BA_GLIDE.has(prev)) units.push("w");
        else units.push("b");
        continue;
      }

      if (r.ch === SA && raw.length > 1) {
        units.push("s"); // স heading a conjunct is [s]: স্কুল, নমস্কার
        continue;
      }

      units.push(r.latin);
    }
    // ঙ in front of a velar is just the homorganic nasal: লঙ্কা is lonka,
    // শঙ্কর shonkor, সঙ্গীত shongit -- never "longka" / "shongkor".
    for (let k = 0; k < units.length - 1; k++) {
      if (units[k] === "ng" && VELARS.has(units[k + 1])) units[k] = "n";
    }
    if (!units.length) units.push("");
    return units;
  }

  /**
   * Split one Bengali word into syllables:
   *   units    = onset consonant units (["n","dh"] for ন্ধ)
   *   c        = onset spelled out
   *   v        = vowel ("o" = inherent, "" = none)
   *   inherent = true when v is the implicit vowel (only those may be deleted)
   *   tail     = nasal / visarga after the vowel
   */
  function syllabify(src) {
    const syls = [];
    let i = 0;
    const n = src.length;

    while (i < n) {
      const ch = src[i];

      if (ch === KHANDA_TA) {
        syls.push({ units: ["t"], c: "t", v: "", inherent: false, tail: "" });
        i += 1;
        continue;
      }

      if (isCons(ch)) {
        const start = i;
        const raw = [];
        let dead = false;

        for (;;) {
          const cc = src[i];
          let latin = CONS[cc];
          let nuqta = false;
          if (src[i + 1] === NUKTA && Object.prototype.hasOwnProperty.call(NUQTA, cc)) {
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

        const units = buildCluster(raw, start === 0);
        const c = units.join("");

        if (dead) {
          syls.push({ units, c, v: "", inherent: false, tail: "" });
          continue;
        }

        let v = INHERENT;
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

      i += 1; // stray marks, avagraha, anything unmapped
    }

    return syls;
  }

  /**
   * Bengali inherent-vowel deletion. Word-final drops (কর -> kor), but not
   * after a conjunct (শব্দ -> shobdo) and not off a bare glide after an i
   * (প্রিয় -> priyo, দ্বিতীয় -> dwitiyo, but সময় -> shomoy).
   *
   * Medially Bengali is a vowel-RETAINING language, unlike Hindi: জনতা is
   * jonota, ক্ষমতা is khomota, জনগণ is jonogon, স্বাধীনতা is swadhinota. The
   * Hindi VC_CV rule mangles all of those, so it is not applied. What Bengali
   * does drop is the vowel on a medial র / ল, where the leftover liquid closes
   * the previous syllable cleanly -- কলকাতা kolkata, সরকার shorkar, ঝরনা
   * jhorna, মঙ্গলবার mongolbar. That, and nothing else, is the medial rule.
   */
  const MEDIAL_DROP = new Set(["r", "l"]);

  function deleteSchwa(syls) {
    const n = syls.length;
    if (n === 0) return;

    const last = syls[n - 1];
    if (n > 1 && last.inherent && last.c && !last.tail && !last.literal &&
        last.units.length === 1) {
      const prev = syls[n - 2];
      const glideAfterI = last.units[0] === "y" && prev && prev.v === "i";
      // word-final হ keeps its vowel: দেহ deho, গ্রহ groho, সিংহ shingho,
      // সপ্তাহ shoptaho, বিবাহ bibaho
      const finalHa = last.units[0] === "h";
      if (!glideAfterI && !finalHa) last.v = "";
    }

    for (let i = n - 2; i >= 1; i--) {
      const s = syls[i];
      if (!s.inherent || s.tail || !s.c || s.literal) continue;
      if (s.units.length !== 1) continue;              // own onset is a conjunct
      if (!MEDIAL_DROP.has(s.units[0])) continue;      // only র / ল drop medially
      const prev = syls[i - 1];
      const next = syls[i + 1];
      if (!prev.v || prev.literal) continue;
      if (!next.c || !next.v || next.literal) continue;
      if (next.units.length !== 1) continue;           // next onset is a conjunct
      s.v = "";
    }
  }

  function spell(syls) {
    let out = "";
    for (let i = 0; i < syls.length; i++) {
      const s = syls[i];
      let tail = s.tail;
      if (tail.indexOf(NASAL) !== -1 || tail.indexOf(NASAL_NG) !== -1) {
        const next = syls[i + 1];
        const onset = next && next.units && next.units.length ? next.units[0] : "";
        // ং is "ng" (রং rong, বাংলা bangla) but collapses to n in front of a
        // velar, where the g is already there: সংগীত shongit, not "shonggit"
        const ng = VELARS.has(onset) ? "n" : "ng";
        const nasal = LABIALS.has(onset) ? "m" : "n";
        tail = tail.split(NASAL).join(nasal).split(NASAL_NG).join(ng);
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
    id: "bengali",
    languages: ["Bengali", "Assamese"],
    ranges,
    romanize
  };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
