/**
 * Hebrew (and Yiddish) -> Roman.
 *
 * Hebrew is written without vowels almost all of the time, so there are really
 * two jobs here and the module does both:
 *
 *   1. Pointed text (niqqud present). Then the vowels are right there and the
 *      output is close to exact: matres lectionis get absorbed (וֹ = o, וּ = u,
 *      ִי = i), sheva is resolved to "e" or nothing, dagesh decides b/v, k/kh,
 *      p/f, furtive patah is moved in front of its guttural (רוּחַ -> ruach).
 *
 *   2. Unpointed text, which is what actually arrives from a transcript. The
 *      consonant skeleton is spelled out, the mater letters ו/י/א/ה are read as
 *      vowels where they behave like vowels, and the remaining consonant runs
 *      get the default Hebrew filler vowels (CaC, CaCaC, CiCCaC) - so שלום
 *      comes out "shalom" and מכתב comes out "mikhtav". A dictionary of very
 *      common words overrides the mechanical output, and one or two of the
 *      one-letter prefixes (ה ו ב ל כ מ ש) can be peeled off before the lookup,
 *      so הבית finds בית.
 *
 * Conventions are the ones people type, not the academic ones: ח = ch, צ = ts,
 * ש = sh, כ = kh, no diacritics anywhere, ע and א are silent.
 */
