# ClipForge AI Studio

ClipForge AI is a browser-first video editing and captioning prototype. It has two separate entry points:

- **Browser editor:** `index.html`, `styles.css`, `app.js`, `editor-upgrade.js` — the main creator workspace.
- **Streamlit prototype:** `app.py` — a separate Python captioning MVP with local faster-whisper transcription and FFmpeg subtitle burn-in.

The browser editor is not yet a full CapCut replacement. Features below are classified by implementation status so the interface and documentation do not overpromise.

## Browser editor — implemented in code

- Responsive creator workspace: Home, Video Editor, Captions, Templates, AI Edit Planner, Sounds, Projects, Export & Settings.
- Local video upload, drag-and-drop, preview and basic media metadata.
- Manual caption creation/editing and timing controls; SRT import/export.
- Six caption-style presets with colour, size and position controls.
- Canvas aspect ratios: 9:16, 16:9, 1:1 and 4:5.
- Browser recording to **WebM** with caption burn-in on supported browsers.
- Trim range, ordered source-time clip sequence, split/remove/reorder controls.
- Timeline caption retiming by dragging caption blocks.
- Local silence analysis using Web Audio; detected quiet ranges are omitted from the clip sequence.
- Optional local Whisper transcription using Transformers.js. The model is downloaded on first use and can be slow or fail due to browser/device memory, codec or network constraints.
- Optional user-provided music track and volume control, mixed into export where supported.
- Brightness, contrast and saturation adjustments applied to preview/export.
- Optional animated word highlighting using estimated word timing, not true word-level alignment.
- Local project snapshots in browser storage. Snapshots store metadata/caption settings, not the video file.
- AI edit brief and sound cue planning. These are planning aids, not automatic AI editing or a bundled licensed sound library.

**Implementation is not the same as verified production behaviour.** The browser editor still requires real-media end-to-end checks for rendering, audio synchronization, silence removal, trim boundaries, clip ordering and local transcription.

## Not implemented as production features

- MP4 export from the browser editor.
- Accurate word-level timestamps/forced alignment.
- AI translation, Hindi-English/Hinglish normalization, speaker diarization or robust multilingual transcription workflows.
- Real transitions/effect library, keyframes, motion tracking, subject cutout, background removal or AI-generated B-roll.
- Automatic scene understanding and reliable one-click AI edits.
- Full multi-track compositing for arbitrary video, overlay, title and audio layers.
- Cloud accounts, cross-device project sync, private media storage, team collaboration or background render jobs.
- Production monitoring, usage quotas, billing or a scalable hosted AI inference service.

## Run browser smoke tests

Node.js 20+ is recommended.

```bash
npm install
npx playwright install --with-deps chromium
npm run test:e2e
```

GitHub Actions runs the smoke tests on pushes and pull requests to `main`. These tests cover basic navigation and control visibility; they do **not** prove that a full video render, audio mix, transcription or export is correct. Those need dedicated media fixtures and browser-level assertions.

## Deploy the browser editor to Vercel

Use the repository root as the root directory and configure Vercel for a static/no-framework site with `index.html` as the entry point. No build command is required for the static frontend.

The repository also contains the Streamlit prototype. If Vercel detects the Python app, select the static/no-framework option. A Streamlit deployment will continue to run `app.py`; it will not automatically become the browser editor.

Live URL (deployment status should be checked in Vercel): https://clipforge-g0xrz6kds-gaurav-nikam-ds.vercel.app/

## Run the Streamlit prototype locally

Install Python 3.10 or 3.11 and FFmpeg (`ffmpeg` and `ffprobe` on PATH), then:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
streamlit run app.py
```

The first faster-whisper transcription downloads model files. The `tiny` model is selected by default to reduce CPU/RAM use.

## Production-readiness checklist

Before calling this a reliable public editor, complete and verify:

1. Real-media tests for video-only and audio-bearing clips, multiple source ranges, trim boundaries, caption burn-in, background music and playback-rate changes.
2. Transcription tests covering first-run model download, unsupported media, network failure, memory pressure and empty/low-confidence results.
3. Cross-browser/device checks, especially mobile Safari and low-memory Android devices.
4. Rendering failure recovery, cancellation, progress accuracy, cleanup of object URLs/audio contexts and clear user-facing errors.
5. Accessible controls, keyboard navigation, focus states and responsive timeline behaviour.
6. Security/privacy review before adding server uploads or accounts; define media retention and deletion.
7. If cloud rendering is added, provide a job queue, limits, monitoring and cost controls.

Unlimited public cloud AI usage cannot be promised without unlimited compute, storage and bandwidth funding. Local browser processing reduces server costs but still depends on the user's hardware and browser support.

## Privacy

The browser editor does not currently upload media to a ClipForge backend. Browser storage is local to the device/browser and is not a permanent or encrypted cloud backup. The Streamlit prototype processes temporary files on its hosting machine; do not upload confidential footage to a public demo without reviewing its hosting/privacy setup.

## Licensing

Review dependency licences and all media assets before selecting a project licence. No proprietary Captik assets or licensed sound library are included.
