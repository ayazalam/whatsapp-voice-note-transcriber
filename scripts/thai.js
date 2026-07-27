/**
 * Thai -> Roman (RTGS-flavoured).
 *
 * Thai is the awkward one. Two structural problems have to be solved before a
 * single letter can be spelled out:
 *
 *   1. Vowels are not written in phonetic order. เ แ โ ใ ไ are typed BEFORE
 *      the consonant but pronounced AFTER it, and other vowels sit above,
 *      below or after. So the syllable reader looks for a leading vowel first,
 *      then the consonant, then reassembles them in speaking order:
 *      เ + ท + ศ -> "thet", not "ethes".
 *   2. There are no spaces between words, and consonants change value in final
 *      position (ส -> t, ร -> n, ล -> n, บ -> p). Where a syllable ends is
 *      therefore a guess, made here from what follows: a consonant that owns a
 *      vowel of its own starts the next syllable, otherwise it closes this one.
 *
 * Tone marks (่ ้ ๊ ๋) are dropped — RTGS does not write tone, and a reader of
 * Latin letters cannot use it anyway.
 *
 * Word boundaries come from a dictionary of common words, longest-match first;
 * that is what turns ประเทศไทย into "prathet thai" rather than one blob.
 * Anything not in the dictionary is syllabified mechanically and glued
 * together, with a cap on how long a run of unknown syllables may grow.
 */