(() => {
  "use strict";

  // ranges: the Hebrew block plus the Hebrew section of Alphabetic
  // Presentation Forms (precomposed points and the alef-lamed ligature).
  const ranges = [[0x0590, 0x05ff], [0xfb1d, 0xfb4f]];

  /* ------------------------------------------------------------------ marks */

  // Combining points render as bare marks in source; the constant names are
  // the documentation. Code points, in order: 05B0, 05B4-05BA, 05BC-05C3,
  // 05C6, 05F3, 05F4.
  const SHEVA = "ְ";
  const HIRIQ = "ִ";
  const TSERE = "ֵ";
  const SEGOL = "ֶ";
  const PATAH = "ַ";
  const QAMATS = "ָ";
  const HOLAM = "ֹ";
  const HOLAM_HASER = "ֺ";
  const DAGESH = "ּ";
  const METEG = "ֽ";
  const MAQAF = "־";
  const RAFE = "ֿ";
  const PASEQ = "׀";
  const SHIN_DOT = "ׁ";
  const SIN_DOT = "ׂ";
  const SOF_PASUQ = "׃";
  const NUN_HAFUKHA = "׆";
  const GERESH = "׳";
  const GERSHAYIM = "״";

  const VOWELS = {
    "ֱ": "e",  // hataf segol
    "ֲ": "a",  // hataf patah
    "ֳ": "o",  // hataf qamats
    "ִ": "i",  // hiriq
    "ֵ": "e",  // tsere
    "ֶ": "e",  // segol
    "ַ": "a",  // patah
    "ָ": "a",  // qamats
    "ֹ": "o",  // holam
    "ֺ": "o",  // holam haser for vav
    "ֻ": "u",  // qubuts
    "ׇ": "o"   // qamats qatan
  };

  /* --------------------------------------------------------------- letters */

  const LETTERS = {
    "א": { c: "", weak: true },                    // alef
    "ב": { c: "b", soft: "v", bgd: true },         // bet
    "ג": { c: "g" },                               // gimel
    "ד": { c: "d" },                               // dalet
    "ה": { c: "h", he: true },                     // he
    "ו": { c: "v", vav: true },                    // vav
    "ז": { c: "z" },                               // zayin
    "ח": { c: "ch", guttural: true },              // chet
    "ט": { c: "t" },                               // tet
    "י": { c: "y", yod: true },                    // yod
    "ך": { c: "k", soft: "kh", bgd: true },        // final kaf
    "כ": { c: "k", soft: "kh", bgd: true },        // kaf
    "ל": { c: "l" },                               // lamed
    "ם": { c: "m" },                               // final mem
    "מ": { c: "m" },                               // mem
    "ן": { c: "n" },                               // final nun
    "נ": { c: "n" },                               // nun
    "ס": { c: "s" },                               // samekh
    "ע": { c: "", weak: true, guttural: true },    // ayin
    "ף": { c: "p", soft: "f", bgd: true },         // final pe
    "פ": { c: "p", soft: "f", bgd: true },         // pe
    "ץ": { c: "ts" },                              // final tsadi
    "צ": { c: "ts" },                              // tsadi
    "ק": { c: "k" },                               // qof
    "ר": { c: "r" },                               // resh
    "ש": { c: "sh", shin: true },                  // shin / sin
    "ת": { c: "t" },                               // tav
    "ׯ": { c: "y", yod: true },                    // yod triangle
    "װ": { c: "v" },                               // yiddish vav-vav
    "ױ": { c: "oy", vowelish: true },              // yiddish vav-yod
    "ײ": { c: "ey", vowelish: true }               // yiddish yod-yod
  };

  const ALEF = "א";

  // Letter + geresh is how modern Hebrew writes foreign sounds.
  const GERESH_MAP = {
    "g": "j",     // ג׳ jeans
    "z": "zh",    // ז׳ zhaner
    "ts": "ch",   // צ׳ chips
    "ch": "kh",   // ח׳
    "t": "t",     // ת׳
    "d": "d",     // ד׳
    "r": "r",     // ר׳
    "v": "w"      // ו׳
  };

  const PUNCT = {
    "־": "-",  // maqaf
    "׀": " ",  // paseq
    "׃": ".",  // sof pasuq
    "׆": "",   // nun hafukha
    "״": ""    // gershayim (acronym marker)
  };

  // Single-letter prefixes, peeled off before a dictionary lookup.
  const PREFIX = {
    "ה": "ha",   // ה the
    "ו": "ve",   // ו and
    "ב": "be",   // ב in
    "ל": "le",   // ל to
    "כ": "ke",   // כ as
    "מ": "me",   // מ from
    "ש": "she"   // ש that
  };

  /* ------------------------------------------------------------ dictionary */
  // Words whose conventional spelling is not what the mechanical rules give.
  const DICT = {
    // greetings and courtesy
    "שלום": "shalom", "תודה": "toda", "בבקשה": "bevakasha", "סליחה": "slicha",
    "להתראות": "lehitraot", "יאללה": "yalla", "סבבה": "sababa", "אחלה": "achla",
    "בהצלחה": "behatslacha", "מזל": "mazal", "יופי": "yofi", "בסדר": "beseder",
    "מצוין": "metsuyan", "נהדר": "nehedar", "נעים": "naim", "ברוך": "baruch",
    // yes / no / question words
    "כן": "ken", "לא": "lo", "אולי": "ulai", "בטח": "betach", "נכון": "nachon",
    "מה": "ma", "מי": "mi", "איפה": "eifo", "מתי": "matai", "למה": "lama",
    "איך": "eich", "כמה": "kama", "איזה": "eize", "כאן": "kan", "שם": "sham",
    // pronouns
    "אני": "ani", "אתה": "ata", "את": "at", "הוא": "hu", "היא": "hi",
    "אנחנו": "anachnu", "אתם": "atem", "אתן": "aten", "הם": "hem", "הן": "hen",
    "שלי": "sheli", "שלך": "shelcha", "שלו": "shelo", "שלה": "shela",
    "שלנו": "shelanu", "שלכם": "shelachem", "שלהם": "shelahem",
    // time
    "עכשיו": "achshav", "היום": "hayom", "מחר": "machar", "אתמול": "etmol",
    "בוקר": "boker", "ערב": "erev", "לילה": "laila", "יום": "yom",
    "שבוע": "shavua", "חודש": "chodesh", "שנה": "shana", "שעה": "shaa",
    "דקה": "daka", "רגע": "rega", "זמן": "zman", "תמיד": "tamid",
    "לפעמים": "lifamim", "מיד": "miyad", "עוד": "od", "כבר": "kvar",
    "עדיין": "adain", "שוב": "shuv", "אז": "az", "מאוחר": "meuchar",
    "מוקדם": "mukdam",
    // people
    "איש": "ish", "אישה": "isha", "אנשים": "anashim", "ילד": "yeled",
    "ילדה": "yalda", "ילדים": "yeladim", "חבר": "chaver", "חברה": "chavera",
    "משפחה": "mishpacha", "אבא": "aba", "אמא": "ima", "אח": "ach",
    "אחות": "achot", "בן": "ben", "בת": "bat", "סבא": "saba", "סבתא": "savta",
    "לקוח": "lakoach", "מנהל": "menahel", "עובד": "oved", "צוות": "tsevet",
    "רופא": "rofe", "מורה": "more", "תלמיד": "talmid",
    // adjectives and adverbs
    "גדול": "gadol", "קטן": "katan", "טוב": "tov", "רע": "ra", "יפה": "yafe",
    "חדש": "chadash", "ישן": "yashan", "הרבה": "harbe", "קצת": "ktsat",
    "מאוד": "meod", "גם": "gam", "רק": "rak", "אבל": "aval", "כי": "ki",
    "אם": "im", "עם": "im", "של": "shel", "על": "al", "אל": "el",
    "כמו": "kmo", "בין": "bein", "אחרי": "acharei", "לפני": "lifnei",
    "עד": "ad", "בלי": "bli", "בגלל": "biglal", "בשביל": "bishvil",
    "כדי": "kdei", "אפילו": "afilu", "בכלל": "bichlal", "פשוט": "pashut",
    "ממש": "mamash", "כאילו": "keilu", "בערך": "beerech", "בדיוק": "bediyuk",
    "ככה": "kacha", "חשוב": "chashuv", "מהר": "maher", "לאט": "leat",
    "קשה": "kashe", "קל": "kal", "חינם": "chinam", "סגור": "sagur",
    "פתוח": "patuach", "מוכן": "muchan", "צודק": "tsodek", "אמת": "emet",
    "שקר": "sheker", "טעות": "taut",
    // verbs people actually say
    "אוהב": "ohev", "רוצה": "rotse", "צריך": "tsarich", "יכול": "yachol",
    "יודע": "yodea", "חושב": "choshev", "אומר": "omer", "הולך": "holech",
    "בא": "ba", "עושה": "ose", "נותן": "noten", "לוקח": "lokeach",
    "רואה": "roe", "שומע": "shomea", "מדבר": "medaber", "כותב": "kotev",
    "קורא": "kore", "שותה": "shote", "ישנתי": "yashanti", "עוזר": "ozer",
    "היה": "haya", "הייתי": "hayiti", "יהיה": "yihye", "אין": "ein",
    "יש": "yesh", "שולח": "sholeach", "מקבל": "mekabel", "בודק": "bodek",
    // things
    "בית": "bait", "עבודה": "avoda", "כסף": "kesef", "אוכל": "ochel",
    "מים": "mayim", "לחם": "lechem", "ספר": "sefer", "שולחן": "shulchan",
    "דלת": "delet", "חלון": "chalon", "מכונית": "mechonit", "אוטובוס": "otobus",
    "רכבת": "rakevet", "מטוס": "matos", "טלפון": "telefon", "מחשב": "machshev",
    "הודעה": "hodaa", "שאלה": "sheela", "תשובה": "tshuva", "בעיה": "baaya",
    "דבר": "davar", "דברים": "dvarim", "מקום": "makom", "פעם": "paam",
    "חיים": "chaim", "אהבה": "ahava", "מתנה": "matana", "מסיבה": "mesiba",
    "חופש": "chofesh", "כלב": "kelev", "חתול": "chatul", "ראש": "rosh",
    "יד": "yad", "רגל": "regel", "עין": "ayin", "לב": "lev",
    "מחיר": "mechir", "חשבון": "cheshbon", "תשלום": "tashlum",
    "הזמנה": "hazmana", "משלוח": "mishloach", "חנות": "chanut", "שוק": "shuk",
    "בנק": "bank", "משרד": "misrad", "פגישה": "pgisha", "מסמך": "mismach",
    "חוזה": "chozeh", "דוח": "doch", "סוף": "sof", "התחלה": "hatchala",
    "שקל": "shekel", "דולר": "dolar",
    // states
    "שמח": "sameach", "עצוב": "atsuv", "עייף": "ayef", "חולה": "chole",
    "בריא": "bari", "כועס": "koes", "נשמה": "neshama", "מותק": "motek",
    "חמוד": "chamud",
    // places
    "ישראל": "yisrael", "ירושלים": "yerushalayim", "תל": "tel", "אביב": "aviv",
    "חיפה": "haifa", "מדינה": "medina", "עיר": "ir", "רחוב": "rechov",
    "ארץ": "erets", "עולם": "olam", "שבת": "shabat", "חג": "chag",
    // numbers
    "אחד": "echad", "אחת": "achat", "שניים": "shnaim", "שתיים": "shtaim",
    "שלוש": "shalosh", "שלושה": "shlosha", "ארבע": "arba", "חמש": "chamesh",
    "שש": "shesh", "שבע": "sheva", "שמונה": "shmone", "תשע": "tesha",
    "עשר": "eser", "עשרים": "esrim", "מאה": "mea", "אלף": "elef",
    "מיליון": "milion",
    // infinitives: the le- prefix reshapes the stem, so none of these fall out
    // of the filler-vowel rules
    "להיות": "lihyot", "לעשות": "laasot", "לדבר": "ledaber", "לבוא": "lavo",
    "ללכת": "lalechet", "לשלוח": "lishloach", "לראות": "lirot",
    "לקבל": "lekabel", "לתת": "latet", "לקחת": "lakachat", "לבדוק": "livdok",
    "לחזור": "lachzor", "להגיע": "lehagia", "לשלם": "leshalem",
    "לסגור": "lisgor", "לפתוח": "liftoach", "לכתוב": "lichtov",
    // past tense, first person - very common in a voice note
    "שלחתי": "shalachti", "קיבלתי": "kibalti", "דיברתי": "dibarti",
    "אמרתי": "amarti", "עשיתי": "asiti", "הלכתי": "halachti",
    "ראיתי": "raiti", "חשבתי": "chashavti", "בדקתי": "badakti",
    "התקשרתי": "hitkasharti",
    // future / imperative
    "אשמח": "esmach", "נדבר": "nedaber", "תעשה": "taase", "תבדוק": "tivdok",
    "תשלח": "tishlach", "תגיד": "tagid", "תראה": "tire", "תודיע": "todia",
    "מחכה": "mechake", "מצטער": "mitstaer", "מצטערת": "mitstaeret",
    // fillers and glue words
    "רבה": "raba", "שלומך": "shlomcha", "גמור": "gamur", "כמובן": "kamuvan",
    "אפשר": "efshar", "תכף": "tekef", "בקרוב": "bekarov", "חייב": "chayav",
    "צריכה": "tsricha", "יודעת": "yodaat", "זה": "ze", "זאת": "zot",
    "כזה": "kaze", "הכל": "hakol", "כולם": "kulam", "כלום": "klum",
    "משהו": "mashehu", "מישהו": "mishehu", "ביחד": "beyachad", "לבד": "levad",
    "למשל": "lemashal", "אחר": "acher", "אחרת": "acheret", "אותו": "oto",
    "ביי": "bye", "אוקיי": "okay",
    // frequent nouns the filler vowels miss
    "מספר": "mispar", "כתובת": "ktovet", "צהריים": "tsohorayim",
    "שעות": "shaot", "ימים": "yamim", "שבועות": "shavuot",
    "בדרך": "baderech", "בעבודה": "baavoda"
  };

  /* ------------------------------------------------------------- utilities */

  const has = (u, m) => u.marks.indexOf(m) !== -1;

  const inBlock = (ch, lo, hi) => {
    const cp = ch.codePointAt(0);
    return cp >= lo && cp <= hi;
  };

  const isMarkChar = (ch) =>
    PUNCT[ch] === undefined && inBlock(ch, 0x0591, 0x05c7);

  const isWordChar = (ch) =>
    LETTERS[ch] !== undefined || ch === GERESH || isMarkChar(ch);

  /** The niqqud/sheva mark carried by a unit, if any. */
  function vowelMarkOf(u) {
    for (const m of u.marks) {
      if (m === SHEVA || VOWELS[m] !== undefined) return m;
    }
    return "";
  }

  function hasNiqqud(w) {
    for (const ch of w) {
      if (ch === SHEVA || VOWELS[ch] !== undefined) return true;
    }
    return false;
  }

  /** Drop cantillation, meteg and the acronym marker; keep niqqud. */
  function strip(w) {
    let out = "";
    for (const ch of w) {
      if (inBlock(ch, 0x0591, 0x05af)) continue; // te'amim
      if (ch === "ֽ") continue;             // meteg
      if (inBlock(ch, 0x05c4, 0x05c6)) continue; // upper/lower dot, nun hafukha
      if (ch === GERSHAYIM) continue;
      out += ch;
    }
    return out;
  }

  function lettersOnly(w) {
    let out = "";
    for (const ch of w) if (LETTERS[ch]) out += ch;
    return out;
  }

  /** ג׳ / צ׳ / ז׳: the geresh turns a letter into its foreign-sound twin. */
  function gereshed(u, c) {
    return u.geresh && GERESH_MAP[c] !== undefined ? GERESH_MAP[c] : c;
  }

  function consonantOf(u, isFirst, pointed) {
    const L = u.L;
    let c = L.c;
    if (L.shin) c = has(u, SIN_DOT) ? "s" : "sh";
    if (L.bgd) {
      if (has(u, DAGESH)) c = L.c;
      else if (has(u, RAFE)) c = L.soft;
      else if (pointed) c = L.soft;
      else c = isFirst ? L.c : L.soft;
    }
    return gereshed(u, c);
  }

  /** Is this bet/kaf/pe free to go hard or soft depending on what precedes it? */
  function flexible(u) {
    return !!u.L.bgd && !has(u, DAGESH) && !has(u, RAFE);
  }

  /** Split a word into letter units, each carrying its own combining marks. */
  function unitize(w) {
    const units = [];
    for (const ch of w) {
      if (LETTERS[ch]) {
        units.push({ ch: ch, L: LETTERS[ch], marks: "", geresh: false });
        continue;
      }
      if (!units.length) continue; // marks with nothing to attach to
      if (ch === GERESH) units[units.length - 1].geresh = true;
      else units[units.length - 1].marks += ch;
    }
    return units;
  }

  function cleanup(s) {
    return s.replace(/([a-z])\1{2,}/g, "$1$1").replace(/[^\x20-\x7E]/g, "");
  }

  /* --------------------------------------------------------- pointed text */

  function spellPointed(units) {
    const n = units.length;
    const cells = [];
    for (let i = 0; i < n; i++) {
      const u = units[i];
      const vm = vowelMarkOf(u);
      cells.push({
        u: u,
        c: consonantOf(u, i === 0, true),
        v: vm && vm !== SHEVA ? VOWELS[vm] : "",
        vm: vm,
        skip: false,
        furtive: false
      });
    }

    const prevCell = (i) => {
      for (let j = i - 1; j >= 0; j--) if (!cells[j].skip) return cells[j];
      return null;
    };

    // matres lectionis: vav and yod that spell a vowel instead of a consonant
    for (let i = 0; i < n; i++) {
      const cell = cells[i];
      const u = cell.u;
      const prev = prevCell(i);

      if (u.L.vav) {
        if (cell.vm === HOLAM || cell.vm === HOLAM_HASER) {
          if (prev && !prev.vm && prev.c) {
            prev.v = "o";
            cell.skip = true;
          } else if (!prev || (!prev.vm && !prev.c)) {
            // no letter in front, or only a silent alef/ayin carrying nothing
            // (אוֹר, עוֹד, שָׁבוּעוֹת): the vav is the vowel, not a consonant.
            cell.c = "";
            cell.v = "o";
          }
        } else if (!cell.vm && has(u, DAGESH)) {
          // shuruk
          if (prev && !prev.vm && prev.c) {
            prev.v = "u";
            cell.skip = true;
          } else {
            cell.c = "";
            cell.v = "u";
          }
        }
        continue;
      }

      if (u.L.yod && !cell.vm && !has(u, DAGESH) && prev && prev.v) {
        const pv = prev.v;
        if (pv === "i") cell.skip = true;
        else if (pv === "e") {
          prev.v = prev.vm === TSERE ? "ei" : "ey";
          cell.skip = true;
        } else if (pv === "a") {
          // a bare yod after patah/qamats is the mater of Sinai / Adonai /
          // matai, which everyone writes "ai" (and so does the dictionary
          // on the unpointed path). A yod that carries its own vowel never
          // reaches here, so mayim / layla / ayin are untouched.
          prev.v = "ai";
          cell.skip = true;
        } else if (pv === "o") {
          prev.v = "oy";
          cell.skip = true;
        } else if (pv === "u") {
          prev.v = "uy";
          cell.skip = true;
        }
        continue;
      }

      // silent final he (תורה -> tora), unless it carries mapiq
      if (u.L.he && i === n - 1 && !cell.vm && !has(u, DAGESH)) {
        if (prev && prev.v) cell.skip = true;
      }
    }

    // furtive patah: רוּחַ -> ruach, not rucha
    const lastCell = cells[n - 1];
    if (
      lastCell && !lastCell.skip && lastCell.vm === PATAH &&
      (lastCell.u.L.guttural || (lastCell.u.L.he && has(lastCell.u, DAGESH)))
    ) {
      lastCell.furtive = true;
    }

    // sheva: vocal at the start of a word, after another sheva, or under a
    // doubled consonant; silent otherwise
    for (let i = 0; i < n; i++) {
      const cell = cells[i];
      if (cell.skip || cell.vm !== SHEVA) continue;
      const prev = prevCell(i);
      let vocal = false;
      if (!prev) vocal = true;
      else if (prev.vm === SHEVA && prev.v === "") vocal = true;
      else if (has(cell.u, DAGESH) && !cell.u.L.bgd && prev.v) vocal = true;
      cell.v = vocal ? "e" : "";
    }

    const act = cells.filter((c) => !c.skip && (c.c || c.v));

    // never leave three consonants stacked with no vowel
    for (let i = 0; i + 2 < act.length; i++) {
      if (act[i].c && !act[i].v && act[i + 1].c && !act[i + 1].v && act[i + 2].c) {
        act[i].v = "e";
      }
    }

    let out = "";
    for (const cell of act) out += cell.furtive ? cell.v + cell.c : cell.c + cell.v;
    return cleanup(out);
  }

  /* ------------------------------------------------------- unpointed text */

  /**
   * Segment the consonant skeleton, reading ו/י/ה as vowels where they act
   * like vowels and leaving א/ע as "weak" slots to be resolved afterwards.
   */
  function segment(units) {
    const n = units.length;
    const segs = [];
    const C = (s) => segs.push({ t: "c", s: s });
    const V = (s) => segs.push({ t: "v", s: s });
    // M marks a vowel spelled by a mater letter (ו / י). Those are the long
    // vowels, and only they trigger the furtive patah below.
    const M = (s) => segs.push({ t: "v", s: s, mater: true });

    let i = 0;
    while (i < n) {
      const u = units[i];
      const L = u.L;
      const first = i === 0;
      const last = i === n - 1;
      const next = i + 1 < n ? units[i + 1] : null;

      if (L.vowelish) {            // yiddish ױ / ײ
        V(L.c);
        i += 1;
        continue;
      }

      if (L.vav) {
        if (next && next.L.vav) {  // וו is a consonantal v
          C("v");
          i += 2;
          continue;
        }
        if (first) {               // ו- "and", or a real initial v
          C("v");
          if (n > 1) V("e");
          i += 1;
          continue;
        }
        M("o");                    // mater: o (or u, unknowable unpointed)
        i += 1;
        continue;
      }

      if (L.yod) {
        if (!first && next && next.L.yod) {
          M("ai");                 // יי -> ai (חיים -> chaim)
          i += 2;
          continue;
        }
        if (first) {
          C("y");
          if (n > 1 && !(next && next.L.vav)) V("e");
          i += 1;
          continue;
        }
        M("i");
        i += 1;
        continue;
      }

      if (L.he) {
        if (last && !first) {      // final he is a vowel letter: תודה -> toda
          V("a");
          i += 1;
          continue;
        }
        C("h");
        i += 1;
        continue;
      }

      if (L.weak) {                // alef / ayin
        segs.push({ t: "w", s: "", last: last });
        i += 1;
        continue;
      }

      // furtive patah, unpointed: a long vowel in front of a word-final ח
      // gets an [a] glide - שליח shaliach, כוח koach, not shalich / koch.
      if (L.guttural && last) {
        const prev = segs[segs.length - 1];
        if (prev && prev.mater) V("a");
      }

      if (flexible(u)) {
        // b/v, k/kh, p/f is positional, not lexical: hard when it heads a
        // syllable that follows a consonant (mishpat), soft after a vowel
        // (katav, mikhtav). Which one applies is only known once the filler
        // vowels below are placed, so carry both and decide while spelling.
        segs.push({ t: "c", s: gereshed(u, u.L.c), soft: gereshed(u, u.L.soft) });
        i += 1;
        continue;
      }

      C(consonantOf(u, first, false));
      i += 1;
    }
    return segs;
  }

  function spellUnpointed(units) {
    let segs = segment(units);

    // alef / ayin: silent next to a vowel, otherwise they carry one
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].t !== "w") continue;
      const p = i > 0 ? segs[i - 1] : null;
      const q = i + 1 < segs.length ? segs[i + 1] : null;
      // same furtive patah, on a final ע: ידוע -> yedoa, not yedo
      if (segs[i].last && p && p.mater) {
        segs[i].t = "v";
        segs[i].s = "a";
        continue;
      }
      if ((p && p.t === "v") || (q && q.t === "v")) segs[i].drop = true;
      else {
        segs[i].t = "v";
        segs[i].s = "a";
      }
    }
    segs = segs.filter((s) => !s.drop);

    // fill consonant runs with the default Hebrew vowels:
    //   CC -> CaC, CCC -> CaCaC, CCCC -> CiCCaC (mishpat, mikhtav)
    let out = "";
    let i = 0;
    let afterVowel = false; // did the last thing emitted end in a vowel?

    while (i < segs.length) {
      if (segs[i].t !== "c") {
        out += segs[i].s;
        afterVowel = segs[i].s.length > 0;
        i += 1;
        continue;
      }
      let j = i;
      while (j < segs.length && segs[j].t === "c") j += 1;
      const run = segs.slice(i, j);
      const k = run.length;
      for (let x = 0; x < k; x++) {
        out += afterVowel && run[x].soft !== undefined ? run[x].soft : run[x].s;
        afterVowel = false;
        if (x === k - 1) break;
        let fill = "";
        if (k <= 3) fill = "a";
        else if (x === 0) fill = "i";
        else if (x > 1) fill = "a";
        if (fill) {
          out += fill;
          afterVowel = true;
        }
      }
      i = j;
    }

    return cleanup(out);
  }

  /* ----------------------------------------------------------------- word */

  function prefixLookup(skeleton) {
    let rest = skeleton;
    let out = "";
    for (let step = 0; step < 2; step++) {
      const p = PREFIX[rest.charAt(0)];
      if (p === undefined) break;
      rest = rest.slice(1);
      out += p;
      // require a real word behind the prefix, not a two-letter fragment
      if (rest.length >= 3 && DICT[rest] !== undefined) return out + DICT[rest];
    }
    return "";
  }

  function romanizeWord(raw) {
    const clean = strip(raw);
    if (!clean) return "";

    if (DICT[clean] !== undefined) return DICT[clean];

    const pointed = hasNiqqud(clean);
    const skeleton = lettersOnly(clean);
    if (!skeleton) return "";

    if (!pointed) {
      if (DICT[skeleton] !== undefined) return DICT[skeleton];
      const viaPrefix = prefixLookup(skeleton);
      if (viaPrefix) return viaPrefix;
    }

    const units = unitize(clean);
    if (!units.length) return "";
    return pointed ? spellPointed(units) : spellUnpointed(units);
  }

  function romanize(word) {
    let src = word;
    try {
      // NFKC expands the precomposed presentation forms (שּׁ, וֹ, ﭏ) into
      // plain letter + mark sequences that the engine already understands.
      src = word.normalize("NFKC");
    } catch (e) {
      src = word;
    }

    const chars = Array.from(src);
    let out = "";
    let buf = "";
    const flush = () => {
      if (buf) {
        out += romanizeWord(buf);
        buf = "";
      }
    };

    /** Is the word buffer currently sitting on a letter (marks don't count)? */
    const onLetter = () => {
      for (let k = buf.length - 1; k >= 0; k--) {
        const c = buf.charAt(k);
        if (LETTERS[c] !== undefined) return true;
        if (!isMarkChar(c)) return false;
      }
      return false;
    };

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];

      // ״ between letters is the acronym marker and must not break the word
      // (צה״ל -> tsahal); standing alone it is the double quote people type.
      if (ch === GERSHAYIM) {
        if (onLetter() && chars[i + 1] && LETTERS[chars[i + 1]]) continue;
        flush();
        out += "\"";
        continue;
      }

      // ׳ after a letter is the foreign-sound modifier (ג׳ -> j); anywhere
      // else it is an apostrophe.
      if (ch === GERESH && !onLetter()) {
        flush();
        out += "'";
        continue;
      }

      if (isWordChar(ch)) {
        buf += ch;
        continue;
      }
      flush();
      if (PUNCT[ch] !== undefined) out += PUNCT[ch];
      else if (ch.codePointAt(0) < 0x80) out += ch; // stray ASCII in the run
      // unassigned code points are dropped
    }
    flush();
    return out.replace(/[^\x20-\x7E]/g, "");
  }

  const mod = {
    id: "hebrew",
    languages: ["Hebrew", "Yiddish"],
    ranges,
    romanize
  };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
