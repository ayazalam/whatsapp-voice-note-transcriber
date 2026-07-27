/**
 * Ethiopic (Ge'ez syllabary) -> Roman. Amharic, Tigrinya, Ge'ez.
 *
 * The block is a perfect grid: every consonant owns 8 consecutive code points,
 * one per vowel order — ä, u, i, a, e, ɨ, o and a labialised -wa slot. So the
 * table below lists one row per consonant and the syllables are computed, not
 * typed out. A handful of rows (qw-, kw-, gw-, hw-) are 6-slot labialised
 * rows with holes in them; those are listed separately.
 *
 * Two judgement calls drive the output:
 *   - 1st order (ä) is written "e" — ሰላም is "selam", the spelling Ethiopians
 *     actually use, not "sälam".
 *   - 6th order (ɨ) is the hard one. It is a real vowel word-initially but a
 *     bare syllable coda after a vowel: ሰላም -> selam (bare -m), but
 *     ትግርኛ -> tigrigna (ት and ር both need the vowel because nothing precedes
 *     them). The rule here is "spell it 'i' unless the previous syllable
 *     already gave us a vowel to lean on", which gets both of those right.
 *
 * Gemination is not written in Ethiopic at all, so አዲስ can only become "adis"
 * mechanically; the dictionary supplies "addis" and friends.
 */
