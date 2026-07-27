/**
 * Kana -> Roman (Hepburn, no macrons).
 *
 * Kanji is a different module's problem: a mixed sentence is split into runs and
 * each run is romanised by whoever claims its block, which is the right answer.
 *
 * Katakana is the hiragana table shifted by 0x60, so one 86 entry array covers
 * both syllabaries; halfwidth kana is folded up to fullwidth first (composing
 * the standalone voicing marks as it goes), so there is exactly one code path.
 *
 * What actually makes kana readable in Latin letters:
 *   yoon        きゃ -> kya, しゅ -> shu, ちょ -> cho, ファ -> fa, ティ -> ti
 *   sokuon      がっこう -> gakkou, まっちゃ -> matcha, ざっし -> zasshi
 *   moraic n    こんにちは -> konnichiwa, しんぶん -> shimbun, ほんや -> hon'ya
 *   long mark   ラーメン -> raamen  (ー doubles the vowel it lengthens)
 *   particles   は -> wa, へ -> e, を -> o
 *
 * Two deliberate choices, both documented because they are judgement calls:
 *
 * 1. Vowel length is written the way people type it, not the way a stylebook
 *    prints it: とうきょう -> toukyou, ありがとう -> arigatou, and ー doubles the
 *    preceding vowel (コーヒー -> koohii). Nothing is silently thrown away.
 *
 * 2. ん before b/m/p becomes m in hiragana (しんぶん -> shimbun, てんぷら ->
 *    tempura) but stays n in katakana (キャンプ -> kyanpu, コンピュータ ->
 *    konpyuuta). Traditional Hepburn does the first; loanwords are read back
 *    towards their source spelling, and katakana is the signal for those.
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [
    [0x3040, 0x309f],  // hiragana
    [0x30a0, 0x30ff],  // katakana
    [0x31f0, 0x31ff],  // katakana phonetic extensions (Ainu)
    [0xff65, 0xff9f]   // halfwidth katakana
  ];

  // U+3041..U+3096 in code point order. Small kana carry their full value here;
  // the parser intercepts them before the lookup when they combine.
  const HIRA = [
    "a", "a", "i", "i", "u", "u", "e", "e", "o", "o",                     // 3041 ぁ..お
    "ka", "ga", "ki", "gi", "ku", "gu", "ke", "ge", "ko", "go",           // 304B か..ご
    "sa", "za", "shi", "ji", "su", "zu", "se", "ze", "so", "zo",          // 3055 さ..ぞ
    "ta", "da", "chi", "ji", "", "tsu", "zu", "te", "de", "to", "do",     // 305F た..ど (っ = "")
    "na", "ni", "nu", "ne", "no",                                        // 306A な..の
    "ha", "ba", "pa", "hi", "bi", "pi", "fu", "bu", "pu",                 // 306F は..ぷ
    "he", "be", "pe", "ho", "bo", "po",                                  // 3078 へ..ぽ
    "ma", "mi", "mu", "me", "mo",                                        // 307E ま..も
    "ya", "ya", "yu", "yu", "yo", "yo",                                  // 3083 ゃ..よ
    "ra", "ri", "ru", "re", "ro",                                        // 3089 ら..ろ
    "wa", "wa", "i", "e", "o", "",                                       // 308E ゎ..ん (ん = "")
    "vu", "ka", "ke"                                                     // 3094 ゔ ゕ ゖ
  ];

  // U+31F0..U+31FF: Ainu coda kana, written as the bare consonant.
  const AINU = ["k", "sh", "s", "t", "n", "h", "h", "f", "h", "h", "m", "r", "r", "r", "r", "r"];

  // halfwidth U+FF65..U+FF9D -> fullwidth katakana
  const HALF = "・ヲァィゥェォャュョッー" +
    "アイウエオカキクケコ" +
    "サシスセソタチツテト" +
    "ナニヌネノハヒフヘホ" +
    "マミムメモヤユヨ" +
    "ラリルレロワン";

  const VOICED = {};
  const SEMIVOICED = {};
  (() => {
    const v = "かがきぎくぐけげこご" +
      "さざしじすずせぜそぞ" +
      "ただちぢつづてでとど" +
      "はばひびふぶへべほぼうゔ" +
      "カガキギクグケゲコゴ" +
      "サザシジスズセゼソゾ" +
      "タダチヂツヅテデトド" +
      "ハバヒビフブヘベホボ" +
      "ウヴワヷヰヸヱヹヲヺ";
    for (let i = 0; i < v.length; i += 2) VOICED[v[i]] = v[i + 1];
    const s = "はぱひぴふぷへぺほぽ" +
      "ハパヒピフプヘペホポ";
    for (let i = 0; i < s.length; i += 2) SEMIVOICED[s[i]] = s[i + 1];
  })();

  const SMALL_Y = { 0x3083: "a", 0x3085: "u", 0x3087: "o", 0x30e3: "a", 0x30e5: "u", 0x30e7: "o" };
  const SMALL_V = {
    0x3041: "a", 0x3043: "i", 0x3045: "u", 0x3047: "e", 0x3049: "o",
    0x30a1: "a", 0x30a3: "i", 0x30a5: "u", 0x30a7: "e", 0x30a9: "o"
  };

  const SOKUON = { 0x3063: 1, 0x30c3: 1 };
  const MORAIC_N = { 0x3093: 1, 0x30f3: 1 };
  const SMALL_WA = { 0x308e: 1, 0x30ee: 1 };

  const VOWELS = "aiueo";

  // Fixed phrases where は is the topic particle in the middle of a kana run,
  // which no position rule can see.
  const DICT = {
    "ではない": "dewanai",
    "ではなく": "dewanaku",
    "ではありません": "dewaarimasen",
    "とはいえ": "towaie",
    "こんにちは": "konnichiwa",
    "こんばんは": "konbanwa",
    "こんにちわ": "konnichiwa",
    "こんばんわ": "konbanwa"
  };

  const stem = (r) => r.replace(/[aiueo]$/, "");
  const lastVowel = (r) => {
    const m = /[aiueo]$/.exec(r);
    return m ? m[0] : "";
  };

  /** Base romaji for one full-size kana, or undefined if it is not one. */
  function kanaRomaji(cp) {
    if (cp >= 0x3041 && cp <= 0x3096) return HIRA[cp - 0x3041];
    if (cp >= 0x30a1 && cp <= 0x30f6) {
      if (cp === 0x30f2) return "wo";  // ヲ is decoration, never the particle
      if (cp === 0x30f6) return "ka";  // ヶ月 -> kagetsu
      return HIRA[cp - 0x30a1];
    }
    if (cp >= 0x30f7 && cp <= 0x30fa) return ["va", "vi", "ve", "vo"][cp - 0x30f7];
    return undefined;
  }

  /** Fold halfwidth katakana up to fullwidth, composing ﾞ and ﾟ. */
  function foldHalfwidth(s) {
    if (!/[｡-ﾟ]/.test(s)) return s;
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const cp = s.charCodeAt(i);
      if (cp < 0xff65 || cp > 0xff9f) { out += s[i]; continue; }
      if (cp > 0xff9d) continue;                 // stray ﾞ / ﾟ
      let full = HALF[cp - 0xff65];
      const nx = s[i + 1];
      if (nx === "ﾞ" && VOICED[full]) { full = VOICED[full]; i += 1; }
      else if (nx === "ﾟ" && SEMIVOICED[full]) { full = SEMIVOICED[full]; i += 1; }
      out += full;
    }
    return out;
  }

  /** kana + small ya/yu/yo */
  function yoon(r, v) {
    const c = stem(r);
    if (c === "sh" || c === "ch" || c === "j") return c + v;   // しゃ sha, ちゅ chu, じょ jo
    if (c === "" || c === "y") return "y" + v;
    return c + "y" + v;                                        // きゃ kya, にゅ nyu, テュ tyu
  }

  /** kana + small a/i/u/e/o */
  function smallVowel(prev, v) {
    const src = prev.src;
    if (src === "う" || src === "ウ") return "w" + v;          // ウィ wi, ウォ wo
    if (src === "く" || src === "ク") return "kw" + v;         // クァ kwa
    if (src === "ぐ" || src === "グ") return "gw" + v;         // グァ gwa
    const c = stem(prev.r);
    if (lastVowel(prev.r) === "i") {
      return (c === "sh" || c === "ch" || c === "j") ? c + v : c + "y" + v;  // シェ she, キェ kye
    }
    return c + v;                                                       // ファ fa, ティ ti, ツァ tsa
  }

  function isKatakana(ch) {
    if (!ch) return false;
    const cp = ch.codePointAt(0);
    return (cp >= 0x30a1 && cp <= 0x30fa) || cp === 0x30fc || cp === 0x30fe;
  }

  const combinable = (u) =>
    u && u.t === "s" && (stem(u.r) !== "" || u.src === "い" || u.src === "イ" ||
      u.src === "う" || u.src === "ウ");

  /**
   * Split a run into moras:
   *   {t:"s"} syllable   {t:"q"} sokuon   {t:"n"} moraic n
   *   {t:"-"} long mark  {t:"x"} literal passthrough
   */
  function parse(src) {
    const chars = Array.from(src);
    const units = [];
    let last = "";  // last full-size kana, for the iteration marks ゝゞヽヾ

    for (let i = 0; i < chars.length; i++) {
      let c = chars[i];
      let cp = c.codePointAt(0);

      if (cp === 0x309d || cp === 0x30fd) {          // ゝ ヽ repeat
        c = last;
      } else if (cp === 0x309e || cp === 0x30fe) {   // ゞ ヾ repeat, voiced
        c = last ? (VOICED[last] || last) : "";
      }
      if (!c) continue;
      cp = c.codePointAt(0);

      if (SOKUON[cp]) { units.push({ t: "q" }); continue; }
      if (MORAIC_N[cp]) { units.push({ t: "n", kata: cp === 0x30f3 }); continue; }
      if (cp === 0x30fc) { units.push({ t: "-" }); continue; }
      if (cp === 0x30fb) { units.push({ t: "x", r: " " }); continue; }   // ・ separates names
      if (cp === 0x30a0) { units.push({ t: "x", r: "-" }); continue; }   // ゠
      if (cp >= 0x31f0 && cp <= 0x31ff) { units.push({ t: "x", r: AINU[cp - 0x31f0] }); continue; }
      if (cp === 0x309f) { units.push({ t: "s", r: "yori", src: c }); last = c; continue; }
      if (cp === 0x30ff) { units.push({ t: "s", r: "koto", src: c }); last = c; continue; }

      const prev = units.length ? units[units.length - 1] : null;

      if (SMALL_Y[cp] !== undefined) {
        if (prev && prev.t === "s" && stem(prev.r) !== "") prev.r = yoon(prev.r, SMALL_Y[cp]);
        else units.push({ t: "s", r: "y" + SMALL_Y[cp], src: c });
        continue;
      }
      if (SMALL_V[cp] !== undefined) {
        if (combinable(prev)) prev.r = smallVowel(prev, SMALL_V[cp]);
        else units.push({ t: "s", r: SMALL_V[cp], src: c });
        continue;
      }
      if (SMALL_WA[cp]) {
        if (prev && prev.t === "s" && stem(prev.r) !== "") prev.r = stem(prev.r) + "wa";
        else units.push({ t: "s", r: "wa", src: c });
        continue;
      }

      let r = kanaRomaji(cp);
      if (r === undefined || r === "") continue;   // combining marks, unassigned
      // Particles: は and へ are read wa / e when they stand as a grammatical
      // word rather than as part of one. Two signals are visible without a
      // dictionary: the run ends there (こんにちは, わたしは, では), or a katakana
      // word ends right before it (ミーティングは). Word-internal は stays ha
      // (はな, はい, ちがい).
      if ((c === "は" || c === "へ") &&
          (i === chars.length - 1 || isKatakana(chars[i - 1]))) {
        r = c === "は" ? "wa" : "e";
      }
      units.push({ t: "s", r, src: c });
      last = c;
    }
    return units;
  }

  function render(units) {
    let out = "";
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const next = units[i + 1];

      if (u.t === "s" || u.t === "x") { out += u.r; continue; }

      if (u.t === "q") {                       // small tsu doubles what follows
        if (next && next.t === "s") {
          const r = next.r;
          if (r.slice(0, 2) === "ch") out += "t";            // まっちゃ matcha
          else if (VOWELS.indexOf(r[0]) === -1) out += r[0];  // がっこう gakkou
        }
        continue;
      }

      if (u.t === "n") {
        let r = "n";
        if (next && next.t === "s") {
          const f = next.r[0];
          if (!u.kata && (f === "b" || f === "m" || f === "p")) r = "m";      // しんぶん shimbun
          else if (VOWELS.indexOf(f) !== -1 || f === "y") r = "n'";           // ほんや hon'ya
        }
        out += r;
        continue;
      }

      if (u.t === "-") {                       // ー lengthens the vowel before it
        const v = lastVowel(out);
        if (v) out += v;
      }
    }
    return out;
  }

  /** Romanise ONE run of kana. */
  function romanize(word) {
    if (!word) return "";
    let src;
    try {
      src = word.normalize("NFC");
    } catch (e) {
      src = word;
    }
    src = foldHalfwidth(src);
    if (Object.prototype.hasOwnProperty.call(DICT, src)) return DICT[src];
    return render(parse(src));
  }

  const mod = { id: "kana", languages: ["Japanese"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