(() => {
  "use strict";

  const ranges = [[0x0e00, 0x0e7f]];

  // Consonants: initial sound, then the (different) final sound.
  // "" as a final means the letter is silent in that position.
  const CONS = {
    "ก": ["k", "k"],
    "ข": ["kh", "k"],
    "ฃ": ["kh", "k"],
    "ค": ["kh", "k"],
    "ฅ": ["kh", "k"],
    "ฆ": ["kh", "k"],
    "ง": ["ng", "ng"],
    "จ": ["ch", "t"],
    "ฉ": ["ch", "t"],
    "ช": ["ch", "t"],
    "ซ": ["s", "t"],
    "ฌ": ["ch", "t"],
    "ญ": ["y", "n"],
    "ฎ": ["d", "t"],
    "ฏ": ["t", "t"],
    "ฐ": ["th", "t"],
    "ฑ": ["th", "t"],
    "ฒ": ["th", "t"],
    "ณ": ["n", "n"],
    "ด": ["d", "t"],
    "ต": ["t", "t"],
    "ถ": ["th", "t"],
    "ท": ["th", "t"],
    "ธ": ["th", "t"],
    "น": ["n", "n"],
    "บ": ["b", "p"],
    "ป": ["p", "p"],
    "ผ": ["ph", "t"],
    "ฝ": ["f", "t"],
    "พ": ["ph", "p"],
    "ฟ": ["f", "p"],
    "ภ": ["ph", "p"],
    "ม": ["m", "m"],
    "ย": ["y", "i"],   // final ย is the vowel offglide -i
    "ร": ["r", "n"],
    "ล": ["l", "n"],
    "ว": ["w", "o"],   // final ว is the vowel offglide -o
    "ศ": ["s", "t"],
    "ษ": ["s", "t"],
    "ส": ["s", "t"],
    "ห": ["h", ""],
    "ฬ": ["l", "n"],
    "อ": ["", ""],     // glottal carrier: silent, the vowel stands alone
    "ฮ": ["h", ""]
  };

  // Initial clusters that really exist. Anything else (ตล, สบ …) is two
  // syllables with an unwritten "a" in the first.
  const CLUSTERS = {
    "ก": "รลว", "ข": "รลว", "ค": "รลว", "ต": "ร",
    "ป": "รล", "ผ": "รล", "พ": "รล", "บ": "รล"
  };

  // ห + one of these is a silent h that only carries tone class.
  const SILENT_H = "งญนมยรลวฬ";

  const LEAD = { "เ": 1, "แ": 1, "โ": 1, "ใ": 1, "ไ": 1 };

  // ฤ and ฦ are letters in their own right (vocalic r / l), not consonants:
  // they carry their own vowel. ฤๅ / ฦๅ are the long forms.
  const RU = { "ฤ": "rue", "ฦ": "lue" };

  const VOWEL_SIGNS = "ะัาำิีึืุูๅ็";
  const TONES = "่้๊๋";
  const THANTHAKHAT = "์";  // silences the letter it sits on
  const NIKHAHIT = "ํ";
  const PHINTHU = "ฺ";
  const YAMAKKAN = "๎";
  const REPEAT = "ๆ";

  const DIGITS = {
    "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
    "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9"
  };

  const PUNCT = {
    "ฯ": ".",    // paiyannoi, abbreviation mark
    "๏": " ",    // fongman, paragraph mark
    "๚": " ",    // angkhankhu
    "๛": ".",    // khomut, end of text
    "฿": "baht"
  };

  const inBlock = (ch) => { const c = ch.charCodeAt(0); return c >= 0x0e00 && c <= 0x0e7f; };
  const isCons = (ch) => ch !== undefined && CONS[ch] !== undefined;
  const isVowelSign = (ch) => ch !== undefined && VOWEL_SIGNS.indexOf(ch) !== -1;
  const isTone = (ch) => ch !== undefined && TONES.indexOf(ch) !== -1;
  const isLead = (ch) => ch !== undefined && LEAD[ch] === 1;

  /** True for marks that bind to the letter before them. */
  const attaches = (ch) =>
    ch !== undefined &&
    (isVowelSign(ch) || isTone(ch) || ch === THANTHAKHAT || ch === NIKHAHIT ||
     ch === PHINTHU || ch === YAMAKKAN);

  /** Tone marks can sit anywhere in a syllable; step over them. */
  function skipTones(w, i) {
    while (i < w.length && (isTone(w[i]) || w[i] === YAMAKKAN || w[i] === PHINTHU)) i += 1;
    return i;
  }

  /**
   * อ and ว are consonant letters that also spell vowels: อ is /ɔː/ and ว is
   * /ua/ when another consonant follows them. Used to decide whether a pair
   * like คร in ครอบ is a real initial cluster.
   */
  function carriesVowel(w, i) {
    const ch = w[i];
    if (ch !== "อ" && ch !== "ว") return false;
    const k = skipTones(w, i + 1);
    return k >= w.length || isCons(w[k]);
  }

  /**
   * Read the initial consonant (or cluster) at i.
   * Returns { c, i } with c already in Latin, or null.
   */
  function readInitial(w, i, hasLead) {
    const ch = w[i];
    if (!isCons(ch)) return null;
    let c = CONS[ch][0];
    let j = i + 1;

    // A letter carrying ์ is silent — skip it and try the next one.
    if (w[j] === THANTHAKHAT) return { c: "", i: j + 1 };

    const nxt = w[j];
    if (ch === "ห" && nxt !== undefined && SILENT_H.indexOf(nxt) !== -1 && w[j + 1] !== THANTHAKHAT) {
      // หม, หน, หล … : the h is silent, the sonorant is the real initial.
      // Only when the sonorant is not itself carrying the syllable alone.
      const after = skipTones(w, j + 1);
      if (isVowelSign(w[after]) || isCons(w[after]) || after >= w.length || isLead(w[after])) {
        c = CONS[nxt][0];
        j += 1;
      }
    } else if (
      nxt !== undefined &&
      CLUSTERS[ch] !== undefined &&
      CLUSTERS[ch].indexOf(nxt) !== -1 &&
      // A real cluster needs a vowel: either a leading one already read for
      // this syllable (ไกล klai, โกรธ krot), a sign after the pair, or one of
      // the two consonants that double as vowels — อ is /ɔː/ and ว is /ua/
      // when a consonant follows them (ครอบ khrop, ปลอด plot, กล้วย kluai).
      // Two consonants with no vowel anywhere are C-o-C instead (นคร nakhon).
      (hasLead === true || isVowelSign(w[skipTones(w, j + 1)]) ||
       carriesVowel(w, skipTones(w, j + 1)))
    ) {
      c += CONS[nxt][0];
      j += 1;
    }

    return { c, i: skipTones(w, j) };
  }

  /**
   * Read one syllable starting at i. Returns { text, i } or null.
   * This is where the leading-vowel reordering happens.
   */
  function readSyllable(w, i) {
    const start = i;
    let lead = "";
    if (isLead(w[i])) {
      lead = w[i];
      i += 1;
    }

    const init = readInitial(w, i, lead !== "");
    if (!init) {
      // ฤ / ฦ stand alone as a syllable: ฤดู ruedu, ฤๅษี ruesi.
      if (RU[w[i]] !== undefined) {
        const t = RU[w[i]];
        i += 1;
        if (w[i] === "ๅ") i += 1;
        return { text: t, i };
      }
      // A leading vowel with no consonant after it: emit the bare vowel.
      if (lead) return { text: lead === "แ" ? "ae" : lead === "โ" ? "o" : lead === "เ" ? "e" : "ai", i };
      return null;
    }
    let c = init.c;
    i = init.i;

    let v = "";
    let allowFinal = true;
    let wroteVowel = true;

    // Ro han: รร is a written vowel, not two r's. It reads "a" when a final
    // consonant closes the syllable (ธรรม tham, กรรม kam, สรรพ sap) and "an"
    // when nothing does (บรรทัด banthat, กรรไกร kankrai, พรรษา phansa).
    let roHan = false;
    if (!lead && w[i] === "ร" && w[i + 1] === "ร") {
      roHan = true;
      i = skipTones(w, i + 2);
      const after = skipTones(w, i + 1);
      if (isCons(w[i]) && !isVowelSign(w[after]) && w[after] !== THANTHAKHAT &&
          !isLead(w[after])) {
        v = "a";
      } else {
        v = "an";
        allowFinal = false;
      }
    }

    const a = w[i];
    // A tone mark can sit between the two halves of a compound vowel
    // (เสื้อ is เ ส ื ้ อ), so look past it.
    const bi = skipTones(w, i + 1);
    const b = w[bi];

    if (roHan) {
      // vowel already decided above
    } else if (lead === "เ") {
      if (a === "ี" && b === "ย") { v = "ia"; i = bi + 1; }
      else if (a === "ื" && b === "อ") { v = "uea"; i = bi + 1; }
      else if (a === "ิ") { v = "oe"; i += 1; }
      else if (a === "อ") { v = "oe"; i += 1; }
      else if (a === "า" && b === "ะ") { v = "o"; i = bi + 1; allowFinal = false; }
      else if (a === "า") { v = "ao"; i += 1; allowFinal = false; }
      else if (a === "ะ") { v = "e"; i += 1; allowFinal = false; }
      else if (a === "็") { v = "e"; i += 1; }
      else if (a === "ย" && !isVowelSign(b)) { v = "oei"; i += 1; allowFinal = false; }
      else v = "e";
    } else if (lead === "แ") {
      if (a === "ะ") { v = "ae"; i += 1; allowFinal = false; }
      else { v = "ae"; if (a === "็") i += 1; }
    } else if (lead === "โ") {
      if (a === "ะ") { v = "o"; i += 1; allowFinal = false; }
      else v = "o";
    } else if (lead === "ใ" || lead === "ไ") {
      v = "ai";
      allowFinal = false;
      if (a === "ย") i += 1;   // ไทย: the ย is not pronounced again
    } else if (a === "ั") {
      if (b === "ว") { v = "ua"; i = bi + 1; }
      else { v = "a"; i += 1; }
    } else if (a === "ะ") { v = "a"; i += 1; allowFinal = false; }
    else if (a === "า") { v = "a"; i += 1; }
    else if (a === "ำ") { v = "am"; i += 1; allowFinal = false; }
    else if (a === "ิ") {
      if (b === "ว") { v = "io"; i = bi + 1; allowFinal = false; }
      else { v = "i"; i += 1; }
    } else if (a === "ี") {
      if (b === "ย") { v = "ia"; i = bi + 1; }
      else { v = "i"; i += 1; }
    } else if (a === "ึ") { v = "ue"; i += 1; }
    else if (a === "ื") { v = "ue"; i += 1; if (w[i] === "อ") i += 1; }
    else if (a === "ุ") { v = "u"; i += 1; }
    else if (a === "ู") { v = "u"; i += 1; }
    else if (a === "ๅ") { v = "a"; i += 1; }
    else if (RU[a] !== undefined) {
      // ฤ after a consonant supplies that syllable's vowel: พฤ -> phrue.
      v = RU[a];
      i += 1;
      if (w[i] === "ๅ") i += 1;
    }
    else if (a === "็") { v = "o"; i += 1; }
    else if (a === "ํ") { v = "am"; i += 1; allowFinal = false; }
    else if (a === "อ" && !isVowelSign(b) && !isLead(b) && b !== THANTHAKHAT) {
      v = "o"; i += 1;
    } else if (a === "ว" && isCons(b) && !isVowelSign(w[skipTones(w, i + 2)])) {
      v = "ua"; i += 1;
    } else {
      // No written vowel at all. Either this consonant closes a syllable with
      // the unwritten short "o" (คน khon, นก nok), or it is the first half of
      // a two-syllable word with an unwritten "a" (สบาย sa-bai).
      wroteVowel = false;
      const cand = w[i];
      if (isCons(cand)) {
        const k = skipTones(w, i + 1);
        const nxt = w[k];
        if (nxt !== undefined && (isVowelSign(nxt) || nxt === THANTHAKHAT)) {
          v = "a";           // the next consonant owns that vowel
          allowFinal = false;
        } else if (isCons(nxt) && skipTones(w, k + 1) >= w.length) {
          // C C C at the end of the run: the last two are a closed syllable of
          // their own, so this one takes the unwritten "a" (ถนน thanon,
          // ตลก talok, สงบ sangop).
          v = "a";
          allowFinal = false;
        } else {
          v = "o";           // closed syllable
        }
      } else {
        // A consonant sitting immediately before a leading vowel owns the
        // unwritten short "a", not the closed-syllable "o": สโมสร samoson.
        v = isLead(cand) ? "a" : "o";
        allowFinal = false;
      }
    }

    i = skipTones(w, i);

    // Final consonant, if the next letter does not own a vowel of its own.
    let fin = "";
    if (allowFinal && isCons(w[i])) {
      const k = skipTones(w, i + 1);
      const nxt = w[k];
      if (nxt === THANTHAKHAT) {
        i = k + 1;           // silent final, e.g. โทรศัพท์
      } else if ((nxt === "ิ" || nxt === "ุ") && wroteVowel &&
                 skipTones(w, k + 1) >= w.length) {
        // Indic loans write a final ิ / ุ that Thai does not say:
        // ชาติ chat, ญาติ yat, ประวัติ prawat, เหตุ het, ธาตุ that.
        fin = CONS[w[i]][1];
        i = skipTones(w, k + 1);
      } else if (isCons(nxt) && nxt !== "ร" && wroteVowel &&
                 skipTones(w, k + 1) >= w.length) {
        // Exactly two bare consonants close the run: they are a syllable of
        // their own (onset + final), not this syllable's final plus a stray.
        // ชาชน is cha-chon, not chat-no; ประชาชน is prachachon.
        // ร is excluded because a final cluster in -ร is silent (จักร chak).
      } else if (nxt === undefined || !isVowelSign(nxt)) {
        fin = CONS[w[i]][1];
        i = skipTones(w, i + 1);
        // ย and ว finals are offglides; do not double the vowel letter.
        if ((fin === "i" || fin === "o") && v.charAt(v.length - 1) === fin) fin = "";
        // a second final (สรรพ, จันทร์) is not pronounced
        if (isCons(w[i]) && w[skipTones(w, i + 1)] === THANTHAKHAT) {
          i = skipTones(w, i + 1) + 1;
        } else if (isCons(w[i]) && isCons(w[skipTones(w, i + 1)]) &&
                   w[skipTones(w, skipTones(w, i + 1) + 1)] === THANTHAKHAT) {
          // A whole silent cluster: จันทร์ chan, ศาสตร์ sat, จักรพรรดิ์.
          i = skipTones(w, skipTones(w, i + 1) + 1) + 1;
        } else if (w[i] === "ร" && !isVowelSign(w[skipTones(w, i + 1)]) &&
                   w[skipTones(w, i + 1)] !== THANTHAKHAT) {
          // A final cluster ending in ร drops the ร: เพชร phet, สมัคร samak,
          // มิตร mit, บัตร bat, จักร chak.
          i = skipTones(w, i + 1);
        }
      }
    }

    if (i === start) return null;   // never let the caller loop forever
    return { text: c + v + fin, i };
  }

  // Common words, longest-match first. This is what supplies word spacing and
  // the spellings people actually recognise.
  const DICT = {
    "สวัสดี": "sawatdi", "สวัสดีครับ": "sawatdi khrap", "สวัสดีค่ะ": "sawatdi kha",
    "ครับ": "khrap", "คับ": "khap", "ค่ะ": "kha", "คะ": "kha", "จ้ะ": "cha", "จ๊ะ": "cha",
    "ขอบคุณ": "khopkhun", "ขอบใจ": "khopchai", "ขอโทษ": "khothot", "ขอ": "kho",
    "ไม่": "mai", "ใช่": "chai", "ได้": "dai", "ไหม": "mai", "มั้ย": "mai",
    "มี": "mi", "เป็น": "pen", "อยู่": "yu", "คือ": "khue", "ทำ": "tham",
    "ไป": "pai", "มา": "ma", "กิน": "kin", "ดื่ม": "duem", "นอน": "non",
    "ดู": "du", "ฟัง": "fang", "พูด": "phut", "อ่าน": "an", "เขียน": "khian",
    "รู้": "ru", "รัก": "rak", "ชอบ": "chop", "อยาก": "yak", "ต้อง": "tong",
    "จะ": "cha", "แล้ว": "laeo", "ยัง": "yang", "ก็": "ko", "และ": "lae",
    "หรือ": "rue", "แต่": "tae", "เพราะ": "phro", "ถ้า": "tha", "ที่": "thi",
    "ของ": "khong", "กับ": "kap", "ให้": "hai", "จาก": "chak", "ใน": "nai",
    "บน": "bon", "ใต้": "tai", "ข้าง": "khang", "นี้": "ni", "นั้น": "nan",
    "นี่": "ni", "นั่น": "nan", "ไหน": "nai", "อะไร": "arai", "ทำไม": "thammai",
    "เมื่อไหร่": "muearai", "ใคร": "khrai", "ยังไง": "yangngai", "อย่างไร": "yangrai",
    "เท่าไหร่": "thaorai", "เท่าไร": "thaorai", "กี่": "ki", "มาก": "mak",
    "น้อย": "noi", "นิดหน่อย": "nitnoi", "ทุก": "thuk", "บาง": "bang", "อีก": "ik",
    "ด้วย": "duai", "เอง": "eng", "เลย": "loei", "จริง": "ching", "นะ": "na",
    "ผม": "phom", "ฉัน": "chan", "ดิฉัน": "dichan", "คุณ": "khun", "เธอ": "thoe",
    "เขา": "khao", "เรา": "rao", "พวกเรา": "phuakrao", "มัน": "man", "ท่าน": "than",
    "พี่": "phi", "น้อง": "nong", "แม่": "mae", "พ่อ": "pho", "ลูก": "luk",
    "เพื่อน": "phuean", "คน": "khon", "บ้าน": "ban", "รถ": "rot", "เงิน": "ngoen",
    "เวลา": "wela", "วัน": "wan", "วันนี้": "wanni", "พรุ่งนี้": "phrungni",
    "เมื่อวาน": "muea wan", "เดือน": "duean", "ปี": "pi", "ชั่วโมง": "chuamong",
    "นาที": "nathi", "เช้า": "chao", "บ่าย": "bai", "เย็น": "yen",
    "กลางคืน": "klangkhuen", "ตอนนี้": "tonni", "เดี๋ยว": "diao", "รอ": "ro",
    "โอเค": "oke", "ดี": "di", "สวย": "suai", "อร่อย": "aroi", "ร้อน": "ron",
    "หนาว": "nao", "เหนื่อย": "nueai", "สบาย": "sabai", "สบายดี": "sabaidi",
    "เข้าใจ": "khaochai", "ช่วย": "chuai", "บอก": "bok", "ถาม": "tham",
    "ตอบ": "top", "ส่ง": "song", "รับ": "rap", "ซื้อ": "sue", "ขาย": "khai",
    "จ่าย": "chai", "ราคา": "rakha", "บาท": "bat", "ร้าน": "ran", "ตลาด": "talat",
    "โรงเรียน": "rongrian", "โรงพยาบาล": "rongphayaban", "บริษัท": "borisat",
    "งาน": "ngan", "ทำงาน": "thamngan", "ประชุม": "prachum", "โทร": "tho",
    "โทรศัพท์": "thorasap", "มือถือ": "muethue", "ข้อความ": "khokhwam",
    "อีเมล": "email", "รูป": "rup", "วิดีโอ": "widio", "ไฟล์": "file",
    "ประเทศ": "prathet", "ไทย": "thai", "ประเทศไทย": "prathet thai",
    "กรุงเทพ": "krungthep", "ภาษา": "phasa", "ภาษาไทย": "phasa thai",
    "อังกฤษ": "angkrit", "จีน": "chin", "ญี่ปุ่น": "yipun", "เกาหลี": "kaoli",
    "อาหาร": "ahan", "ข้าว": "khao", "น้ำ": "nam", "กาแฟ": "kafae", "ชา": "cha",
    "นม": "nom", "ผลไม้": "phonlamai", "หมู": "mu", "ไก่": "kai", "เนื้อ": "nuea",
    "ปลา": "pla", "ผัก": "phak", "ไข่": "khai", "ขนม": "khanom",
    "หนึ่ง": "nueng", "สอง": "song", "สาม": "sam", "สี่": "si", "ห้า": "ha",
    "หก": "hok", "เจ็ด": "chet", "แปด": "paet", "เก้า": "kao", "สิบ": "sip",
    "ร้อย": "roi", "พัน": "phan", "หมื่น": "muen", "แสน": "saen", "ล้าน": "lan",
    "ศูนย์": "sun", "เดิน": "doen", "วิ่ง": "wing", "ขับ": "khap", "นั่ง": "nang",
    "ยืน": "yuen", "เห็น": "hen", "คิด": "khit", "จำ": "cham", "ลืม": "luem",
    "เรียน": "rian", "สอน": "son", "เล่น": "len", "ทำไง": "thamngai",
    "อยากได้": "yak dai", "ไม่เป็นไร": "mai penrai", "สนุก": "sanuk",
    "เก่ง": "keng", "แพง": "phaeng", "ถูก": "thuk", "ใหญ่": "yai", "เล็ก": "lek",
    "ใหม่": "mai", "เก่า": "kao", "เร็ว": "reo", "ช้า": "cha", "ไกล": "klai",
    "ใกล้": "klai", "ที่ไหน": "thinai", "อันนี้": "anni", "แบบนี้": "baepni",
    // Place names and set phrases whose Latin spelling is fixed by usage.
    "กรุงเทพมหานคร": "krungthep maha nakhon", "มหานคร": "maha nakhon",
    "พัทยา": "phatthaya", "อยุธยา": "ayutthaya", "สุโขทัย": "sukhothai",
    "สุวรรณภูมิ": "suwannaphum", "เชียงใหม่": "chiang mai",
    "เชียงราย": "chiang rai", "หาดใหญ่": "hat yai", "หัวหิน": "hua hin",
    "ขอนแก่น": "khon kaen", "นครราชสีมา": "nakhon ratchasima",
    "อุบลราชธานี": "ubon ratchathani", "อุบล": "ubon", "นครปฐม": "nakhon pathom",
    "ภูเก็ต": "phuket", "สงขลา": "songkhla", "ชลบุรี": "chonburi",
    "ต้มยำ": "tom yam", "ต้มยำกุ้ง": "tom yam kung", "ส้มตำ": "som tam",
    "ผัดไทย": "phat thai", "แม่น้ำ": "maenam", "รถไฟ": "rotfai",
    "ฤดู": "ridu", "ฤทธิ์": "rit",
    // Words where a single letter is pronounced twice (วิท-ทะ-ยา) or the
    // spelling is simply irregular. Nothing mechanical recovers these.
    "มหาวิทยาลัย": "mahawitthayalai", "วิทยาลัย": "witthayalai",
    "วิทยาศาสตร์": "witthayasat", "วิทยา": "witthaya",
    "รัฐบาล": "ratthaban", "รัฐ": "rat", "เศรษฐกิจ": "setthakit",
    "เศรษฐี": "setthi", "ราชการ": "ratchakan", "ราชา": "racha",
    "วัฒนธรรม": "watthanatham", "ประวัติศาสตร์": "prawattisat",
    "อุณหภูมิ": "unhaphum", "บริการ": "borikan", "บริเวณ": "boriwen",
    "บริหาร": "borihan", "บริสุทธิ์": "borisut", "ปรารถนา": "prattha na",
    "สัปดาห์": "sapda", "อาทิตย์": "athit", "ศุกร์": "suk", "เสาร์": "sao",
    "อังคาร": "angkhan", "พฤหัสบดี": "pharuehatsabodi", "พฤษภาคม": "phruetsaphakhom",
    "มกราคม": "makarakhom", "กุมภาพันธ์": "kumphaphan", "มีนาคม": "minakhom",
    "เมษายน": "mesayon", "มิถุนายน": "mithunayon", "กรกฎาคม": "karakadakhom",
    "สิงหาคม": "singhakhom", "กันยายน": "kanyayon", "ตุลาคม": "tulakhom",
    "พฤศจิกายน": "phruetsachikayon", "ธันวาคม": "thanwakhom",
    "สุขภาพ": "sukkhaphap", "ความสุข": "khwamsuk", "สนามบิน": "sanambin",
    "คอมพิวเตอร์": "khomphiutoe", "อินเทอร์เน็ต": "internet",
    "สวรรค์": "sawan", "มนุษย์": "manut", "ศิลปะ": "sinlapa",
    "กีฬา": "kila", "ดนตรี": "dontri", "เทศกาล": "thetsakan",
    "สงกรานต์": "songkran", "ลอยกระทง": "loi krathong",
    "ธรรมชาติ": "thammachat", "ธรรมดา": "thammada", "ธรรมะ": "thamma",
    "พระ": "phra", "วัด": "wat", "ตำรวจ": "tamruat", "ทหาร": "thahan",
    "สถานี": "sathani", "สถานีรถไฟ": "sathani rotfai", "สโมสร": "samoson",
    "หนังสือ": "nangsue", "ห้อง": "hong", "ห้องน้ำ": "hongnam",
    "นักเรียน": "nakrian", "นักศึกษา": "naksueksa", "ภูเขา": "phukhao",
    "ทะเล": "thale", "ดอกไม้": "dokmai", "ต้นไม้": "tonmai",
    "ประชาชน": "prachachon", "ครอบครัว": "khropkhrua", "ปลอดภัย": "plotphai"
  };

  let MAX_DICT = 1;
  for (const k of Object.keys(DICT)) if (k.length > MAX_DICT) MAX_DICT = k.length;

  // Longest run of unknown syllables glued into one Latin word before we give
  // up and insert a space. Thai words are almost never longer than this.
  const MAX_BLOB = 5;

  /** Does some word plausibly start at j? Used to confirm a dictionary edge. */
  function startsHere(w, j) {
    if (j >= w.length) return true;
    const ch = w[j];
    if (isLead(ch)) return true;                       // a new syllable, clearly
    if (DIGITS[ch] !== undefined || PUNCT[ch] !== undefined || ch === REPEAT) return true;
    if (ch.charCodeAt(0) < 0x0e00 || ch.charCodeAt(0) > 0x0e7f) return true;
    const maxLen = Math.min(MAX_DICT, w.length - j);
    for (let len = maxLen; len >= 1; len--) {
      if (DICT[w.substr(j, len)] !== undefined && !attaches(w[j + len])) return true;
    }
    const init = readInitial(w, j, false);
    if (init === null) return false;
    const vs = w[init.i];
    // A lone consonant plus a word-final ิ / ุ is the silent Indic ending of
    // the syllable before it (ชาติ chat), not the start of a new word.
    if ((vs === "ิ" || vs === "ุ") && skipTones(w, init.i + 1) >= w.length) return false;
    return isVowelSign(vs);                            // it owns a written vowel
  }

  /**
   * A dictionary match must not cut a syllable in half. ช้า is a word, but the
   * ช้า of ช้าง is not — the ง there is that syllable's final, not a new word.
   * So a match whose end lands inside the syllable the reader would build is
   * only accepted when something else plainly starts at that edge.
   */
  function dictEdgeOk(w, i, len) {
    if (attaches(w[i + len])) return false;
    const syl = readSyllable(w, i);
    if (!syl || syl.i <= i + len) return true;
    return startsHere(w, i + len);
  }

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
        // ๆ repeats the previous word: เด็กๆ -> dek dek
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
      if (isTone(ch) || ch === THANTHAKHAT || ch === PHINTHU || ch === YAMAKKAN) {
        i += 1;   // stray mark with nothing to attach to
        continue;
      }
      if (ch < "฀" || ch > "๿") {
        // Only direct callers can produce this; the router splits on it.
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

      // Dictionary first, longest match wins.
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
        // A short single-word entry landing in the middle of a run is a
        // morpheme, not a word boundary. Thai writes no spaces at all, so
        // inventing one inside ภูเขา or ห้องน้ำ is worse than gluing:
        // phukhao / hongnam, not "phu khao" / "hong nam".
        if (blob && hit.len <= 5 && hit.text.indexOf(" ") === -1) {
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

      i += 1;   // unmapped code point in the block
    }
    flush();

    return tokens
      .join(" ")
      .replace(/\s+([.,])/g, "$1")
      .replace(/  +/g, " ")
      .replace(/[^\x20-\x7E]/g, "")
      .trim();
  }

  const mod = { id: "thai", languages: ["Thai"], ranges, romanize };
  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
