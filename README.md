# Voice Note Transcriber for WhatsApp™

A local, unpacked Chrome extension. Adds a **Transcribe** button under every voice
note on web.whatsapp.com, sends the audio to **ElevenLabs Scribe v2**, and shows the
text right in the chat. The original script is shown by default, with a Latin-letter
view available for supported writing systems.

Hindi voice notes can be read as Hinglish (`kal bhej doonga`). The same Latin-letter
view works for Urdu, Russian, Greek, Korean, Chinese, Thai, Amharic and 25 writing
systems in total. One toggle flips any transcript back to its original script.

Bring your own ElevenLabs API key. Free and open source (MIT). No backend, no
telemetry, no accounts — it runs only in your browser profile, only on
`web.whatsapp.com`, and only talks to `api.elevenlabs.io`.

Scribe v2 auto-detects and transcribes 90+ languages, including files that mix
languages mid-sentence. Language detection is always automatic.

## Install

### From the Chrome Web Store

<https://chromewebstore.google.com/detail/focfcilphmfahkmknffmoaobomgedicn>

### From source

There is no build step, no bundler and no dependencies. What is in this repository is
exactly what runs in the browser, which is the point: you can read every line before
you trust it with your messages.

```bash
git clone https://github.com/ayazalam/whatsapp-voice-note-transcriber.git
```

Then:

1. Open `chrome://extensions`
2. Turn on **Developer mode**, top right
3. Click **Load unpacked** and select the cloned folder, the one containing
   `manifest.json`
4. Click the extension icon, paste your ElevenLabs API key, press **Test key**, then
   **Save**. Get a key at <https://elevenlabs.io/app/settings/api-keys>
5. Reload your WhatsApp Web tab. This step is required, because content scripts only
   inject on page load

The extension runs entirely in your browser. There is no server to host, nothing to
deploy and no account to create. "Self hosting" here just means running your own copy
from source.

### After you change a file

1. Press the reload arrow on the extension's card in `chrome://extensions`
2. Hard refresh the WhatsApp tab with `Ctrl+Shift+R`

Order matters. Reloading the extension orphans the content script already running in
the page, and the orphan will tell you to reload the tab rather than failing silently.

### Running the romanizer outside the browser

Every script module works under plain Node with no install step, which makes it easy
to test a change to a mapping table:

```bash
node -e "
global.window = {};
require('./router.js');
require('./transliterate.js');
require('./scripts/cyrillic.js');
console.log(window.WVT_translit('Здравствуйте, मुझे कल चाहिए'));
"
```

Load only the modules you need. `router.js` splits text by Unicode range and hands each
run to whichever module claims it, so anything unclaimed passes through untouched.

## Use

Click **Transcribe** under any voice note. First run takes a few seconds; after that
the transcript is cached locally and reappears instantly whenever that message
scrolls back into view.

- **Original script / Latin letters** — flip the same transcript between scripts
- **Copy** — copies what's currently displayed
- **Redo** — re-transcribes, ignoring the cache

## How it avoids playing the note

Verified against the live DOM (July 2026), because WhatsApp's actual behaviour is
not what you'd assume:

- Voice-note audio is **not in the page**. `document.querySelectorAll("audio")`
  returns 0 even for a rendered voice note — the waveform is drawn from message
  metadata, and nothing is downloaded until you press play.
- Decryption happens in a **worker**, so the `blob:` URL is minted in a realm the
  main thread never sees. Hooking `URL.createObjectURL` on `window` catches nothing.
- Playback goes through a **detached `new Audio()`** that is never appended to the
  document.

The one choke point that always fires is `HTMLMediaElement.prototype.play()`.
`page-hook.js` patches it: during a capture it reads the `blob:` URL off the
element, fetches the audio, and **returns a resolved promise without calling the
real `play()`**. The audio pipeline is never engaged, so there is no sound — this
isn't muted playback, it's no playback. The `src` setter and the `Audio`
constructor are patched too, to catch the URL even earlier.

