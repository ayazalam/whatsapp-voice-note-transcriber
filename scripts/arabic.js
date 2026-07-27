/**
 * Arabic script -> Roman transliteration.
 *
 * Covers Arabic, Urdu, Persian, Pashto, Sindhi, Kashmiri and Uyghur, i.e. the
 * Arabic block plus the Supplement and both Presentation Forms blocks.
 *
 * BE HONEST ABOUT WHAT THIS CAN AND CANNOT DO. Arabic script does not write
 * short vowels. كل is kal, kul or kil and nothing in the string says which;
 * كتب is kataba, kutub or kutiba. Any romaniser that claims otherwise is
 * guessing. So this module does three things, in descending order of how much
 * quality each one buys:
 *
 *   1. A dictionary of ~1000 of the words that actually occur in messages --
 *      pronouns, particles, greetings, verbs of being, numbers, business
 *      vocabulary -- spelled the way people type them. This is where most of
 *      the real quality lives, exactly like the Hindi DICT in transliterate.js.
 *   2. The diacritics, when Scribe emits them. Fatha/kasra/damma, tanween,
 *      shadda and sukun are all read and used; a vowelled word comes out right.
 *   3. A syllable model for everything else. Long vowels (alef, waw, yeh) are
 *      written and so are known; the short ones are reconstructed by opening a
 *      syllable wherever a consonant cluster would otherwise be unreadable.
 *
 * The insertion rule for (3), stated plainly, is:
 *
 *   - a consonant with nothing pronounceable before it opens the word with "a"
 *     (ktb -> katb, not ktb);
 *   - a consonant right after a vowel is a coda and stays bare (dost, waqt,
 *     sabr, hamd -- these final clusters are real and extremely common);
 *   - any other bare consonant starts a new syllable and takes "a";
 *   - a doubled (shadda) consonant forces a vowel on the letter before it,
 *     which is what makes muhammad come out as three syllables;
 *   - a coda is refused where it would spell a digraph that lies: s before h
 *     would read as ش (wasahlan not washlan), and a consonant before y reads
 *     as nothing at all (hogayi not hogyi);
 *   - a final cluster that no word in either language ends with gets broken:
 *     "mn"/"nm" (aman, Yaman); a stop plus a sonorant (hasan, watan, nazar,
 *     khabar, badal, shakal, zakham, garam); and any cluster after a long aa,
 *     which is the CaaCiC participle and always has "i" (haazir, qaabil,
 *     saabit, maalik) -- but not a nasal plus a stop, which is one sound and
 *     ends words all the time (maang, chaand, saanp, saans);
 *   - after any other long vowel, a stranded sonorant takes "a" (hakomat);
 *   - a written short vowel in front of a و or a ی is the long vowel or the
 *     diphthong they spell together: phool, noor, qaum, deen, bait.
 *
 * The inserted vowel is otherwise always "a", because "a" is the most frequent
 * short vowel in both Arabic and Urdu and because a wrong "a" reads better than
 * a wrong "u". So the output is a consonantal skeleton with plausible vowels:
 * "kataab" for kitaab, "maslamaan" for musalmaan. Readable, not correct.
 *
 * Urdu gets the most attention, since the extension's author receives
 * Hindi/Urdu voice notes and an Urdu user has the identical use case. A word
 * is romanised in one of two modes:
 *
 *   ur   the word contains an Urdu/Persian letter (ک ی ہ ے ٹ ڈ ڑ ں ھ گ چ پ ژ)
 *        -> ث is s, ض is z, و is o (do, log, bol), final ه is a (raasta).
 *   ar   the word contains ك ي ى ة, or nothing decisive
 *        -> ث is th, ض is d (Ramadan, Riyadh), و is oo (rasool), final ه is h.
 *
 * Words with no decisive letter inherit the mode of the last decisive word in
 * the same message, because "ضرورت" is spelled identically in both languages
 * and the surrounding sentence is the only evidence there is.
 *
 * Everything is ASCII. Hamza and ayn are dropped rather than spelled with
 * apostrophes -- "maloom" reads, "ma'l\um" does not.
 */
