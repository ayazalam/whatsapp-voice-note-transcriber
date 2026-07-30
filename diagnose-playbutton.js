/**
 * Play-control diagnostic. Paste into the DevTools console on web.whatsapp.com
 * with a voice note visible. Reports DOM STRUCTURE ONLY: tag names, roles,
 * aria-labels, data-icon values. No message text, no contact names, no audio.
 *
 * Result is copied to the clipboard.
 */
copy(
  JSON.stringify(
    (() => {
      const rows = [...document.querySelectorAll('div[role="row"], div[data-id]')].filter(
        (r) => !(r.parentElement && r.parentElement.closest('div[role="row"]'))
      );

      const isVoice = (r) =>
        !!r.querySelector(
          '[data-icon="ptt-status"], [aria-label*="voice" i], [aria-label*="voz" i], [role="slider"]'
        );

      const row = rows.find(isVoice);
      if (!row) return { error: 'no voice note row found', totalRows: rows.length };

      const describe = (el) => ({
        tag: el.tagName,
        role: el.getAttribute('role') || null,
        label: el.getAttribute('aria-label') || null,
        dataIcon: el.getAttribute('data-icon') || null,
        hasSvg: !!el.querySelector('svg'),
        isSvg: el.tagName === 'svg',
        text: (el.textContent || '').trim().slice(0, 24) || null,
        clickable:
          el.tagName === 'BUTTON' ||
          el.getAttribute('role') === 'button' ||
          typeof el.onclick === 'function' ||
          el.hasAttribute('tabindex')
      });

      // Everything in the row that could plausibly be the play control.
      const candidates = [...row.querySelectorAll('*')]
        .filter(
          (el) =>
            el.tagName === 'BUTTON' ||
            el.getAttribute('role') === 'button' ||
            el.hasAttribute('data-icon') ||
            el.hasAttribute('aria-label') ||
            el.hasAttribute('tabindex')
        )
        .slice(0, 30)
        .map(describe);

      // What the current selectors actually return.
      const iconOnly = [...row.querySelectorAll('button, [role="button"]')]
        .filter((b) => {
          if (b.getAttribute('role') === 'slider' || b.closest('[role="slider"]')) return false;
          if ((b.textContent || '').trim()) return false;
          return !!b.querySelector('svg');
        })
        .map(describe);

      const slider = row.querySelector('[role="slider"]');

      return {
        pageLang: document.documentElement.lang || null,
        translated: !!document.querySelector('html.translated-ltr, html.translated-rtl'),
        buttonCount: row.querySelectorAll('button').length,
        roleButtonCount: row.querySelectorAll('[role="button"]').length,
        svgCount: row.querySelectorAll('svg').length,
        sliderFound: !!slider,
        sliderLabel: slider ? slider.getAttribute('aria-label') : null,
        iconOnlyMatches: iconOnly,
        allDataIcons: [...row.querySelectorAll('[data-icon]')].map((e) =>
          e.getAttribute('data-icon')
        ),
        candidates
      };
    })(),
    null,
    2
  )
);