Caveat, stated honestly: the extension has to click WhatsApp's own play control to
make it download and decrypt. WhatsApp's internal state machine may therefore mark
the note as played and send a *played* receipt to the sender (blue mic). Suppressing
that would mean tampering with its WebSocket frames, which this doesn't do.

## Reading it in Latin letters

Scribe returns each language in its own script, with code-switched English already in
Latin. The extension romanises only the non-Latin runs, so mixed speech reads naturally:

```
सर वो ऑर्डर अभी तक डिलीवरी नहीं हुआ, कस्टमर बहुत गुस्सा है
→ sir wo order abhi tak delivery nahi hua, customer bohot gussa hai

ok भेज दो, спасибо, 谢谢
→ ok bhej do, spasibo, xie xie
```

Romanisation is rule-based and runs entirely locally — no second API call, no extra cost.

### Writing systems covered

25 modules in `scripts/`, plus Devanagari in `transliterate.js`. Everything already
written in Latin — English, Spanish, French, German, Portuguese, Italian, Dutch, Polish,
Turkish, Vietnamese, Indonesian, Swahili and the rest, roughly half of Scribe's list —
passes through untouched.

| Script | Languages |
| --- | --- |
| Devanagari | Hindi, Marathi, Nepali, Bhojpuri, Maithili, Konkani, Sanskrit |
| Bengali | Bengali, Assamese |
| Gurmukhi / Gujarati / Odia | Punjabi, Gujarati, Odia |
| Tamil / Telugu / Kannada / Malayalam / Sinhala | the five south Indian languages |
| Arabic | Arabic, Urdu, Persian, Pashto, Sindhi, Kashmiri, Uyghur |
| Cyrillic | Russian, Ukrainian, Bulgarian, Serbian, Macedonian, Belarusian, Kazakh, Kyrgyz, Mongolian, Tajik |
| Greek, Hebrew, Georgian, Armenian, Thaana | Greek, Hebrew, Yiddish, Georgian, Armenian, Dhivehi |
| Hangul, Kana, Han | Korean, Japanese, Chinese |
| Thai, Lao, Khmer, Myanmar | Thai, Lao, Khmer, Burmese |
| Ethiopic | Amharic, Tigrinya |

Output is **ASCII only, by design** — `Tokyo`, not `Tōkyō`; `Moskva`, not `Moskvá`. The
point is text you can read at a glance on a phone, so readability beats scholarly
precision everywhere the two conflict. Standards followed: BGN/PCGN for Cyrillic, ELOT 743
for Greek, Revised Romanization for Korean, Hepburn (no macrons) for Japanese, Pinyin (no
tones) for Chinese, RTGS for Thai.

### How the Indic engine works

The Brahmic scripts are abugidas: a consonant carries an inherent vowel, matras replace
it, virama kills it, conjuncts stack. `transliterate.js` syllabifies, then applies Hindi
schwa deletion — word-final, plus the classic `VC_CV` medial rule right-to-left — so
`समझना` → `samajhna`, not `samajhanaa`. Each Brahmic module carries its own tables and
its own schwa behaviour, which differs per language: Bengali's inherent vowel is `o` not
`a` (`কর` → `kor`), Tamil applies positional voicing (`க` is k/g/h by position), and the
south Indian languages mostly don't drop the final vowel at all.

### Known limits

Every module was adversarially verified against reference romanisations. What survived is
documented here rather than hidden — most of it is inherent to the script, not laziness.

- **Arabic script is the weakest** (157/218 reference tests). Short vowels aren't written,
  so `کل` could be *kal*, *kul* or *kil*; a ~1000-word dictionary carries most of the
  quality. Urdu is good (`main kal bhej doon ga, shukriya`), Arabic is decent, **Persian is
  romanised with Urdu vowel colouring** (`kitaab` not `ketab`), and **Pashto is poor**
  (7/23). When the text does carry diacritics, output is much better.
