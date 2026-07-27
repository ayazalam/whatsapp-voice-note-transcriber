/**
 * Khmer -> Roman.
 *
 * Khmer is stored in logical order, so unlike Thai nothing needs reordering.
 * The two things that actually decide whether the output is right:
 *
 *   1. REGISTER (the two consonant series). Every consonant belongs to the
 *      a-series or the o-series, and every vowel sign is pronounced one way
 *      after an a-series consonant and a different way after an o-series one:
 *      ា is "a" in ក but "ea" in គ; ុ is "o" in ស but "u" in ព. Getting this
 *      wrong mangles every second word, so the vowel table below is two
 *      columns wide and the series of the syllable is resolved first —
 *      including the ៉ / ៊ marks whose whole job is to flip it.
 *   2. COENG. ្ + consonant is a subscript letter stacked under the base and
 *      pronounced as a cluster: ខ ្ម ែ រ is "khmae(r)", not "kh-ma-e-r".
 *      Coeng also chains, so ស្ត្រី stacks two.
 *
 * Final consonants take their own (reduced) values — final ស is "h", final ប
 * is "p" — and a following consonant is read as this syllable's final unless
 * it owns a vowel or a coeng of its own.
 *
 * Limitation worth stating: the register of a stacked cluster is taken from
 * the base consonant. That is the usual rule but not the only one, so a few
 * clusters come out in the wrong column.
 */
