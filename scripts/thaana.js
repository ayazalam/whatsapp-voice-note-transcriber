/**
 * Thaana (Dhivehi / Maldivian) -> Roman.
 *
 * Thaana is written right-to-left but stored in logical order, so a plain
 * left-to-right walk of the string is already the right order for Latin.
 *
 * Every consonant carries an obligatory vowel sign (fili) or a sukun meaning
 * "no vowel", so unlike Hebrew or Arabic nothing has to be guessed. The vowel
 * values are the ones the official Maldivian Latin transliteration uses -
 * a/aa, i/ee, u/oo, e/ey, o/oa - which is also how Dhivehi speakers type in
 * Latin.
 *
 * Two structural rules matter:
 *   - alifu (އ) is a carrier with no sound of its own: with a fili it just
 *     yields the bare vowel (word-initial vowels), with sukun before a
 *     consonant it geminates that consonant (ރާއްޖެ -> raajje).
 *   - alifu + sukun at the end of a word is the glottal stop that Maldivian
 *     Latin writes as -h (ކިހިނެއް -> kihineh).
 *
 * The table is indexed by code point; the letters in the comments are
 * decoration, the offsets are the data.
 */
(() => {
  "use strict";

  const ranges = [[0x0780, 0x07bf]];

  const CONS_BASE = 0x0780;
  const FILI_BASE = 0x07a6;
  const SUKUN = 0x07b0;
  const ALIFU = 0x0787;
  const NAA = 0x07b1;

  // Index = code point - U+0780. Covers U+0780..U+07A5, the full consonant set.
  const CONS = [
    "h",   // U+0780 ހ haa
    "sh",  // U+0781 ށ shaviyani
    "n",   // U+0782 ނ noonu
    "r",   // U+0783 ރ raa
    "b",   // U+0784 ބ baa
    "lh",  // U+0785 ޅ lhaviyani
    "k",   // U+0786 ކ kaafu
    "",    // U+0787 އ alifu   (carrier, handled specially)
    "v",   // U+0788 ވ vaavu
    "m",   // U+0789 މ meemu
    "f",   // U+078A ފ faafu
    "dh",  // U+078B ދ dhaalu
    "th",  // U+078C ތ thaa
    "l",   // U+078D ލ laamu
    "g",   // U+078E ގ gaafu
    "gn",  // U+078F ޏ gnaviyani
    "s",   // U+0790 ސ seenu
    "d",   // U+0791 ޑ daviyani
    "z",   // U+0792 ޒ zaviyani
    "t",   // U+0793 ޓ taviyani
    "y",   // U+0794 ޔ yaa
    "p",   // U+0795 ޕ paviyani
    "j",   // U+0796 ޖ javiyani
    "ch",  // U+0797 ޗ chaviyani
    // U+0798..U+07A4 exist for Arabic loanwords
    "th",  // U+0798 ޘ ttaa    (Arabic thaa)
    "h",   // U+0799 ޙ hhaa
    "kh",  // U+079A ޚ khaa
    "z",   // U+079B ޛ thaalu
    "z",   // U+079C ޜ zaa
    "sh",  // U+079D ޝ sheenu
    "s",   // U+079E ޞ saadhu
    "z",   // U+079F ޟ daadhu
    "t",   // U+07A0 ޠ to
    "z",   // U+07A1 ޡ zo
    "",    // U+07A2 ޢ ainu    (silent carrier, like Hebrew ayin)
    "gh",  // U+07A3 ޣ ghainu
    "q",   // U+07A4 ޤ qaafu
    "w"    // U+07A5 ޥ waavu
  ];

  // Index = code point - U+07A6. Covers U+07A6..U+07AF.
  const FILI = [
    "a",   // U+07A6 ަ abafili
    "aa",  // U+07A7 ާ aabaafili
    "i",   // U+07A8 ި ibifili
    "ee",  // U+07A9 ީ eebeefili
    "u",   // U+07AA ު ubufili
    "oo",  // U+07AB ޫ ooboofili
    "e",   // U+07AC ެ ebefili
    "ey",  // U+07AD ޭ eybeyfili
    "o",   // U+07AE ޮ obofili
    "oa"   // U+07AF ޯ oaboaafili
  ];

  const isConsonant = (cp) =>
    (cp >= CONS_BASE && cp - CONS_BASE < CONS.length) || cp === NAA;

  const consonantOf = (cp) => (cp === NAA ? "n" : CONS[cp - CONS_BASE]);

  const isFili = (cp) => cp >= FILI_BASE && cp - FILI_BASE < FILI.length;

  function romanize(word) {
    const cps = [];
    for (const ch of word) cps.push(ch.codePointAt(0));

    let out = "";
    let geminate = false;

    for (let i = 0; i < cps.length; i++) {
      const cp = cps[i];

      if (isConsonant(cp)) {
        // pull in the fili / sukun that belongs to this consonant
        let mark = -1;
        const m = i + 1 < cps.length ? cps[i + 1] : -1;
        if (m === SUKUN || isFili(m)) {
          mark = m;
          i += 1;
        }

        if (cp === ALIFU) {
          if (mark === SUKUN) {
            const after = i + 1 < cps.length ? cps[i + 1] : -1;
            if (isConsonant(after)) geminate = true;
            else out += "h"; // word-final glottal stop
          } else if (isFili(mark)) {
            out += FILI[mark - FILI_BASE]; // bare vowel
          }
          continue;
        }

        let c = consonantOf(cp);
        if (geminate) {
          // Gemination doubles the leading Latin letter (ދ dh -> ddh, as in
          // ދިއްދޫ Dhiddhoo). ޗ is the one digraph whose first letter is not
          // a consonant on its own, so it doubles whole: ch -> chch, as in
          // މައްޗަންގޮޅި Machchangolhi.
          if (c === "ch") c = "chch";
          else if (c) c = c.charAt(0) + c;
          geminate = false;
        }
        out += c;
        if (isFili(mark)) out += FILI[mark - FILI_BASE];
        continue;
      }

      if (isFili(cp)) {
        out += FILI[cp - FILI_BASE]; // stray fili with no carrier
        continue;
      }
      if (cp === SUKUN) continue;
      if (cp < 0x80) out += String.fromCodePoint(cp); // stray ASCII in the run
      // unassigned code points in the block are dropped
    }

    if (geminate) out += "h"; // dangling alifu+sukun

    return out.replace(/[^\x20-\x7E]/g, "");
  }

  const mod = { id: "thaana", languages: ["Dhivehi"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
