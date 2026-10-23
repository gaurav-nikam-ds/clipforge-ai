import os, re, json, tempfile, subprocess, shutil
from pathlib import Path
import streamlit as st

st.set_page_config(page_title="ClipForge AI", page_icon="🎬", layout="wide", initial_sidebar_state="expanded")

# ---------- Visual system ----------
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
html, body, [class*="css"] {font-family:'DM Sans',sans-serif;}
.stApp {background:radial-gradient(ellipse at 8% 0%, #18233d 0%, #0b1020 38%, #080b14 100%); color:#f4f6ff;}
h1,h2,h3 {font-family:'Space Grotesk',sans-serif; letter-spacing:-.035em;}
.block-container {padding-top:1.5rem; max-width:1400px;}
div[data-testid="stMetric"] {background:#121a2c;border:1px solid #28334b;padding:16px;border-radius:16px;}
div[data-testid="stFileUploader"] {background:#11192b;border:1px dashed #53658a;border-radius:18px;padding:16px;}
.stButton>button, .stDownloadButton>button {border-radius:12px;border:1px solid #3b82f6;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;font-weight:700;min-height:44px;}
.stButton>button:hover,.stDownloadButton>button:hover {border-color:#a5b4fc;color:white;filter:brightness(1.1);}
div[data-testid="stTabs"] button {font-weight:600;}
div[data-testid="stSidebar"] {background:#0d1424;border-right:1px solid #202b40;}
.cf-card {background:linear-gradient(145deg,#141e32,#101525);border:1px solid #283650;border-radius:18px;padding:20px;margin:8px 0;}
.cf-muted {color:#aab6d1;}
.pill {display:inline-block;background:#1b2d4c;border:1px solid #344b70;padding:5px 10px;border-radius:999px;color:#c7d8ff;font-size:12px;margin-right:5px;}
</style>
""", unsafe_allow_html=True)

st.markdown('<span class="pill">✦ AI VIDEO WORKSPACE</span><span class="pill">NO WATERMARKS</span><span class="pill">OPEN-SOURCE FRIENDLY</span>', unsafe_allow_html=True)
st.title("Make every take feel **made for the feed.**")
st.markdown('<p class="cf-muted">Captions, subtitle styling and clean exports in one simple workspace. Built for creators, educators and small teams.</p>', unsafe_allow_html=True)

def has_ffmpeg():
    return shutil.which("ffmpeg") is not None

def run_cmd(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout or "Command failed")[-3000:])
    return p

def fmt_time(seconds):
    seconds=max(0.0,float(seconds))
    h=int(seconds//3600); m=int((seconds%3600)//60); s=seconds%60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".",",")

def srt_from_segments(segments):
    out=[]
    for i, seg in enumerate(segments,1):
        start=fmt_time(seg["start"]); end=fmt_time(seg["end"])
        out.append(f"{i}\n{start} --> {end}\n{seg['text'].strip()}\n")
    return "\n".join(out)

def parse_simple_transcript(text, duration):
    """Create editable approximate timings for manually supplied lines."""
    lines=[x.strip() for x in text.splitlines() if x.strip()]
    if not lines: return []
    # Distribute lines evenly as a practical manual-caption starting point.
    step=max(float(duration)/len(lines),0.5)
    return [{"start":i*step,"end":min((i+1)*step,float(duration)),"text":line} for i,line in enumerate(lines)]

def seconds_to_ass(seconds):
    seconds=max(0,float(seconds)); h=int(seconds//3600); m=int(seconds%3600//60); s=seconds%60
    return f"{h}:{m:02d}:{s:05.2f}"

def write_ass(segments, path, font, size, color, outline, position):
    # ASS uses BGR & alpha. Translate common colors.
    colors={"White":"&H00FFFFFF","Yellow":"&H0000FFFF","Cyan":"&H00FFFF00","Green":"&H0000FF00","Pink":"&H00C0B0FF"}
    align={"Bottom":2,"Middle":5,"Top":8}[position]
    margin_v=55 if position=="Bottom" else (360 if position=="Middle" else 70)
    with open(path,"w",encoding="utf-8-sig") as f:
        f.write("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n")
        f.write("[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
        f.write(f"Style: Default,{font},{size},{colors[color]},&H000000FF,&H00101010,&H80000000,1,0,0,0,100,100,0,0,1,{outline},1,{align},70,70,{margin_v},1\n\n")
        f.write("[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
        for seg in segments:
            text=seg["text"].replace("\n"," ").replace("{","\\\\{").replace("}","\\\\}")
            f.write(f"Dialogue: 0,{seconds_to_ass(seg['start'])},{seconds_to_ass(seg['end'])},Default,,0,0,0,,{text}\n")

def probe_duration(path):
    if not shutil.which("ffprobe"): return 60.0
    p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(path)],capture_output=True,text=True)
    try: return max(float(p.stdout.strip()),1.0)
    except: return 60.0

if "segments" not in st.session_state: st.session_state.segments=[]
if "media_path" not in st.session_state: st.session_state.media_path=None
if "duration" not in st.session_state: st.session_state.duration=60.0

with st.sidebar:
    st.markdown("## 🎛️ Project settings")
    aspect=st.selectbox("Canvas format",["9:16 · Reels / Shorts","16:9 · YouTube","1:1 · Square feed","4:5 · Portrait feed"])
    quality=st.selectbox("Export quality",["1080p","720p","Original resolution"])
    caption_mode=st.selectbox("Caption mode",["Word/line captions","Clean subtitle lines"])
    st.markdown("---")
    st.markdown("### Caption look")
    template=st.selectbox("Style preset",["Creator Bold","Clean Minimal","Neon Pop","Podcast Yellow","Editorial White"])
    font=st.selectbox("Font",["DejaVu Sans","Arial","Liberation Sans","DejaVu Serif"])
    font_size=st.slider("Caption size",28,86,56,2)
    text_color=st.selectbox("Text colour",["White","Yellow","Cyan","Green","Pink"])
    outline=st.slider("Outline thickness",1,8,4)
    position=st.selectbox("Vertical position",["Bottom","Middle","Top"])
    st.caption("Exports are clean by default. No watermark is added by this app.")

left, right = st.columns([1.05,0.95], gap="large")
with left:
    st.markdown("### 01 · Bring your video")
    upload=st.file_uploader("Drop an MP4, MOV, or WebM video here",type=["mp4","mov","webm","m4v"],help="For best results, start with a short clip.")
    if upload:
        suffix=Path(upload.name).suffix or ".mp4"
        if st.session_state.media_path is None or st.session_state.get("uploaded_name") != upload.name:
            tmp=tempfile.NamedTemporaryFile(delete=False,suffix=suffix)
            tmp.write(upload.getbuffer()); tmp.close()
            st.session_state.media_path=tmp.name
            st.session_state.uploaded_name=upload.name
            st.session_state.duration=probe_duration(tmp.name)
            st.session_state.segments=[]
        st.video(upload)
        st.caption(f"**{upload.name}** · Approx. {st.session_state.duration:.1f} seconds")
    else:
        st.markdown('<div class="cf-card"><h3>Drop your take here</h3><p class="cf-muted">MP4 · MOV · WebM · M4V</p><p>Start with a short clip. Add captions, refine wording and export without a watermark.</p></div>',unsafe_allow_html=True)
    st.markdown("### 02 · Generate captions")
    st.write("Choose automatic transcription (requires local model download) or paste your own script.")
    lang=st.selectbox("Spoken language",["Auto detect","Hindi","English","Marathi","Bengali","Gujarati","Kannada","Malayalam","Odia","Punjabi","Tamil","Telugu"])
    model_size=st.selectbox("Local transcription model",["tiny","base","small"],index=0,help="Tiny is fastest on CPU; larger models can be more accurate but slower.")
    if st.button("✨ Transcribe with open-source AI",use_container_width=True,disabled=not bool(st.session_state.media_path)):
        if not has_ffmpeg():
            st.error("FFmpeg was not found. Install FFmpeg and ensure it is on PATH, then restart the app.")
        else:
            try:
                with st.spinner("Loading speech model and transcribing audio… first run downloads model files."):
                    from faster_whisper import WhisperModel
                    compute="int8"
                    model=WhisperModel(model_size,device="cpu",compute_type=compute)
                    lang_map={"Auto detect":None,"Hindi":"hi","English":"en","Marathi":"mr","Bengali":"bn","Gujarati":"gu","Kannada":"kn","Malayalam":"ml","Odia":"or","Punjabi":"pa","Tamil":"ta","Telugu":"te"}
                    lang_code=lang_map.get(lang)
                    results, info=model.transcribe(st.session_state.media_path,language=lang_code,word_timestamps=False,vad_filter=True)
                    st.session_state.segments=[{"start":float(x.start),"end":float(x.end),"text":x.text.strip()} for x in results]
                st.success(f"Transcription complete · detected language: {info.language}")
            except Exception as e:
                st.error(f"Transcription failed: {e}")
    with st.expander("Or paste/edit transcript manually",expanded=not bool(st.session_state.segments)):
        manual=st.text_area("One caption line per row",placeholder="Hello everyone!\nWelcome back to the channel.\nToday we are learning something new.",height=140)
        if st.button("Use manual transcript",use_container_width=True,disabled=not bool(st.session_state.media_path)):
            st.session_state.segments=parse_simple_transcript(manual,st.session_state.duration)
            st.success("Caption lines added. Review their timings in the editor.")

with right:
    st.markdown("### 03 · Edit your captions")
    if st.session_state.segments:
        st.markdown(f'<div class="cf-card"><b>{len(st.session_state.segments)} caption segments</b><br><span class="cf-muted">Edit text and timings before export.</span></div>',unsafe_allow_html=True)
        edited=[]
        for i,seg in enumerate(st.session_state.segments):
            with st.container(border=True):
                c1,c2,c3=st.columns([1,1,3])
                start=c1.number_input("Start (s)",min_value=0.0,value=float(seg["start"]),step=0.1,key=f"start_{i}")
                end=c2.number_input("End (s)",min_value=0.1,value=max(float(seg["end"]),0.1),step=0.1,key=f"end_{i}")
                txt=c3.text_input("Caption",value=seg["text"],key=f"text_{i}")
                edited.append({"start":min(start,end-0.05),"end":max(end,start+0.05),"text":txt})
        st.session_state.segments=edited
        srt=srt_from_segments(edited)
        st.download_button("⬇️ Download SRT subtitles",srt,file_name="clipforge_captions.srt",mime="application/x-subrip",use_container_width=True)
    else:
        st.markdown('<div class="cf-card"><h3>Your captions will appear here</h3><p class="cf-muted">Transcribe with AI or add a manual transcript to start editing.</p><p>✦ Review text and timing<br>✦ Style captions<br>✦ Export MP4 + SRT</p></div>',unsafe_allow_html=True)
    st.markdown("### 04 · Export clean video")
    st.caption("Requires FFmpeg. This starter exports the uploaded video with styled subtitles; advanced keyframes, subject cut-outs and AI B-roll are future modules.")
    if st.button("🎬 Render clean MP4",use_container_width=True,disabled=not bool(st.session_state.media_path and st.session_state.segments)):
        if not has_ffmpeg():
            st.error("FFmpeg is required for video export. Install FFmpeg and restart the app.")
        else:
            try:
                with st.spinner("Rendering video… longer clips take more time on CPU."):
                    with tempfile.TemporaryDirectory() as td:
                        ass_path=os.path.join(td,"captions.ass")
                        out_path=os.path.join(td,"clipforge_export.mp4")
                        write_ass(st.session_state.segments,ass_path,font,font_size,text_color,outline,position)
                        ass_escaped=ass_path.replace("\\","/").replace(":","\\:")
                        vf=f"subtitles='{ass_escaped}'"
                        if quality=="1080p": vf+=",scale=-2:1080"
                        elif quality=="720p": vf+=",scale=-2:720"
                        cmd=["ffmpeg","-y","-i",st.session_state.media_path,"-vf",vf,"-c:v","libx264","-preset","veryfast","-crf","20","-c:a","aac","-b:a","192k","-movflags","+faststart",out_path]
                        run_cmd(cmd)
                        data=Path(out_path).read_bytes()
                st.success("Export ready — no watermark added.")
                st.download_button("⬇️ Download clean MP4",data,file_name="clipforge_export.mp4",mime="video/mp4",use_container_width=True)
            except Exception as e:
                st.error(f"Export failed. Check that FFmpeg includes libass/subtitles support. Details: {e}")

st.markdown("---")
st.markdown("### Built for creators")
m1,m2,m3,m4=st.columns(4)
m1.metric("Watermark","None")
m2.metric("Caption export","SRT")
m3.metric("Processing","Local / open source")
m4.metric("Pricing","Free")
with st.expander("What works now vs. what is planned"):
    st.markdown("""
**Working in this starter**
- Upload and preview video
- Local speech-to-text with faster-whisper (after model download)
- Hindi, English, Marathi and other Whisper-supported languages
- Manual transcript entry and editable caption segments
- Subtitle style controls and SRT download
- FFmpeg MP4 export without a watermark

**Next engineering milestones for a full SaaS product**
- True word-level karaoke captions and 100+ original templates
- Silence removal with adjustable natural/tight modes
- AI edit planner, hook/title cards, smart zooms and B-roll suggestions
- Background removal / subject cut-out for behind-the-person text
- Keyframe timeline, clip split/trim/reorder and audio ducking
- Licensed sound library, custom font uploads and project autosave
- Accounts, cloud projects, job queue, progress reporting and safe storage
- Adobe Premiere Pro / After Effects / DaVinci Resolve integrations

This is an extensible MVP, not a claim of feature parity with Captik yet.
""")
st.caption("ClipForge AI · Independent open-source starter · Do not upload confidential footage to a public deployment.")
