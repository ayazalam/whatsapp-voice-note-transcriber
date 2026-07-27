/**
 * Devanagari -> Roman (Hinglish) transliteration.
 *
 * Scribe returns Hindi in Devanagari and code-switched English words already in
 * Latin, so romanising only the Devanagari runs gives natural-looking Hinglish.
 *
 * Approach: syllabify, then apply Hindi schwa deletion (word-final, plus the
 * classic VC_CV medial rule applied right-to-left), then spell out with the
 * vowel conventions people actually use when typing Hinglish (aa/ee/oo, and
 * short -a/-i/-u word-finally). A dictionary of very common words overrides the
 * generic output.
 *
 * Exposes: window.WVT_translit(text) -> string
 */
(() => {
  "use strict";

  const CONS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v", "ळ": "l",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    // precomposed nuqta forms
    "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z",
    "ड़": "d", "ढ़": "dh", "फ़": "f", "य़": "y"
  };

  // base consonant followed by U+093C NUKTA
  const NUQTA = {
    "क": "q", "ख": "kh", "ग": "g", "ज": "z",
    "ड": "d", "ढ": "dh", "फ": "f", "य": "y"
  };

  const INDEP = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee",
    "उ": "u", "ऊ": "oo", "ऋ": "ri",
    "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
    "ऑ": "o", "ऍ": "e", "ॲ": "a"
  };

  const MATRA = {
    "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
    "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "ॉ": "o", "ॅ": "e"
  };

  const DIGITS = {
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
    "५": "5", "६": "6", "७": "7", "८": "8", "९": "9"
  };

  const VIRAMA = "्";
  const NUKTA = "़";
  const ANUSVARA = "ं";
  const CHANDRABINDU = "ँ";
  const VISARGA = "ः";
  const DANDA = "।";
  const DOUBLE_DANDA = "॥";

  // Sentinel for a nasal whose realisation (n vs m) depends on the next onset.
  const NASAL = "";

  const LABIALS = new Set(["p", "ph", "b", "bh", "m", "f"]);

  // Words where the mechanical output is not what anyone actually types.
  const DICT = {
    "है": "hai", "हैं": "hain",
    "हूँ": "hoon", "हूं": "hoon",
    "था": "tha", "थी": "thi", "थे": "the",
    "नहीं": "nahi", "नही": "nahi",
    "ना": "na", "न": "na", "मत": "mat",
    "क्या": "kya", "क्यों": "kyun",
    "कैसे": "kaise", "कैसा": "kaisa", "कैसी": "kaisi",
    "कब": "kab", "कहाँ": "kahan", "कहां": "kahan",
    "कौन": "kaun", "कितना": "kitna", "कितने": "kitne",
    "मैं": "main", "मैंने": "maine",
    "मुझे": "mujhe", "मुझको": "mujhko",
    "मेरा": "mera", "मेरी": "meri", "मेरे": "mere",
    "हम": "hum", "हमें": "humein",
    "हमारा": "hamara", "हमारी": "hamari", "हमारे": "hamare",
    "तुम": "tum", "तुझे": "tujhe",
    "तेरा": "tera", "तेरी": "teri", "तेरे": "tere",
    "आप": "aap", "आपको": "aapko", "आपका": "aapka",
    "आपकी": "aapki", "आपके": "aapke",
    "वो": "wo", "वह": "woh", "ये": "ye", "यह": "yeh",
    "उन्हें": "unhein", "उनको": "unko",
    "इसको": "isko", "उसको": "usko",
    "उसे": "use", "इसे": "ise",
    "उनका": "unka", "उसका": "uska", "इसका": "iska",
    "में": "mein", "मे": "me", "से": "se",
    "को": "ko", "का": "ka", "की": "ki", "के": "ke",
    "ने": "ne", "पर": "par", "और": "aur", "या": "ya",
    "भी": "bhi", "ही": "hi", "तो": "to", "कि": "ki",
    "जो": "jo", "जब": "jab", "तब": "tab", "अगर": "agar",
    "लेकिन": "lekin", "मगर": "magar",
    "बहुत": "bohot", "थोड़ा": "thoda", "थोड़ी": "thodi",
    "ज्यादा": "zyada", "कुछ": "kuch", "सब": "sab",
    "अभी": "abhi", "आज": "aaj", "कल": "kal",
    "सुबह": "subah", "शाम": "shaam", "रात": "raat",
    "ठीक": "theek", "अच्छा": "accha",
    "अच्छी": "acchi", "अच्छे": "acche",
    "गलत": "galat", "सही": "sahi",
    "हाँ": "haan", "हां": "haan", "जी": "ji",
    "साहब": "sahab", "सर": "sir", "भाई": "bhai", "यार": "yaar",
    "काम": "kaam", "बात": "baat", "समय": "samay",
    "पैसा": "paisa", "पैसे": "paise", "आदमी": "aadmi",
    "चाहिए": "chahiye", "चाहिये": "chahiye",
    "होगा": "hoga", "होगी": "hogi", "होंगे": "honge",
    "करो": "karo", "किया": "kiya", "करेंगे": "karenge",
    "गया": "gaya", "गयी": "gayi", "गई": "gayi", "गए": "gaye",
    "दिया": "diya", "लिया": "liya",
    "रहा": "raha", "रही": "rahi", "रहे": "rahe",
    "हुआ": "hua", "हुई": "hui", "हुए": "hue",
    "मिला": "mila", "भेजो": "bhejo",
    "देखो": "dekho", "सुनो": "suno", "बोलो": "bolo",
    "एक": "ek", "दो": "do", "तीन": "teen", "चार": "chaar",
    "पाँच": "paanch", "पांच": "paanch", "दस": "das",
    "हजार": "hazaar", "हज़ार": "hazaar",
    "लाख": "laakh", "करोड़": "crore",
    "क्योंकि": "kyunki", "इसलिए": "isliye", "वरना": "warna",
    "जल्दी": "jaldi", "देर": "der", "पूरा": "pura", "आधा": "aadha",
    // -इए / -इये imperatives
    "दीजिए": "dijiye", "दीजिये": "dijiye", "कीजिए": "kijiye", "कीजिये": "kijiye",
    "बताइए": "bataiye", "बताइये": "bataiye", "आइए": "aaiye", "जाइए": "jaiye",
    "सुनिए": "suniye", "देखिए": "dekhiye", "बोलिए": "boliye", "करिए": "kariye",
    "भेजिए": "bhejiye", "लीजिए": "lijiye", "समझिए": "samajhiye",

    // English written in Devanagari -> spell it back in English
    "पेमेंट": "payment", "ऑर्डर": "order", "आर्डर": "order", "मीटिंग": "meeting",
    "डिलीवरी": "delivery", "कस्टमर": "customer", "ऑफिस": "office", "ऑफिश": "office",
    "फोन": "phone", "फ़ोन": "phone", "कॉल": "call", "मैसेज": "message",
    "स्कूल": "school", "प्रोजेक्ट": "project", "टाइम": "time", "कंपनी": "company",
    "मैडम": "madam", "ओके": "ok", "प्लीज": "please", "प्लीज़": "please",
    "थैंक्स": "thanks", "सॉरी": "sorry", "इनवॉइस": "invoice", "बिल": "bill",
    "चेक": "cheque", "नंबर": "number", "एड्रेस": "address", "फैक्ट्री": "factory",
    "स्टॉक": "stock", "रिपोर्ट": "report", "अकाउंट": "account", "बैंक": "bank",
    "ट्रांसफर": "transfer", "लोड": "load", "ट्रक": "truck", "पार्टी": "party",
    "साइट": "site", "मटेरियल": "material", "सप्लाई": "supply", "डिस्काउंट": "discount",
    "रेट": "rate", "कोटेशन": "quotation", "सैंपल": "sample", "स्टाफ": "staff",
    "सैलरी": "salary", "एडवांस": "advance", "ईमेल": "email", "व्हाट्सएप": "WhatsApp",
    "गूगल": "Google", "पिकअप": "pickup", "डिस्पैच": "dispatch", "शिपमेंट": "shipment",
    "क्वालिटी": "quality", "प्रॉब्लम": "problem", "प्रोब्लम": "problem",
    "कैंसिल": "cancel", "कन्फर्म": "confirm", "अपडेट": "update", "स्टेटस": "status"
  };

  const isCons = (ch) => Object.prototype.hasOwnProperty.call(CONS, ch);
  const isDev = (ch) => {
    const c = ch.codePointAt(0);
    return c >= 0x0900 && c <= 0x097f;
  };
  const isMark = (ch) => ch === ANUSVARA || ch === CHANDRABINDU || ch === VISARGA;

  /** Reads the nasal/visarga marks that follow position i. */
  function readTail(word, i) {
    let tail = "";
    while (i < word.length && isMark(word[i])) {
      tail += word[i] === VISARGA ? "h" : NASAL;
      i += 1;
    }
    return tail;
  }

  function tailLength(word, i) {
    let n = 0;
    while (i + n < word.length && isMark(word[i + n])) n += 1;
    return n;
  }

  /**
   * Split one Devanagari word into syllables: { c, v, inherent, tail }
   *   c        = onset consonant cluster in Latin ("" for vowel-initial syllables)
   *   v        = vowel in Latin ("a" = inherent schwa, "" = no vowel)
   *   inherent = true when v is the implicit schwa (only those can be deleted)
   *   tail     = nasal/visarga after the vowel
   */
  function syllabify(word) {
    const syls = [];
    let i = 0;

    while (i < word.length) {
      const ch = word[i];

      if (isCons(ch)) {
        let cluster = "";
        let dead = false; // ended on a virama -> consonant carrying no vowel

        for (;;) {
          let latin = CONS[word[i]];
          if (word[i + 1] === NUKTA && NUQTA[word[i]]) {
            latin = NUQTA[word[i]];
            i += 1;
          }
          cluster += latin;
          i += 1;
          if (word[i] === VIRAMA) {
            i += 1;
            if (isCons(word[i])) continue; // conjunct: keep building the cluster
            dead = true;
          }
          break;
        }

        if (dead) {
          syls.push({ c: cluster, v: "", inherent: false, tail: "" });
          continue;
        }

        let v = "a";
        let inherent = true;
        if (MATRA[word[i]]) {
          v = MATRA[word[i]];
          inherent = false;
          i += 1;
        }
        syls.push({ c: cluster, v, inherent, tail: readTail(word, i) });
        i += tailLength(word, i);
        continue;
      }

      if (INDEP[ch]) {
        const v = INDEP[ch];
        const j = i + 1;
        syls.push({ c: "", v, inherent: v === "a", tail: readTail(word, j) });
        i = j + tailLength(word, j);
        continue;
      }

      if (DIGITS[ch]) {
        syls.push({ c: DIGITS[ch], v: "", inherent: false, tail: "", literal: true });
        i += 1;
        continue;
      }

      i += 1; // avagraha, stray marks, anything unmapped
    }

    return syls;
  }

  /** Hindi schwa deletion. */
  function deleteSchwa(syls) {
    const n = syls.length;
    if (n === 0) return;

    // 1. word-final inherent schwa drops (unless it is the only syllable)
    const last = syls[n - 1];
    if (n > 1 && last.inherent && last.v === "a" && last.c && !last.tail && !last.literal) {
      last.v = "";
    }

    // 2. medial: schwa -> 0 in V C _ C V, right-to-left, using updated context
    for (let i = n - 2; i >= 1; i--) {
      const s = syls[i];
      if (!s.inherent || s.v !== "a" || s.tail || !s.c || s.literal) continue;
      const prev = syls[i - 1];
      const next = syls[i + 1];
      if (!prev.v || prev.literal) continue;
      if (!next.c || !next.v || next.literal) continue;
      s.v = "";
    }
  }

  function spell(syls) {
    let out = "";
    for (let i = 0; i < syls.length; i++) {
      const s = syls[i];
      let v = s.v;

      // How people actually type it: karnaa -> karna, bhii -> bhi, aaluu -> aalu
      if (i === syls.length - 1 && !s.tail && (syls.length > 1 || s.c)) {
        if (v === "aa") v = "a";
        else if (v === "ee") v = "i";
        else if (v === "oo") v = "u";
      }

      let tail = s.tail;
      if (tail.indexOf(NASAL) !== -1) {
        const next = syls[i + 1];
        let nasal = "n";
        if (next && next.c) {
          const one = next.c[0];
          const two = next.c.slice(0, 2);
          if (LABIALS.has(two) || LABIALS.has(one)) nasal = "m";
        }
        tail = tail.split(NASAL).join(nasal);
      }
      out += s.c + v + tail;
    }
    return out;
  }

  function word(w) {
    if (DICT[w]) return DICT[w];
    const syls = syllabify(w);
    if (!syls.length) return "";
    deleteSchwa(syls);
    let out = spell(syls);
    // uthaaya -> uthaya (but keep word-initial aa: aaya, aage)
    out = out.replace(/(.)aay/g, "$1ay");
    // collapse artefacts like "nnn" from stacked marks
    return out.replace(/([a-z])\1{2,}/g, "$1$1");
  }

  /** Transliterate every Devanagari run in `text`, leave everything else alone. */
  function translit(text) {
    if (!text) return "";
    let src;
    try {
      src = text.normalize("NFC");
    } catch (_) {
      src = text;
    }
    let out = "";
    let buf = "";
    const flush = () => {
      if (buf) {
        out += word(buf);
        buf = "";
      }
    };
    for (const ch of src) {
      if (ch === DANDA || ch === DOUBLE_DANDA) {
        flush();
        out += ".";
      } else if (isDev(ch)) {
        buf += ch;
      } else {
        flush();
        out += ch;
      }
    }
    flush();
    return out;
  }

  // Register with the router alongside every other script module. The router owns
  // window.WVT_translit; this file just owns Devanagari.
  /**
   * The router hands us a whole run of Devanagari-block characters, and danda
   * (U+0964) sits inside that block — so sentence punctuation arrives glued to
   * the words and has to be split back out here.
   */
  function romanizeRun(run) {
    return run
      .split(/([।॥])/)
      .map((part) => {
        if (!part) return "";
        if (part === DANDA || part === DOUBLE_DANDA) return ".";
        return word(part);
      })
      .join("");
  }

  const mod = {
    id: "devanagari",
    languages: ["Hindi", "Marathi", "Nepali", "Bhojpuri", "Maithili", "Konkani", "Sanskrit"],
    ranges: [[0x0900, 0x097f]],
    romanize: romanizeRun
  };

  if (typeof window !== "undefined") {
    (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
    // Kept for direct use and for tests that predate the router.
    window.WVT_devanagari = translit;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { translit, word, ...mod };
  }
})();
