/**
 * Sinhala -> Roman transliteration (U+0D80-U+0DFF).
 *
 * The same abugida walk as the other Indic modules, with the things that make
 * Sinhala Sinhala:
 *
 *   - Prenasalised stops. ඟ ඦ ඬ ඳ ඹ are single letters that carry their own
 *     nasal, so හඳ -> handa and අඹ -> amba. They are not ග ජ ඩ ද බ, and
 *     spelling them as such loses the sound.
 *   - ව is a w, not a v: ආයුබෝවන් -> ayubowan, යනවා -> yanawa. That single
 *     choice is most of what makes written Singlish look right.
 *   - ං is an n unless a lip consonant follows: සිංහල -> sinhala, ලංකා ->
 *     lanka, අංක -> anka, but the labials pull it to m.
 *   - The al-lakuna ් really does kill the vowel — ආයුබෝවන් ends in a bare n,
 *     unlike Malayalam where a final chandrakkala is a half-u. The inherent
 *     vowel is otherwise always kept: මම -> mama, ගෙදර -> gedara.
 *
 * Long vowels get one Latin letter (ා -> a, ී -> i, ූ -> u), because that is
 * how Sinhala is actually typed: sthuthiyi, ayubowan, kohomada, bohoma.
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x0d80, 0x0dff]];

  const VIRAMA = "්";      // ් al-lakuna
  const NASAL = "\u0001";       // sentinel: n or m, decided by the next onset
  const E_SIGN = "ෙ";      // ෙ
  const AA_SIGN = "ා";     // ා
  const LU_SIGN = "ෟ";     // ෟ

  const CONS = {
    "ක": "k", "ඛ": "kh", "ග": "g", "ඝ": "gh", "ඞ": "ng", "ඟ": "ng",
    "ච": "ch", "ඡ": "chh", "ජ": "j", "ඣ": "jh", "ඤ": "ny", "ඥ": "gn",
    "ඦ": "nj",
    "ට": "t", "ඨ": "th", "ඩ": "d", "ඪ": "dh", "ණ": "n", "ඬ": "nd",
    "ත": "th", "ථ": "th", "ද": "d", "ධ": "dh", "න": "n", "ඳ": "nd",
    "ප": "p", "ඵ": "ph", "බ": "b", "භ": "bh", "ම": "m", "ඹ": "mb",
    "ය": "y", "ර": "r", "ල": "l", "ව": "w",
    "ශ": "sh", "ෂ": "sh", "ස": "s", "හ": "h", "ළ": "l", "ෆ": "f"
  };

  // Nasals in their vowel-less form.
  const DEAD_NASAL = { "ඞ": "n", "ඤ": "n", "ණ": "n", "න": "n", "ම": "m" };

  const INDEP = {
    "අ": "a", "ආ": "a", "ඇ": "a", "ඈ": "a", "ඉ": "i", "ඊ": "i",
    "උ": "u", "ඌ": "u", "ඍ": "ru", "ඎ": "ru", "ඏ": "lu", "ඐ": "lu",
    "එ": "e", "ඒ": "e", "ඓ": "ai", "ඔ": "o", "ඕ": "o", "ඖ": "au"
  };

  const SIGN = {
    "ා": "a", "ැ": "a", "ෑ": "a", "ි": "i", "ී": "i",
    "ු": "u", "ූ": "u", "ෘ": "ru", "ෟ": "lu", "ෲ": "ru", "ෳ": "lu",
    "ෙ": "e", "ේ": "e", "ෛ": "ai", "ො": "o", "ෝ": "o", "ෞ": "au"
  };

  const MARKS = { "ඁ": NASAL, "ං": NASAL, "ඃ": "h" };

  const LIT = {
    "෦": "0", "෧": "1", "෨": "2", "෩": "3", "෪": "4",
    "෫": "5", "෬": "6", "෭": "7", "෮": "8", "෯": "9",
    "෴": "."
  };

  const LABIAL = { p: 1, b: 1, m: 1, f: 1 };

  // Where the mechanical output is not what anyone actually types.
  const DICT = {
    // pronouns and question words
    "මම": "mama", "අපි": "api", "ඔයා": "oya", "ඔබ": "oba", "ඔහු": "ohu",
    "ඇය": "aya", "එයා": "eyaa", "ඔවුන්": "owun", "මට": "mata",
    "ඔයාට": "oyata", "අපට": "apata", "මගේ": "mage", "ඔයාගේ": "oyage",
    "අපේ": "ape", "එයාගේ": "eyage", "ඒක": "eka", "මේක": "meka",
    "කවුද": "kauda", "මොකද": "mokada", "මොනවද": "monawada",
    "මොකක්ද": "mokakda", "කොහොමද": "kohomada", "කොහෙද": "koheda",
    "කොහෙන්ද": "kohenda", "කවදද": "kawadada", "ඇයි": "ai",
    "කීයද": "kiyada", "කොහොම": "kohoma", "කොච්චර": "kochchara",
    "මොනවා": "monawa", "මොකුත්": "mokuth", "එහෙනම්": "ehenam",

    // yes, no, can, want
    "ඔව්": "ow", "නෑ": "na", "නැහැ": "naha", "බෑ": "ba", "බැහැ": "baha",
    "පුළුවන්": "puluwan", "බැරි": "bari", "ඕන": "ona", "ඕනේ": "one",
    "එපා": "epa", "හරි": "hari", "වැරදි": "waradi", "දන්නවා": "dannawa",
    "දන්නේ": "danne", "තේරුණා": "theruna", "තේරෙනවා": "therenawa",

    // verbs people actually send
    "තියෙනවා": "thiyenawa", "යනවා": "yanawa", "එනවා": "enawa",
    "කරනවා": "karanawa", "කියනවා": "kiyanawa", "බලනවා": "balanawa",
    "කනවා": "kanawa", "බොනවා": "bonawa", "ගන්නවා": "gannawa",
    "දෙනවා": "denawa", "හදනවා": "hadanawa", "ඉන්නවා": "innawa",
    "වෙනවා": "wenawa", "පේනවා": "penawa", "අහනවා": "ahanawa",
    "එවනවා": "ewanawa", "ආවා": "awa", "ගියා": "giya", "කිව්වා": "kiwwa",
    "කළා": "kala", "දැක්කා": "dakka", "ගිහින්": "gihin",
    "එන්න": "enna", "යන්න": "yanna", "කරන්න": "karanna",
    "කියන්න": "kiyanna", "බලන්න": "balanna", "දෙන්න": "denna",
    "ඉන්න": "inna", "එවන්න": "ewanna",

    // greetings and courtesy
    "ආයුබෝවන්": "ayubowan", "ස්තූතියි": "sthuthiyi", "ස්තුතියි": "sthuthiyi",
    "බොහොම": "bohoma", "සමාවෙන්න": "samawenna", "කරුණාකර": "karunakara",
    "කරුණාකරලා": "karunakarala", "සුබ": "suba", "සුභ": "suba",
    "උපන්දිනය": "upandinaya", "සුබපැතුම්": "subapathum",
    "හොඳයි": "hondai", "හොඳ": "honda", "නරක": "naraka",
    "ලස්සන": "lassana", "අනේ": "ane", "අයියෝ": "ayyo",

    // people
    "අම්මා": "amma", "තාත්තා": "thaththa", "අයියා": "ayya", "අක්කා": "akka",
    "මල්ලි": "malli", "නංගි": "nangi", "පුතා": "putha", "දුව": "duwa",
    "යාළුවා": "yaluwa", "මිනිහා": "miniha", "ළමයා": "lamaya",
    "ගැහැණු": "gahanu", "පිරිමි": "pirimi", "සර්": "sir", "මැඩම්": "madam",

    // food, home, money, work
    "කෑම": "kama", "බත්": "bath", "වතුර": "wathura", "කිරි": "kiri",
    "තේ": "the", "කෝපි": "kopi", "පාන්": "paan", "ගෙදර": "gedara",
    "ගම": "gama", "කඩේ": "kade", "සල්ලි": "salli", "මුදල්": "mudal",
    "වැඩ": "wada", "රස්සාව": "rassawa", "පඩිය": "padiya", "මිල": "mila",
    "ගාන": "gana", "ගණන": "ganana",

    // time
    "කාලය": "kalaya", "වෙලාව": "welawa", "අද": "ada", "හෙට": "heta",
    "ඊයේ": "iye", "දැන්": "dan", "පස්සේ": "passe", "කලින්": "kalin",
    "උදේ": "ude", "දවල්": "dawal", "හවස": "hawasa", "රෑ": "ra",
    "දවස": "dawasa", "සතිය": "sathiya", "මාසය": "masaya",
    "අවුරුද්ද": "awurudda", "ඉක්මනට": "ikmanata", "හෙමින්": "hemin",

    // places
    "ලංකා": "Lanka", "ශ්රී": "Sri", "සිංහල": "sinhala", "කොළඹ": "Colombo",
    "කැන්දි": "Kandy", "මහනුවර": "Mahanuwara", "ගාල්ල": "Galle",
    "යාපනය": "Jaffna", "රට": "rata", "පාර": "para", "ගමන": "gamana",
    "පන්සල": "pansala", "පල්ලිය": "palliya", "දෙවියනේ": "dewiyane",

    // numbers
    "එක": "eka", "දෙක": "deka", "තුන": "thuna", "හතර": "hathara",
    "පහ": "paha", "හය": "haya", "හත": "hatha", "අට": "ata",
    "නමය": "namaya", "දහය": "dahaya", "සීය": "seeya", "දාහ": "daha",

    // qualities
    "ලොකු": "loku", "පොඩි": "podi", "ගොඩක්": "godak", "ටිකක්": "tikak",
    "ඔක්කොම": "okkoma", "සේරම": "serama", "වගේ": "wage", "විතරක්": "witharak",
    "කැමති": "kamathi", "අකමැති": "akamathi", "ලෙඩ": "leda",

    // English written in Sinhala script -> spell it back in English
    "ෆෝන්": "phone", "මොබයිල්": "mobile", "මැසේජ්": "message",
    "ඔෆිස්": "office", "ඕඩර්": "order", "පේමන්ට්": "payment",
    "මීටින්": "meeting", "කස්ටමර්": "customer", "ඩිලිවරි": "delivery",
    "බිල්": "bill", "රේට්": "rate", "ස්ටොක්": "stock", "නම්බර්": "number",
    "ඇඩ්රස්": "address", "කම්පැනි": "company", "ඩොක්ටර්": "doctor",
    "රෝහල": "rohala", "ඉස්පිරිතාලේ": "hospital", "ඉස්කෝලේ": "school",
    "පාසල": "pasala", "කැම්පස්": "campus", "බස්": "bus", "කාර්": "car",
    "ට්රේන්": "train", "ඕකේ": "ok", "තෑන්ක්ස්": "thanks", "සොරි": "sorry",
    "වට්සැප්": "WhatsApp", "බැංකුව": "bank", "අකවුන්ට්": "account",
    "ඊමේල්": "email", "ෆොටෝ": "photo", "වීඩියෝ": "video",
    "පොත": "potha", "නම": "nama", "වයස": "wayasa",
    "දුරකථනය": "durakathanaya", "දොස්තර": "dosthara"
  };

  const has = (obj, k) => k !== undefined && Object.prototype.hasOwnProperty.call(obj, k);

  function normalize(word) {
    let s = word;
    try {
      s = s.normalize("NFC");
    } catch (_) { /* older engines: use the string as-is */ }
    // ZWJ only picks the touching/yansaya shape of a conjunct; it says nothing
    // about the sound, so drop it and read the al-lakuna underneath.
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
   * Reads the vowel at position i, coping with the two-part signs in case they
   * arrive decomposed (ෙ + ා = ො, ෙ + ් = ෝ, ෙ + ෟ = ෞ).
   */
  function readVowel(w, i) {
    let v = SIGN[w[i]];
    let n = 1;
    if (w[i] === E_SIGN) {
      const nx = w[i + 1];
      if (nx === AA_SIGN) {
        v = "o";
        n = 2;
      } else if (nx === VIRAMA) {
        v = "o";
        n = 2;
      } else if (nx === LU_SIGN) {
        v = "au";
        n = 2;
      }
    }
    return { v, n };
  }

  /**
   * Flat token list. Each token is one of
   *   { t: "c", ch, dead, v, tail }   a consonant with its vowel
   *   { t: "v", v, tail }             an independent vowel
   *   { t: "lit", s }                 a digit or symbol
   */
  function parse(w) {
    const items = [];
    let i = 0;

    while (i < w.length) {
      const ch = w[i];

      if (has(CONS, ch)) {
        i += 1;
        let dead = false;
        let v = "a";
        if (has(SIGN, w[i])) {
          const got = readVowel(w, i);
          v = got.v;
          i += got.n;
        } else if (w[i] === VIRAMA) {
          dead = true;
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

      // A mark with nothing to lean on (leading anusvara, stray visarga).
      if (has(MARKS, ch)) {
        items.push({ t: "lit", s: MARKS[ch] === NASAL ? "n" : MARKS[ch] });
        i += 1;
        continue;
      }

      i += 1; // unassigned, stray sign, anything unmapped
    }

    return items;
  }

  function consLatin(items, idx) {
    const it = items[idx];
    if (it.dead && has(DEAD_NASAL, it.ch)) return DEAD_NASAL[it.ch];
    return CONS[it.ch];
  }

  /** n or m, whichever the following onset wants. */
  function nasalFor(items, idx) {
    for (let j = idx + 1; j < items.length; j++) {
      const nx = items[j];
      if (nx.t !== "c") return "n";
      const latin = consLatin(items, j);
      if (!latin) continue;
      return has(LABIAL, latin[0]) ? "m" : "n";
    }
    return "n"; // word-final anusvara
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

  const mod = { id: "sinhala", languages: ["Sinhala"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