(() => {
  "use strict";

  const ranges = [[0x1780, 0x17ff]];

  const A = 1;  // a-series (first register)
  const O = 2;  // o-series (second register)

  // [initial sound, series, final sound]
  const CONS = {
    "ក": ["k", A, "k"],
    "ខ": ["kh", A, "k"],
    "គ": ["k", O, "k"],
    "ឃ": ["kh", O, "k"],
    "ង": ["ng", O, "ng"],
    "ច": ["ch", A, "ch"],
    "ឆ": ["chh", A, "ch"],
    "ជ": ["ch", O, "ch"],
    "ឈ": ["chh", O, "ch"],
    "ញ": ["nh", O, "nh"],
    "ដ": ["d", A, "t"],
    "ឋ": ["th", A, "t"],
    "ឌ": ["d", O, "t"],
    "ឍ": ["th", O, "t"],
    "ណ": ["n", A, "n"],
    "ត": ["t", A, "t"],
    "ថ": ["th", A, "t"],
    "ទ": ["t", O, "t"],
    "ធ": ["th", O, "t"],
    "ន": ["n", O, "n"],
    "ប": ["b", A, "p"],
    "ផ": ["ph", A, "p"],
    "ព": ["p", O, "p"],
    "ភ": ["ph", O, "p"],
    "ម": ["m", O, "m"],
    "យ": ["y", O, "y"],
    "រ": ["r", O, "r"],
    "ល": ["l", O, "l"],
    "វ": ["v", O, "v"],
    "ឝ": ["s", A, "h"],
    "ឞ": ["s", A, "h"],
    "ស": ["s", A, "h"],
    "ហ": ["h", A, "h"],
    "ឡ": ["l", A, "l"],
    "អ": ["", A, ""]
  };

  const INDEP = {
    "ឣ": "a", "ឤ": "a", "ឥ": "i", "ឦ": "ei", "ឧ": "u", "ឨ": "uk",
    "ឩ": "u", "ឪ": "ou", "ឫ": "rue", "ឬ": "rue", "ឭ": "lue",
    "ឮ": "lue", "ឯ": "e", "ឰ": "ai", "ឱ": "ao", "ឲ": "ao", "ឳ": "au"
  };

  // Dependent vowels: [a-series value, o-series value].
  const VOWELS = {
    "ា": ["a", "ea"],
    "ិ": ["i", "i"],
    "ី": ["ei", "i"],
    "ឹ": ["oe", "oe"],
    "ឺ": ["oe", "eu"],
    "ុ": ["o", "u"],
    "ូ": ["ou", "u"],
    "ួ": ["uo", "uo"],
    "ើ": ["aeu", "eu"],
    "ឿ": ["oea", "oea"],
    "ៀ": ["ie", "ie"],
    "េ": ["e", "e"],
    "ែ": ["ae", "ea"],
    "ៃ": ["ai", "ey"],
    "ោ": ["ao", "oa"],
    "ៅ": ["au", "ou"]
  };

  const COENG = "្";        // U+17D2, stacks the next consonant
  const NIKAHIT = "ំ";      // U+17C6, nasal
  const REAHMUK = "ះ";      // U+17C7, final h
  const YUUKALEAPINTU = "ៈ"; // U+17C8
  const MUUSIKATOAN = "៉";  // U+17C9, force a-series
  const TRIISAP = "៊";      // U+17CA, force o-series
  const BANTOC = "់";       // U+17CB, shortens the vowel
  const ROBAT = "៌";        // U+17CC
  const TOANDAKHIAT = "៍";  // U+17CD, silences its consonant
  const KAKABAT = "៎";
  const AHSDA = "៏";
  const SAMYOK = "័";
  const VIRIAM = "៑";
  const BATHAMASAT = "៓";
  const ATTHACAN = "៝";
  const AVAKRAHASANYA = "ៜ";
  const REPEAT = "ៗ";

  // Marks that just modify and never stand alone. ័ (samyok sannya) is NOT one
  // of them — it is a real vowel sign (ជ័យ chey, ស័ក sak) and is read below.
  const SILENT_MARKS = ROBAT + KAKABAT + AHSDA + VIRIAM +
                       BATHAMASAT + ATTHACAN + AVAKRAHASANYA;

  const DIGITS = {
    "០": "0", "១": "1", "២": "2", "៣": "3", "៤": "4",
    "៥": "5", "៦": "6", "៧": "7", "៨": "8", "៩": "9",
    // U+17F0..U+17F9, the lek attak (divination) numerals, same values.
    "៰": "0", "៱": "1", "៲": "2", "៳": "3", "៴": "4",
    "៵": "5", "៶": "6", "៷": "7", "៸": "8", "៹": "9"
  };

  const PUNCT = {
    "។": ".",     // khan, full stop
    "៕": ".",     // bariyoosan, end of text
    "៖": ":",     // camnuc pii kuuh
    "៘": ".",     // beyyal (etc.)
    "៙": " ",     // phnaek muan
    "៚": ".",     // koomuut
    "៛": "riel"
  };

  const inBlock = (ch) => { const c = ch.charCodeAt(0); return c >= 0x1780 && c <= 0x17ff; };
  const isCons = (ch) => ch !== undefined && CONS[ch] !== undefined;
  const isVowel = (ch) => ch !== undefined && VOWELS[ch] !== undefined;
  const isModifier = (ch) =>
    ch !== undefined &&
    (ch === NIKAHIT || ch === REAHMUK || ch === YUUKALEAPINTU ||
     ch === MUUSIKATOAN || ch === TRIISAP || ch === BANTOC ||
     ch === TOANDAKHIAT || ch === SAMYOK || SILENT_MARKS.indexOf(ch) !== -1);

  /** True for anything that binds to the letter before it. */
  const attaches = (ch) =>
    ch !== undefined && (isVowel(ch) || isModifier(ch) || ch === COENG);

  function skipSilent(w, i) {
    while (i < w.length && SILENT_MARKS.indexOf(w[i]) !== -1) i += 1;
    return i;
  }

  /** True at a word edge: end of run, punctuation, a digit or foreign text. */
  function endish(w, i) {
    if (i >= w.length) return true;
    const ch = w[i];
    if (PUNCT[ch] !== undefined || DIGITS[ch] !== undefined) return true;
    const cp = ch.charCodeAt(0);
    return cp < 0x1780 || cp > 0x17ff;
  }

  /** One syllable at i -> { text, i } or null. */
  function readSyllable(w, i) {
    const start = i;
    const ch = w[i];

    if (INDEP[ch] !== undefined) {
      i += 1;
      let t = INDEP[ch];
      i = skipSilent(w, i);
      if (w[i] === NIKAHIT) { t += "m"; i += 1; }
      else if (w[i] === REAHMUK) { t += "h"; i += 1; }
      return { text: t, i };
    }
    if (!isCons(ch)) return null;

    const base = CONS[ch];
    let onset = base[0];
    let series = base[1];
    i += 1;
    i = skipSilent(w, i);

    // A consonant wearing ៍ is not pronounced at all.
    if (w[i] === TOANDAKHIAT) return { text: "", i: i + 1 };

    // Stacked (coeng) consonants, possibly several.
    let guard = 0;
    while (w[i] === COENG && isCons(w[i + 1]) && guard++ < 4) {
      const sub = CONS[w[i + 1]];
      // ប is "b" alone but "p" once something is stacked under it, which is
      // why ប្រទេស is prates and ប្រាំ is pram — never "brates"/"bram".
      if (ch === "ប" && onset === "b") onset = "p";
      onset += sub[0];
      i += 2;
      i = skipSilent(w, i);
    }

    // Register shifters exist precisely to override the inherited series.
    for (;;) {
      if (w[i] === MUUSIKATOAN) {
        // On ប the mark does not shift register, it unvoices the letter:
        // ប is "b" but ប៉ is "p" (ប៉ូលិស polis, ប៉ុន្តែ pontae).
        if (ch === "ប" && onset.charAt(0) === "b") onset = "p" + onset.slice(1);
        series = A;
        i += 1;
      }
      else if (w[i] === TRIISAP) { series = O; i += 1; }
      else break;
      i = skipSilent(w, i);
    }

    // Vowel: written, or the inherent one.
    let v;
    let sawVowel = true;
    if (isVowel(w[i])) {
      v = VOWELS[w[i]][series === A ? 0 : 1];
      i += 1;
    } else if (w[i] === SAMYOK) {
      // ័ is a written short /a/; ័យ is the diphthong (ជ័យ chey, ម៉ោង…).
      i = skipSilent(w, i + 1);
      if (w[i] === "យ") { v = series === A ? "ay" : "ey"; i += 1; }
      else v = series === A ? "a" : "ea";
    } else {
      v = series === A ? "a" : "o";
      sawVowel = false;
    }
    i = skipSilent(w, i);

    // Post-vowel signs.
    let tail = "";
    for (;;) {
      if (w[i] === NIKAHIT) {
        // ាំ is "am"/"oam"; a bare ំ nasalises the inherent vowel.
        if (v === "a" || v === "ea") v = series === A ? "a" : "oa";
        tail += "m";
        i += 1;
      } else if (w[i] === REAHMUK) {
        tail += "h";
        i += 1;
      } else if (w[i] === YUUKALEAPINTU) {
        tail += "h";
        i += 1;
      } else if (w[i] === BANTOC) {
        // Shortens the vowel; the inherent o-series vowel becomes "u".
        if (v === "o") v = "u";
        i += 1;
      } else break;
      i = skipSilent(w, i);
    }

    // Final consonant, if the next letter does not own a vowel or a coeng.
    let fin = "";
    if (!tail && isCons(w[i])) {
      const nxt = skipSilent(w, i + 1);
      if (w[nxt] === TOANDAKHIAT) {
        i = nxt + 1;                       // written but silent
      } else if (w[nxt] === COENG && isCons(w[nxt + 1]) &&
                 endish(w, skipSilent(w, nxt + 2))) {
        // A stack at the end of the word is a written cluster with only the
        // first letter pronounced: ខេត្ត khet, កិច្ច kech, សត្វ sat,
        // សមុទ្រ samot — never a new syllable with an inherent vowel.
        fin = CONS[w[i]][2];
        i = skipSilent(w, nxt + 2);
      } else if (isCons(w[nxt]) && sawVowel && endish(w, nxt + 1)) {
        // Exactly two bare consonants close the word: they are a syllable of
        // their own (onset + final), not this syllable's final plus a stray.
        // ជាជន is chea-chon, not cheach-no; សាកល is sa-kal.
      } else if ((w[nxt] === "ិ" || w[nxt] === "ុ") && sawVowel &&
                 endish(w, nxt + 1)) {
        // Indic loans keep a final ិ / ុ in writing but drop it in speech:
        // ភូមិ phum, ជាតិ cheat, ធាតុ theat.
        fin = CONS[w[i]][2];
        i = nxt + 1;
      } else if (!isVowel(w[nxt]) && w[nxt] !== COENG &&
                 w[nxt] !== MUUSIKATOAN && w[nxt] !== TRIISAP) {
        fin = CONS[w[i]][2];
        i = nxt;
        // ់ after the final shortens the vowel
        if (w[i] === BANTOC) {
          if (v === "o") v = "u";
          i += 1;
        }
        if (w[i] === NIKAHIT) { fin += "m"; i += 1; }
        else if (w[i] === REAHMUK) { fin += "h"; i += 1; }
        i = skipSilent(w, i);
      }
    }

    if (i === start) return null;
    return { text: onset + v + tail + fin, i };
  }

  /**
   * A dictionary match may not stop in the middle of a syllable. ណា is a word
   * ("which"), but the ណា of ណាស់ is not — the ស់ there closes that same
   * syllable. Checking only for an attaching mark after the match is not
   * enough, because a plain consonant does not attach; ask the syllable reader
   * how far the syllable starting at i actually reaches.
   */
  function dictEdgeOk(w, i, len) {
    if (attaches(w[i + len])) return false;
    const syl = readSyllable(w, i);
    return !syl || syl.i <= i + len;
  }

  // Conventional spellings. Khmer romanisation in the wild is not systematic
  // (Khmer, Phnom Penh, riel), so the common words are listed outright.
  const DICT = {
    "ខ្មែរ": "khmer", "កម្ពុជា": "kampuchea", "ភ្នំពេញ": "phnom penh",
    "សួស្តី": "suostei", "ជំរាបសួរ": "chumreapsuor", "អរគុណ": "arkoun",
    "សូម": "som", "សូមអរគុណ": "som arkoun", "អត់អីទេ": "at ei te",
    "បាទ": "bat", "ចាស": "chas", "ទេ": "te", "អត់": "at", "មិន": "min",
    "បាន": "ban", "មាន": "mean", "ជា": "chea", "នៅ": "nov", "ទៅ": "tov",
    "មក": "mok", "ញ៉ាំ": "nyam", "ស៊ី": "si", "ដេក": "dek", "មើល": "meul",
    "ស្តាប់": "sdap", "និយាយ": "niyeay", "អាន": "an", "សរសេរ": "sarse",
    "ដឹង": "doeng", "ស្រឡាញ់": "sralanh", "ចូលចិត្ត": "cholchet",
    "ចង់": "chong", "ត្រូវ": "trov", "នឹង": "noeng", "ហើយ": "haey",
    "នៅឡើយ": "nov laey", "និង": "ning", "ឬ": "rue", "តែ": "tae",
    "ព្រោះ": "prohs", "បើ": "baeu", "ដែល": "dael", "របស់": "robos",
    "ជាមួយ": "cheamuoy", "ឱ្យ": "aoy", "ពី": "pi", "ក្នុង": "knong",
    "លើ": "leu", "ក្រោម": "kraom", "នេះ": "nih", "នោះ": "nuh",
    "ណា": "na", "អ្វី": "avei", "ហេតុអ្វី": "haet avei", "ពេលណា": "pel na",
    "អ្នកណា": "neak na", "ប៉ុន្មាន": "ponman", "ច្រើន": "chraeun",
    "តិច": "tech", "ទាំងអស់": "teangoh", "ខ្ញុំ": "khnhom", "អ្នក": "neak",
    "គាត់": "koat", "គេ": "ke", "យើង": "yeung", "ពួកគេ": "puok ke",
    "លោក": "lok", "បង": "bong", "ប្អូន": "paon", "ម្តាយ": "mdaay",
    "ឪពុក": "ovpuk", "កូន": "kon", "មិត្ត": "mit", "មនុស្ស": "monus",
    "ផ្ទះ": "phteah", "ឡាន": "lan", "លុយ": "luy", "ពេល": "pel",
    "ថ្ងៃ": "thngai", "ថ្ងៃនេះ": "thngai nih", "ស្អែក": "saek",
    "ម្សិលមិញ": "msel minh", "ខែ": "khae", "ឆ្នាំ": "chhnam",
    "ម៉ោង": "maong", "នាទី": "neati", "ព្រឹក": "proek", "ល្ងាច": "lngeach",
    "យប់": "yup", "ឥឡូវ": "eylov", "ល្អ": "laor", "ស្អាត": "saat",
    "ឆ្ងាញ់": "chhnganh", "ក្តៅ": "kdav", "ត្រជាក់": "trocheak",
    "អាហារ": "ahar", "បាយ": "bay", "ទឹក": "tuk", "កាហ្វេ": "kafe",
    "តែក្រហម": "tae krahom", "ភាសា": "pheasa", "ភាសាខ្មែរ": "pheasa khmer",
    "ប្រទេស": "prates", "ទីក្រុង": "tikrong", "សាលា": "sala",
    "មន្ទីរពេទ្យ": "monti pet", "ការងារ": "kangea", "ទូរស័ព្ទ": "turosap",
    "មួយ": "muoy", "ពីរ": "pi", "បី": "bei", "បួន": "buon", "ប្រាំ": "pram",
    "ដប់": "dop", "រយ": "roy", "ពាន់": "poan", "លាន": "lean",
    "សុខសប្បាយ": "sok sabbay", "សុំទោស": "som tos", "លាហើយ": "lea haey",
    // Place names, where the conventional Latin spelling is fixed by usage.
    "ព្រះ": "preah", "សៀមរាប": "siem reap", "បាត់ដំបង": "battambang",
    "ព្រះវិហារ": "preah vihear", "ព្រះសីហនុ": "preah sihanouk",
    "តាកែវ": "takeo", "ព្រៃវែង": "prey veng", "ស្វាយរៀង": "svay rieng",
    "កណ្តាល": "kandal", "កណ្ដាល": "kandal", "រតនគិរី": "ratanakiri",
    "មណ្ឌលគិរី": "mondulkiri", "ក្រចេះ": "kratie", "កោះកុង": "koh kong",
    "ពោធិ៍សាត់": "pursat", "កំពង់ចាម": "kampong cham",
    "កំពង់ស្ពឺ": "kampong speu", "កំពង់ឆ្នាំង": "kampong chhnang",
    "កំពង់ធំ": "kampong thom", "សិស្ស": "ses", "អង្គរវត្ត": "angkor wat",
    "ស្ទឹងត្រែង": "stung treng", "បន្ទាយមានជ័យ": "banteay meanchey",
    "កំពត": "kampot", "ឧត្តរមានជ័យ": "oddar meanchey", "កែប": "kep",
    "ប៉ៃលិន": "pailin", "សាលារៀន": "salarien", "ព្រលានយន្តហោះ": "prolean yun hoh",
    "អង្គរ": "angkor", "ទន្លេសាប": "tonle sap", "មេគង្គ": "mekong"
  };

  let MAX_DICT = 1;
  for (const k of Object.keys(DICT)) if (k.length > MAX_DICT) MAX_DICT = k.length;

  const MAX_BLOB = 4;

  function romanize(run) {
    const w = run;
    const tokens = [];
    let blob = "";
    let blobSyls = 0;

    const flush = () => {
      if (blob) tokens.push(blob);
      blob = "";
      blobSyls = 0;
    };

    let i = 0;
    let guard = 0;
    while (i < w.length && guard++ < 4000) {
      const ch = w[i];

      if (ch === REPEAT) {
        flush();
        if (tokens.length) tokens.push(tokens[tokens.length - 1]);
        i += 1;
        continue;
      }
      if (DIGITS[ch] !== undefined) {
        let num = "";
        while (i < w.length && DIGITS[w[i]] !== undefined) {
          num += DIGITS[w[i]];
          i += 1;
        }
        flush();
        tokens.push(num);
        continue;
      }
      if (PUNCT[ch] !== undefined) {
        flush();
        tokens.push(PUNCT[ch]);
        i += 1;
        continue;
      }
      if (attaches(ch)) {
        i += 1;   // stray mark with nothing to attach to
        continue;
      }
      const cp = ch.charCodeAt(0);
      if (cp < 0x1780 || cp > 0x17ff) {
        // Foreign text the router did not split off: keep it in one piece,
        // one token per run rather than one token per letter.
        flush();
        let lit = "";
        while (i < w.length && !inBlock(w[i])) {
          if (w[i].charCodeAt(0) >= 0x20 && w[i].charCodeAt(0) < 0x7f) lit += w[i];
          i += 1;
        }
        if (lit) tokens.push(lit);
        continue;
      }

      let hit = null;
      const maxLen = Math.min(MAX_DICT, w.length - i);
      for (let len = maxLen; len >= 1; len--) {
        const sub = w.substr(i, len);
        // A match may not stop in the middle of a syllable.
        if (DICT[sub] !== undefined && dictEdgeOk(w, i, len)) {
          hit = { text: DICT[sub], len };
          break;
        }
      }
      if (hit) {
        flush();
        tokens.push(hit.text);
        i += hit.len;
        continue;
      }

      const syl = readSyllable(w, i);
      if (syl) {
        if (blobSyls >= MAX_BLOB) flush();
        blob += syl.text;
        blobSyls += 1;
        i = syl.i;
        continue;
      }

      i += 1;
    }
    flush();

    return tokens
      .join(" ")
      .replace(/\s+([.,:])/g, "$1")
      .replace(/  +/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  }

  const mod = { id: "khmer", languages: ["Khmer"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
