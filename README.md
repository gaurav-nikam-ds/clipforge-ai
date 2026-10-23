# ClipForge AI Studio

An independent creator-first video captioning MVP. The current build focuses on a cleaner workspace, caption editing and subtitle export; it is not a full Captik clone.

## Current workspace
- **Home:** project overview and editing workflow
- **Studio:** upload and preview a video; generate captions with faster-whisper or enter a transcript manually
- **Caption tools:** edit caption text and timing; download SRT subtitles
- **Export & settings:** choose subtitle appearance and render an MP4 with burned-in captions
- Dark responsive layout with consistent navigation and project status

## Implemented features
- Video upload and preview (MP4, MOV, WebM, M4V)
- Local speech transcription using `faster-whisper`
- Hindi, English, Marathi and other supported Whisper languages
- Manual transcript entry with approximate timing
- Editable caption text and segment timings
- SRT subtitle download
- ASS subtitle styling controls (font, size, colour, outline and placement)
- MP4 rendering through FFmpeg, with no watermark added by the app

## Not implemented yet
These are **not** available as working features in this version:
- Timeline editor, clip splitting/trimming/reordering and keyframes
- Word-by-word karaoke captions or a large animated template library
- Automatic silence removal
- AI B-roll generation, smart zoom and subject/background removal
- Licensed sound library, cloud accounts, project autosave, team workspaces or billing
- Adobe Premiere Pro / After Effects / DaVinci Resolve integrations
- Actual canvas conversion/cropping for each aspect ratio (current export preserves source aspect ratio)

A polished UI does not mean an advanced feature is implemented. These modules need separate engineering and testing.

## Resource and hosting limits
A genuinely unlimited public AI video service is not free to operate: CPU/GPU time, storage, bandwidth and hosting have costs. Processing currently runs on the machine hosting the app. On Streamlit Community Cloud, large videos, model downloads or long renders may hit resource limits. For personal use, running locally with FFmpeg avoids some hosted limits, but remains limited by your computer's CPU and RAM.

## Run locally (Windows)
1. Install Python 3.10 or 3.11.
2. Install FFmpeg and ensure `ffmpeg` and `ffprobe` are on PATH.
3. Open a terminal in the project folder.
4. Create and activate a virtual environment:
   ```powershell
   py -3.11 -m venv .venv
   .venv\\Scripts\\activate
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   streamlit run app.py
   ```
5. Open the local URL printed by Streamlit.

The first AI transcription may download model files. The `tiny` model is selected by default to reduce CPU/RAM load.

## Deploy on Streamlit Community Cloud
1. Sign in at https://share.streamlit.io/ with GitHub.
2. Select this repository, branch `main`, and main file `app.py`.
3. Deploy or reboot the existing app to pull the latest commit.
4. Check the app logs if the build fails.

`packages.txt` requests FFmpeg in the build environment. If subtitle rendering fails, the host's FFmpeg build may lack `libass` support.

## Privacy
Videos are written to temporary files during a session. Before inviting real users, add explicit retention rules, upload size limits, authentication, rate limiting, durable storage controls and a background job queue. Do not upload confidential footage to a public deployment.

## Licence
Choose a licence after checking the terms of every dependency and any media assets you add. No third-party sound pack or proprietary template library is bundled here.