(() => {
  "use strict";

  const ranges = [[0x1200, 0x137f]];

  // One entry per 8-slot consonant row: [row base code point, Latin consonant].
  const ROWS = [
    [0x1200, "h"],    // ሀ hoy
    [0x1208, "l"],    // ለ lawe
    [0x1210, "h"],    // ሐ hawt
    [0x1218, "m"],    // መ may
    [0x1220, "s"],    // ሠ sat
    [0x1228, "r"],    // ረ res
    [0x1230, "s"],    // ሰ sat
    [0x1238, "sh"],   // ሸ sha
    [0x1240, "k"],    // ቀ qaf  (ejective q; "k" reads better than "q")
    [0x1250, "kh"],   // ቐ qha  (Tigrinya)
    [0x1260, "b"],    // በ bet
    [0x1268, "v"],    // ቨ ve   (loanwords)
    [0x1270, "t"],    // ተ tawe
    [0x1278, "ch"],   // ቸ cha
    [0x1280, "h"],    // ኀ harm
    [0x1290, "n"],    // ነ nahas
    [0x1298, "gn"],   // ኘ nya  ("gn" is the spelling in Amarigna/Tigrigna)
    [0x12a0, ""],     // አ alef (vowel carrier)
    [0x12a8, "k"],    // ከ kaf
    [0x12b8, "kh"],   // ኸ kha
    [0x12c8, "w"],    // ወ wawe
    [0x12d0, ""],     // ዐ ayn (vowel carrier)
    [0x12d8, "z"],    // ዘ zay
    [0x12e0, "zh"],   // ዠ zhe
    [0x12e8, "y"],    // የ yaman
    [0x12f0, "d"],    // ደ dent
    [0x12f8, "d"],    // ዸ dda
    [0x1300, "j"],    // ጀ je
    [0x1308, "g"],    // ገ geml
    [0x1318, "ng"],   // ጘ gga
    [0x1320, "t"],    // ጠ tait  (ejective)
    [0x1328, "ch"],   // ጨ cha   (ejective)
    [0x1330, "p"],    // ጰ psa   (ejective)
    [0x1338, "ts"],   // ጸ tsady
    [0x1340, "ts"],   // ፀ tseppa
    [0x1348, "f"],    // ፈ af
    [0x1350, "p"]     // ፐ psa
  ];

  // Labialised rows: base+0 = Cwä, +1 hole, +2 Cwi, +3 Cwa, +4 Cwe, +5 Cwɨ.
  const W_ROWS = [
    [0x1248, "kw"],   // ቈ qwa
    [0x1258, "khw"],  // ቘ qhwa
    [0x1288, "hw"],   // ኈ hwa
    [0x12b0, "kw"],   // ኰ kwa
    [0x12c0, "khw"],  // ዀ khwa
    [0x1310, "gw"]    // ጐ gwa
  ];

  // Vowel per order. Index 5 (ɨ) is decided by context, so it is left empty.
  const VOWELS = ["e", "u", "i", "a", "e", "", "o", "wa"];
  // A bare vowel carrier (alef, ayn) reads "a" in 1st order and "i" in 6th.
  const CARRIER_VOWELS = ["a", "u", "i", "a", "e", "i", "o", "wa"];
  // After a laryngeal (ሀ ሐ ኀ) the 1st order is [a], not [ä]: ሐረር harer,
  // ሀገር hager, ሀብት habt — never "herer"/"heger".
  const GUTTURAL_VOWELS = ["a", "u", "i", "a", "e", "", "o", "wa"];
  const GUTTURAL_ROWS = { 0x1200: 1, 0x1210: 1, 0x1280: 1 };
  // Labialised rows run the same orders as everything else: Cwä, hole, Cwi,
  // Cwa, Cwe, Cwɨ. Slot 0 is NOT "-wa" (that is slot 3) and slot 5 is the
  // 6th order, decided by context like every other 6th order.
  const W_VOWELS = ["e", "", "i", "a", "e", ""];
  const W_GUTTURAL_VOWELS = ["a", "", "i", "a", "e", ""];
  // ኈ is the labialised form of the laryngeal ኀ, so its 1st order is [a].
  const W_GUTTURAL_ROWS = { 0x1288: 1 };

  // Odd men out: the 8th slot of these rows is -oa, not -wa.
  const SLOT7 = { 0x1207: "hoa", 0x1247: "koa", 0x1287: "hoa" };

  // Standalone syllables that sit outside the grid.
  const EXTRA = {
    0x1358: { c: "ry", v: "a" },   // ፘ rya
    0x1359: { c: "my", v: "a" },   // ፙ mya
    0x135a: { c: "fy", v: "a" }    // ፚ fya
  };

  /** code point -> { c, v, sixth } */
  const SYL = new Map();

  for (const [base, cons] of ROWS) {
    const carrier = cons === "";
    const vowels = carrier ? CARRIER_VOWELS
      : (GUTTURAL_ROWS[base] ? GUTTURAL_VOWELS : VOWELS);
    for (let k = 0; k < 8; k++) {
      const cp = base + k;
      if (SLOT7[cp] !== undefined) {
        SYL.set(cp, { c: "", v: SLOT7[cp], sixth: false });
        continue;
      }
      SYL.set(cp, { c: cons, v: vowels[k], sixth: k === 5 && !carrier });
    }
  }

  for (const [base, cons] of W_ROWS) {
    const vowels = W_GUTTURAL_ROWS[base] ? W_GUTTURAL_VOWELS : W_VOWELS;
    for (let k = 0; k < 6; k++) {
      if (k === 1) continue; // unassigned hole
      SYL.set(base + k, { c: cons, v: vowels[k], sixth: k === 5 });
    }
  }

  for (const cp of Object.keys(EXTRA)) {
    const e = EXTRA[cp];
    SYL.set(Number(cp), { c: e.c, v: e.v, sixth: false });
  }

  // ፡ is a word separator, so a whole Ethiopic sentence arrives as one run.
  const PUNCT = {
    0x1360: " ",   // ፠ section mark
    0x1361: " ",   // ፡ word space
    0x1362: ".",   // ። full stop
    0x1363: ",",   // ፣ comma
    0x1364: ";",   // ፤ semicolon
    0x1365: ":",   // ፥ colon
    0x1366: ":",   // ፦ preface colon
    0x1367: "?",   // ፧ question mark
    0x1368: " "    // ፨ paragraph separator
  };

  // U+1369..U+137C: 1-9, then 10..90, then ፻ 100 and ፼ 10000.
  function numeralValue(cp) {
    if (cp >= 0x1369 && cp <= 0x1371) return cp - 0x1368;          // 1..9
    if (cp >= 0x1372 && cp <= 0x137a) return (cp - 0x1371) * 10;   // 10..90
    if (cp === 0x137b) return 100;
    if (cp === 0x137c) return 10000;
    return -1;
  }

  // Words whose mechanical output is not the spelling anyone uses. Gemination
  // is unwritten in Ethiopic, so it can only come from here.
  const DICT = {
    "አማርኛ": "amarigna",
    "አዲስ": "addis",
    "አበባ": "abeba",
    "ኢትዮጵያ": "ethiopia",
    "ኢትዮጵያዊ": "ethiopiawi",
    "ኤርትራ": "eritrea",
    "እሺ": "ishi",
    "እና": "ina",
    "እባክህ": "ibakih",
    "እባክሽ": "ibakish",
    "እሱ": "issu",
    "እሷ": "isswa",
    "ነው": "new",
    "ናት": "nat",
    "ናቸው": "nachew",
    "አዎ": "awo",
    "አይደለም": "aydelem",
    "ጤና": "tena",
    "ይስጥልኝ": "yistilign",
    "ደህና": "dehna",
    "አመሰግናለሁ": "amesegnalehu",
    "እንደምን": "endemen",
    "እንደምንህ": "endemenih",
    "እንደምንሽ": "endemenish",
    "በጣም": "betam",
    "ትንሽ": "tinish",
    "ብዙ": "bizu",
    "ዛሬ": "zare",
    "ትናንት": "tinant",
    "ነገ": "nege",
    "ሰዓት": "seat",
    "ገንዘብ": "genzeb",
    "ስንት": "sint",
    "ምንድን": "mindin",
    "ማን": "man",
    "የት": "yet",
    "መቼ": "meche",
    "ለምን": "lemin",
    "እንዴት": "indet",
    "ቤት": "bet",
    "ውሃ": "wuha",
    "ውኃ": "wuha",
    "ቡና": "buna",
    "እንጀራ": "injera",
    "ሰው": "sew",
    "ልጅ": "lij",
    "ሰላም": "selam",
    "ሠላም": "selam",
    "ጓደኛ": "gwadegna",
    "ሥራ": "sira",
    "ስራ": "sira",
    "ስልክ": "silk",
    "መኪና": "mekina",
    "ሀገር": "hager",
    "አገር": "ager",
    "ትግርኛ": "tigrigna",
    "ግዕዝ": "geez",
    // Where the epenthetic ɨ actually lands inside a consonant cluster is not
    // recoverable from the spelling (አምስት is [ammɨst], መንግስት is [mängɨst]),
    // so the frequent ones are listed.
    "አምስት": "amist",
    "ስድስት": "sidist",
    "ስምንት": "simint",
    "አስር": "asir",
    "ባህር": "bahir",
    "ክፍል": "kifil",
    "ሺህ": "shih",
    "ልብስ": "libis",
    "ሙዚቃ": "muzika"
  };

  // Which two-consonant endings a reader can actually say. A word may end in a
  // bare 6th-order pair when the first is a fricative (-st, -sk, -ft) or a
  // sonorant followed by a stop (-nt, -rk, -mb); "demn" and "kutr" are not
  // endings, so the 6th order there has to be spelled out as "i".
  const CODA_FIRST = {
    s: 1, sh: 1, z: 1, zh: 1, f: 1, ts: 1,
    n: 1, m: 1, l: 1, r: 1, ng: 1
  };
  const CODA_SECOND = {
    t: 1, d: 1, k: 1, g: 1, b: 1, p: 1, j: 1, ch: 1, ts: 1, s: 1, f: 1
  };
  const sayableCoda = (a, b) =>
    a !== "" && b !== "" && CODA_FIRST[a] === 1 && CODA_SECOND[b] === 1;

  /** Romanise one whitespace-free, punctuation-free Ethiopic word. */
  function romanizeWord(word) {
    if (DICT[word]) return DICT[word];

    // Collect the syllable units first: the 6th-order decision needs to know
    // what came before and whether anything comes after.
    const units = [];
    for (const ch of word) {
      const cp = ch.codePointAt(0);
      const syl = SYL.get(cp);
      if (syl) {
        units.push({ c: syl.c, v: syl.v, sixth: syl.sixth });
        continue;
      }
      const n = numeralValue(cp);
      if (n >= 0) {
        units.push({ num: n });
        continue;
      }
      if (PUNCT[cp] !== undefined) {
        units.push({ lit: PUNCT[cp] });
        continue;
      }
      // U+135D..U+135F combining gemination/tone marks and unassigned holes.
    }

    // Resolve every syllable to [consonant, vowel] first. The 6th order can
    // only be settled once the end of the word is in sight, and settling it
    // can mean going back one syllable (see below).
    const parts = [];
    let numAcc = 0;
    let numTotal = 0;
    let inNum = false;

    let hasVowel = false; // did the previous syllable leave a vowel to lean on?

    const flushNum = () => {
      if (!inNum) return;
      parts.push({ c: String(numTotal + numAcc), v: "" });
      numAcc = 0;
      numTotal = 0;
      inNum = false;
      hasVowel = false;
    };

    for (let i = 0; i < units.length; i++) {
      const u = units[i];

      if (u.num !== undefined) {
        inNum = true;
        // Ge'ez numerals are multiplicative around ፻ (100) and ፼ (10000).
        if (u.num >= 100) {
          numAcc = (numAcc === 0 ? 1 : numAcc) * u.num;
          numTotal += numAcc;
          numAcc = 0;
        } else {
          numAcc += u.num;
        }
        continue;
      }
      flushNum();

      if (u.lit !== undefined) {
        parts.push({ c: u.lit, v: "" });
        hasVowel = false;
        continue;
      }

      let v = u.v;
      // 6th order: a bare coda when the syllable before it already carries a
      // vowel (ሰላም selam) and word-finally, where Amharic reduces it away
      // (ሦስት sost); otherwise the consonant needs a vowel of its own
      // (ትግርኛ tigrigna).
      if (u.sixth) {
        const isLast = i === units.length - 1;
        v = hasVowel || (isLast && i > 0) ? "" : "i";
      }
      parts.push({ c: u.c, v, sixth: u.sixth === true });
      hasVowel = v !== "";
    }
    flushNum();

    // A word may end in two bare consonants only when they can be said
    // together: -st, -rk, -nt. When they cannot, the epenthetic vowel belongs
    // on the FIRST of the two, not the last — ቁጥር is kutir (not "kutri" or
    // "kutr") and እንደምን is indemin.
    const n = parts.length;
    if (n >= 2) {
      const last = parts[n - 1];
      const prev = parts[n - 2];
      if (last.sixth && last.v === "" && prev.sixth && prev.v === "" &&
          !sayableCoda(prev.c, last.c)) {
        prev.v = "i";
      }
    }

    let out = "";
    for (const p of parts) out += p.c + p.v;

    // Collapse artefacts like "sss" from stacked identical consonants.
    return out.replace(/([a-z])\1{2,}/g, "$1$1");
  }

  /**
   * The router hands over a maximal run of block characters, and Ethiopic
   * punctuation (including the ፡ word space) lives inside the block — so the
   * run has to be split back into words here.
   */
  function romanize(run) {
    let out = "";
    let buf = "";
    const flush = () => {
      if (buf) {
        out += romanizeWord(buf);
        buf = "";
      }
    };
    for (const ch of run) {
      const cp = ch.codePointAt(0);
      if (PUNCT[cp] !== undefined) {
        flush();
        out += PUNCT[cp];
      } else if (cp < 0x1200 || cp > 0x137f) {
        // The router never sends these, but direct callers might.
        flush();
        out += cp < 0x80 ? ch : "";
      } else {
        buf += ch;
      }
    }
    flush();
    return out.replace(/  +/g, " ").replace(/[^\x20-\x7E]/g, "");
  }

  const mod = {
    id: "ethiopic",
    languages: ["Amharic", "Tigrinya", "Geez", "Tigre"],
    ranges,
    romanize
  };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
