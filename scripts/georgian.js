/**
 * Georgian -> Roman.
 *
 * Georgian is a near-perfect one-letter-one-sound alphabet, so this is a table
 * walk with no reordering. Values follow the Georgian national system (2002)
 * with the apostrophes dropped: the ejective/aspirate pairs (კ/ქ, პ/ფ, ტ/თ,
 * ც/წ, ჩ/ჭ) collapse onto the same Latin letters, which is exactly what people
 * type. ღ=gh, ყ=q, შ=sh, ჩ=ch, ც=ts, ძ=dz, ხ=kh, ჯ=j, ჟ=zh.
 *
 * All four Georgian scripts are covered. Asomtavruli (U+10A0..), Mtavruli
 * (U+1C90..) and Nuskhuri (U+2D00..) are code-point aliases of Mkhedruli
 * (U+10D0..), so they are folded onto it by a fixed offset. Georgian is
 * caseless in normal use, so the output is always lower case.
 *
 * The romanisation table is indexed by code point rather than keyed by literal
 * characters: the letters in the comments are decoration, the offsets are the
 * data.
 */
(() => {
  "use strict";

  // ranges: Mkhedruli+Asomtavruli block, Georgian Extended (Mtavruli),
  // Georgian Supplement (Nuskhuri).
  const ranges = [[0x10a0, 0x10ff], [0x1c90, 0x1cbf], [0x2d00, 0x2d2f]];

  const MK_BASE = 0x10d0;

  // Index = code point - U+10D0. Covers U+10D0..U+10FA.
  const MKHEDRULI = [
    "a",   // U+10D0 ა an
    "b",   // U+10D1 ბ ban
    "g",   // U+10D2 გ gan
    "d",   // U+10D3 დ don
    "e",   // U+10D4 ე en
    "v",   // U+10D5 ვ vin
    "z",   // U+10D6 ზ zen
    "t",   // U+10D7 თ tan
    "i",   // U+10D8 ი in
    "k",   // U+10D9 კ kan
    "l",   // U+10DA ლ las
    "m",   // U+10DB მ man
    "n",   // U+10DC ნ nar
    "o",   // U+10DD ო on
    "p",   // U+10DE პ par
    "zh",  // U+10DF ჟ zhar
    "r",   // U+10E0 რ rae
    "s",   // U+10E1 ს san
    "t",   // U+10E2 ტ tar
    "u",   // U+10E3 უ un
    "p",   // U+10E4 ფ phar
    "k",   // U+10E5 ქ khar
    "gh",  // U+10E6 ღ ghan
    "q",   // U+10E7 ყ qar
    "sh",  // U+10E8 შ shin
    "ch",  // U+10E9 ჩ chin
    "ts",  // U+10EA ც can
    "dz",  // U+10EB ძ jil
    "ts",  // U+10EC წ cil
    "ch",  // U+10ED ჭ char
    "kh",  // U+10EE ხ xan
    "j",   // U+10EF ჯ jhan
    "h",   // U+10F0 ჰ hae
    "e",   // U+10F1 ჱ he      (archaic)
    "y",   // U+10F2 ჲ hie     (archaic)
    "w",   // U+10F3 ჳ we      (archaic)
    "kh",  // U+10F4 ჴ har     (archaic)
    "o",   // U+10F5 ჵ hoe     (archaic)
    "f",   // U+10F6 ჶ fi      (archaic / loanwords)
    "e",   // U+10F7 ჷ yn      (Svan/Ossetian schwa)
    "",    // U+10F8 ჸ elifi   (glottal stop, dropped)
    "g",   // U+10F9 ჹ turned gan (Ossetian)
    ""     // U+10FA ჺ ain     (Bats pharyngeal, dropped)
  ];

  // Modifier letters that follow the alphabet in the block.
  const EXTRA = {
    0x10fc: "n",   // ჼ nar, nasalises the preceding vowel
    0x10fd: "ae",  // ჽ aen (Ossetian)
    0x10fe: "",    // ჾ hard sign
    0x10ff: "w"    // ჿ labial sign
  };

  const PUNCT = {
    0x10fb: "."    // ჻ paragraph separator
  };

  /** Fold Asomtavruli / Mtavruli / Nuskhuri onto the Mkhedruli code point. */
  function fold(cp) {
    if (cp >= 0x10a0 && cp <= 0x10c5) return cp + 0x30;    // Asomtavruli an..hoe
    if (cp === 0x10c7 || cp === 0x10cd) return cp + 0x30;  // Asomtavruli yn, aen
    if (cp >= 0x1c90 && cp <= 0x1cba) return cp - 0xbc0;   // Mtavruli an..ain
    if (cp >= 0x1cbd && cp <= 0x1cbf) return cp - 0xbc0;   // Mtavruli aen..labial
    if (cp >= 0x2d00 && cp <= 0x2d25) return cp - 0x1c30;  // Nuskhuri an..hoe
    if (cp === 0x2d27 || cp === 0x2d2d) return cp - 0x1c30;// Nuskhuri yn, aen
    return cp;
  }

  function romanize(word) {
    let out = "";
    for (const ch of word) {
      const cp = fold(ch.codePointAt(0));
      if (cp >= MK_BASE && cp - MK_BASE < MKHEDRULI.length) {
        out += MKHEDRULI[cp - MK_BASE];
      } else if (EXTRA[cp] !== undefined) {
        out += EXTRA[cp];
      } else if (PUNCT[cp] !== undefined) {
        out += PUNCT[cp];
      } else if (cp < 0x80) {
        out += ch; // stray ASCII swept into the run
      }
      // unassigned code points in the blocks are dropped
    }
    return out.replace(/[^\x20-\x7E]/g, "");
  }

  const mod = { id: "georgian", languages: ["Georgian"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
