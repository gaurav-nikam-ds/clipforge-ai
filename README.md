# ClipForge AI

An independent, open-source-friendly starter for AI captions and clean short-video exports.

## Features in this MVP
- Streamlit creator workspace with responsive layout
- Video upload and preview (MP4, MOV, WebM, M4V)
- Local speech transcription using `faster-whisper`
- Hindi, English, Marathi and other Whisper-supported languages
- Editable caption text and approximate/AI segment timing
- SRT subtitle export
- Subtitle style controls (font, size, colour, outline and placement)
- MP4 rendering through FFmpeg, with no watermark added by the app
- Manual transcript mode when you don't want to run AI transcription

## Important limits
This is an MVP, **not full feature parity with Captik**. Advanced word-level karaoke timing, AI edit planning, automatic silence removal, subject cut-out, keyframes, a timeline editor, licensed sound packs, B-roll generation, cloud accounts, billing, and Adobe/DaVinci plugins are not implemented yet.

A genuinely unlimited public AI video service is not free to operate: CPU/GPU time, storage, bandwidth, and hosting have costs. This starter runs processing on the machine hosting the app. On Streamlit Community Cloud, long renders or model downloads can exceed resource limits. For unlimited personal use, run locally on your own computer with FFmpeg installed.

## Run locally (Windows)
1. Install Python 3.10 or 3.11.
2. Install FFmpeg and ensure `ffmpeg` and `ffprobe` are on PATH.
3. Extract this project and open a terminal in its folder.
4. Create a virtual environment:
   ```powershell
   py -3.11 -m venv .venv
   .venv\Scripts\activate
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   streamlit run app.py
   ```
5. Open the local URL printed by Streamlit.

The first AI transcription may download a model. The `tiny` model is selected by default to reduce CPU/RAM load.

## Deploy on Streamlit Community Cloud
1. Create a public GitHub repository and upload all files.
2. Go to https://share.streamlit.io/ and sign in with GitHub.
3. Choose the repository, branch `main`, and main file `app.py`.
4. Deploy. Keep in mind that hosted CPU/RAM/time limits apply.

`packages.txt` asks the Streamlit build environment to install FFmpeg. If FFmpeg subtitle rendering fails, the host's FFmpeg build may lack the required `libass` support.

## Safety and privacy
Videos are written to temporary files during a session. A public deployment should add explicit retention rules, upload size limits, authentication, rate limiting, and a proper background job queue before real users use it. Do not use this starter to process confidential footage on a public instance.

## Licence
Choose a licence after checking the terms of every dependency and any media assets you add. No third-party sound pack or proprietary template library is bundled here.
