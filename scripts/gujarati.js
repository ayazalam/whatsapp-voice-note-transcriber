/**
 * Gujarati (U+0A80-U+0AFF) -> Roman.
 *
 * Structurally the closest of the eastern abugidas to Devanagari, so the
 * machinery is the same one the Devanagari module uses: syllabify, delete the
 * inherent schwa (word-final plus the classic VC_CV medial rule applied
 * right-to-left), then spell out with the vowel conventions people actually
 * type -- aa/ee/oo for the long vowels, shortened to a/i/u in the final rhyme.
 *
 * Gujarati-specific behaviour:
 *   - ઋ / ૃ are [ru], not [ri]: અમૃત -> amrut, કૃપા -> krupa, વૃક્ષ -> vruksh.
 *     This is the one vowel where Gujarati genuinely parts ways with Hindi.
 *   - ળ = l (retroflex), શ ષ = sh, સ = s, વ = v, જ્ઞ = gy, ક્ષ = ksh
 *   - ઍ ૅ (candra e) and ઑ ૉ (candra o) are the English-loan vowels: બૅન્ક,
 *     ડૉક્ટર -- spelled plainly as e / o
 *   - ં anusvara and ઁ candrabindu are both nasals, realised m before a labial
 *     and n elsewhere: અંદર -> andar, સંબંધ -> sambandh. Word-finally the nasal
 *     is not typed at all -- the neuter -ું and the -ાં endings give લખવું ->
 *     lakhvu, મારું -> maru, જ્યાં -> jya
 *   - a word-final conjunct ending in a glide or liquid keeps its vowel:
 *     સત્ય -> satya, રાજ્ય -> rajya, રાષ્ટ્ર -> rashtra, ચંદ્ર -> chandra,
 *     and so does -ીય: ભારતીય -> bhartiya. Clusters ending in a stop or nasal
 *     still go bare: ધર્મ -> dharm, જન્મ -> janm
 *   - the final long vowel of a closed last syllable shortens the way people
 *     type it: આભાર -> aabhar, વિચાર -> vichar, ગરીબ -> garib, જરૂર -> jarur,
 *     but a one-vowel word keeps its length: કામ -> kaam, ઠીક -> theek
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0a80, 0x0aff]];

  const VIRAMA = "્";       // ્
  const NUKTA = "઼";        // ઼
  const ANUSVARA = "ં";     // ં
  const CANDRABINDU = "ઁ";  // ઁ
  const VISARGA = "ઃ";      // ઃ

  // Sentinel for a nasal whose realisation (n vs m) depends on the next onset.
  const NASAL = "\u0001";

  const INHERENT = "a";

  const CONS = {
    "ક": "k",  "ખ": "kh", "ગ": "g",  "ઘ": "gh", "ઙ": "ng",
    "ચ": "ch", "છ": "chh","જ": "j",  "ઝ": "jh", "ઞ": "n",
    "ટ": "t",  "ઠ": "th", "ડ": "d",  "ઢ": "dh", "ણ": "n",
    "ત": "t",  "થ": "th", "દ": "d",  "ધ": "dh", "ન": "n",
    "પ": "p",  "ફ": "ph", "બ": "b",  "ભ": "bh", "મ": "m",
    "ય": "y",  "ર": "r",  "લ": "l",  "ળ": "l",  "વ": "v",
    "શ": "sh", "ષ": "sh", "સ": "s",  "હ": "h",
    "ૹ": "zh"  // U+0AF9 GUJARATI LETTER ZHA
  };

  // base consonant followed by U+0ABC NUKTA
  const NUQTA = {
    "ક": "q",  "ખ": "kh", "ગ": "g",  "જ": "z", "ઝ": "z",
    "ડ": "d",  "ઢ": "dh", "ફ": "f",  "ય": "y", "ર": "r",
    "ન": "n",  "લ": "l",  "સ": "s",  "શ": "sh","હ": "h",
    "બ": "b",  "ત": "t",  "થ": "th", "દ": "d", "ધ": "dh"
  };

  const INDEP = {
    "અ": "a",  "આ": "aa", "ઇ": "i",  "ઈ": "ee",
    "ઉ": "u",  "ઊ": "oo", "ઋ": "ru", "ઌ": "lu",
    "ઍ": "e",  "એ": "e",  "ઐ": "ai",
    "ઑ": "o",  "ઓ": "o",  "ઔ": "au",
    "ૠ": "ru", "ૡ": "lu"
  };

  const MATRA = {
    "ા": "aa", "િ": "i",  "ી": "ee", "ુ": "u",
    "ૂ": "oo", "ૃ": "ru", "ૄ": "ru", "ૅ": "e",
    "ે": "e",  "ૈ": "ai", "ૉ": "o",  "ો": "o",
    "ૌ": "au", "ૢ": "lu", "ૣ": "lu"
  };

  const DIGITS = {
    "૦": "0", "૧": "1", "૨": "2", "૩": "3", "૪": "4",
    "૫": "5", "૬": "6", "૭": "7", "૮": "8", "૯": "9"
  };

  // Everything else that can legally show up inside the block.
  const PUNCT = {
    "ઽ": "",     // avagraha
    "ૐ": "om",   // om
    "૰": ".",    // abbreviation sign
    "૱": "Rs",   // rupee sign
    "ૺ": "", "ૻ": "", "ૼ": "", "૽": "", "૾": "", "૿": "",
    "।": ".",    // danda (lives in the Devanagari block, used with Gujarati)
    "॥": "."
  };

  // Conjuncts whose mechanical spelling is not what the cluster sounds like.
  const CLUSTER = {
    "જઞ": ["gy"],   // જ્ઞ -> gy (જ્ઞાન -> gyaan)
    "શર": ["shr"],  // શ્ર -> shr
    "તર": ["tr"],
    "દય": ["dy"],
    "ચછ": ["chh"]   // ઇચ્છા -> ichha, not "ichchhaa"
  };

  // A doubled aspirate is written with a plain stop first: ખ્ખ -> kkh, ધ્ધ ->
  // ddh, ચોખ્ખું -> chokkhu.
  const GEM = {
    "kh": "k", "gh": "g", "chh": "ch", "jh": "j", "th": "t",
    "dh": "d", "ph": "p", "bh": "b", "sh": "s", "ch": "ch"
  };

  const LABIALS = new Set(["p", "ph", "b", "bh", "m", "f", "v", "w"]);

  const RAW_DICT = {
    // pronouns
    "હું": "hun", "મને": "mane", "મારું": "maru", "મારો": "maro",
    "મારી": "mari", "મારા": "mara", "અમે": "ame", "અમારું": "amaru",
    "અમને": "amne", "આપણે": "aapne", "આપણું": "aapnu",
    "તું": "tu", "તને": "tane", "તારું": "taru", "તારો": "taro",
    "તારી": "tari", "તમે": "tame", "તમને": "tamne", "તમારું": "tamaru",
    "તમારો": "tamaro", "તમારી": "tamari", "તમારે": "tamare",
    "તે": "te", "તેને": "tene", "તેનું": "tenu", "તેનો": "teno",
    "તેની": "teni", "તેઓ": "teo", "એ": "e", "આ": "aa", "પોતે": "pote",
    // question words
    "શું": "shu", "કેમ": "kem", "ક્યાં": "kya", "ક્યારે": "kyare",
    "કોણ": "kon", "કેટલું": "ketlu", "કેટલા": "ketla", "કેટલી": "ketli",
    "કયું": "kayu", "કેવી": "kevi", "કેવું": "kevu", "શા": "sha",
    "શાનું": "shanu", "કોને": "kone",
    // being and negation
    "છે": "chhe", "છું": "chhu", "છો": "chho", "છીએ": "chhie",
    "હતું": "hatu", "હતો": "hato", "હતી": "hati", "હતા": "hata",
    "હશે": "hashe", "થાય": "thay", "થયું": "thayu", "થશે": "thashe",
    "હોય": "hoy", "નથી": "nathi", "ના": "na", "નહીં": "nahi", "નહિ": "nahi",
    "હા": "ha", "જી": "ji",
    // verbs
    "કરવું": "karvu", "કર્યું": "karyu", "કરો": "karo", "કરે": "kare",
    "કરીશ": "karish", "કરીને": "karine", "જવું": "javu", "ગયો": "gayo",
    "ગઈ": "gai", "ગયું": "gayu", "જાઓ": "jao", "આવવું": "aavvu",
    "આવ્યો": "aavyo", "આવો": "aavo", "આપો": "aapo", "આપ્યું": "aapyu",
    "લેવું": "levu", "લીધું": "lidhu", "જોઈએ": "joie", "જુઓ": "juo",
    "જોયું": "joyu", "સાંભળો": "sambhlo", "બોલો": "bolo", "કહો": "kaho",
    "કહ્યું": "kahyu", "મોકલો": "moklo", "મળ્યું": "malyu", "રાખો": "rakho",
    "ખાવું": "khavu", "પીવું": "pivu", "સમજ્યો": "samajyo", "ખબર": "khabar",
    "મળશે": "malshe", "લખો": "lakho", "શરૂ": "sharu", "પૂરું": "puru",
    // courtesy
    "ધન્યવાદ": "dhanyavad", "નમસ્તે": "namaste", "જય": "jay",
    "માફ": "maaf", "પ્લીઝ": "please", "સોરી": "sorry", "ઓકે": "ok",
    "સ્વાગત": "swagat", "મહેરબાની": "meherbani",
    // qualities
    "સારું": "saru", "સારો": "saro", "સારી": "sari", "ખરાબ": "kharab",
    "બરાબર": "barabar", "ઠીક": "theek", "બહુ": "bahu", "ઘણું": "ghanu",
    "થોડું": "thodu", "થોડી": "thodi", "વધારે": "vadhare", "ઓછું": "ochhu",
    "બધું": "badhu", "બધા": "badha", "કંઈ": "kai", "કશું": "kashu",
    "મોટું": "motu", "નાનું": "nanu", "નવું": "navu", "જૂનું": "junu",
    "સરસ": "saras", "મજા": "maja", "મજામાં": "majama", "ખૂબ": "khub",
    // time
    "આજે": "aaje", "કાલે": "kale", "ગઈકાલે": "gaikale", "અત્યારે": "atyare",
    "પછી": "pachhi", "પહેલાં": "pehla", "હવે": "have", "સવારે": "savare",
    "બપોરે": "bapore", "સાંજે": "saanje", "રાત્રે": "ratre", "સમય": "samay",
    "દિવસ": "divas", "અઠવાડિયું": "athvadiyu", "મહિનો": "mahino",
    "વર્ષ": "varsh", "વખત": "vakhat", "તારીખ": "tarikh",
    // numbers and money
    "એક": "ek", "બે": "be", "ત્રણ": "tran", "ચાર": "chaar",
    "પાંચ": "paanch", "છ": "chha", "સાત": "saat", "આઠ": "aath",
    "નવ": "nav", "દસ": "das", "સો": "so", "હજાર": "hajar",
    "લાખ": "lakh", "કરોડ": "crore", "પૈસા": "paisa", "રૂપિયા": "rupiya",
    "ભાવ": "bhav", "કિંમત": "kimat",
    // work and places
    "કામ": "kaam", "ધંધો": "dhandho", "નોકરી": "nokri", "ઓફિસ": "office",
    "દુકાન": "dukan", "બજાર": "bajar", "ઘર": "ghar", "ગામ": "gaam",
    "શહેર": "shaher", "રસ્તો": "rasto", "ગાડી": "gaadi", "વાત": "vaat",
    "સવાલ": "saval", "જવાબ": "javab", "મુશ્કેલી": "mushkeli",
    "ગુજરાત": "gujarat", "ગુજરાતી": "gujarati", "અમદાવાદ": "Ahmedabad",
    "સુરત": "Surat", "વડોદરા": "Vadodara", "રાજકોટ": "Rajkot",
    "ભારત": "bharat", "મુંબઈ": "Mumbai",
    // people
    "મા": "maa", "બા": "baa", "પપ્પા": "pappa", "બાપુજી": "bapuji",
    "ભાઈ": "bhai", "બહેન": "behen", "દીકરો": "dikro", "દીકરી": "dikri",
    "છોકરો": "chhokro", "છોકરી": "chhokri", "મિત્ર": "mitra",
    "દોસ્ત": "dost", "પરિવાર": "parivar", "માણસ": "manas", "લોકો": "loko",
    "સાહેબ": "saheb", "કાકા": "kaka", "મામા": "mama", "દાદા": "dada",
    // function words
    "અને": "ane", "પણ": "pan", "કે": "ke", "જો": "jo", "તો": "to",
    "કારણ": "karan", "માટે": "mate", "સાથે": "sathe", "થી": "thi",
    "માં": "ma", "ને": "ne", "નું": "nu", "નો": "no", "ની": "ni",
    "અથવા": "athva", "એટલે": "etle", "જેમ": "jem", "ત્યાં": "tya",
    "અહીં": "ahi", "ઉપર": "upar", "નીચે": "niche", "અંદર": "andar",
    "બહાર": "bahar", "પાસે": "pase", "વગર": "vagar", "સુધી": "sudhi",
    // english written in Gujarati script
    "ફોન": "phone", "મોબાઈલ": "mobile", "મેસેજ": "message",
    "નંબર": "number", "પેમેન્ટ": "payment", "ઓર્ડર": "order",
    "મીટિંગ": "meeting", "બિલ": "bill", "બેંક": "bank", "ચેક": "cheque",
    "રિપોર્ટ": "report", "કંપની": "company", "ટાઈમ": "time",
    "સ્કૂલ": "school", "કોલેજ": "college", "ડિલિવરી": "delivery",
    "ડૉક્ટર": "doctor", "ડોક્ટર": "doctor", "હોસ્પિટલ": "hospital",
    "કસ્ટમર": "customer", "એડ્રેસ": "address", "ઈમેલ": "email"
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
      // ઃ in front of a consonant is not an audible "h": દુઃખ is dukh.
      if (src[i] === VISARGA) tail += isCons(src[i + 1]) ? "" : "h";
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

  /** Turn a raw consonant run into Latin units, applying the cluster overrides. */
  function buildCluster(raw) {
    let key = "";
    for (let k = 0; k < raw.length; k++) key += raw[k].ch;
    if (has(CLUSTER, key)) return CLUSTER[key].slice();

    const units = [];
    for (let k = 0; k < raw.length; k++) {
      const latin = raw[k].latin;
      // geminate: ખ્ખ is kkh, not "khkh"
      if (units.length && units[units.length - 1] === latin && has(GEM, latin)) {
        units[units.length - 1] = GEM[latin];
      }
      units.push(latin);
    }
    if (!units.length) units.push("");
    return units;
  }

  /**
   * Split one Gujarati word into syllables:
   *   units    = onset consonant units (["n","dh"] for ન્ધ)
   *   c        = onset spelled out
   *   v        = vowel ("a" = inherent schwa, "" = none)
   *   inherent = true when v is the implicit schwa (only those may be deleted)
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
          if (src[i + 1] === NUKTA && has(NUQTA, cc)) {
            latin = NUQTA[cc];
            i += 1;
          }
          raw.push({ ch: cc, latin });
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
        if (has(MATRA, src[i])) {
          v = MATRA[src[i]];
          inherent = false;
          i += 1;
        }
        syls.push({ units, c, v, inherent, tail: readTail(src, i) });
        i += tailLength(src, i);
        continue;
      }

      if (has(INDEP, ch)) {
        const v = INDEP[ch];
        const j = i + 1;
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

      i += 1; // stray marks, transliteration signs, anything unmapped
    }

    return syls;
  }

  // A word-final conjunct that ends in a glide or a liquid keeps its vowel:
  // સત્ય -> satya, રાજ્ય -> rajya, રાષ્ટ્ર -> rashtra, ચંદ્ર -> chandra. Only
  // clusters ending in a stop or nasal go bare (ધર્મ -> dharm, જન્મ -> janm).
  const FINAL_VOWEL_AFTER = /[yr]$/;
  // A schwa sitting on a conjunct onset survives when that conjunct is a
  // geminate or ends in a glide/liquid: ઉત્તરાયણ -> uttarayan, ચિત્રકાર ->
  // chitrakar, સ્વતંત્રતા -> svatantrata.
  const KEEP_AFTER = /[yrvl]$/;

  /** Gujarati schwa deletion -- the Hindi rules apply essentially unchanged. */
  function deleteSchwa(syls) {
    const n = syls.length;
    if (n === 0) return;

    // 1. word-final inherent schwa drops (unless it is the only syllable)
    const last = syls[n - 1];
    if (n > 1 && last.inherent && last.c && !last.tail && !last.literal) {
      // last.c is the whole onset spelled out, so a one-letter table entry for a
      // conjunct ("tr" for ત્ર) is caught as well as a stacked one ("ry").
      const prev = syls[n - 2];
      // -ીય / -િય is the Sanskrit adjective ending: ભારતીય bhartiya, પ્રિય
      // priya. Elsewhere a final ય just closes the word: સમય samay.
      const glideAfterI = last.c === "y" && prev && (prev.v === "i" || prev.v === "ee");
      if (glideAfterI || (last.c.length > 1 && FINAL_VOWEL_AFTER.test(last.c))) {
        last.finalA = true;
      } else {
        last.v = "";
      }
    }

    // 2. medial: schwa -> 0 in V C _ C V, right-to-left, using updated context
    for (let i = n - 2; i >= 1; i--) {
      const s = syls[i];
      if (!s.inherent || s.tail || !s.c || s.literal) continue;
      if (s.c.length > 1 && KEEP_AFTER.test(s.c)) continue;
      if (s.units.length > 1 && s.units[0] === s.units[1]) continue;
      const prev = syls[i - 1];
      const next = syls[i + 1];
      if (!prev.v || prev.literal) continue;
      if (!next.c || !next.v || next.literal) continue;
      // the schwa survives in front of a conjunct: નમસ્કાર -> namaskar,
      // નમસ્તે -> namaste, not "namskar" / "namste"
      if (next.units.length !== 1) continue;
      s.v = "";
    }
  }

  const SHORT = { "aa": "a", "ee": "i", "oo": "u" };

  function spell(syls) {
    // The last syllable that carries a vowel, and whether only dead consonants
    // follow it -- that is the rhyme people shorten when they type.
    // A vowel restored by rule (rajya, rashtra) counts towards the word's vowel
    // total but is not itself the rhyme that shortens -- સૌરાષ્ટ્ર is
    // saurashtra, not "sauraashtra".
    let lastV = -1;
    let vowels = 0;
    for (let i = 0; i < syls.length; i++) {
      if (syls[i].v && !syls[i].literal) {
        if (!syls[i].finalA) lastV = i;
        vowels += 1;
      }
    }
    let openRhyme = lastV >= 0;
    for (let i = lastV + 1; i < syls.length; i++) {
      if (syls[i].finalA) continue;
      if (syls[i].literal || syls[i].v || syls[i].tail) {
        openRhyme = false;
        break;
      }
    }

    let out = "";
    for (let i = 0; i < syls.length; i++) {
      const s = syls[i];
      let v = s.v;

      // Gujarati's word-final nasal is not written the way people type it: the
      // neuter -ું and the -ાં / -ીં endings come out as maru, saru, lakhvu,
      // tya, ahi, nahi -- exactly as the dictionary spells them.
      const finalNasal =
        i === syls.length - 1 && s.v && s.tail && s.tail.split(NASAL).join("") === "";

      if (i === lastV && openRhyme && (!s.tail || finalNasal) && has(SHORT, v)) {
        // karnaa -> karna, bhii -> bhi, aaluu -> aalu when the vowel ends the
        // word; aabhaar -> aabhar, gariib -> garib when one consonant follows.
        // A word with a single vowel keeps its length: kaam, theek, phool.
        const wordFinal = i === syls.length - 1;
        if (wordFinal ? syls.length > 1 || s.c : vowels >= 2) v = SHORT[v];
      }

      let tail = s.tail;
      if (finalNasal) {
        tail = "";
      } else if (tail.indexOf(NASAL) !== -1) {
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
    // uthaaya -> uthaya (but keep word-initial aa: aavyo, aage)
    out = out.replace(/(.)aay/g, "$1ay");
    // collapse artefacts like "nnn" from stacked marks
    out = out.replace(/([a-z])\1{2,}/g, "$1$1");
    return out;
  }

  const mod = {
    id: "gujarati",
    languages: ["Gujarati", "Kutchi"],
    ranges,
    romanize
  };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
