/**
 * CJK and fullwidth punctuation -> ASCII.
 *
 * These live outside the ideograph and kana blocks, so no script module claims
 * them and they'd otherwise survive romanisation: 你好，我是 -> "ni hao，wo shi".
 *
 * Deliberately does NOT claim U+FF65-FF9F (halfwidth katakana) — that belongs to
 * the kana module.
 */
(() => {
  "use strict";

  const MAP = {
    "　": " ", // ideographic space
    "、": ", ",
    "。": ". ",
    "〃": '"',
    "〈": "<",
    "〉": ">",
    "《": "<",
    "》": ">",
    "「": '"',
    "」": '"',
    "『": '"',
    "』": '"',
    "【": "[",
    "】": "]",
    "〔": "[",
    "〕": "]",
    "〖": "[",
    "〗": "]",
    "〘": "[",
    "〙": "]",
    "〚": "[",
    "〛": "]",
    "〜": "~",
    "〝": '"',
    "〞": '"',
    "・": " ",
    "…": "...",
    "‥": "..",

    // Fullwidth clause punctuation. These would otherwise fall through to the
    // generic fullwidth->ASCII shift and lose their trailing space, running the
    // next romanised run straight into them ("ni hao,wo shi").
    "，": ", ",
    "．": ". ",
    "！": "! ",
    "？": "? ",
    "：": ": ",
    "；": "; ",
    "】": "] ",
    "］": "] ",
    "｝": "} ",
    "）": ") "
  };

  const ranges = [
    [0x3000, 0x303f], // CJK symbols and punctuation
    [0xff01, 0xff64], // fullwidth forms, stopping before halfwidth katakana
    [0xffe0, 0xffee] // fullwidth signs
  ];

  function one(ch) {
    if (Object.prototype.hasOwnProperty.call(MAP, ch)) return MAP[ch];

    const cp = ch.codePointAt(0);

    // Fullwidth ASCII (！ through ～) is plain ASCII shifted by 0xFEE0.
    if (cp >= 0xff01 && cp <= 0xff5e) return String.fromCharCode(cp - 0xfee0);

    // Fullwidth currency and signs.
    if (cp === 0xffe0) return "c";
    if (cp === 0xffe1) return "GBP";
    if (cp === 0xffe5) return "JPY";
    if (cp === 0xffe6) return "KRW";
    if (cp >= 0xffe2 && cp <= 0xffee) return "";

    // Anything unmapped in these blocks is punctuation we don't need.
    return " ";
  }

  function romanize(run) {
    let out = "";
    for (const ch of run) out += one(ch);
    return out;
  }

  const mod = {
    id: "punctuation",
    languages: ["Chinese", "Japanese", "Korean"],
    ranges,
    romanize
  };

  if (typeof window !== "undefined") (window.WVT_SCRIPTS = window.WVT_SCRIPTS || []).push(mod);
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
})();
