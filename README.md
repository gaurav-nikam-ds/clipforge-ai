# ClipForge AI Studio

ClipForge now contains two application entry points:

- **Browser frontend:** `index.html`, `styles.css`, `app.js` — a redesigned multi-section creator workspace.
- **Streamlit prototype:** `app.py` — the earlier Python captioning MVP with local faster-whisper transcription and FFmpeg subtitle burn-in.

The new browser frontend is the intended UI direction. It is a client-side foundation, not a claim of full feature parity with Captik.

## Browser frontend: features that work
- Responsive, dark creator workspace with Home, Video Editor, Captions, Templates, AI Edit Planner, Sounds, Projects and Export pages
- Video upload, drag-and-drop, local video preview and metadata
- Manual caption entry with approximate timings
- Edit caption text and segment start/end times
- Import and export SRT subtitle files
- Six original caption-style presets, colour/size/position controls and live caption preview
- Aspect-ratio canvas selection for browser rendering (9:16, 16:9, 1:1 and 4:5)
- Browser-based WebM recording with caption burn-in where MediaRecorder and video stream capture are supported
- Local project snapshots in browser localStorage (caption text/settings only, not the video file)
- Edit brief planner and sound-cue planning list

## Known limitations — not implemented as production features
- Automatic transcription of uploaded files is **not connected** in the new browser frontend.
- AI translation, Hinglish normalization and word-level timestamps are not implemented in that frontend.
- AI edit planner creates a written draft; it does not automatically make cuts, zooms or B-roll.
- The sound page is a cue-planning list; no licensed audio files are bundled.
- Silence detection/removal, subject cut-outs, camera tracking, AI B-roll generation, clip split/reorder, keyframes, animated karaoke word tracking and a 100+ template library are not implemented in the browser frontend.
- Browser export is WebM, not MP4. Browser/device support and performance vary; long videos can use substantial memory. The selected aspect ratio is applied to the render canvas using a cover crop.
- The browser snapshot saves project metadata, not media bytes. Re-import the video before rendering after a page reload.
- No accounts, cloud project storage, billing, team workspaces, background job queue or editor integrations are provided.

The Streamlit prototype remains available through `app.py` and retains its own processing path, but it does not automatically share project state with the browser frontend.

## Deploy the new frontend on Vercel
1. Open Vercel and create a **new project** from this GitHub repository.
2. Use the repository root as the **Root Directory**.
3. Choose the static/no-framework deployment (no build command is required; the entry page is `index.html`).
4. Deploy. Vercel serves the browser frontend from `index.html`.
5. Keep in mind: your existing Streamlit deployment will continue to run `app.py`. It will not turn into this frontend automatically.

The repository root contains Python and Streamlit files for the old deployment, so if Vercel's framework detection selects Python unexpectedly, choose the static/no-framework option and leave the root directory as `.`.

## Run the Streamlit prototype locally
1. Install Python 3.10 or 3.11 and FFmpeg (`ffmpeg` and `ffprobe` on PATH).
2. Run:
   ```powershell
   py -3.11 -m venv .venv
   .venv\Scripts\activate
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   streamlit run app.py
   ```

The first faster-whisper transcription downloads model files. The `tiny` model is selected by default to reduce CPU/RAM usage.

## Production requirements still needed
Before turning this into a public AI editing SaaS, connect a transcription/render backend, add secure authentication, upload limits, private media storage with retention rules, a background render queue, real progress reporting, automated tests and operational monitoring. AI/GPU processing, storage and bandwidth have ongoing costs, so unlimited public usage cannot be promised without infrastructure and a usage policy.

## Privacy
The new browser frontend does not upload media to a ClipForge backend. Browser-local project snapshots are not encrypted or permanent. The Streamlit prototype writes temporary files on its hosting machine; avoid uploading confidential footage to public deployments.

## Licence
Check dependency licences and any media assets before choosing a project licence. No proprietary Captik assets or licensed sound library are included.
