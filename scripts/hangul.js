/**
 * Hangul -> Roman (Revised Romanization of Korean).
 *
 * Every precomposed syllable in U+AC00..U+D7A3 is index = (I * 21 + V) * 28 + F
 * offset from U+AC00, so there is no 11,172 entry table here: decompose
 * arithmetically, then map 19 initials / 21 medials / 28 finals.
 *
 * The part that actually makes Korean readable in Latin letters is what happens
 * BETWEEN syllables, so the sound changes are applied to the jamo indices before
 * anything is spelled out:
 *   liaison        한국어 -> hangugeo, 맛있어요 -> masisseoyo, 없어 -> eopseo
 *   nasalisation   한국말 -> hangungmal, 감사합니다 -> gamsahamnida, 독립 -> dongnip
 *   lateral        신라 -> silla, 설날 -> seollal, 종로 -> jongno
 *   aspiration     좋고 -> joko, 놓다 -> nota, 잡혀 -> japyeo, 축하 -> chuka
 *   palatalisation 같이 -> gachi, 굳이 -> guji, 닫히다 -> dachida
 *
 * ASCII only: no breves, no apostrophes, and none of RR's optional syllable
 * hyphens - this is read on a phone, not cited in a paper. Tensification
 * (된소리되기) is deliberately not written, exactly as RR prescribes
 * (압구정 -> Apgujeong, not Apkkujeong).
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [[0x1100, 0x11ff], [0x3130, 0x318f], [0xac00, 0xd7af]];

  const SBASE = 0xac00;
  const SLAST = 0xd7a3;

  // onset spellings, indexed by choseong number. 11 = ㅇ, silent as an onset.
  const ONSET = [
    "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s",
    "ss", "", "j", "jj", "ch", "k", "t", "p", "h"
  ];

  // the same 19 letters standing on their own (ㅇ is a real letter then)
  const ONSET_ISO = [
    "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s",
    "ss", "ng", "j", "jj", "ch", "k", "t", "p", "h"
  ];

  // 21 medials
  const VOWEL = [
    "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",
    "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"
  ];

  // 28 finals: the sound a coda actually has (neutralised), index 0 = no coda.
  //  0 -   1 ㄱ  2 ㄲ  3 ㄳ  4 ㄴ  5 ㄵ  6 ㄶ  7 ㄷ  8 ㄹ  9 ㄺ 10 ㄻ 11 ㄼ 12 ㄽ 13 ㄾ
  // 14 ㄿ 15 ㅀ 16 ㅁ 17 ㅂ 18 ㅄ 19 ㅅ 20 ㅆ 21 ㅇ 22 ㅈ 23 ㅊ 24 ㅋ 25 ㅌ 26 ㅍ 27 ㅎ
  const CODA = [
    "", "k", "k", "k", "n", "n", "n", "t", "l", "k",
    "m", "l", "l", "l", "p", "l", "m", "p", "p", "t",
    "t", "ng", "t", "t", "k", "t", "p", "t"
  ];

  // Liaison: [final that stays behind, onset that moves to the next syllable].
  // -1 means nothing moves (the ㅇ onset stays silent).
  const LIAISON = [
    [0, -1],  //  0 none
    [0, 0],   //  1 ㄱ  국어 -> gugeo
    [0, 1],   //  2 ㄲ  밖에 -> bakke
    [1, 9],   //  3 ㄳ  삯이 -> saksi
    [0, 2],   //  4 ㄴ  손에 -> sone
    [4, 12],  //  5 ㄵ  앉아 -> anja
    [0, 2],   //  6 ㄶ  많아 -> mana   (ㅎ disappears)
    [0, 3],   //  7 ㄷ
    [0, 5],   //  8 ㄹ  물이 -> muri
    [8, 0],   //  9 ㄺ  읽어 -> ilgeo
    [8, 6],   // 10 ㄻ  젊어 -> jeolmeo
    [8, 7],   // 11 ㄼ  넓어 -> neolbeo
    [8, 9],   // 12 ㄽ
    [8, 16],  // 13 ㄾ
    [8, 17],  // 14 ㄿ
    [0, 5],   // 15 ㅀ  싫어 -> sireo  (ㅎ disappears)
    [0, 6],   // 16 ㅁ
    [0, 7],   // 17 ㅂ  집에 -> jibe
    [17, 9],  // 18 ㅄ  없어 -> eopseo
    [0, 9],   // 19 ㅅ  옷이 -> osi
    [0, 10],  // 20 ㅆ  있어 -> isseo
    [21, -1], // 21 ㅇ  강아지 -> gangaji (ㅇ never moves)
    [0, 12],  // 22 ㅈ  낮에 -> naje
    [0, 14],  // 23 ㅊ  꽃이 -> kkochi
    [0, 15],  // 24 ㅋ
    [0, 16],  // 25 ㅌ  밭에 -> bate
    [0, 17],  // 26 ㅍ  앞에 -> ape
    [0, -1]   // 27 ㅎ  좋아 -> joa
  ];

  // plain stop -> aspirated stop, for the ㅎ rules
  const ASPIRATE = { 0: 15, 3: 16, 12: 14 };  // ㄱ->ㅋ, ㄷ->ㅌ, ㅈ->ㅊ

  // Palatalisation (구개음화) of a preceding ㄷ / ㅌ happens before ㅣ, and before
  // the ㅕ of the contracted -이어 / -히어 forms, which are always open syllables
  // (닫혀 -> dachyeo, 붙여 -> buchyeo). It does NOT happen before a ㅕ that carries
  // its own coda, which is why RR spells 맏형 matyeong and not "machyeong", nor
  // before a plain ㅑ / ㅛ / ㅠ.
  const palatal = (b) => b.V === 20 || (b.V === 6 && b.F === 0);

  // compatibility jamo U+3131..U+318E standing on their own (ㅋㅋㅋ -> kkk).
  // The tail of this block is archaic and its values are approximations.
  const COMPAT = [
    "g", "kk", "ks", "n", "nj", "nh", "d", "tt", "r", "lg",        // 3131
    "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "pp", "bs",      // 313B
    "s", "ss", "ng", "j", "jj", "ch", "k", "t", "p", "h",          // 3145
    "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",     // 314F
    "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui",    // 3159
    "i", "", "nn", "nd", "ns", "nz", "lgs", "ld", "lbs", "lz",     // 3163 (3164 = filler)
    "lh", "mb", "ms", "mz", "m", "bg", "bd", "bsg", "bsd", "bj",   // 316D
    "bt", "b", "bb", "sg", "sn", "sd", "sb", "sj", "z", "ngng",    // 3177
    "ng", "ngs", "ngz", "f", "hh", "h", "yoya", "yoyae", "yoi", "yuyeo", // 3181
    "yuye", "yui", "a", "ai"                                       // 318B
  ];

  // The handful of archaic conjoining jamo that have a settled value. Anything
  // else in U+1100..U+11FF outside the modern rows degrades to "".
  const ARCHAIC = {
    0x1114: "nn", 0x1115: "nd", 0x111d: "m", 0x1121: "bs", 0x1127: "bj",
    0x112b: "b", 0x112c: "bb", 0x112d: "sg", 0x1132: "sb", 0x1136: "sj",
    0x1140: "z", 0x114c: "ng", 0x1157: "f", 0x1158: "hh", 0x1159: "h",
    0x119e: "a", 0x11a1: "ai", 0x11a2: "aa",
    0x11e2: "m", 0x11e6: "b", 0x11eb: "z", 0x11f0: "ng", 0x11f9: "h"
  };

  // Words where the mechanical output is not what anyone actually reads.
  // Matched against the whole run, so anything that normally carries a particle
  // does not belong here - see NASAL_ONSET below for those.
  const DICT = {
    "김치": "kimchi", "김치찌개": "kimchijjigae", "김치볶음밥": "kimchibokkeumbap",
    "태권도": "taekwondo", "합기도": "hapkido",
    "삼성": "Samsung", "현대": "Hyundai", "기아": "Kia", "엘지": "LG",
    "카카오톡": "KakaoTalk", "카톡": "KakaoTalk",
    // 체언 keeps its ㅎ visible: RR 3.1 note, 묵호 Mukho / 집현전 Jiphyeonjeon.
    // The general rule (좋고 joko, 잡혀 japyeo) is right for 용언 and stays.
    "묵호": "mukho", "집현전": "jiphyeonjeon", "국회": "gukhoe", "국화": "gukhwa",
    "북한": "bukhan", "북한산": "bukhansan", "백화점": "baekhwajeom",
    "입학": "iphak", "급행": "geuphaeng", "직행": "jikhaeng",
    // 밟- is the lexical exception pronounced [밥] before a consonant; the
    // general ㄼ rule (correct for 넓다 -> neolda) gets this one wrong.
    "밟다": "bapda", "밟고": "bapgo", "밟는": "bamneun", "밟지": "bapji",
    "밟습니다": "bapseumnida",
    // chat shorthand people type as bare jamo
    "ㅇㅇ": "eung", "ㄴㄴ": "nono", "ㅇㅋ": "okay", "ㄱㅅ": "gamsa",
    "ㅈㅅ": "joesong", "ㅅㄱ": "sugo", "ㅎㅇ": "hi", "ㅂㅂ": "bye",
    "ㅇㅈ": "injeong", "ㄷㄷ": "deoldeol", "ㅁㄹ": "molla"
  };

  /**
   * Compounds carrying a ㄴ that no rule can predict, because the morpheme
   * boundary is invisible: ㄴ/ㄹ-insertion (서울역 -> seoullyeok, 십육 -> simnyuk)
   * and the compounds where ㄴ + ㄹ stays ㄴ + ㄴ instead of doubling to ll
   * (신문로 -> sinmunno). Both come out as "syllable N is pronounced with a ㄴ
   * onset", so the value is that syllable index and the ordinary sandhi engine
   * does the rest.
   *
   * Storing the correction as a jamo edit rather than as a finished string is
   * what makes it survive agglutination: Korean glues particles straight onto
   * the noun, so a whole-string entry for 서울역 would stop firing the moment
   * anyone writes 서울역에서. Matching a prefix and then re-running the rules
   * gives seoullyeogeseo, liaison across the new boundary included.
   */
  const NASAL_ONSET = {
    "십육": 1, "육십육": 2, "색연필": 1, "한여름": 1, "꽃잎": 1, "나뭇잎": 2,
    "서울역": 2, "담요": 1, "물약": 1, "알약": 1, "설익다": 1, "막일": 1,
    "늦여름": 1, "영업용": 2, "휘발유": 2, "식용유": 2, "깻잎": 1,
    "강남역": 2, "학여울": 1,
    "홑이불": 1, "솜이불": 1, "맨입": 1, "삯일": 1, "눈요기": 1, "내복약": 2,
    "신문로": 2, "의견란": 2, "생산량": 2, "결단력": 2, "공권력": 2,
    "동원령": 2, "임진란": 2, "상견례": 2, "이원론": 2, "입원료": 2,
    "횡단로": 2
  };
  // longest key first, so 육십육 wins over 십육 when both could match
  const NASAL_KEYS = Object.keys(NASAL_ONSET).sort((a, b) => b.length - a.length);

  const isSyllable = (cp) => cp >= SBASE && cp <= SLAST;

  /** One isolated jamo -> Latin. Returns "" for fillers and unassigned slots. */
  function jamoText(cp) {
    if (cp >= 0x1100 && cp <= 0x1112) return ONSET_ISO[cp - 0x1100];
    if (cp >= 0x1161 && cp <= 0x1175) return VOWEL[cp - 0x1161];
    if (cp >= 0x11a8 && cp <= 0x11c2) return CODA[cp - 0x11a7];
    if (cp >= 0x1100 && cp <= 0x11ff) return ARCHAIC[cp] || "";
    if (cp >= 0x3131 && cp <= 0x318e) return COMPAT[cp - 0x3131];
    return "";
  }

  /** Split a run into syllable tokens {I,V,F} and literal tokens {lit}. */
  function tokenize(src) {
    const toks = [];
    for (const ch of src) {
      const cp = ch.codePointAt(0);
      if (isSyllable(cp)) {
        const s = cp - SBASE;
        toks.push({
          syl: true,
          I: Math.floor(s / 588),
          V: Math.floor((s % 588) / 28),
          F: s % 28
        });
        continue;
      }
      const lit = jamoText(cp);
      if (lit) toks.push({ syl: false, lit });
    }
    return toks;
  }

  /**
   * Sound changes across one syllable boundary. Mutates a.F and b.I in place,
   * both still expressed as jamo indices, so the spelling stays a table lookup.
   */
  function sandhi(a, b) {
    if (a.F === 0) return;

    // --- next syllable starts with a vowel: the coda moves into the onset ---
    if (b.I === 11) {
      if ((a.F === 7 || a.F === 25) && palatal(b)) {
        b.I = a.F === 7 ? 12 : 14;   // 굳이 -> guji, 같이 -> gachi
        a.F = 0;
        return;
      }
      const keep = LIAISON[a.F][0];
      const move = LIAISON[a.F][1];
      a.F = keep;
      if (move >= 0) b.I = move;
      return;
    }

    // --- next onset is ㅎ: a stop coda swallows it and comes out aspirated ---
    if (b.I === 18) {
      if (a.F === 9) { a.F = 8; b.I = 15; return; }   // ㄺ + ㅎ -> l + k (읽히다)
      if (a.F === 11 || a.F === 14) { a.F = 8; b.I = 17; return; }  // ㄼ/ㄿ + ㅎ
      // ㄵ + ㅎ: the ㅈ of the cluster is what aspirates, and CODA[] has already
      // neutralised the cluster to a bare "n", so it has to be caught by index.
      if (a.F === 5) { a.F = 4; b.I = 14; return; }   // 앉히다 -> anchida
      const g = CODA[a.F];
      if (g === "k") { a.F = 0; b.I = 15; return; }   // 축하 -> chuka
      if (g === "t") {                                 // 못해 -> motae
        a.F = 0;
        b.I = palatal(b) ? 14 : 16;                    // 닫히다 -> dachida
        return;
      }
      if (g === "p") { a.F = 0; b.I = 17; return; }   // 잡혀 -> japyeo
      return;                                          // 만화 -> manhwa
    }

    // --- a coda carrying a latent ㅎ aspirates the next plain stop ---
    if ((a.F === 6 || a.F === 15) && ASPIRATE[b.I] !== undefined) {
      b.I = ASPIRATE[b.I];              // 많다 -> manta, 싫다 -> silta
      a.F = a.F === 6 ? 4 : 8;
    } else if (a.F === 27) {
      if (ASPIRATE[b.I] !== undefined) {
        b.I = ASPIRATE[b.I];            // 좋고 -> joko, 놓다 -> nota, 낳지 -> nachi
        a.F = 0;
        return;
      }
      if (b.I === 9) { b.I = 10; a.F = 0; return; }   // 놓소 -> nosso
    }

    const g = CODA[a.F];

    // --- nasal onset: an obstruent coda turns into the matching nasal ---
    if (b.I === 2 || b.I === 6) {
      if (g === "k") a.F = 21;                 // 한국말 -> hangungmal
      else if (g === "t") a.F = 4;             // 맏며느리 -> manmyeoneuri
      else if (g === "p") a.F = 16;            // 감사합니다 -> gamsahamnida
      else if (g === "l" && b.I === 2) b.I = 5; // 설날 -> seollal
      return;
    }

    // --- ㄹ onset: either it doubles with an l coda or it nasalises ---
    if (b.I === 5) {
      if (g === "n") { a.F = 8; return; }              // 신라 -> silla
      if (g === "l") return;                            // 울릉 -> ulleung
      if (g === "k") { a.F = 21; b.I = 2; return; }    // 독립 -> dongnip
      if (g === "t") { a.F = 4; b.I = 2; return; }
      if (g === "p") { a.F = 16; b.I = 2; return; }    // 압력 -> amnyeok
      b.I = 2;                                          // 종로 -> jongno
    }
  }

  function spell(toks) {
    let out = "";
    let prevCoda = "";
    for (const t of toks) {
      if (!t.syl) {
        out += t.lit;
        prevCoda = "";
        continue;
      }
      let onset = ONSET[t.I];
      if (t.I === 5 && prevCoda === "l") onset = "l";  // ㄹㄹ is spelled ll
      const coda = CODA[t.F];
      out += onset + VOWEL[t.V] + coda;
      prevCoda = coda;
    }
    return out;
  }

  /** Romanise ONE run of Hangul characters. */
  function romanize(word) {
    if (!word) return "";
    let src;
    try {
      src = word.normalize("NFC");
    } catch (e) {
      src = word;
    }
    if (Object.prototype.hasOwnProperty.call(DICT, src)) return DICT[src];

    const toks = tokenize(src);

    // An unpredictable ㄴ at a compound boundary, applied before the rules run
    // so that everything downstream (nasalisation, ㄴ+ㄹ -> ll, liaison into a
    // following particle) still happens by rule.
    for (const key of NASAL_KEYS) {
      if (!src.startsWith(key)) continue;
      const at = NASAL_ONSET[key];
      if (toks[at] && toks[at].syl) toks[at].I = 2;   // force a ㄴ onset
      break;
    }

    for (let i = 0; i + 1 < toks.length; i++) {
      if (toks[i].syl && toks[i + 1].syl) sandhi(toks[i], toks[i + 1]);
    }
    return spell(toks);
  }

  const mod = { id: "hangul", languages: ["Korean"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
