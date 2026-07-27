# Privacy Policy

**Voice Note Transcriber for WhatsApp™**
Last updated: 27 July 2026

## Short version

This extension has no backend, no analytics, and no developer-side data collection.
Nothing is sent to the developer — ever. The only network request it makes is from your
own browser to ElevenLabs, using your own API key, when you click Transcribe.

## What the extension handles

**Your ElevenLabs API key.** Stored in `chrome.storage.local`, which lives only in your
browser profile on your device. It is sent to `api.elevenlabs.io` to authenticate your
transcription requests and to nowhere else. The developer never receives it and has no
means of receiving it.

**Voice note audio.** When — and only when — you click the Transcribe button on a specific
voice note, that note's audio is read from the page and sent directly from your browser to
the ElevenLabs Speech-to-Text API for transcription. It is not stored by the extension, not
uploaded anywhere else, and not routed through any server operated by the developer.

**Transcripts.** The resulting text is cached in `chrome.storage.local` on your device so
that revisiting a message does not re-transcribe it. You can erase all cached transcripts
at any time with the "Clear cache" button in the extension's settings. Uninstalling the
extension deletes them too.

## What the extension does not do

- Does not collect, transmit, or store any data on developer-controlled servers
- Does not include analytics, telemetry, crash reporting, or advertising
- Does not read, index, or transmit your messages, contacts, or chat history
- Does not transcribe anything automatically — every transcription is one deliberate click
- Does not sell or share data with anyone (there is no data to sell or share)
- Does not load or execute remote code; all code ships inside the extension package

## Third-party processing

Audio you choose to transcribe is processed by **ElevenLabs** under your own account and
their terms and privacy policy: <https://elevenlabs.io/privacy>. Your relationship for that
processing is directly with ElevenLabs. The developer of this extension is not a party to
it and receives no copy of the audio or the transcript.

## Permissions and why they exist

| Permission | Why |
| --- | --- |
| `storage` | Save your API key, your display preferences, and cached transcripts locally |
| `https://web.whatsapp.com/*` | Add the Transcribe button to voice notes and read the audio of the note you click |
| `https://api.elevenlabs.io/*` | Send that audio to ElevenLabs for transcription with your key |

## Source code

The complete source is public and MIT licensed. Every claim above can be verified by
reading it — there is no minified or obfuscated code in the package.

## Contact

Questions or concerns: open an issue on the GitHub repository.
