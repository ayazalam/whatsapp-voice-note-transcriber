/**
 * Myanmar (Burmese) -> Roman.
 *
 * Unlike Thai, Myanmar is stored in phonetic order, so nothing has to be
 * reordered. The work is elsewhere:
 *
 *   - Onsets carry up to four medials: ျ and ြ are both /j/ ("y"), ွ is "w",
 *     and ှ makes the consonant voiceless — and that h is written BEFORE the
 *     letter, so မှာ is "hma", not "mha". ရ + ှ is the special case "sh".
 *   - A syllable's vowel is not the sum of its parts. Burmese rhymes are
 *     idiosyncratic: ိ + က် is "eik", ု + န် is "on", ော + င် is "aung".
 *     So the vowel signs and the killed final consonant are read together and
 *     looked up as one rhyme, which is the only way to get ကျောင်း -> kyaung.
 *   - ် (asat) kills a consonant into a final; ္ (virama) stacks it under the
 *     next one. Both mean "this consonant closes the syllable", including the
 *     kinzi sequence င် ္ in မင်္ဂလာပါ.
 *
 * Tone marks ့ and း are dropped — they do not survive romanisation.
 */
(() => {
  "use strict";

  const ranges = [[0x1000, 0x109f]];

  const CONS = {
    "က": "k", "ခ": "kh", "ဂ": "g", "ဃ": "g", "င": "ng",
    "စ": "s", "ဆ": "s", "ဇ": "z", "ဈ": "z", "ဉ": "ny", "ည": "ny",
    "ဋ": "t", "ဌ": "ht", "ဍ": "d", "ဎ": "d", "ဏ": "n",
    "တ": "t", "ထ": "ht", "ဒ": "d", "ဓ": "d", "န": "n",
    "ပ": "p", "ဖ": "ph", "ဗ": "b", "ဘ": "b", "မ": "m",
    "ယ": "y", "ရ": "y", "လ": "l", "ဝ": "w", "သ": "th",
    "ဟ": "h", "ဠ": "l", "အ": "",
    "ဿ": "s",  // great sa

    // Pali/Sanskrit letters (U+1050..U+1051).
    "ၐ": "sh", "ၑ": "sh",

    // Mon letters (U+105A..U+105D).
    "ၚ": "ng", "ၛ": "jh", "ၜ": "b", "ၝ": "b",

    // Karen letters: Sgaw sha, Western Pwo tha/pwa, Eastern Pwo nna/ywa/ghwa.
    "ၡ": "sh", "ၥ": "th", "ၦ": "pw", "ၮ": "n", "ၯ": "yw", "ၰ": "ghw",

    // Shan letters (U+1075..U+1081). The block claims Shan support, so the
    // whole consonant row has to be here or Shan text romanises to nothing.
    "ၵ": "k", "ၶ": "kh", "ၷ": "g", "ၸ": "s", "ၹ": "z", "ၺ": "ny",
    "ၻ": "d", "ၼ": "n", "ၽ": "ph", "ၾ": "f", "ၿ": "b", "ႀ": "th",
    "ႁ": "h",

    // Rumai Palaung fa and the Shan/Khamti na at the end of the block.
    "ႎ": "f", "ႏ": "n"
  };

  const INDEP = {
    "ဢ": "a", "ဣ": "i", "ဤ": "i", "ဥ": "u", "ဦ": "u",
    "ဧ": "e", "ဨ": "e", "ဩ": "aw", "ဪ": "aw",
    // Pali vocalic r / l (U+1052..U+1055).
    "ၒ": "ri", "ၓ": "ri", "ၔ": "li", "ၕ": "li"
  };

  const YAPIN = "ျ";     // U+103B medial ya
  const YAYIT = "ြ";     // U+103C medial ra (also /j/ in Burmese)
  const WASWE = "ွ";     // U+103D medial wa
  const HAHTO = "ှ";     // U+103E medial ha
  const ASAT = "်";      // U+103A kills the consonant
  const VIRAMA = "္";    // U+1039 stacks the next consonant
  const ANUSVARA = "ံ";  // U+1036
  const DOT_BELOW = "့"; // U+1037 tone
  const VISARGA = "း";   // U+1038 tone

  // Mon medials (U+105E..U+1060) and the Shan medial wa (U+1082).
  const MON_MEDIAL = { "ၞ": "n", "ၟ": "m", "ၠ": "l" };
  const SHAN_WA = "ႂ";

  // Shan vowel signs: ႃ = aa, ႄ/ႅ = e, ႆ = final y.
  const SHAN_AA = "ႃ";
  const SHAN_E = "ႄႅ";
  const SHAN_AI = "ႆ";

  const VOWEL_SIGNS = "ါာိီုူေဲ" + ANUSVARA + SHAN_AA + SHAN_E + SHAN_AI +
    // Pali vocalic signs, Karen / Kayah / Aiton vowel signs. They are not in
    // the rhyme table, but they must not break the syllable reader.
    "ၖၗၘၙ" + "ၢ" + "ၧၨ" + "ၱၲၳၴ" + "ႜႝ";

  // Tone marks and other purely suprasegmental signs, all dropped.
  const EXTRA_TONES = "ၣၤ" + "ၩၪၫၬၭ" + "ႇႈႉႊႋႌႍ" + "ႚႛ";

  const DIGITS = {
    "၀": "0", "၁": "1", "၂": "2", "၃": "3", "၄": "4",
    "၅": "5", "၆": "6", "၇": "7", "၈": "8", "၉": "9",
    // Shan digits share the block
    "႐": "0", "႑": "1", "႒": "2", "႓": "3", "႔": "4",
    "႕": "5", "႖": "6", "႗": "7", "႘": "8", "႙": "9"
  };

  const PUNCT = {
    "၊": ",",        // little section
    "။": ".",        // section (full stop)
    "၌": " hnaik ",  // locative
    "၍": " ywe ",    // completive
    "၎": " lagaung ",
    "၏": " e "       // genitive
  };

  // Rhyme = normalised vowel + killed final consonant. Keys are the vowel
  // bucket; values map the final letter (or "" for an open syllable).
  const RHYME = {
    "": {
      "": "a", "က": "et", "င": "in", "စ": "it", "ဉ": "in", "ည": "i",
      "ဏ": "an", "တ": "at", "ထ": "at", "ဒ": "at", "န": "an", "ပ": "at",
      "ဖ": "at", "ဗ": "at", "ဘ": "at", "မ": "an", "ယ": "e", "ရ": "a",
      "လ": "an", "ဝ": "a", "သ": "at", "ဠ": "an", "ဂ": "et", "ခ": "et",
      "ဃ": "et", "ဇ": "it", "ဆ": "it", "ဋ": "at", "ဌ": "at", "ဍ": "at"
    },
    "a": {
      "": "a", "က": "ak", "င": "aung", "စ": "at", "ဉ": "an", "ည": "e",
      "ဏ": "an", "တ": "at", "န": "an", "ပ": "at", "မ": "an", "ယ": "ai",
      "ရ": "a", "လ": "an", "ဝ": "a", "သ": "at"
    },
    "i": {
      "": "i", "က": "eik", "င": "ein", "စ": "eik", "ဉ": "in", "ည": "i",
      "ဏ": "ein", "တ": "eik", "န": "ein", "ပ": "eik", "မ": "ein",
      "ယ": "i", "လ": "ein", "သ": "eik"
    },
    "u": {
      "": "u", "က": "ok", "င": "on", "စ": "ok", "ဉ": "on", "တ": "ok",
      "န": "on", "ပ": "ok", "မ": "on", "ယ": "u", "လ": "on", "သ": "ok"
    },
    "e": {
      "": "e", "က": "ek", "င": "ein", "စ": "et", "တ": "et", "န": "en",
      "ပ": "et", "မ": "en", "ယ": "e"
    },
    "ai": {
      "": "e", "က": "ek", "င": "ein", "တ": "et", "န": "en", "ပ": "et",
      "မ": "en", "ယ": "e"
    },
    "o": {
      "": "o", "က": "aik", "င": "aing", "စ": "aik", "တ": "aik",
      "န": "ain", "ပ": "aik", "မ": "ain", "ယ": "o"
    },
    "aw": {
      "": "aw", "က": "auk", "င": "aung", "စ": "auk", "တ": "auk",
      "န": "aun", "ပ": "auk", "မ": "aun", "ယ": "aw"
    },
    "am": {
      "": "an", "က": "an", "င": "an", "တ": "an", "န": "an", "မ": "an"
    }
  };

  // Fallback when a rhyme is not in the table.
  const FINAL_DEFAULT = {
    "က": "k", "ခ": "k", "ဂ": "k", "ဃ": "k", "င": "ng", "စ": "t",
    "ဆ": "t", "ဇ": "t", "ဉ": "n", "ည": "i", "ဋ": "t", "ဌ": "t",
    "ဍ": "t", "ဏ": "n", "တ": "t", "ထ": "t", "ဒ": "t", "ဓ": "t",
    "န": "n", "ပ": "t", "ဖ": "t", "ဗ": "t", "ဘ": "t", "မ": "n",
    "ယ": "", "ရ": "", "လ": "n", "ဝ": "", "သ": "t", "ဠ": "n"
  };

  const inBlock = (ch) => { const c = ch.charCodeAt(0); return c >= 0x1000 && c <= 0x109f; };
  const isCons = (ch) => ch !== undefined && CONS[ch] !== undefined;
  const isVowelSign = (ch) => ch !== undefined && VOWEL_SIGNS.indexOf(ch) !== -1;
  const isTone = (ch) =>
    ch === DOT_BELOW || ch === VISARGA ||
    (ch !== undefined && EXTRA_TONES.indexOf(ch) !== -1);

  /** True for marks that bind to the letter before them. */
  const attaches = (ch) =>
    ch !== undefined &&
    (isVowelSign(ch) || isTone(ch) || ch === ASAT || ch === VIRAMA ||
     ch === YAPIN || ch === YAYIT || ch === WASWE || ch === HAHTO ||
     ch === SHAN_WA || MON_MEDIAL[ch] !== undefined);

  function skipTones(w, i) {
    while (i < w.length && isTone(w[i])) i += 1;
    return i;
  }

  /** Collapse the collected vowel signs into one bucket key. */
  function vowelKey(signs) {
    const has = (ch) => signs.indexOf(ch) !== -1;
    const hasAny = (set) => {
      for (const ch of set) if (signs.indexOf(ch) !== -1) return true;
      return false;
    };
    const aa = has("ာ") || has("ါ") || has(SHAN_AA);
    const e = has("ေ") || hasAny(SHAN_E);
    const i = has("ီ") || has("ိ");
    const u = has("ူ") || has("ု");
    // ံ nasalises the vowel it sits on; ုံ is "oun" and ိံ is "ein", so it
    // has to be tested together with the vowel, never after it.
    const nasal = has(ANUSVARA);
    if (e && aa) return "aw";
    if (i && u) return "o";
    if (e) return "e";
    if (has("ဲ") || has(SHAN_AI)) return "ai";
    // ာ on its own is plain long a (ဘာသာ batha); only ာံ nasalises to "an".
    if (aa) return nasal ? "am" : "a";
    if (i) return nasal ? "im" : "i";
    if (u) return nasal ? "um" : "u";
    if (nasal) return "am";
    return "";
  }

  /** One syllable at i -> { text, i } or null. */
  function readSyllable(w, i) {
    const start = i;
    const ch = w[i];

    if (INDEP[ch] !== undefined) return { text: INDEP[ch], i: skipTones(w, i + 1) };
    if (!isCons(ch)) return null;

    let base = CONS[ch];
    let pre = "";
    let post = "";
    i += 1;

    // A consonant killed immediately is a stray final; give it its own sound.
    if (w[i] === ASAT || w[i] === VIRAMA) {
      const f = FINAL_DEFAULT[ch] !== undefined ? FINAL_DEFAULT[ch] : base;
      return { text: f, i: skipTones(w, i + 1) };
    }

    // Medials, in whatever order they were typed.
    let sawMedial = true;
    while (sawMedial && i < w.length) {
      const m = w[i];
      if (m === YAPIN || m === YAYIT) { post += "y"; i += 1; }
      else if (m === WASWE || m === SHAN_WA) { post += "w"; i += 1; }
      else if (MON_MEDIAL[m] !== undefined) { post += MON_MEDIAL[m]; i += 1; }
      else if (m === HAHTO) {
        if (ch === "ရ") base = "sh";
        else if (ch === "အ") base = "h";
        else pre = "h";
        i += 1;
      } else sawMedial = false;
    }

    // Vowel signs (tone marks interleave freely).
    let signs = "";
    for (;;) {
      i = skipTones(w, i);
      if (isVowelSign(w[i])) {
        signs += w[i];
        i += 1;
        continue;
      }
      break;
    }

    // Killed final consonant, written C + ် or C + ္.
    let fin = "";
    if (isCons(w[i])) {
      const k = skipTones(w, i + 1);
      if (w[k] === ASAT || w[k] === VIRAMA) {
        fin = w[i];
        i = skipTones(w, k + 1);
        // A doubled final (ဘောင်း style) or a stacked pair: the second letter
        // belongs to the next syllable, so stop here.
      }
    }

    const key = vowelKey(signs);
    const row = RHYME[key];
    let rhyme;
    if (row && row[fin] !== undefined) rhyme = row[fin];
    else rhyme = (key === "" ? "a" : key === "ai" ? "e" : key === "am" ? "an" : key) +
                 (fin ? (FINAL_DEFAULT[fin] !== undefined ? FINAL_DEFAULT[fin] : "") : "");

    i = skipTones(w, i);
    if (i === start) return null;

    // ခ + medial y is /tɕʰ/ — everybody writes that "ch" (ချစ် chit).
    let onset = pre + base + post;
    if (onset === "khy") onset = "ch";
    else if (onset === "hkhy") onset = "hch";

    return { text: onset + rhyme, i };
  }

  /**
   * A dictionary match may not stop in the middle of a syllable. ကို is a word
   * ("to"), but the ကို of ကိုင် is not — the င် there is that syllable's
   * killed final. Checking only the character after the match is not enough,
   * because a plain consonant does not "attach"; the syllable reader has to be
   * asked how far the syllable that starts at i actually reaches.
   */
  function dictEdgeOk(w, i, len) {
    if (attaches(w[i + len])) return false;
    const syl = readSyllable(w, i);
    return !syl || syl.i <= i + len;
  }

  // Spellings people recognise, plus the sandhi (ပ -> b, တ -> d) that the
  // mechanical path cannot know about.
  const DICT = {
    "မြန်မာ": "myanmar", "မြန်မာနိုင်ငံ": "myanmar naingngan",
    "မင်္ဂလာပါ": "mingalaba", "မင်္ဂလာ": "mingala",
    "ကျေးဇူးတင်ပါတယ်": "kyezu tin ba de", "ကျေးဇူးတင်ပါသည်": "kyezu tin ba de",
    "ကျေးဇူး": "kyezu", "ကျေးဇူးပါ": "kyezu ba",
    "ဟုတ်ကဲ့": "hokeh", "ဟုတ်တယ်": "hoke de", "မဟုတ်ဘူး": "mahoke bu",
    "ပါတယ်": "ba de", "ပါ": "ba", "တယ်": "de", "ဘူး": "bu", "လား": "la",
    "ကျွန်တော်": "kyanaw", "ကျွန်မ": "kyama", "ကျနော်": "kyanaw",
    "ခင်ဗျာ": "khinbya", "ခင်ဗျား": "khinbya", "ရှင်": "shin",
    "ရန်ကုန်": "yangon", "နေပြည်တော်": "naypyidaw", "မန္တလေး": "mandalay",
    "ဗမာ": "bama", "နေကောင်းလား": "nekaung la", "နေကောင်းပါတယ်": "nekaung ba de",
    "ဘယ်လိုလဲ": "balo le", "ဘာလဲ": "ba le", "ဘယ်သူ": "bathu",
    "ဘယ်လောက်": "belauk", "ဘယ်မှာ": "beh hma", "ဘယ်တော့": "betaw",
    "ဘယ်": "beh", "ဒီ": "di", "အဲဒါ": "eh da", "ဒါ": "da",
    "ငါ": "nga", "မင်း": "min", "သူ": "thu", "သူတို့": "thudo", "ငါတို့": "ngado",
    "စား": "sa", "သွား": "thwa", "လာ": "la", "ပြော": "pyaw", "ကြည့်": "kyi",
    "နေ": "ne", "ကို": "ko", "မှာ": "hma", "နဲ့": "neh", "ရ": "ya",
    "တစ်": "tit", "နှစ်": "hnit", "သုံး": "thoun", "လေး": "le", "ငါး": "nga",
    "ခြောက်": "chauk", "ခုနစ်": "khunit", "ရှစ်": "shit", "ကိုး": "ko",
    "ဆယ်": "se", "ရာ": "ya", "ထောင်": "htaung", "သောင်း": "thaung",
    "သိန်း": "thein", "သန်း": "than", "ရေ": "ye", "ထမင်း": "htamin",
    "စာ": "sa", "အိမ်": "ein", "ကား": "ka", "ငွေ": "ngwe", "အလုပ်": "alok",
    "ကျောင်း": "kyaung", "ဆေးရုံ": "hsayoun", "ဖုန်း": "phone",
    "ဓာတ်ပုံ": "datpoun", "နာမည်": "namae", "ဘာသာစကား": "bathasaga",
    "ကောင်း": "kaung", "ဆိုး": "so", "ကြီး": "kyi", "သေး": "the",
    "အရမ်း": "ayan", "နည်းနည်း": "nene", "အများကြီး": "amyakyi",
    "ဒီနေ့": "dine", "မနက်ဖြန်": "manetphyan", "မနေ့က": "maneka",
    "အခု": "akhu", "နောက်": "nauk", "ရှေ့": "she",
    // Place and people names whose Latin spelling is fixed by usage; the
    // mechanical reading (pugan, yakhaing) is not what anyone writes.
    "ပုဂံ": "bagan", "ပဲခူး": "bago", "မော်လမြိုင်": "mawlamyine",
    "စစ်ကိုင်း": "sagaing", "တောင်ကြီး": "taunggyi", "မကွေး": "magway",
    "ဧရာဝတီ": "ayeyarwady", "ဧရာဝတီမြစ်": "ayeyarwady myit",
    "ရခိုင်": "rakhine", "ကချင်": "kachin", "ကရင်": "karen", "ကယား": "kayah",
    "ချင်း": "chin", "မွန်": "mon", "ရှမ်း": "shan", "တနင်္သာရီ": "tanintharyi",
    "ပုသိမ်": "pathein", "မော်လမြိုင်မြို့": "mawlamyine",
    "တောင်ငူ": "taungoo", "သထုံ": "thaton",
    "မြိတ်": "myeik", "ထားဝယ်": "dawei", "လားရှိုး": "lashio",
    "မြစ်ကြီးနား": "myitkyina", "စစ်တွေ": "sittwe", "ဟားခါး": "hakha",
    "လွိုင်ကော်": "loikaw", "ဘားအံ": "hpa an", "မြန်မာပြည်": "myanmar pyi"
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
        tokens.push(PUNCT[ch].trim() || ".");
        i += 1;
        continue;
      }
      if (isTone(ch) || ch === ASAT || ch === VIRAMA ||
          ch === YAPIN || ch === YAYIT || ch === WASWE || ch === HAHTO) {
        i += 1;   // stray mark with nothing to attach to
        continue;
      }
      const cp = ch.charCodeAt(0);
      if (cp < 0x1000 || cp > 0x109f) {
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
        // A match may not stop in the middle of a syllable: ရ is a word, but
        // the ရ of ရှိ is not.
        if (DICT[sub] !== undefined && dictEdgeOk(w, i, len)) {
          hit = { text: DICT[sub], len };
          break;
        }
      }
      if (hit) {
        // Single-syllable entries are morphemes, not words — glue them to the
        // syllables around them instead of inventing a space (ဆ + ရာ = saya).
        if (hit.len <= 3 && hit.text.indexOf(" ") === -1) {
          if (blobSyls >= MAX_BLOB) flush();
          blob += hit.text;
          blobSyls += 1;
        } else {
          flush();
          tokens.push(hit.text);
        }
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
      .replace(/\s+([.,])/g, "$1")
      .replace(/  +/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  }

  const mod = { id: "myanmar", languages: ["Burmese", "Shan", "Mon"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