(() => {
  "use strict";

  // ranges: Unicode blocks this module claims, inclusive
  const ranges = [
    [0x0600, 0x06ff], // Arabic
    [0x0750, 0x077f], // Arabic Supplement
    [0xfb50, 0xfdff], // Arabic Presentation Forms-A
    [0xfe70, 0xfeff]  // Arabic Presentation Forms-B
  ];

  /**
   * Presentation form -> base letter(s). Legacy encoders, some PDFs and a few
   * ASR backends emit the contextual shapes instead of the base letters, and
   * the lam-alef ligatures are two letters wearing one code point. Folding
   * here means the rest of the file only ever sees U+0600-U+06FF.
   */
  const PRES = {
    // U+FB50-U+FDFF  Presentation Forms-A: Persian/Urdu/Sindhi letter shapes
    // and the ligature block. Machine-generated from Unicode NFKC.
    "\ufb50": "\u0671", "\ufb51": "\u0671", "\ufb52": "\u067b", "\ufb53": "\u067b",
    "\ufb54": "\u067b", "\ufb55": "\u067b", "\ufb56": "\u067e", "\ufb57": "\u067e",
    "\ufb58": "\u067e", "\ufb59": "\u067e", "\ufb5a": "\u0680", "\ufb5b": "\u0680",
    "\ufb5c": "\u0680", "\ufb5d": "\u0680", "\ufb5e": "\u067a", "\ufb5f": "\u067a",
    "\ufb60": "\u067a", "\ufb61": "\u067a", "\ufb62": "\u067f", "\ufb63": "\u067f",
    "\ufb64": "\u067f", "\ufb65": "\u067f", "\ufb66": "\u0679", "\ufb67": "\u0679",
    "\ufb68": "\u0679", "\ufb69": "\u0679", "\ufb6a": "\u06a4", "\ufb6b": "\u06a4",
    "\ufb6c": "\u06a4", "\ufb6d": "\u06a4", "\ufb6e": "\u06a6", "\ufb6f": "\u06a6",
    "\ufb70": "\u06a6", "\ufb71": "\u06a6", "\ufb72": "\u0684", "\ufb73": "\u0684",
    "\ufb74": "\u0684", "\ufb75": "\u0684", "\ufb76": "\u0683", "\ufb77": "\u0683",
    "\ufb78": "\u0683", "\ufb79": "\u0683", "\ufb7a": "\u0686", "\ufb7b": "\u0686",
    "\ufb7c": "\u0686", "\ufb7d": "\u0686", "\ufb7e": "\u0687", "\ufb7f": "\u0687",
    "\ufb80": "\u0687", "\ufb81": "\u0687", "\ufb82": "\u068d", "\ufb83": "\u068d",
    "\ufb84": "\u068c", "\ufb85": "\u068c", "\ufb86": "\u068e", "\ufb87": "\u068e",
    "\ufb88": "\u0688", "\ufb89": "\u0688", "\ufb8a": "\u0698", "\ufb8b": "\u0698",
    "\ufb8c": "\u0691", "\ufb8d": "\u0691", "\ufb8e": "\u06a9", "\ufb8f": "\u06a9",
    "\ufb90": "\u06a9", "\ufb91": "\u06a9", "\ufb92": "\u06af", "\ufb93": "\u06af",
    "\ufb94": "\u06af", "\ufb95": "\u06af", "\ufb96": "\u06b3", "\ufb97": "\u06b3",
    "\ufb98": "\u06b3", "\ufb99": "\u06b3", "\ufb9a": "\u06b1", "\ufb9b": "\u06b1",
    "\ufb9c": "\u06b1", "\ufb9d": "\u06b1", "\ufb9e": "\u06ba", "\ufb9f": "\u06ba",
    "\ufba0": "\u06bb", "\ufba1": "\u06bb", "\ufba2": "\u06bb", "\ufba3": "\u06bb",
    "\ufba4": "\u06c0", "\ufba5": "\u06c0", "\ufba6": "\u06c1", "\ufba7": "\u06c1",
    "\ufba8": "\u06c1", "\ufba9": "\u06c1", "\ufbaa": "\u06be", "\ufbab": "\u06be",
    "\ufbac": "\u06be", "\ufbad": "\u06be", "\ufbae": "\u06d2", "\ufbaf": "\u06d2",
    "\ufbb0": "\u06d3", "\ufbb1": "\u06d3", "\ufbd3": "\u06ad", "\ufbd4": "\u06ad",
    "\ufbd5": "\u06ad", "\ufbd6": "\u06ad", "\ufbd7": "\u06c7", "\ufbd8": "\u06c7",
    "\ufbd9": "\u06c6", "\ufbda": "\u06c6", "\ufbdb": "\u06c8", "\ufbdc": "\u06c8",
    "\ufbdd": "\u06c7\u0674", "\ufbde": "\u06cb", "\ufbdf": "\u06cb", "\ufbe0": "\u06c5",
    "\ufbe1": "\u06c5", "\ufbe2": "\u06c9", "\ufbe3": "\u06c9", "\ufbe4": "\u06d0",
    "\ufbe5": "\u06d0", "\ufbe6": "\u06d0", "\ufbe7": "\u06d0", "\ufbe8": "\u0649",
    "\ufbe9": "\u0649", "\ufbea": "\u0626\u0627", "\ufbeb": "\u0626\u0627", "\ufbec": "\u0626\u06d5",
    "\ufbed": "\u0626\u06d5", "\ufbee": "\u0626\u0648", "\ufbef": "\u0626\u0648", "\ufbf0": "\u0626\u06c7",
    "\ufbf1": "\u0626\u06c7", "\ufbf2": "\u0626\u06c6", "\ufbf3": "\u0626\u06c6", "\ufbf4": "\u0626\u06c8",
    "\ufbf5": "\u0626\u06c8", "\ufbf6": "\u0626\u06d0", "\ufbf7": "\u0626\u06d0", "\ufbf8": "\u0626\u06d0",
    "\ufbf9": "\u0626\u0649", "\ufbfa": "\u0626\u0649", "\ufbfb": "\u0626\u0649", "\ufbfc": "\u06cc",
    "\ufbfd": "\u06cc", "\ufbfe": "\u06cc", "\ufbff": "\u06cc", "\ufc00": "\u0626\u062c",
    "\ufc01": "\u0626\u062d", "\ufc02": "\u0626\u0645", "\ufc03": "\u0626\u0649", "\ufc04": "\u0626\u064a",
    "\ufc05": "\u0628\u062c", "\ufc06": "\u0628\u062d", "\ufc07": "\u0628\u062e", "\ufc08": "\u0628\u0645",
    "\ufc09": "\u0628\u0649", "\ufc0a": "\u0628\u064a", "\ufc0b": "\u062a\u062c", "\ufc0c": "\u062a\u062d",
    "\ufc0d": "\u062a\u062e", "\ufc0e": "\u062a\u0645", "\ufc0f": "\u062a\u0649", "\ufc10": "\u062a\u064a",
    "\ufc11": "\u062b\u062c", "\ufc12": "\u062b\u0645", "\ufc13": "\u062b\u0649", "\ufc14": "\u062b\u064a",
    "\ufc15": "\u062c\u062d", "\ufc16": "\u062c\u0645", "\ufc17": "\u062d\u062c", "\ufc18": "\u062d\u0645",
    "\ufc19": "\u062e\u062c", "\ufc1a": "\u062e\u062d", "\ufc1b": "\u062e\u0645", "\ufc1c": "\u0633\u062c",
    "\ufc1d": "\u0633\u062d", "\ufc1e": "\u0633\u062e", "\ufc1f": "\u0633\u0645", "\ufc20": "\u0635\u062d",
    "\ufc21": "\u0635\u0645", "\ufc22": "\u0636\u062c", "\ufc23": "\u0636\u062d", "\ufc24": "\u0636\u062e",
    "\ufc25": "\u0636\u0645", "\ufc26": "\u0637\u062d", "\ufc27": "\u0637\u0645", "\ufc28": "\u0638\u0645",
    "\ufc29": "\u0639\u062c", "\ufc2a": "\u0639\u0645", "\ufc2b": "\u063a\u062c", "\ufc2c": "\u063a\u0645",
    "\ufc2d": "\u0641\u062c", "\ufc2e": "\u0641\u062d", "\ufc2f": "\u0641\u062e", "\ufc30": "\u0641\u0645",
    "\ufc31": "\u0641\u0649", "\ufc32": "\u0641\u064a", "\ufc33": "\u0642\u062d", "\ufc34": "\u0642\u0645",
    "\ufc35": "\u0642\u0649", "\ufc36": "\u0642\u064a", "\ufc37": "\u0643\u0627", "\ufc38": "\u0643\u062c",
    "\ufc39": "\u0643\u062d", "\ufc3a": "\u0643\u062e", "\ufc3b": "\u0643\u0644", "\ufc3c": "\u0643\u0645",
    "\ufc3d": "\u0643\u0649", "\ufc3e": "\u0643\u064a", "\ufc3f": "\u0644\u062c", "\ufc40": "\u0644\u062d",
    "\ufc41": "\u0644\u062e", "\ufc42": "\u0644\u0645", "\ufc43": "\u0644\u0649", "\ufc44": "\u0644\u064a",
    "\ufc45": "\u0645\u062c", "\ufc46": "\u0645\u062d", "\ufc47": "\u0645\u062e", "\ufc48": "\u0645\u0645",
    "\ufc49": "\u0645\u0649", "\ufc4a": "\u0645\u064a", "\ufc4b": "\u0646\u062c", "\ufc4c": "\u0646\u062d",
    "\ufc4d": "\u0646\u062e", "\ufc4e": "\u0646\u0645", "\ufc4f": "\u0646\u0649", "\ufc50": "\u0646\u064a",
    "\ufc51": "\u0647\u062c", "\ufc52": "\u0647\u0645", "\ufc53": "\u0647\u0649", "\ufc54": "\u0647\u064a",
    "\ufc55": "\u064a\u062c", "\ufc56": "\u064a\u062d", "\ufc57": "\u064a\u062e", "\ufc58": "\u064a\u0645",
    "\ufc59": "\u064a\u0649", "\ufc5a": "\u064a\u064a", "\ufc5b": "\u0630\u0670", "\ufc5c": "\u0631\u0670",
    "\ufc5d": "\u0649\u0670", "\ufc5e": "\u064c\u0651", "\ufc5f": "\u064d\u0651", "\ufc60": "\u064e\u0651",
    "\ufc61": "\u064f\u0651", "\ufc62": "\u0650\u0651", "\ufc63": "\u0651\u0670", "\ufc64": "\u0626\u0631",
    "\ufc65": "\u0626\u0632", "\ufc66": "\u0626\u0645", "\ufc67": "\u0626\u0646", "\ufc68": "\u0626\u0649",
    "\ufc69": "\u0626\u064a", "\ufc6a": "\u0628\u0631", "\ufc6b": "\u0628\u0632", "\ufc6c": "\u0628\u0645",
    "\ufc6d": "\u0628\u0646", "\ufc6e": "\u0628\u0649", "\ufc6f": "\u0628\u064a", "\ufc70": "\u062a\u0631",
    "\ufc71": "\u062a\u0632", "\ufc72": "\u062a\u0645", "\ufc73": "\u062a\u0646", "\ufc74": "\u062a\u0649",
    "\ufc75": "\u062a\u064a", "\ufc76": "\u062b\u0631", "\ufc77": "\u062b\u0632", "\ufc78": "\u062b\u0645",
    "\ufc79": "\u062b\u0646", "\ufc7a": "\u062b\u0649", "\ufc7b": "\u062b\u064a", "\ufc7c": "\u0641\u0649",
    "\ufc7d": "\u0641\u064a", "\ufc7e": "\u0642\u0649", "\ufc7f": "\u0642\u064a", "\ufc80": "\u0643\u0627",
    "\ufc81": "\u0643\u0644", "\ufc82": "\u0643\u0645", "\ufc83": "\u0643\u0649", "\ufc84": "\u0643\u064a",
    "\ufc85": "\u0644\u0645", "\ufc86": "\u0644\u0649", "\ufc87": "\u0644\u064a", "\ufc88": "\u0645\u0627",
    "\ufc89": "\u0645\u0645", "\ufc8a": "\u0646\u0631", "\ufc8b": "\u0646\u0632", "\ufc8c": "\u0646\u0645",
    "\ufc8d": "\u0646\u0646", "\ufc8e": "\u0646\u0649", "\ufc8f": "\u0646\u064a", "\ufc90": "\u0649\u0670",
    "\ufc91": "\u064a\u0631", "\ufc92": "\u064a\u0632", "\ufc93": "\u064a\u0645", "\ufc94": "\u064a\u0646",
    "\ufc95": "\u064a\u0649", "\ufc96": "\u064a\u064a", "\ufc97": "\u0626\u062c", "\ufc98": "\u0626\u062d",
    "\ufc99": "\u0626\u062e", "\ufc9a": "\u0626\u0645", "\ufc9b": "\u0626\u0647", "\ufc9c": "\u0628\u062c",
    "\ufc9d": "\u0628\u062d", "\ufc9e": "\u0628\u062e", "\ufc9f": "\u0628\u0645", "\ufca0": "\u0628\u0647",
    "\ufca1": "\u062a\u062c", "\ufca2": "\u062a\u062d", "\ufca3": "\u062a\u062e", "\ufca4": "\u062a\u0645",
    "\ufca5": "\u062a\u0647", "\ufca6": "\u062b\u0645", "\ufca7": "\u062c\u062d", "\ufca8": "\u062c\u0645",
    "\ufca9": "\u062d\u062c", "\ufcaa": "\u062d\u0645", "\ufcab": "\u062e\u062c", "\ufcac": "\u062e\u0645",
    "\ufcad": "\u0633\u062c", "\ufcae": "\u0633\u062d", "\ufcaf": "\u0633\u062e", "\ufcb0": "\u0633\u0645",
    "\ufcb1": "\u0635\u062d", "\ufcb2": "\u0635\u062e", "\ufcb3": "\u0635\u0645", "\ufcb4": "\u0636\u062c",
    "\ufcb5": "\u0636\u062d", "\ufcb6": "\u0636\u062e", "\ufcb7": "\u0636\u0645", "\ufcb8": "\u0637\u062d",
    "\ufcb9": "\u0638\u0645", "\ufcba": "\u0639\u062c", "\ufcbb": "\u0639\u0645", "\ufcbc": "\u063a\u062c",
    "\ufcbd": "\u063a\u0645", "\ufcbe": "\u0641\u062c", "\ufcbf": "\u0641\u062d", "\ufcc0": "\u0641\u062e",
    "\ufcc1": "\u0641\u0645", "\ufcc2": "\u0642\u062d", "\ufcc3": "\u0642\u0645", "\ufcc4": "\u0643\u062c",
    "\ufcc5": "\u0643\u062d", "\ufcc6": "\u0643\u062e", "\ufcc7": "\u0643\u0644", "\ufcc8": "\u0643\u0645",
    "\ufcc9": "\u0644\u062c", "\ufcca": "\u0644\u062d", "\ufccb": "\u0644\u062e", "\ufccc": "\u0644\u0645",
    "\ufccd": "\u0644\u0647", "\ufcce": "\u0645\u062c", "\ufccf": "\u0645\u062d", "\ufcd0": "\u0645\u062e",
    "\ufcd1": "\u0645\u0645", "\ufcd2": "\u0646\u062c", "\ufcd3": "\u0646\u062d", "\ufcd4": "\u0646\u062e",
    "\ufcd5": "\u0646\u0645", "\ufcd6": "\u0646\u0647", "\ufcd7": "\u0647\u062c", "\ufcd8": "\u0647\u0645",
    "\ufcd9": "\u0647\u0670", "\ufcda": "\u064a\u062c", "\ufcdb": "\u064a\u062d", "\ufcdc": "\u064a\u062e",
    "\ufcdd": "\u064a\u0645", "\ufcde": "\u064a\u0647", "\ufcdf": "\u0626\u0645", "\ufce0": "\u0626\u0647",
    "\ufce1": "\u0628\u0645", "\ufce2": "\u0628\u0647", "\ufce3": "\u062a\u0645", "\ufce4": "\u062a\u0647",
    "\ufce5": "\u062b\u0645", "\ufce6": "\u062b\u0647", "\ufce7": "\u0633\u0645", "\ufce8": "\u0633\u0647",
    "\ufce9": "\u0634\u0645", "\ufcea": "\u0634\u0647", "\ufceb": "\u0643\u0644", "\ufcec": "\u0643\u0645",
    "\ufced": "\u0644\u0645", "\ufcee": "\u0646\u0645", "\ufcef": "\u0646\u0647", "\ufcf0": "\u064a\u0645",
    "\ufcf1": "\u064a\u0647", "\ufcf2": "\u064e\u0651", "\ufcf3": "\u064f\u0651", "\ufcf4": "\u0650\u0651",
    "\ufcf5": "\u0637\u0649", "\ufcf6": "\u0637\u064a", "\ufcf7": "\u0639\u0649", "\ufcf8": "\u0639\u064a",
    "\ufcf9": "\u063a\u0649", "\ufcfa": "\u063a\u064a", "\ufcfb": "\u0633\u0649", "\ufcfc": "\u0633\u064a",
    "\ufcfd": "\u0634\u0649", "\ufcfe": "\u0634\u064a", "\ufcff": "\u062d\u0649", "\ufd00": "\u062d\u064a",
    "\ufd01": "\u062c\u0649", "\ufd02": "\u062c\u064a", "\ufd03": "\u062e\u0649", "\ufd04": "\u062e\u064a",
    "\ufd05": "\u0635\u0649", "\ufd06": "\u0635\u064a", "\ufd07": "\u0636\u0649", "\ufd08": "\u0636\u064a",
    "\ufd09": "\u0634\u062c", "\ufd0a": "\u0634\u062d", "\ufd0b": "\u0634\u062e", "\ufd0c": "\u0634\u0645",
    "\ufd0d": "\u0634\u0631", "\ufd0e": "\u0633\u0631", "\ufd0f": "\u0635\u0631", "\ufd10": "\u0636\u0631",
    "\ufd11": "\u0637\u0649", "\ufd12": "\u0637\u064a", "\ufd13": "\u0639\u0649", "\ufd14": "\u0639\u064a",
    "\ufd15": "\u063a\u0649", "\ufd16": "\u063a\u064a", "\ufd17": "\u0633\u0649", "\ufd18": "\u0633\u064a",
    "\ufd19": "\u0634\u0649", "\ufd1a": "\u0634\u064a", "\ufd1b": "\u062d\u0649", "\ufd1c": "\u062d\u064a",
    "\ufd1d": "\u062c\u0649", "\ufd1e": "\u062c\u064a", "\ufd1f": "\u062e\u0649", "\ufd20": "\u062e\u064a",
    "\ufd21": "\u0635\u0649", "\ufd22": "\u0635\u064a", "\ufd23": "\u0636\u0649", "\ufd24": "\u0636\u064a",
    "\ufd25": "\u0634\u062c", "\ufd26": "\u0634\u062d", "\ufd27": "\u0634\u062e", "\ufd28": "\u0634\u0645",
    "\ufd29": "\u0634\u0631", "\ufd2a": "\u0633\u0631", "\ufd2b": "\u0635\u0631", "\ufd2c": "\u0636\u0631",
    "\ufd2d": "\u0634\u062c", "\ufd2e": "\u0634\u062d", "\ufd2f": "\u0634\u062e", "\ufd30": "\u0634\u0645",
    "\ufd31": "\u0633\u0647", "\ufd32": "\u0634\u0647", "\ufd33": "\u0637\u0645", "\ufd34": "\u0633\u062c",
    "\ufd35": "\u0633\u062d", "\ufd36": "\u0633\u062e", "\ufd37": "\u0634\u062c", "\ufd38": "\u0634\u062d",
    "\ufd39": "\u0634\u062e", "\ufd3a": "\u0637\u0645", "\ufd3b": "\u0638\u0645", "\ufd3c": "\u0627\u064b",
    "\ufd3d": "\u0627\u064b", "\ufd50": "\u062a\u062c\u0645", "\ufd51": "\u062a\u062d\u062c", "\ufd52": "\u062a\u062d\u062c",
    "\ufd53": "\u062a\u062d\u0645", "\ufd54": "\u062a\u062e\u0645", "\ufd55": "\u062a\u0645\u062c", "\ufd56": "\u062a\u0645\u062d",
    "\ufd57": "\u062a\u0645\u062e", "\ufd58": "\u062c\u0645\u062d", "\ufd59": "\u062c\u0645\u062d", "\ufd5a": "\u062d\u0645\u064a",
    "\ufd5b": "\u062d\u0645\u0649", "\ufd5c": "\u0633\u062d\u062c", "\ufd5d": "\u0633\u062c\u062d", "\ufd5e": "\u0633\u062c\u0649",
    "\ufd5f": "\u0633\u0645\u062d", "\ufd60": "\u0633\u0645\u062d", "\ufd61": "\u0633\u0645\u062c", "\ufd62": "\u0633\u0645\u0645",
    "\ufd63": "\u0633\u0645\u0645", "\ufd64": "\u0635\u062d\u062d", "\ufd65": "\u0635\u062d\u062d", "\ufd66": "\u0635\u0645\u0645",
    "\ufd67": "\u0634\u062d\u0645", "\ufd68": "\u0634\u062d\u0645", "\ufd69": "\u0634\u062c\u064a", "\ufd6a": "\u0634\u0645\u062e",
    "\ufd6b": "\u0634\u0645\u062e", "\ufd6c": "\u0634\u0645\u0645", "\ufd6d": "\u0634\u0645\u0645", "\ufd6e": "\u0636\u062d\u0649",
    "\ufd6f": "\u0636\u062e\u0645", "\ufd70": "\u0636\u062e\u0645", "\ufd71": "\u0637\u0645\u062d", "\ufd72": "\u0637\u0645\u062d",
    "\ufd73": "\u0637\u0645\u0645", "\ufd74": "\u0637\u0645\u064a", "\ufd75": "\u0639\u062c\u0645", "\ufd76": "\u0639\u0645\u0645",
    "\ufd77": "\u0639\u0645\u0645", "\ufd78": "\u0639\u0645\u0649", "\ufd79": "\u063a\u0645\u0645", "\ufd7a": "\u063a\u0645\u064a",
    "\ufd7b": "\u063a\u0645\u0649", "\ufd7c": "\u0641\u062e\u0645", "\ufd7d": "\u0641\u062e\u0645", "\ufd7e": "\u0642\u0645\u062d",
    "\ufd7f": "\u0642\u0645\u0645", "\ufd80": "\u0644\u062d\u0645", "\ufd81": "\u0644\u062d\u064a", "\ufd82": "\u0644\u062d\u0649",
    "\ufd83": "\u0644\u062c\u062c", "\ufd84": "\u0644\u062c\u062c", "\ufd85": "\u0644\u062e\u0645", "\ufd86": "\u0644\u062e\u0645",
    "\ufd87": "\u0644\u0645\u062d", "\ufd88": "\u0644\u0645\u062d", "\ufd89": "\u0645\u062d\u062c", "\ufd8a": "\u0645\u062d\u0645",
    "\ufd8b": "\u0645\u062d\u064a", "\ufd8c": "\u0645\u062c\u062d", "\ufd8d": "\u0645\u062c\u0645", "\ufd8e": "\u0645\u062e\u062c",
    "\ufd8f": "\u0645\u062e\u0645", "\ufd92": "\u0645\u062c\u062e", "\ufd93": "\u0647\u0645\u062c", "\ufd94": "\u0647\u0645\u0645",
    "\ufd95": "\u0646\u062d\u0645", "\ufd96": "\u0646\u062d\u0649", "\ufd97": "\u0646\u062c\u0645", "\ufd98": "\u0646\u062c\u0645",
    "\ufd99": "\u0646\u062c\u0649", "\ufd9a": "\u0646\u0645\u064a", "\ufd9b": "\u0646\u0645\u0649", "\ufd9c": "\u064a\u0645\u0645",
    "\ufd9d": "\u064a\u0645\u0645", "\ufd9e": "\u0628\u062e\u064a", "\ufd9f": "\u062a\u062c\u064a", "\ufda0": "\u062a\u062c\u0649",
    "\ufda1": "\u062a\u062e\u064a", "\ufda2": "\u062a\u062e\u0649", "\ufda3": "\u062a\u0645\u064a", "\ufda4": "\u062a\u0645\u0649",
    "\ufda5": "\u062c\u0645\u064a", "\ufda6": "\u062c\u062d\u0649", "\ufda7": "\u062c\u0645\u0649", "\ufda8": "\u0633\u062e\u0649",
    "\ufda9": "\u0635\u062d\u064a", "\ufdaa": "\u0634\u062d\u064a", "\ufdab": "\u0636\u062d\u064a", "\ufdac": "\u0644\u062c\u064a",
    "\ufdad": "\u0644\u0645\u064a", "\ufdae": "\u064a\u062d\u064a", "\ufdaf": "\u064a\u062c\u064a", "\ufdb0": "\u064a\u0645\u064a",
    "\ufdb1": "\u0645\u0645\u064a", "\ufdb2": "\u0642\u0645\u064a", "\ufdb3": "\u0646\u062d\u064a", "\ufdb4": "\u0642\u0645\u062d",
    "\ufdb5": "\u0644\u062d\u0645", "\ufdb6": "\u0639\u0645\u064a", "\ufdb7": "\u0643\u0645\u064a", "\ufdb8": "\u0646\u062c\u062d",
    "\ufdb9": "\u0645\u062e\u064a", "\ufdba": "\u0644\u062c\u0645", "\ufdbb": "\u0643\u0645\u0645", "\ufdbc": "\u0644\u062c\u0645",
    "\ufdbd": "\u0646\u062c\u062d", "\ufdbe": "\u062c\u062d\u064a", "\ufdbf": "\u062d\u062c\u064a", "\ufdc0": "\u0645\u062c\u064a",
    "\ufdc1": "\u0641\u0645\u064a", "\ufdc2": "\u0628\u062d\u064a", "\ufdc3": "\u0643\u0645\u0645", "\ufdc4": "\u0639\u062c\u0645",
    "\ufdc5": "\u0635\u0645\u0645", "\ufdc6": "\u0633\u062e\u064a", "\ufdc7": "\u0646\u062c\u064a", "\ufdf0": "\u0635\u0644\u06d2",
    "\ufdf1": "\u0642\u0644\u06d2", "\ufdf3": "\u0627\u0643\u0628\u0631", "\ufdf4": "\u0645\u062d\u0645\u062f", "\ufdf5": "\u0635\u0644\u0639\u0645",
    "\ufdf6": "\u0631\u0633\u0648\u0644", "\ufdf7": "\u0639\u0644\u064a\u0647", "\ufdf8": "\u0648\u0633\u0644\u0645", "\ufdf9": "\u0635\u0644\u0649",
    "\ufdfc": "\u0631\u06cc\u0627\u0644",

    // U+FE70-U+FEFF  Presentation Forms-B: the contextual shapes legacy
    // encoders emit (initial/medial/final/isolated) plus the lam-alef ligatures.
    "\ufe70": "\u064b", "\ufe71": "\u064b", "\ufe72": "\u064c", "\ufe74": "\u064d",
    "\ufe76": "\u064e", "\ufe77": "\u064e", "\ufe78": "\u064f", "\ufe79": "\u064f",
    "\ufe7a": "\u0650", "\ufe7b": "\u0650", "\ufe7c": "\u0651", "\ufe7d": "\u0651",
    "\ufe7e": "\u0652", "\ufe7f": "\u0652", "\ufe80": "\u0621", "\ufe81": "\u0622",
    "\ufe82": "\u0622", "\ufe83": "\u0623", "\ufe84": "\u0623", "\ufe85": "\u0624",
    "\ufe86": "\u0624", "\ufe87": "\u0625", "\ufe88": "\u0625", "\ufe89": "\u0626",
    "\ufe8a": "\u0626", "\ufe8b": "\u0626", "\ufe8c": "\u0626", "\ufe8d": "\u0627",
    "\ufe8e": "\u0627", "\ufe8f": "\u0628", "\ufe90": "\u0628", "\ufe91": "\u0628",
    "\ufe92": "\u0628", "\ufe93": "\u0629", "\ufe94": "\u0629", "\ufe95": "\u062a",
    "\ufe96": "\u062a", "\ufe97": "\u062a", "\ufe98": "\u062a", "\ufe99": "\u062b",
    "\ufe9a": "\u062b", "\ufe9b": "\u062b", "\ufe9c": "\u062b", "\ufe9d": "\u062c",
    "\ufe9e": "\u062c", "\ufe9f": "\u062c", "\ufea0": "\u062c", "\ufea1": "\u062d",
    "\ufea2": "\u062d", "\ufea3": "\u062d", "\ufea4": "\u062d", "\ufea5": "\u062e",
    "\ufea6": "\u062e", "\ufea7": "\u062e", "\ufea8": "\u062e", "\ufea9": "\u062f",
    "\ufeaa": "\u062f", "\ufeab": "\u0630", "\ufeac": "\u0630", "\ufead": "\u0631",
    "\ufeae": "\u0631", "\ufeaf": "\u0632", "\ufeb0": "\u0632", "\ufeb1": "\u0633",
    "\ufeb2": "\u0633", "\ufeb3": "\u0633", "\ufeb4": "\u0633", "\ufeb5": "\u0634",
    "\ufeb6": "\u0634", "\ufeb7": "\u0634", "\ufeb8": "\u0634", "\ufeb9": "\u0635",
    "\ufeba": "\u0635", "\ufebb": "\u0635", "\ufebc": "\u0635", "\ufebd": "\u0636",
    "\ufebe": "\u0636", "\ufebf": "\u0636", "\ufec0": "\u0636", "\ufec1": "\u0637",
    "\ufec2": "\u0637", "\ufec3": "\u0637", "\ufec4": "\u0637", "\ufec5": "\u0638",
    "\ufec6": "\u0638", "\ufec7": "\u0638", "\ufec8": "\u0638", "\ufec9": "\u0639",
    "\ufeca": "\u0639", "\ufecb": "\u0639", "\ufecc": "\u0639", "\ufecd": "\u063a",
    "\ufece": "\u063a", "\ufecf": "\u063a", "\ufed0": "\u063a", "\ufed1": "\u0641",
    "\ufed2": "\u0641", "\ufed3": "\u0641", "\ufed4": "\u0641", "\ufed5": "\u0642",
    "\ufed6": "\u0642", "\ufed7": "\u0642", "\ufed8": "\u0642", "\ufed9": "\u0643",
    "\ufeda": "\u0643", "\ufedb": "\u0643", "\ufedc": "\u0643", "\ufedd": "\u0644",
    "\ufede": "\u0644", "\ufedf": "\u0644", "\ufee0": "\u0644", "\ufee1": "\u0645",
    "\ufee2": "\u0645", "\ufee3": "\u0645", "\ufee4": "\u0645", "\ufee5": "\u0646",
    "\ufee6": "\u0646", "\ufee7": "\u0646", "\ufee8": "\u0646", "\ufee9": "\u0647",
    "\ufeea": "\u0647", "\ufeeb": "\u0647", "\ufeec": "\u0647", "\ufeed": "\u0648",
    "\ufeee": "\u0648", "\ufeef": "\u0649", "\ufef0": "\u0649", "\ufef1": "\u064a",
    "\ufef2": "\u064a", "\ufef3": "\u064a", "\ufef4": "\u064a", "\ufef5": "\u0644\u0622",
    "\ufef6": "\u0644\u0622", "\ufef7": "\u0644\u0623", "\ufef8": "\u0644\u0623", "\ufef9": "\u0644\u0625",
    "\ufefa": "\u0644\u0625", "\ufefb": "\u0644\u0627", "\ufefc": "\u0644\u0627"
  };

  /**
   * Consonants. Values are the practical spellings people recognise, not a
   * scholarly transliteration: خ is kh, ش is sh, غ is gh, ق is q, ع is nothing.
   */
  const CONS = {
    // U+0620-U+064A -- the Arabic alphabet
    "ؠ": "y",  // kashmiri yeh
    "ء": "",   // hamza
    "ب": "b", "ت": "t", "ث": "th", "ج": "j",
    "ح": "h", "خ": "kh", "د": "d", "ذ": "z",
    "ر": "r", "ز": "z", "س": "s", "ش": "sh",
    "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
    "ع": "",   // ayn -- a vowel carrier, spelled with nothing
    "غ": "gh",
    "ػ": "k", "ؼ": "k", "ؽ": "y", "ؾ": "y", "ؿ": "y",
    "ف": "f", "ق": "q", "ك": "k", "ل": "l",
    "م": "m", "ن": "n",

    // U+066E-U+066F -- dotless forms used in early manuscripts
    "ٮ": "b", "ٯ": "q",
    "ٴ": "",   // high hamza

    // U+0679-U+06BF -- Urdu, Persian, Pashto, Sindhi, Kurdish additions
    "ٹ": "t",  // ٹ  Urdu retroflex t
    "ٺ": "th", "ٻ": "b", "ټ": "t", "ٽ": "t", // ٺ Sindhi aspirated tt
    "پ": "p",  // پ
    "ٿ": "th", "ڀ": "bh", // ٿ Sindhi aspirated t
    "ځ": "dz", "ڂ": "h", "ڃ": "ny", "ڄ": "j",
    "څ": "ts",
    "چ": "ch", // چ
    "ڇ": "chh",
    "ڈ": "d",  // ڈ  Urdu retroflex d
    "ډ": "d", "ڊ": "d", "ڋ": "d", "ڌ": "dh",
    "ڍ": "dh", "ڎ": "d", "ڏ": "d", "ڐ": "d",
    // ڑ  Urdu retroflex flap. "d" rather than "r", to match how people
    // actually type it and how transliterate.js spells the Hindi ड़: بڑا is
    // bada, تھوڑا is thoda, سڑک is sadak.
    "ڑ": "d",
    "ڒ": "r", "ړ": "r", "ڔ": "r", "ڕ": "r",
    "ږ": "zh", "ڗ": "r",
    "ژ": "zh", // ژ
    "ڙ": "r", "ښ": "kh", "ڛ": "s", "ڜ": "s",
    "ڝ": "s", "ڞ": "s", "ڟ": "t", "ڠ": "ng",
    "ڡ": "f", "ڢ": "f", "ڣ": "f", "ڤ": "v",
    "ڥ": "f", "ڦ": "ph", "ڧ": "q", "ڨ": "q",
    "ک": "k",  // ک  Urdu/Persian keheh
    "ڪ": "k", "ګ": "g", "ڬ": "k", "ڭ": "ng", // ګ Pashto gaf
    "ڮ": "k",
    "گ": "g",  // گ
    "ڰ": "g", "ڱ": "ng", "ڲ": "g", "ڳ": "g",
    "ڴ": "g", "ڵ": "l", "ڶ": "l", "ڷ": "l",
    "ڸ": "l", "ڹ": "n",
    "ں": "n",  // ں  noon ghunna
    "ڻ": "n", "ڼ": "n", "ڽ": "ny", "ڿ": "ch",

    // U+06C4-U+06CB, U+06CF -- Uyghur / Kurdish waw shapes that stay consonants
    "ۋ": "v",  // ۋ
    "ۏ": "w",  // ۏ

    // U+06EE-U+06EF -- Kurdish
    "ۮ": "d", "ۯ": "r",

    // U+06FA-U+06FF -- Sindhi and Kashmiri tail
    "ۺ": "sh", "ۻ": "z", "ۼ": "gh", "ۿ": "h",

    // U+0750-U+077F -- Arabic Supplement (Khowar, Torwali, African languages)
    "ݐ": "b", "ݑ": "b", "ݒ": "b", "ݓ": "b",
    "ݔ": "b", "ݕ": "b", "ݖ": "b", "ݗ": "h",
    "ݘ": "h", "ݙ": "d", "ݚ": "d", "ݛ": "r",
    "ݜ": "s", "ݝ": "", "ݞ": "", "ݟ": "",
    "ݠ": "f", "ݡ": "f", "ݢ": "g", "ݣ": "k",
    "ݤ": "k", "ݥ": "m", "ݦ": "m", "ݧ": "n",
    "ݨ": "n", "ݩ": "n", "ݪ": "l", "ݫ": "r",
    "ݬ": "r", "ݭ": "s", "ݮ": "h", "ݯ": "h",
    "ݰ": "s", "ݱ": "r", "ݲ": "h", "ݼ": "h",
    "ݽ": "s", "ݾ": "s", "ݿ": "k"
  };

  /** ث ض and final ه are read differently either side of the Arabic/Urdu line. */
  const MODE_CONS = {
    ar: { "ث": "th", "ض": "d" },
    ur: { "ث": "s", "ض": "z", "ذ": "z", "ظ": "z" }
  };

  /** Letters that are always a vowel, whatever sits either side of them. */
  const PURE_VOWEL = {
    "آ": "aa", // آ  alef with madda
    "أ": "a",  // أ
    "إ": "i",  // إ
    "ٱ": "a",  // ٱ  alef wasla
    "ٲ": "a", "ٳ": "i", "ٵ": "a",
    "ݳ": "a", "ݴ": "a",
    "ۅ": "o",  // ۅ
    "ۆ": "o",  // ۆ  Kurdish/Uyghur o
    "ۇ": "u",  // ۇ
    "ۈ": "u",  // ۈ
    "ۉ": "u",  // ۉ
    "ې": "e",  // ې  Pashto/Uyghur e
    "ێ": "e",  // ێ
    "ە": "e",  // ە
    "ݸ": "u", "ݹ": "u",
    "ے": "e",  // ے  yeh barree
    "ݺ": "e", "ݻ": "e",
    "ۓ": "e",  // ۓ  yeh barree with hamza (izafat)
    "ۀ": "a-e", // ۀ
    "ۂ": "a-e"  // ۂ
  };

  const ALEF = "ا";
  const LAM = "ل";
  const ALEF_MAQSURA = "ى";
  const WAW = "و";
  const WAW_HAMZA = "ؤ";
  const YEH = "ي";
  const FARSI_YEH = "ی";
  const YEH_HAMZA = "ئ";
  const HEH = "ه";
  const HEH_GOAL = "ہ";
  const TEH_MARBUTA = "ة";
  const TEH_MARBUTA_GOAL = "ۃ";
  const DOACHASHMEE = "ھ"; // ھ

  /** Alef-family letters: after a consonant they are the long "aa". */
  const ALEFS = new Set([ALEF, ALEF_MAQSURA, "آ", "أ", "إ",
    "ٱ", "ٲ", "ٳ", "ٵ", "ݳ", "ݴ"]);

  /** Waw-family letters that flip between the consonant w and the vowel o/oo. */
  const WAWS = new Set([WAW, WAW_HAMZA, "ٶ", "ٷ", "ۄ", "ۊ"]);

  /** Yeh-family letters that flip between the consonant y and the vowel ee/i. */
  const YEHS = new Set([YEH, FARSI_YEH, "ؠ", "ۑ", "ٸ", "ۍ",
    "ݵ", "ݶ", "ݷ"]);

  /** Heh-family letters: "h" inside a word, a vowel at the end of one. */
  const HEHS = new Set([HEH, HEH_GOAL, "ۿ"]);

  /**
   * Letters in front of which و is a consonant rather than a long vowel:
   * دوا is dawa, سوال is sawaal, جواب is jawaab, ہوا is hawa. The yeh family
   * belongs here too -- two long vowels cannot sit next to each other, so the
   * و in طويل, توصيل, قوی and نویس is the consonant w (taweel, not tooeel).
   */
  const W_BEFORE = new Set([...ALEFS, "ے", "ۓ", YEH, FARSI_YEH, "ې", "ێ"]);

  /**
   * Letters in front of which ی is the glide "iy" rather than a plain long
   * vowel: شکریہ is shukriya, زیادہ is zyada, دیا is diya. Note و is absent,
   * which is what keeps دیوار as deewaar instead of diywaar.
   */
  const Y_BEFORE = new Set([...ALEFS, "ے", "ۓ", HEH, HEH_GOAL,
    TEH_MARBUTA, TEH_MARBUTA_GOAL, "ۀ", "ۂ", "ۿ"]);

  /** Letters after which ئ is the glide "y" (gayi, aaye, koyi). */
  const HAMZA_Y_BEFORE = new Set([...Y_BEFORE, WAW, YEH, FARSI_YEH]);

  /**
   * Harakat, tanween and the rest of the combining marks. Written as escapes
   * because every one of them is invisible on its own and a stray edit to a
   * literal would be impossible to spot.
   */
  const MARKS = {
    "ً": { v: "an", tanween: true }, // fathatan
    "ٌ": { v: "un" },                // dammatan
    "ٍ": { v: "in" },                // kasratan
    "َ": { v: "a" },                 // fatha
    "ُ": { v: "u" },                 // damma
    "ِ": { v: "i", kasra: true },    // kasra
    "ّ": { shadda: true },           // shadda
    "ْ": { v: "" },                  // sukun
    "ٓ": { v: "aa" },                // maddah above
    "ٔ": {},                         // hamza above
    "ٕ": {},                         // hamza below
    "ٖ": { v: "i" },                 // subscript alef
    "ٗ": { v: "oo" },                // inverted damma (Urdu ulta pesh)
    "٘": { nasal: true },            // mark noon ghunna
    "ٙ": { v: "a" },                 // zwarakay (Pashto)
    "ٚ": { v: "a" },                 // vowel sign small v above
    "ٛ": { v: "u" },                 // vowel sign inverted small v above
    "ٜ": { v: "i" },                 // vowel sign dot below
    "ٝ": { v: "u" },                 // reversed damma
    "ٞ": { v: "a" },                 // fatha with two dots
    "ٟ": { v: "i" },                 // wavy hamza below
    "ٰ": { v: "aa" },                // superscript alef
    "ؘ": { v: "a" },                 // small fatha
    "ؙ": { v: "u" },                 // small damma
    "ؚ": { v: "i" },                 // small kasra
    "ۥ": { v: "oo" },                // small waw
    "ۦ": { v: "ee" }                 // small yeh
  };

  /**
   * Digits, punctuation and the standalone signs. These break words, so a
   * comma or a full stop does not get swallowed into the syllable machinery.
   */
  const SIGNS = {
    // Arabic-Indic and Eastern Arabic-Indic digits
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    // punctuation
    "،": ",",   // ، Arabic comma
    "؛": ";",   // ؛ Arabic semicolon
    "؟": "?",   // ؟ Arabic question mark
    "۔": ".",   // ۔ Urdu full stop
    "؞": "...", // ؞ triple dot
    "؍": "/",   // ؍ date separator
    "٪": "%",   // ٪ percent
    "؉": "%",   // ؉ per mille
    "؊": "%",   // ؊ per ten thousand
    "٫": ".",   // ٫ decimal separator
    "٬": ",",   // ٬ thousands separator
    "٭": "*",   // ٭ five pointed star
    "؋": "Af",  // ؋ afghani sign
    "۽": "&",   // ۽ Sindhi ampersand
    "۾": "men", // ۾ Sindhi postposition
    "﴾": "(", "﴿": ")", // ornate parentheses
    // ligatures that spell out a whole phrase
    "ﷲ": "Allah",
    "ﷺ": "sallallahu alaihi wasallam",
    "ﷻ": "jalla jalaluhu",
    "﷽": "bismillah ir-rahman ir-raheem"
  };

  /**
   * Seen, not spelled: the invisible number/letter marks (U+0600-0605, U+061C),
   * tatweel, the honorifics and poetic signs (U+0610-0617, U+060E-060F), the
   * Quranic recitation annotation (U+06D6-06ED) and the byte order mark that
   * lives at the end of the Presentation Forms block. MARKS is consulted first,
   * so the small waw and small yeh inside that last range still count.
   */
  function isSilent(ch) {
    const c = ch.codePointAt(0);
    return (
      (c >= 0x0600 && c <= 0x0608) ||
      (c >= 0x060e && c <= 0x0617) ||
      c === 0x061c || c === 0x061d || c === 0x0640 ||
      (c >= 0x06d6 && c <= 0x06ed) ||
      c === 0xfeff
    );
  }

  /** Does this module claim the code point at all? */
  function inRanges(code) {
    for (const r of ranges) if (code >= r[0] && code <= r[1]) return true;
    return false;
  }

  /**
   * The words that carry the message. Everything above is scaffolding; this is
   * where the output stops being a transliteration and starts being readable.
   * Urdu first, then Arabic, then the Persian handful.
   *
   * Keys are matched after diacritics are stripped and after ک/ی are folded
   * onto ك/ي, so one entry covers both the Arabic and the Urdu keyboard.
   */
  const DICT = {
    // ---- Urdu: pronouns -------------------------------------------------
    "میں": "main", "مجھے": "mujhe", "مجھ": "mujh", "مجھکو": "mujhko",
    "میرا": "mera", "میری": "meri", "میرے": "mere",
    "ہم": "hum", "ہمیں": "hamein", "ہمارا": "hamara", "ہماری": "hamari",
    "ہمارے": "hamare", "ہمکو": "humko",
    "تم": "tum", "تمہیں": "tumhein", "تمہارا": "tumhara",
    "تمہاری": "tumhari", "تمہارے": "tumhare", "تجھے": "tujhe",
    "تیرا": "tera", "تیری": "teri", "تیرے": "tere",
    "آپ": "aap", "آپکا": "aapka", "آپکی": "aapki", "آپکے": "aapke",
    "آپکو": "aapko",
    "وہ": "woh", "یہ": "yeh", "اس": "is", "اسے": "use", "اسکا": "uska",
    "اسکی": "uski", "اسکے": "uske", "اسکو": "usko", "اسی": "isi",
    "یہی": "yehi", "وہی": "wohi", "انہیں": "unhein",
    "انکا": "unka", "انکی": "unki", "انکے": "unke", "انکو": "unko",
    "اپنا": "apna", "اپنی": "apni", "اپنے": "apne", "خود": "khud",

    // ---- Urdu: question words and connectives ---------------------------
    "کیا": "kya", "کیوں": "kyun", "کیسے": "kaise", "کیسا": "kaisa",
    "کیسی": "kaisi", "کب": "kab", "کہاں": "kahan", "کون": "kaun",
    "کونسا": "kaunsa", "کتنا": "kitna", "کتنی": "kitni", "کتنے": "kitne",
    "جو": "jo", "جب": "jab", "تب": "tab", "جہاں": "jahan",
    "جیسے": "jaise", "ویسے": "waise", "ایسے": "aise", "ایسا": "aisa",
    "ایسی": "aisi", "یہاں": "yahan", "وہاں": "wahan", "کہیں": "kahin",
    "کوئی": "koi", "کچھ": "kuch", "سب": "sab", "سبھی": "sabhi",
    "ہر": "har", "دوسرا": "doosra", "دوسری": "doosri", "دوسرے": "doosre",
    "اور": "aur", "یا": "ya", "بھی": "bhi", "ہی": "hi", "تو": "to",
    "کہ": "ke", "اگر": "agar", "لیکن": "lekin", "مگر": "magar",
    "کیونکہ": "kyunki", "اسلیے": "isliye", "لیے": "liye", "لئے": "liye",
    "ورنہ": "warna", "بلکہ": "balke", "پھر": "phir", "اب": "ab",
    "ابھی": "abhi", "تک": "tak", "کا": "ka", "کی": "ki", "کے": "ke",
    "کو": "ko", "نے": "ne", "سے": "se", "پر": "par", "والا": "wala",
    "والی": "wali", "والے": "wale",

    // ---- Urdu: to be, to do, to go --------------------------------------
    "ہے": "hai", "ہیں": "hain", "ہوں": "hoon", "ہو": "ho",
    "تھا": "tha", "تھی": "thi", "تھے": "the", "تھیں": "theen",
    "ہوگا": "hoga", "ہوگی": "hogi", "ہوگے": "hoge", "ہونگے": "honge",
    "ہوتا": "hota", "ہوتی": "hoti", "ہوتے": "hote", "ہونا": "hona",
    "ہوا": "hua", "ہوئی": "hui", "ہوئے": "hue", "ہوجائے": "hojaye",
    "نہیں": "nahi", "نہ": "na", "مت": "mat", "ہاں": "haan", "جی": "ji",
    "کرنا": "karna", "کرتا": "karta", "کرتی": "karti", "کرتے": "karte",
    "کرو": "karo", "کریں": "karein", "کیجیے": "kijiye", "کر": "kar",
    "کرکے": "karke", "کیجئے": "kijiye", "کروں": "karoon",
    "جانا": "jana", "جاتا": "jata", "جاتی": "jati", "جاتے": "jate",
    "جاؤ": "jao", "جائیں": "jayein", "گیا": "gaya", "گئی": "gayi",
    "گئے": "gaye", "جائے": "jaye",
    "آنا": "aana", "آتا": "aata", "آتی": "aati", "آتے": "aate",
    "آؤ": "aao", "آئیں": "aayen", "آیا": "aaya", "آئی": "aayi",
    "آئے": "aaye",
    "دینا": "dena", "دیا": "diya", "دو": "do", "دیں": "dein",
    "لینا": "lena", "لیا": "liya", "لو": "lo", "لیں": "lein",
    "رہنا": "rehna", "رہا": "raha", "رہی": "rahi", "رہے": "rahe",
    "رہو": "raho", "رکھو": "rakho", "رکھنا": "rakhna",
    "دیکھنا": "dekhna", "دیکھو": "dekho", "دیکھا": "dekha",
    "دیکھیں": "dekhein", "دیکھ": "dekh",
    "سننا": "sunna", "سنو": "suno", "سنا": "suna", "سن": "sun",
    "کہنا": "kehna", "کہا": "kaha", "کہو": "kaho", "کہتا": "kehta",
    "کہتے": "kehte", "بولنا": "bolna", "بولو": "bolo", "بولا": "bola",
    "ملنا": "milna", "ملا": "mila", "ملی": "mili", "ملے": "mile",
    "ملتا": "milta", "ملتی": "milti", "ملتے": "milte",
    "ملیں": "milein",
    "بھیجنا": "bhejna", "بھیجو": "bhejo", "بھیجا": "bheja",
    "بھیج": "bhej", "بھیجیں": "bhejein",
    "لکھنا": "likhna", "لکھو": "likho", "لکھا": "likha",
    "پڑھنا": "padhna", "پڑھو": "padho", "پڑھا": "padha",
    "سمجھنا": "samajhna", "سمجھو": "samjho", "سمجھا": "samjha",
    "سمجھ": "samajh", "بتانا": "batana", "بتاؤ": "batao",
    "بتایا": "bataya", "بتائیں": "bataayen", "بتا": "bata",
    "چاہیے": "chahiye", "چاہئے": "chahiye", "چاہتا": "chahta",
    "چاہتی": "chahti", "چاہتے": "chahte",
    "سکتا": "sakta", "سکتی": "sakti", "سکتے": "sakte",
    "لگتا": "lagta", "لگا": "laga", "لگی": "lagi", "لگے": "lage",
    "دینے": "dene", "لینے": "lene", "کرنے": "karne",
    "جانے": "jane", "ہونے": "hone", "دیکھنے": "dekhne",
    "کہنے": "kehne", "دوں": "doon", "لوں": "loon",
    "جاؤں": "jaoon", "آؤں": "aaoon", "نکل": "nikal",
    "نکلا": "nikla", "نکلی": "nikli", "نکلے": "nikle",
    "پہنچ": "pahunch", "پہنچا": "pahuncha",
    "پہنچی": "pahunchi", "پہنچے": "pahunche",
    "سنائیں": "sunayein", "بتائیں": "bataayen",
    "دیجیے": "dijiye", "لیجیے": "lijiye",
    "سمجھے": "samjhe", "چل": "chal", "چلو": "chalo",
    "آگیا": "aagaya", "ہوگیا": "hogaya", "کردیا": "kardiya",
    "کیجیۓ": "kijiye",

    // ---- Urdu: everyday words -------------------------------------------
    "ٹھیک": "theek", "اچھا": "achcha", "اچھی": "achchi", "اچھے": "achche",
    "برا": "bura", "بہت": "bohot", "تھوڑا": "thoda", "تھوڑی": "thodi",
    "زیادہ": "zyada", "کم": "kam", "بڑا": "bada", "بڑی": "badi",
    "بڑے": "bade", "چھوٹا": "chhota", "چھوٹی": "chhoti", "نیا": "naya",
    "نئی": "nayi", "پرانا": "purana", "سارا": "saara", "پورا": "poora",
    "آدھا": "aadha", "بالکل": "bilkul", "شاید": "shayad", "ضرور": "zaroor",
    "آج": "aaj", "پرسوں": "parson", "صبح": "subah",
    "شام": "shaam", "رات": "raat", "دوپہر": "dopeher", "دن": "din",
    "ہفتہ": "hafta", "مہینہ": "maheena", "سال": "saal", "وقت": "waqt",
    "دیر": "der", "جلدی": "jaldi", "پہلے": "pehle", "بعد": "baad",
    "ساتھ": "saath", "بغیر": "baghair", "اندر": "andar", "باہر": "bahar",
    "اوپر": "oopar", "نیچے": "neeche", "آگے": "aage", "پیچھے": "peeche",
    "پاس": "paas", "دور": "door", "سامنے": "saamne", "درمیان": "darmiyan",
    "گھر": "ghar", "دفتر": "daftar", "دکان": "dukaan", "بازار": "bazaar",
    "کام": "kaam", "بات": "baat", "نام": "naam", "پیسہ": "paisa",
    "پیسے": "paise", "روپے": "rupay", "آدمی": "aadmi", "لڑکا": "ladka",
    "لڑکی": "ladki", "بچہ": "bacha", "بچے": "bache", "بھائی": "bhai",
    "بہن": "behen", "ماں": "maan", "باپ": "baap", "امی": "ammi",
    "ابو": "abbu", "بیوی": "biwi", "شوہر": "shohar", "دوست": "dost",
    "یار": "yaar", "صاحب": "sahab", "بھیا": "bhaiya", "بیٹا": "beta",
    "بیٹی": "beti", "لوگ": "log", "لوگوں": "logon",
    "پانی": "paani", "کھانا": "khaana", "چائے": "chai", "دودھ": "doodh",
    "چاند": "chaand", "دانت": "daant",
    "سانپ": "saanp", "سانس": "saans",
    "حالت": "haalat", "بادل": "baadal",
    "چادر": "chaadar", "پاگل": "paagal",
    "عالم": "aalam", "خالی": "khaali",
    "روٹی": "roti", "گوشت": "gosht", "چاول": "chawal",
    "گاڑی": "gaadi", "سڑک": "sadak", "راستہ": "raasta", "سفر": "safar",
    "خوش": "khush", "خوشی": "khushi", "امید": "umeed", "فکر": "fikar",
    "پریشان": "pareshan", "مسئلہ": "masla", "حل": "hal",
    "ضرورت": "zaroorat", "ضروری": "zaroori", "تیار": "tayyar",
    "شروع": "shuru", "ختم": "khatam", "بند": "band", "کھلا": "khula",
    "معلوم": "maloom", "پتہ": "pata", "یاد": "yaad", "بھول": "bhool",
    "سوچ": "soch", "خیال": "khayal", "علم": "ilm", "الگ": "alag",
    "الٹا": "ulta", "مطلب": "matlab", "طرح": "tarah", "طرف": "taraf",
    "بار": "baar", "دفعہ": "dafa", "چیز": "cheez", "جگہ": "jagah",
    "محبت": "mohabbat", "زندگی": "zindagi", "دنیا": "duniya",
    "مسلمان": "musalmaan", "انسان": "insaan", "عورت": "aurat",
    "شکریہ": "shukriya", "مہربانی": "meherbani", "معاف": "maaf",
    "معافی": "maafi", "سلام": "salaam", "خیریت": "khairiyat",
    "خدا": "khuda", "خداحافظ": "khuda hafiz", "حافظ": "hafiz",
    "اللہ": "Allah", "انشاءاللہ": "inshallah", "ماشاءاللہ": "mashallah",
    "الحمدللہ": "alhamdulillah", "سبحان": "subhan", "بسم": "bismillah",
    "نماز": "namaz", "روزہ": "roza", "عید": "eid", "مسجد": "masjid",
    "قرآن": "Quran", "دعا": "dua", "حدیث": "hadees", "جمعہ": "juma",
    "محمد": "Muhammad", "فلم": "film", "قسم": "qasam",
    "حکم": "hukm", "جسم": "jism", "عقل": "aqal", "قسمت": "qismat", "نصيب": "naseeb",

    // ---- Urdu: numbers ---------------------------------------------------
    "ایک": "ek", "تین": "teen", "چار": "chaar", "پانچ": "paanch",
    "چھ": "chhe", "سات": "saat", "آٹھ": "aath", "نو": "nau",
    "دس": "das", "گیارہ": "gyarah", "بارہ": "barah", "بیس": "bees",
    "پچاس": "pachas", "سو": "sau", "ہزار": "hazaar", "لاکھ": "laakh",
    "کروڑ": "crore", "پہلا": "pehla", "دوسرے": "doosre",

    // ---- Urdu: work and money -------------------------------------------
    "آرڈر": "order", "پیمنٹ": "payment", "بل": "bill", "رسید": "raseed",
    "حساب": "hisaab", "رقم": "raqam", "قیمت": "qeemat", "ریٹ": "rate",
    "مال": "maal", "سامان": "saamaan", "گاہک": "customer",
    "کمپنی": "company", "فیکٹری": "factory", "میٹنگ": "meeting",
    "رپورٹ": "report", "ٹرک": "truck", "انوائس": "invoice",
    "لیتا": "leta", "لیتی": "leti", "لیتے": "lete",
    "دیتا": "deta", "دیتی": "deti", "دیتے": "dete",
    "بھیجوں": "bhejoon", "کروں": "karoon", "فون": "phone", "کال": "call", "میسج": "message",
    "آفس": "office", "آفیس": "office", "بجے": "baje",
    "کارڈ": "card", "چارٹ": "chart",
    "پارٹ": "part", "پارک": "park",
    "مارکیٹ": "market", "شارٹ": "short",
    "ٹارگٹ": "target", "کالج": "college",
    "مہینے": "maheene", "ادا": "ada", "جمع": "jama",
    "نمبر": "number", "ایمیل": "email", "بینک": "bank", "چیک": "cheque",
    "ادائیگی": "adaigi", "تنخواہ": "tankhwah", "نوکری": "naukri",
    "کاروبار": "karobar", "دوکان": "dukaan", "مزدور": "mazdoor",
    "اردو": "Urdu", "ہندی": "Hindi", "انگریزی": "angrezi",
    "پاکستان": "Pakistan", "ہندوستان": "Hindustan", "کراچی": "Karachi",
    "لاہور": "Lahore", "دہلی": "Delhi", "دبئی": "Dubai",

    // ---- Arabic: greetings ----------------------------------------------
    "مرحبا": "marhaba", "أهلا": "ahlan", "اهلا": "ahlan", "سهلا": "sahlan",
    "السلام": "assalamu", "عليكم": "alaikum", "علیکم": "alaikum",
    "وعليكم": "wa alaikum", "وعلیکم": "wa alaikum", "السلامة": "assalama",
    "صباح": "sabah", "مساء": "masaa", "الخير": "alkhair",
    "النور": "annoor", "ليلة": "laila", "سعيدة": "saeeda",
    "شكرا": "shukran", "جزيلا": "jazeelan", "عفوا": "afwan",
    "آسف": "aasif", "آسفة": "aasifa", "معذرة": "mazira",
    "فضلك": "fadlak", "تفضل": "tafaddal", "حسنا": "hasanan",
    "طيب": "tayyib", "تمام": "tamam", "ممتاز": "mumtaz",
    "خلاص": "khalas", "يلا": "yalla", "ماشي": "mashi", "أكيد": "akeed",
    "طبعا": "tabaan", "وداعا": "wadaan", "نعم": "naam", "لا": "la",
    "ايوه": "aiwa", "بس": "bas", "يعني": "yaani", "كمان": "kaman",

    // ---- Arabic: pronouns and particles ----------------------------------
    "أنا": "ana", "انا": "ana", "أنت": "anta", "انت": "inta",
    "هو": "huwa", "هي": "hiya", "نحن": "nahnu", "احنا": "ihna",
    "أنتم": "antum", "انتم": "antum", "هما": "huma", "هن": "hunna",
    "هذا": "haza", "هذه": "hazihi", "ذلك": "zalika", "تلك": "tilka",
    "الذي": "allazi", "التي": "allati", "هنا": "huna", "هناك": "hunak",
    "ما": "ma", "ماذا": "maza", "لماذا": "limaza", "كيف": "kaif",
    "كيفك": "kaifak", "أين": "ayna", "اين": "ayna", "متى": "mata",
    "مين": "meen", "في": "fi", "على": "ala", "إلى": "ila", "الى": "ila",
    "حالك": "haalak", "حالكم": "haalkum",
    "بيتك": "baitak", "اسمك": "ismak",
    "عندك": "indak", "معك": "maak", "لك": "lak",
    "منك": "minak", "لي": "li", "بي": "bi",
    "من": "min", "عن": "an", "مع": "maa", "عند": "inda", "عندي": "indi",
    "بين": "bain", "تحت": "taht", "فوق": "fauq", "قبل": "qabl",
    "بدون": "bidoon", "حول": "haul", "و": "wa", "أو": "aw",
    "لكن": "lakin", "إذا": "iza", "اذا": "iza",
    "كان": "kaan", "يكون": "yakoon", "ليس": "laisa",
    "أريد": "ureed", "اريد": "ureed", "بدي": "biddi", "أعرف": "aaraf",
    "أفهم": "afham", "يمكن": "yumkin", "لازم": "lazim", "يجب": "yajib",
    "كثير": "katheer", "قليل": "qaleel", "كتير": "keteer",
    "شوي": "shwai", "حبيبي": "habibi", "حبيبتي": "habibti",
    "أخي": "akhi", "اخي": "akhi", "صديقي": "sadeeqi", "أستاذ": "ustaz",
    "دكتور": "doctor", "مهندس": "muhandis", "سيد": "sayyid",

    // ---- Arabic: faith ---------------------------------------------------
    "الله": "Allah", "لله": "lillah", "الحمد": "alhamdu",
    "إنشاءالله": "inshallah", "انشاءالله": "inshallah",
    "ماشاءالله": "mashallah", "الرحمن": "ar-rahman",
    "الرحيم": "ar-raheem", "رب": "rabb", "نبي": "nabi",
    "رسول": "rasool", "القرآن": "al-Quran", "صلاة": "salaah",
    "حج": "hajj", "زكاة": "zakaah", "جمعة": "jumaa",
    "عيد": "eid", "دعاء": "dua", "جنة": "jannah", "سبحان": "subhan",

    // ---- Arabic: everyday nouns -----------------------------------------
    "اليوم": "alyaum", "غدا": "ghadan", "أمس": "ams", "الآن": "alaan",
    "يوم": "yaum", "أسبوع": "usbooa", "شهر": "shahr", "سنة": "sana",
    "ساعة": "saat", "دقيقة": "daqeeqa", "وقت": "waqt",
    "بيت": "bait", "مدرسة": "madrasa", "جامعة": "jamia", "عمل": "amal",
    "شغل": "shughl", "مكتب": "maktab", "شركة": "sharika", "سوق": "sooq",
    "مستشفى": "mustashfa", "مطار": "matar", "فندق": "funduq",
    "اجتماع": "ijtimaa", "مساعدة": "musaada",
    "عالمين": "aalameen", "عاشرة": "aashira",
    "ورحمة": "wa rahmat", "وبركاته": "wa barakatuh",
    "بخير": "bikhair", "جدا": "jiddan", "صباحا": "sabahan",
    "اتصل": "ittasil", "لقاء": "liqaa", "تبارك": "tabarak",
    "فلوس": "fuloos", "فاتورة": "fatoora", "راتب": "ratib",
    "كتاب": "kitaab", "قلم": "qalam", "ورقة": "waraqa", "هاتف": "hatif",
    "جوال": "jawwal", "رقم": "raqam", "اسم": "ism", "عنوان": "unwan",
    "ماء": "maa", "طعام": "taam", "شاي": "shai", "قهوة": "qahwa",
    "خبز": "khubz", "لحم": "lahm", "رجل": "rajul", "امرأة": "imraa",
    "ولد": "walad", "بنت": "bint", "ابن": "ibn", "أب": "ab", "أم": "umm",
    "أخ": "akh", "أخت": "ukht", "صديق": "sadeeq",
    "كبير": "kabeer", "صغير": "sagheer", "جديد": "jadeed",
    "قديم": "qadeem", "جميل": "jameel", "سريع": "saree", "سهل": "sahl",
    "صعب": "saab", "جيد": "jayyid", "عربي": "arabi", "عرب": "arab",
    "واحد": "wahid", "اثنين": "ithnain", "ثلاثة": "thalatha",
    "أربعة": "arbaa", "خمسة": "khamsa", "ستة": "sitta", "سبعة": "sabaa",
    "ثمانية": "thamaniya", "تسعة": "tisaa", "عشرة": "ashara",
    "مئة": "mia", "ألف": "alf", "مليون": "milyoon",
    "مصر": "Misr", "دبي": "Dubai", "الكويت": "Kuwait", "قطر": "Qatar",
    "عمان": "Oman", "تونس": "Tunis", "ليبيا": "Libya",
    "فلسطين": "Filastin", "لبنان": "Lubnan", "الهند": "al-Hind",

    // ---- Persian ---------------------------------------------------------
    "خوب": "khoob", "بله": "bale", "نه": "na", "که": "ke", "شما": "shoma",
    "است": "ast", "هست": "hast", "بود": "bood", "دارم": "daram",
    "ممنون": "mamnoon", "مرسی": "mersi",
    "چطور": "chetor", "چه": "che", "کجا": "kuja", "چرا": "chera",
    "امروز": "emroz", "فردا": "farda", "دیروز": "diroz", "خیلی": "khaili",
    "می": "mi", "بسیار": "besyar", "زیبا": "ziba",
    "ده": "dah", "از": "az", "منزل": "manzil",
    "تهران": "Tehran", "ایران": "Iran", "اصفهان": "Isfahan",
    "شیراز": "Shiraz", "دانشگاه": "daneshgah", "بیمارستان": "bimarestan",
    "فرودگاه": "forudgah", "هواپیما": "havapeyma", "خیابان": "khiaban",
    "ماشین": "mashin", "بزرگ": "buzurg", "کوچک": "kuchak", "پسر": "pesar",
    "دختر": "dokhtar", "ارزان": "arzan", "گران": "geran", "قشنگ": "qashang",
    "ببخشید": "bebakhshid", "لطفا": "lutfan", "خواهش": "khahesh",
    "هستم": "hastam", "نیست": "nist", "میخواهم": "mikhaham", "پول": "pool",

    // ---- Urdu: the everyday words the syllable model guesses wrong -------
    "سکول": "school", "اسکول": "school",
    "یونیورسٹی": "university", "اسلام": "Islam", "آباد": "abad",
    "انتظار": "intezaar", "انتظام": "intezam", "اجازت": "ijazat",
    "استعمال": "istemaal", "امتحان": "imtihaan", "مشکل": "mushkil",
    "موسم": "mausam", "دروازہ": "darwaza", "کھڑکی": "khidki",
    "ظلم": "zulm", "وزن": "wazan", "واپس": "wapas", "دوبارہ": "dobara",
    "فورا": "fauran", "تقریبا": "taqreeban", "وغیرہ": "waghera",
    "کسی": "kisi", "جناب": "janab", "محترم": "mohtaram", "برائے": "baraye",
    "بہتر": "behtar", "بہترین": "behtareen", "خراب": "kharab",
    "سستا": "sasta", "مہنگا": "mehnga", "مصروف": "masroof",
    "فارغ": "faarigh", "معذرت": "mazrat", "افسوس": "afsos",
    "مبارک": "mubarak", "مبارکباد": "mubarakbad", "خوشخبری": "khushkhabri",
    "تکلیف": "takleef", "کوشش": "koshish", "نتیجہ": "nateeja",
    "تعلیم": "taleem", "تجربہ": "tajruba", "توجہ": "tawajjo",
    "خطرہ": "khatra", "محفوظ": "mehfooz", "نقصان": "nuqsaan",
    "منافع": "munafa", "ادھار": "udhaar", "خرچ": "kharch",
    "ہسپتال": "hospital", "ڈاکٹر": "doctor", "دوائی": "dawai",
    "بخار": "bukhaar", "مریض": "mareez", "صحت": "sehat",
    "طبیعت": "tabiyat", "علاج": "ilaaj", "کھانسی": "khaansi",
    "موبائل": "mobile", "انٹرنیٹ": "internet", "کمپیوٹر": "computer",
    "پرنٹر": "printer", "فائل": "file", "پاسورڈ": "password",
    "واٹساپ": "WhatsApp", "میسیج": "message", "تصویر": "tasveer",
    "ویڈیو": "video", "ہوٹل": "hotel", "کمرہ": "kamra", "ٹکٹ": "ticket",
    "اسٹیشن": "station", "سٹیشن": "station", "ایئرپورٹ": "airport",
    "رکشہ": "rickshaw", "ڈیلیوری": "delivery", "پارسل": "parcel",
    "اسٹاک": "stock", "سٹاک": "stock", "ڈسکاؤنٹ": "discount",
    "ایڈوانس": "advance", "کلو": "kilo", "میٹر": "meter", "درجن": "darjan",
    "ڈبہ": "dabba", "بوری": "bori", "کارٹن": "carton", "منٹ": "minute",
    "گھنٹہ": "ghanta", "گھنٹے": "ghante", "سیکنڈ": "second",
    "منگل": "mangal", "بدھ": "budh", "جمعرات": "jumeraat",
    "اتوار": "itwaar", "پینا": "peena", "سونا": "sona", "اٹھنا": "uthna",
    "بیٹھنا": "baithna", "چلنا": "chalna", "رکنا": "rukna",
    "بھولنا": "bhoolna", "خریدنا": "khareedna", "بیچنا": "bechna",
    "کھولنا": "kholna", "تیرہ": "terah", "چودہ": "chaudah",
    "پندرہ": "pandrah", "سولہ": "solah", "سترہ": "satrah",
    "اٹھارہ": "atharah", "انیس": "unnees", "تیس": "tees",
    "چالیس": "chalees", "ستر": "sattar", "نوے": "nawway",
    "پشاور": "Peshawar", "ملتان": "Multan", "راولپنڈی": "Rawalpindi",
    "کوئٹہ": "Quetta", "حیدرآباد": "Hyderabad", "ممبئی": "Mumbai",
    "بھارت": "Bharat", "چین": "China", "امریکہ": "America",
    "لندن": "London", "سعودی": "Saudi",

    // ---- Urdu: the verb forms the vowel guess gets wrong ------------------
    "مل": "mil", "ملو": "milo", "چکا": "chuka", "چکی": "chuki",
    "چکے": "chuke", "کھلے": "khule", "کھلی": "khuli", "کھول": "khol",
    "کھولو": "kholo", "پوچھ": "poochh", "پوچھا": "poochha",
    "پوچھیں": "poochhein", "پوچھو": "poochho", "اٹھا": "utha",
    "اٹھاؤ": "uthao", "اٹھایا": "uthaya", "اٹھی": "uthi", "اٹھے": "uthe",
    "اٹھاؤں": "uthaoon", "جیسا": "jaisa", "جیسی": "jaisi",
    "ویسا": "waisa", "ویسی": "waisi", "چھٹی": "chhutti",
    "چھٹیاں": "chhuttiyan", "خیر": "khair", "بھیجی": "bheji",
    "بھیجے": "bheje", "بھیجنی": "bhejni", "دیکھی": "dekhi",
    "دیکھے": "dekhe", "سنی": "suni", "سنے": "sune", "سنیں": "sunein",
    "لکھی": "likhi", "لکھے": "likhe", "لکھیں": "likhein",
    "لینی": "leni", "دینی": "deni", "پہنچو": "pahuncho",
    "پہنچیں": "pahunchein", "پہنچنا": "pahunchna", "مانگ": "maang",
    "مانگا": "maanga", "مانگی": "maangi", "مانگیں": "maangein",
    "دکھاؤ": "dikhao", "دکھایا": "dikhaya", "دکھائیں": "dikhayen",
    "لگاؤ": "lagao", "لگایا": "lagaya", "بھیجوا": "bhijwa",
    "منظور": "manzoor", "منظوری": "manzoori", "درخواست": "darkhwast",
    "تفصیل": "tafseel", "تفصیلات": "tafseelaat", "معلومات": "maloomaat",
    "اطلاع": "ittila", "کسٹمر": "customer", "سکیورٹی": "security",
    "سیمنٹ": "cement", "اینٹ": "eent", "گیس": "gas", "ڈیزل": "diesel",
    "پیٹرول": "petrol", "پولیس": "police", "پاسپورٹ": "passport",
    "ویزا": "visa", "بجلی": "bijli", "لکڑی": "lakdi", "لوہا": "loha",
    "مرمت": "marammat", "مستری": "mistri", "ٹھیکہ": "theka",
    "ٹھیکیدار": "thekedaar", "مزدوری": "mazdoori", "حکومت": "hukumat",
    "عدالت": "adaalat", "فوج": "fauj", "شناختی": "shanaakhti",
    "دستخط": "dastkhat", "انتظامات": "intezamaat",

    // ---- Arabic: the same, for the words the model guesses wrong ---------
    "مدير": "mudeer", "لغة": "lugha", "مشكلة": "mushkila",
    "مكة": "Makkah", "جدة": "Jeddah", "دمشق": "Dimashq",
    "بيروت": "Beirut", "أردن": "Urdun", "مغرب": "Maghrib",
    "سيارة": "sayyara", "مبارك": "mubarak", "سلطان": "sultan",
    "معلم": "muallim", "مطعم": "mataam", "بطاقة": "bitaaqa",
    "كلمة": "kalima", "جملة": "jumla", "خدمة": "khidma",
    "سعودية": "Saudia", "امارات": "Emarat", "سوريا": "Suriya",
    "عراق": "Iraq", "أمريكا": "Amreeka", "ممكن": "mumkin",
    "غالي": "ghali", "رخيص": "rakhees", "مافي": "mafi",
    "شو": "shu", "ليش": "laish", "وين": "wain", "هلا": "hala",
    "تعال": "taal", "جامع": "jami"
  };

  /**
   * The words the two languages spell identically and read differently. Looked
   * up before DICT and only in the matching mode, which is the whole reason the
   * mode exists: کل is "kal" in an Urdu message and كل is "kull" in an Arabic
   * one, and they are the same six bytes.
   */
  const MODE_DICT = {
    ur: {
      "کل": "kal", "من": "man", "رمضان": "Ramzan", "بعض": "baaz",
      "کن": "kan", "سنت": "sunnat", "علی": "Ali",
      // ان is "them" in Urdu and إن/أن in Arabic; سر is the English "sir"
      // every Urdu business message opens with, and سِرّ in Arabic.
      "ان": "un", "سر": "sir", "بس": "bas"
    },
    ar: {
      "كل": "kull", "من": "min", "رمضان": "Ramadan", "بعض": "baad",
      "سنة": "sana", "علي": "Ali", "ان": "in", "سر": "sirr"
    }
  };

  // ---------------------------------------------------------------------
  // Normalisation
  // ---------------------------------------------------------------------

  /**
   * Strip everything that never helps a dictionary lookup: harakat and tanween,
   * the Urdu/Pashto vowel marks, superscript alef, tatweel, the honorifics, the
   * Quranic annotation and the zero width joiners Persian puts inside compounds.
   */
  const STRIP_RE = /[\u064B-\u065F\u0670\u0640\u0610-\u061A\u06D6-\u06ED\u200C\u200D]/g;

  /** Fold the Urdu/Persian keyboard onto the Arabic one for lookup only. */
  function dictKey(word) {
    return word
      .replace(STRIP_RE, "")
      .replace(/ک|ڪ/g, "ك")           // ک ڪ -> ك
      .replace(/ی|ؠ|ۑ/g, "ي");   // ی ؠ ۑ -> ي
  }

  /** Second pass for lookup: also fold the heh, hamza and alef variants. */
  function looseKey(word) {
    return dictKey(word)
      .replace(/[ہۀۂەۿ]/g, "ه")
      .replace(/ۃ/g, "ة")
      .replace(/[أإٱٲٳٵ]/g, "ا")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي");
  }

  const EXACT = Object.create(null);
  const LOOSE = Object.create(null);
  for (const key of Object.keys(DICT)) {
    const value = DICT[key];
    EXACT[dictKey(key)] = value;
    const loose = looseKey(key);
    if (LOOSE[loose] === undefined) LOOSE[loose] = value;
  }

  const BY_MODE = { ar: Object.create(null), ur: Object.create(null) };
  for (const mode of Object.keys(MODE_DICT)) {
    for (const key of Object.keys(MODE_DICT[mode])) {
      BY_MODE[mode][dictKey(key)] = MODE_DICT[mode][key];
    }
  }

  /** Presentation forms -> base letters, then compose the combining marks. */
  function fold(run) {
    let out = "";
    for (const ch of run) {
      const mapped = PRES[ch];
      out += mapped === undefined ? ch : mapped;
    }
    try {
      return out.normalize("NFC");
    } catch (_) {
      return out;
    }
  }

  // ---------------------------------------------------------------------
  // Mode
  // ---------------------------------------------------------------------

  /**
   * U+0679-U+06D5 is every letter Arabic does not have -- ٹ ڈ ڑ پ چ ژ ک گ ں ھ
   * ہ ی ے and the Pashto/Sindhi/Kurdish/Uyghur additions -- plus the Urdu full
   * stop. U+06FA-U+06FF is the Sindhi and Kashmiri tail. One of those in a word
   * settles the question.
   */
  const UR_MARKERS = /[ٹ-ەۺ-ۿ]/;
  /** ك ي ى ة: nobody types those on an Urdu or Persian keyboard. */
  const AR_MARKERS = /[كيىة]/;

  let sticky = "ar";

  function detectMode(text) {
    if (UR_MARKERS.test(text)) return "ur";
    if (AR_MARKERS.test(text)) return "ar";
    return null;
  }

  // ---------------------------------------------------------------------
  // Parsing one word into syllable nodes
  // ---------------------------------------------------------------------

  const LONG = new Set(["aa", "oo", "ee", "o", "e", "u", "au", "ai", "iy", "a-e"]);
  /**
   * The vowels a final ہ is heard after (shah, gunaah, koh). The glide "iy" is
   * deliberately absent: سرمایہ is sarmaya and تجزیہ is tajziya, not sarmayh.
   */
  const HEH_AFTER_LONG = new Set(["aa", "oo", "ee", "o", "u", "au"]);
  const SONORANT = new Set(["r", "l", "n", "m", "ng"]);
  const NASAL = new Set(["n", "m", "ng"]);
  /** Consonants that would form a false digraph with a following "h". */
  const H_TRAP = /[sztdkgcp]/;
  /** The one final cluster every one of these languages allows: dost, gosht. */
  const SIBILANT = /^(s|sh|z|zh|ss|ssh)$/;
  const STOP = /^[tdk]/;

  /** Shadda: kk, tt, mm -- and ssh, cch, tth for the digraphs. */
  function doubled(latin) {
    if (!latin) return latin;
    if (latin.length === 1) return latin + latin;
    return latin.charAt(0) + latin;
  }

  const isMark = (ch) => Object.prototype.hasOwnProperty.call(MARKS, ch);

  function isLetter(ch) {
    if (isMark(ch) || isSilent(ch)) return false;
    if (Object.prototype.hasOwnProperty.call(SIGNS, ch)) return false;
    return (
      Object.prototype.hasOwnProperty.call(CONS, ch) ||
      Object.prototype.hasOwnProperty.call(PURE_VOWEL, ch) ||
      ALEFS.has(ch) || WAWS.has(ch) || YEHS.has(ch) || HEHS.has(ch) ||
      ch === YEH_HAMZA || ch === TEH_MARBUTA || ch === TEH_MARBUTA_GOAL ||
      ch === DOACHASHMEE
    );
  }

  /**
   * Split a word into nodes: { c, v, sh }.
   *   c  = the consonant, "" for a bare vowel or a silent carrier (ayn, hamza)
   *   v  = the vowel, null while undecided and "" for none at all
   *   sh = the consonant was written with a shadda
   */
  function parse(word, mode) {
    const nodes = [];
    const override = MODE_CONS[mode] || {};
    let lastLetter = -1;
    for (let i = 0; i < word.length; i++) if (isLetter(word[i])) lastLetter = i;

    /** Index of the next letter or spoken harakat after i; the rest is annotation. */
    const nextSigIdx = (i) => {
      for (let j = i + 1; j < word.length; j++) {
        const ch = word[j];
        if (isMark(ch)) {
          if (MARKS[ch].v) return j;
          continue;
        }
        if (isSilent(ch)) continue;
        return j;
      }
      return -1;
    };
    const nextSig = (i) => {
      const j = nextSigIdx(i);
      return j < 0 ? "" : word.charAt(j);
    };
    /** Is the letter at i written with a shadda? It always sits right on it. */
    const shaddaAt = (i) => {
      for (let j = i + 1; j < word.length; j++) {
        if (word.charAt(j) === "ّ") return true;
        if (!isMark(word[j]) && !isSilent(word[j])) return false;
      }
      return false;
    };

    const last = () => (nodes.length ? nodes[nodes.length - 1] : null);
    const open = (c) => {
      const node = { c: c, v: null, sh: false };
      nodes.push(node);
      return node;
    };
    /** Hang a vowel on the open consonant, or stand it up on its own. */
    const vowel = (v) => {
      const node = last();
      if (node && node.v === null) node.v = v;
      else open("").v = v;
    };

    let skipAlef = false;

    for (let i = 0; i < word.length; i++) {
      const ch = word[i];

      if (isMark(ch)) {
        const m = MARKS[ch];
        const node = last();
        if (m.shadda) {
          if (node) {
            node.c = doubled(node.c);
            node.sh = true;
          }
          continue;
        }
        if (m.nasal) {
          open("n").v = "";
          continue;
        }
        if (m.v === undefined) continue;
        if (m.tanween) {
          if (node) node.v = "an";
          else open("").v = "an";
          skipAlef = true;
          continue;
        }
        if (m.kasra && i >= lastLetter && mode === "ur") {
          // Urdu izafat: wazeer-e-azam is written with a bare kasra
          if (node && node.v === null) node.v = "-e";
          else open("").v = "-e";
          continue;
        }
        if (node && node.v === null) node.v = m.v;
        else if (!node) open("").v = m.v;
        continue;
      }

      if (isSilent(ch)) continue;

      const isFinal = i === lastLetter;
      const after = nextSig(i);
      // A fathatan is written on an alef that is a seat, not a vowel, but only
      // for the letter immediately after it.
      const seat = skipAlef;
      skipAlef = false;

      // --- alef family: word-initial "a", long "aa" everywhere else -------
      if (ALEFS.has(ch) && !(ch === ALEF_MAQSURA && !isFinal)) {
        // ...except that ى only ever ends an Arabic word (على, موسى). Uyghur
        // uses the same code point mid-word for the vowel "i", so a medial one
        // falls through to the yeh branch below.
        if (seat) continue;
        if (!nodes.length) {
          // اور -> aur, ایسا -> aisa: a bare initial alef glued to و/ی is a
          // diphthong, not a vowel followed by a consonant.
          const j = nextSigIdx(i);
          const glide = j < 0 ? "" : word.charAt(j);
          const beyond = j < 0 ? "" : nextSig(j);
          const node = open("");
          if (ch === ALEF && beyond && !ALEFS.has(beyond) && !isMark(beyond) &&
              (glide === WAW || glide === YEH || glide === FARSI_YEH)) {
            node.v = glide === WAW ? "au" : "ai";
            i = j;
          } else {
            node.v = PURE_VOWEL[ch] || "a";
          }
          continue;
        }
        const node = last();
        const v = ch === "إ" || ch === "ٳ" ? "i" : "aa";
        if (node && node.v === null) node.v = v;
        else open("").v = v;
        continue;
      }

      // --- waw: consonant in front of a vowel, long vowel otherwise -------
      if (WAWS.has(ch)) {
        const node = last();
        const asVowel = ch === WAW_HAMZA ? (mode === "ur" ? "o" : "u")
                                         : (mode === "ur" ? "o" : "oo");
        // A shadda sits on the letter it doubles, so a وّ is the consonant w
        // and the doubling belongs to it: قوّت is quwwat, never qqoot.
        if (shaddaAt(i)) {
          open("w");
          continue;
        }
        if (ch === WAW && (W_BEFORE.has(after) || isMark(after))) {
          open("w");
          continue;
        }
        if (ch === "ۄ" || ch === "ۊ") {
          open("w");
          continue;
        }
        if (node && node.v === null && node.c !== "") node.v = asVowel;
        else if (!nodes.length) open("w");
        // A damma in front of a و is the long oo it is written with, and a
        // fatha in front of one is the diphthong: پھُول is phool, قَوم is qaum.
        else if (node && node.v === "u") node.v = "oo";
        else if (node && node.v === "a" && ch === WAW) node.v = "au";
        // The syllable already has its vowel, and no syllable carries two:
        // پشاور is pashaawar, not pashaaor, and دَوا is dawa. A final ؤ is
        // exempt -- it is the o of جاؤ, بتاؤ, لگاؤ and دکھاؤ.
        else if (node && node.v !== null && ch === WAW && !isFinal) open("w");
        else vowel(asVowel);
        continue;
      }

      // --- yeh: consonant, glide, or long vowel ---------------------------
      if (YEHS.has(ch) || ch === ALEF_MAQSURA) {
        const node = last();
        if (isMark(after) || shaddaAt(i)) {
          open("y");   // سيّارة is sayyara: the shadda doubles the yeh
          continue;
        }
        if (node && node.v === null && node.c !== "") {
          node.v = Y_BEFORE.has(after) ? "iy" : isFinal ? "i" : "ee";
          continue;
        }
        if (!nodes.length) {
          open("y");
          continue;
        }
        // A kasra in front of a ی is the long ee, a fatha is the diphthong:
        // دِین is deen, بَیت is bait.
        if (node && node.v === "i" && !Y_BEFORE.has(after)) { node.v = "ee"; continue; }
        if (node && node.v === "a" && !Y_BEFORE.has(after)) { node.v = "ai"; continue; }
        // Same rule as the waw: after a vowel the yeh is the consonant y --
        // ئۇيغۇر is uyghur and آیا is aaya, not aaeeaa. At the end of a word
        // it is still the vowel, because چای is chai and رائے is raaye.
        if (Y_BEFORE.has(after) || (node && node.v !== null && !isFinal)) open("y");
        else vowel(isFinal ? "i" : "ee");
        continue;
      }

      // --- yeh with hamza: the glide in gayi, aaye, koyi -------------------
      if (ch === YEH_HAMZA) {
        // Uyghur writes every word-initial vowel on a hamza seat: ئۇ is u,
        // ئا is a, ئۆ is o. The seat itself is silent.
        if (!nodes.length && after && (ALEFS.has(after) || WAWS.has(after) ||
            YEHS.has(after) ||
            Object.prototype.hasOwnProperty.call(PURE_VOWEL, after))) {
          open("");
          continue;
        }
        if (HAMZA_Y_BEFORE.has(after) || isMark(after)) open("y");
        else vowel("i");
        continue;
      }

      // --- heh: "h" inside a word, a vowel at the end of one ---------------
      if (HEHS.has(ch)) {
        if (!isFinal) {
          open("h");
          continue;
        }
        if (ch === HEH && mode === "ar") {
          open("h");
          continue;
        }
        // ...but a final heh after a long vowel is pronounced: شاہ is shah,
        // گناہ is gunaah, نگاہ is nigaah, دانشگاه is daneshgah. Only a heh
        // sitting on a bare consonant is the silent "a" of راستہ and زیادہ.
        const node = last();
        if (node && node.v !== null && HEH_AFTER_LONG.has(node.v)) {
          open("h");
          continue;
        }
        vowel("a");
        continue;
      }

      if (ch === TEH_MARBUTA || ch === TEH_MARBUTA_GOAL) {
        if (isFinal) vowel("a");
        else open("t");
        continue;
      }

      // --- ھ: the aspiration in bh, ph, th, dh, kh, gh, chh ----------------
      if (ch === DOACHASHMEE) {
        const node = last();
        // چ + ھ has to become "chh", so a trailing h is not by itself a reason
        // to refuse the merge -- only an already doubled one is.
        if (node && node.v === null && node.c && node.c.slice(-2) !== "hh") {
          node.c += "h";
        } else {
          open("h");
        }
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(PURE_VOWEL, ch)) {
        vowel(PURE_VOWEL[ch]);
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(CONS, ch)) {
        const latin = Object.prototype.hasOwnProperty.call(override, ch)
          ? override[ch]
          : CONS[ch];
        open(latin);
        continue;
      }

      // Anything unmapped inside the block simply does not reach the output.
    }

    return nodes;
  }

  // ---------------------------------------------------------------------
  // Spelling the nodes out
  // ---------------------------------------------------------------------

  function spell(nodes) {
    let out = "";
    let since = 0;        // consonants emitted since the last vowel
    let seenVowel = false;
    let lastVowel = "";

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const next = nodes[i + 1];
      const isLast = i === nodes.length - 1;
      // true when exactly one bare consonant is left after this one, so a bare
      // coda here would close the word with a two-consonant cluster
      const closing = !!(next && nodes[i + 2] === undefined &&
                         next.v === null && next.c);
      // the same cluster with a short "a" hung off the end of it, which is what
      // a taa marbuta or a final ہ leaves behind: القاهرة, فاطمہ, حادثہ
      const closingA = !!(next && nodes[i + 2] === undefined &&
                          next.v === "a" && next.c);
      let v = node.v;

      if (v === null) {
        if (node.c === "") {
          // ع and the hamza seats spell nothing, but they still hold a syllable
          // open: عرب is arab rather than rab, and طبیعت keeps its last vowel.
          if (!seenVowel && nodes.length > 1) v = "a";
          else if (closing && since === 0) v = "a";
          else continue;
        }
        else if (!seenVowel) v = "a";              // open the word
        else if (next && next.sh) v = "a";         // muhammad, not muhmmad
        else if (node.sh && !isLast) v = "a";
        else if (since === 0) {
          v = "";
          // وسهلا is wasahlan, and a bare coda would spell it "washlan": s
          // against a following h reads as ش. Same for z, t, d, k, g, c, p.
          // A coda against a following y or w is the other unreadable join --
          // ہوگئی has to be hogayi, not hogyi.
          if (next && next.c.charAt(0) === "h" &&
              H_TRAP.test(node.c.charAt(node.c.length - 1))) {
            v = "a";
          } else if (next && next.c === "y") {
            v = "a";
          } else if (closing && NASAL.has(node.c) && NASAL.has(next.c)) {
            // امن is aman and یمن is Yaman: no word here ends "mn" or "nm".
            v = "a";
          } else if ((closing || closingA) && LONG.has(lastVowel) &&
                     !(SIBILANT.test(node.c) && STOP.test(next.c)) &&
                     !(NASAL.has(node.c) && !SONORANT.has(next.c))) {
            // A long vowel carries one coda, not two -- haqeeqat not haqeeqt,
            // hakomat not hakomt -- except for the sibilant-plus-stop cluster,
            // which every one of these languages ends words with: dost, gosht,
            // raast, bardaasht.
            //
            // After a long aa the vowel is "i", not "a", because that shape is
            // the CaaCiC participle: haazir, qaabil, saabit, maalik, kaamil,
            // taalib, aashiq. It is the most common word pattern Urdu borrowed
            // from Arabic and it never has anything else in that slot.
            //
            // A nasal in front of a stop or a sibilant is left alone, because
            // that cluster is a single sound and every language here ends
            // words with it: maang, chaand, saanp, daant, saans, taang.
            v = lastVowel === "aa" ? "i" : "a";
          } else if (closing && SONORANT.has(next.c)) {
            // A word does not end on a stop plus a sonorant: حسن is hasan,
            // وطن is watan, نظر is nazar, خبر is khabar, بدل is badal, شکل is
            // shakal, زخم is zakham, جبل is jabal. The words that really do
            // end that way -- ilm, jism, hukm, qism, film, zulm -- are all in
            // the dictionary, because there is no rule that separates them.
            v = "a";
          }
        } else if (isLast) v = "";                 // dost, waqt, sabr, hamd
        else v = "a";                              // start a new syllable
      }

      out += node.c + v;
      if (v) {
        since = 0;
        seenVowel = true;
        lastVowel = v;
      } else if (node.c) {
        since += 1;
      }
    }

    return out;
  }

  /** The last few things that stand between the output and how people type. */
  function tidy(out) {
    out = out.replace(/(.)aay/g, "$1ay");   // bhaayi -> bhayi
    out = out.replace(/(.)aai/g, "$1ai");   // masaail -> masail
    out = out.replace(/(.)aa$/, "$1a");     // badaa -> bada, but آ stays aa
    out = out.replace(/([a-z])\1{2,}/g, "$1$1"); // stacked marks
    return out;
  }

  // ---------------------------------------------------------------------
  // Words
  // ---------------------------------------------------------------------

  const SUN_DIGRAPH = ["sh", "th"];
  const SUN_SINGLE = "tdzrsnl";

  /** al-kitaab, ar-rahman, ash-shams: the article assimilates to sun letters. */
  function withArticle(rest) {
    if (!rest) return "al";
    for (const d of SUN_DIGRAPH) {
      if (rest.indexOf(d) === 0) return "a" + d + "-" + rest;
    }
    if (SUN_SINGLE.indexOf(rest.charAt(0)) !== -1) {
      return "a" + rest.charAt(0) + "-" + rest;
    }
    return "al-" + rest;
  }

  function romanizeWord(word, mode) {
    if (!word) return "";

    const key = dictKey(word);
    const byMode = BY_MODE[mode];
    if (byMode && byMode[key] !== undefined) return byMode[key];
    if (EXACT[key] !== undefined) return EXACT[key];
    const loose = LOOSE[looseKey(word)];
    if (loose !== undefined) return loose;

    // Arabic definite article. Urdu-mode words are left alone, because الگ is
    // alag and الٹا is ulta -- neither of them carries an article.
    if (mode === "ar" && key.length >= 4 &&
        (key.charAt(0) === ALEF || key.charAt(0) === "ٱ") &&
        key.charAt(1) === LAM) {
      // The alef is the first letter, so the first lam in the word is the
      // article's; everything past it is the noun and gets romanised on its own.
      const rest = word.slice(word.indexOf(LAM) + 1);
      const tail = romanizeWord(rest, mode);
      if (tail) return withArticle(tail);
    }

    const nodes = parse(word, mode);
    if (!nodes.length) return "";
    const out = tidy(spell(nodes));
    // A word that is nothing but hamza or ayn spells nothing, and the router
    // falls back to the original script whenever a module hands back an empty
    // string -- which would put an Arabic letter into ASCII output. Both are
    // vowel carriers, so "a" is the honest answer.
    return out === "" ? "a" : out;
  }

  // ---------------------------------------------------------------------
  // Entry points
  // ---------------------------------------------------------------------

  // romanize(word) receives ONE maximal run of consecutive characters from these
  // ranges (whitespace and punctuation already split them, so this is a word).
  function romanize(word) {
    if (!word) return "";
    const text = fold(word);

    const detected = detectMode(text);
    if (detected) sticky = detected;
    const mode = detected || sticky;

    let out = "";
    let buf = "";
    const flush = () => {
      if (buf) {
        out += romanizeWord(buf, mode);
        buf = "";
      }
    };

    for (const ch of text) {
      if (Object.prototype.hasOwnProperty.call(SIGNS, ch)) {
        flush();
        out += SIGNS[ch];
        continue;
      }
      if (isMark(ch) || isLetter(ch)) {
        buf += ch;
        continue;
      }
      if (ch === "‌" || ch === "‍") {
        flush(); // Persian writes compound verbs with a zero width non-joiner
        continue;
      }
      if (isSilent(ch)) continue;
      // Unassigned or unspellable inside a block we claim: drop it rather than
      // let a code point leak into what is supposed to be plain ASCII.
      if (inRanges(ch.codePointAt(0))) continue;
      flush();
      out += ch; // spaces from an expanded ligature, or anything unclaimed
    }
    flush();

    return out;
  }

  /**
   * Whole-text helper, kept for direct use and for tests. Unlike romanize() it
   * decides Arabic-vs-Urdu from the entire message before touching a word, so
   * the ambiguous words in an Urdu sentence read as Urdu.
   */
  function translit(text) {
    if (!text) return "";
    const detected = detectMode(fold(text));
    if (detected) sticky = detected;

    let out = "";
    let buf = "";
    const flush = () => {
      if (buf) {
        out += romanize(buf);
        buf = "";
      }
    };
    for (const ch of text) {
      // The zero width joiners are not in a block this module claims -- the
      // router will always split a Persian compound verb across two runs -- but
      // when the whole message comes through here they can be handled properly.
      if (inRanges(ch.codePointAt(0)) || ch === "‌" || ch === "‍") buf += ch;
      else {
        flush();
        out += ch;
      }
    }
    flush();
    return out;
  }

  const mod = {
    id: "arabic",
    languages: ["Arabic", "Urdu", "Persian", "Pashto", "Sindhi", "Kashmiri", "Uyghur"],
    ranges,
    romanize
  };

  if (typeof window !== "undefined") {
    (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
    window.WVT_arabic = translit;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { translit, ...mod };
  }
})();