- **Ukrainian vs Russian can't be told apart per word.** `гривня` and `граница` are
  orthographically indistinguishable, so `Ужгород` → `Uzhgorod`, not `Uzhhorod`. The
  Ukrainian mode only fires on words containing і/ї/є/ґ. Not fixable at word granularity.
- **Hebrew unpointed text guesses vowels** (`מלך` → `malakh`, should be `melekh`).
  **Yiddish is materially wrong** — its vowel rules contradict Hebrew's directly.
- **Serbian and Macedonian** have no dedicated mode: `ц` is always `ts`, so `Црвена` →
  `Tsrvena` rather than `Crvena`.
- **Chinese** picks each character's most common reading and spaces syllables
  (`bei jing da xue`); multi-reading characters outside the override table can be wrong.
  Japanese kanji routed here get **Mandarin** readings, which is wrong for Japanese.
- **Greek** polytonic/Ancient text gets modern values; breathings are dropped.

The rest — Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada,
Malayalam, Sinhala, Cyrillic, Greek (modern), Georgian, Armenian, Thaana, Hangul, Kana,
Thai, Lao, Khmer, Myanmar, Ethiopic — passed at or near 100% on reference tests.

### Fixing a word

Every module has a `DICT` of common words that overrides the generic rules. If something
comes out wrong, add the correct spelling there — that's how `पेमेंट` → `payment` and
`ऑर्डर` → `order` work, rather than the literal `pement` and `ordar`.

### Adding a script

Drop a file in `scripts/` that pushes `{ id, languages, ranges, romanize(word) }` onto
`window.WVT_SCRIPTS`, and add it to `content_scripts.js` in the manifest. `router.js`
groups text into runs by claimed Unicode range and dispatches automatically. Modules are
plain vanilla JS with no dependencies and load under bare `node` for testing.

## Settings

Script display and speaker separation save as soon as you change them. Save the API
key separately; **Verify key** checks the value in the field without saving it.

| Setting | What it does |
| --- | --- |
| API key | Stored in `chrome.storage.local`, never leaves your profile except in the request to ElevenLabs |
| Show transcript as | Original script (default), Latin letters, or both stacked |
| Separate speakers | Diarization, for forwarded multi-voice recordings |
| Clear cache | Drops all stored transcripts |

## Cost

Billed per minute of audio by ElevenLabs, at your account's rate. Transcripts are
cached per message, so re-viewing an old note is free.

## License

MIT — see [LICENSE](LICENSE). Not affiliated with or endorsed by WhatsApp, Meta,
or ElevenLabs.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `page-hook.js` | Page-world: retains audio blobs, force-mutes playback during the fallback |
| `content.js` | Finds voice notes, injects UI, extracts audio, renders transcripts |
| `transliterate.js` | Devanagari → Hinglish |
| `background.js` | Calls the ElevenLabs API (holds the key, avoids page CORS/CSP) |
| `options.html` / `options.js` | Settings, also the toolbar popup |

## If a button doesn't appear

WhatsApp Web changes its DOM often. As of July 2026 the extension keys off
`data-icon="ptt-status"` and the aria-labels `Voice message` / `Play voice message`.
Earlier icon names (`audio-play`, `ptt-play`) no longer exist, and the bubble
classes `.message-in` / `.message-out` are gone — rows carry generated atomic
classes instead, so the UI mounts on the row and picks its side geometrically.

If WhatsApp renames things again, update `VOICE_HINTS`, `isVoiceNote()` and
`findPlayButton()` in `content.js`. Run `diagnose.js` in the DevTools console on
web.whatsapp.com to see the current names. After any edit, hit **Reload** on
`chrome://extensions` and refresh the WhatsApp tab.

Watch out: `[aria-label*="play" i]` also matches *"Change playback speed"* — match
the exact label or anchor with `^=`.
