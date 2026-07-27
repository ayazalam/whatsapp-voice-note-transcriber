/**
 * Selector diagnostic — paste into the DevTools console on web.whatsapp.com,
 * with a chat containing voice notes open.
 *
 * Reports DOM STRUCTURE ONLY: tag names, class names, data attributes, whether
 * audio sources are present. It does not read, log, or transmit any message
 * text, contact names, or audio.
 */
(() => {
  const rows = [...document.querySelectorAll('div[role="row"], div[data-id]')].filter(
    (r) => !(r.parentElement && r.parentElement.closest('div[role="row"]'))
  );

  const isVoice = (r) =>
    !!r.querySelector("audio") ||
    !!r.querySelector(
      '[data-icon="ptt-status"], [aria-label="Voice message"], [aria-label="Play voice message"]'
    );

  const voice = rows.filter(isVoice);

  // Rows that look like media but that our detector misses.
  const suspects = rows.filter(
    (r) =>
      !isVoice(r) &&
      /\b(ptt|audio|voice)\b/i.test(
        [...r.querySelectorAll("[data-icon],[aria-label]")]
          .map((e) => (e.getAttribute("data-icon") || "") + " " + (e.getAttribute("aria-label") || ""))
          .join(" ")
      )
  );

  const describe = (row) => {
    const audio = row.querySelector("audio");
    const bubble = row.querySelector(".message-in, .message-out");
    return {
      rowTag: row.tagName + (row.getAttribute("role") ? `[role=${row.getAttribute("role")}]` : ""),
      hasDataId: !!(row.querySelector("[data-id]") || row.closest("[data-id]")),
      bubbleFound: !!bubble,
      bubbleClasses: bubble ? bubble.className.split(/\s+/).slice(0, 6) : null,
      mountChildTag: bubble && bubble.firstElementChild ? bubble.firstElementChild.tagName : null,
      audio: audio
        ? {
            present: true,
            hasSrc: !!audio.src,
            scheme: audio.src ? audio.src.split(":")[0] : null,
            preload: audio.preload,
            duration: Number.isFinite(audio.duration) ? Math.round(audio.duration) : null
          }
        : { present: false },
      icons: [...row.querySelectorAll("[data-icon]")].map((e) => e.getAttribute("data-icon")),
      buttonLabels: [...row.querySelectorAll('button[aria-label], [role="button"][aria-label]')].map(
        (e) => e.getAttribute("aria-label")
      )
    };
  };

  const report = {
    url: location.origin,
    totalRows: rows.length,
    detectedVoiceNotes: voice.length,
    missedSuspects: suspects.length,
    allDataIconsOnPage: [
      ...new Set([...document.querySelectorAll("[data-icon]")].map((e) => e.getAttribute("data-icon")))
    ].sort(),
    samples: voice.slice(0, 3).map(describe),
    missedSamples: suspects.slice(0, 2).map(describe),
    extensionLoaded: !!document.querySelector(".wvt-wrap"),
    extensionButtons: document.querySelectorAll(".wvt-btn").length
  };

  console.log(JSON.stringify(report, null, 2));
  return report;
})();
