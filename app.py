import os, tempfile, subprocess, shutil, html
from pathlib import Path
import streamlit as st

st.set_page_config(page_title="ClipForge AI Studio", page_icon="🎬", layout="wide", initial_sidebar_state="expanded")

# ---------- App state ----------
DEFAULTS = {"segments": [], "media_path": None, "duration": 60.0, "uploaded_name": None, "project_name": "Untitled project", "page": "Studio"}
for key, value in DEFAULTS.items():
    if key not in st.session_state:
        st.session_state[key] = value

# ---------- Design system ----------
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
:root{--bg:#090b10;--panel:#11151d;--panel2:#171d28;--line:#283142;--muted:#9ba8bc;--text:#f3f5fb;--accent:#9b87ff;--accent2:#6c5ce7;}
html,body,[class*="css"]{font-family:'DM Sans',sans-serif}
.stApp{background:radial-gradient(ellipse at 80% -20%,#202043 0%,transparent 42%),var(--bg);color:var(--text)}
.block-container{max-width:1540px;padding-top:1.35rem;padding-bottom:3rem}
h1,h2,h3{font-family:'Space Grotesk',sans-serif;letter-spacing:-.035em}
h1{font-size:2.5rem!important;font-weight:700}
h2{font-size:1.55rem!important} h3{font-size:1.08rem!important}
p,li{color:#d1d7e3}
div[data-testid="stSidebar"]{background:#0d1017;border-right:1px solid #252c39}
div[data-testid="stSidebar"] .block-container{padding-top:1.2rem}
.stButton>button,.stDownloadButton>button{border-radius:10px;border:1px solid #7666e8;background:linear-gradient(135deg,#7c6cf0,#5c4bd6);color:#fff;font-weight:700;min-height:42px;transition:all .15s}
.stButton>button:hover,.stDownloadButton>button:hover{border-color:#b4aaff;color:white;filter:brightness(1.1)}
.stButton>button:disabled{background:#242936;border-color:#343b49;color:#6f7889}
div[data-testid="stFileUploader"]{background:#131925;border:1px dashed #4a5570;border-radius:14px;padding:12px}
div[data-testid="stMetric"]{background:#131925;border:1px solid #283142;padding:14px 16px;border-radius:13px}
div[data-testid="stTabs"] button{font-weight:600}
div[data-testid="stTextInput"] input,div[data-testid="stNumberInput"] input,div[data-testid="stTextArea"] textarea{background:#0e131c;border-color:#30394a;border-radius:9px}
div[data-testid="stSelectbox"] div[data-baseweb="select"]>div{background:#111722;border-color:#30394a;border-radius:9px}
hr{border-color:#242c3b}
.cf-brand{font:700 1.15rem 'Space Grotesk';letter-spacing:-.04em;color:#fff;padding:8px 0 18px}
.cf-logo{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#9b87ff,#5c4bd6);margin-right:8px}
.cf-eyebrow{font-size:.72rem;letter-spacing:.14em;font-weight:700;text-transform:uppercase;color:#a99cff}
.cf-muted{color:var(--muted)!important}
.cf-panel{background:linear-gradient(145deg,#151b27,#10141d);border:1px solid #2a3343;border-radius:16px;padding:20px}
.cf-panel-soft{background:#111722;border:1px solid #252e3d;border-radius:13px;padding:16px}
.cf-chip{display:inline-block;border:1px solid #3a365f;background:#211e3b;color:#c8c0ff;padding:4px 9px;border-radius:999px;font-size:.72rem;font-weight:700;margin-right:5px}
.cf-step{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#292448;color:#c5baff;font-weight:700;margin-right:8px}
[data-testid="stExpander"]{border:1px solid #283142;border-radius:12px}
small{color:var(--muted)}
</style>
""", unsafe_allow_html=True)

def has_ffmpeg():
    return shutil.which("ffmpeg") is not None

def run_cmd(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError((p.stderr or p.stdout or "Command failed")[-2500:])
    return p

def fmt_time(seconds):
    seconds=max(0.0,float(seconds)); h=int(seconds//3600); m=int((seconds%3600)//60); s=seconds%60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".",",")

def srt_from_segments(segments):
    return "\n\n".join(f"{i}\n{fmt_time(seg['start'])} --> {fmt_time(seg['end'])}\n{seg['text'].strip()}" for i,seg in enumerate(segments,1))

def parse_simple_transcript(text, duration):
    lines=[x.strip() for x in text.splitlines() if x.strip()]
    if not lines: return []
    step=max(float(duration)/len(lines),0.5)
    return [{"start":i*step,"end":min((i+1)*step,float(duration)),"text":line} for i,line in enumerate(lines)]

def seconds_to_ass(seconds):
    seconds=max(0,float(seconds)); h=int(seconds//3600); m=int(seconds%3600//60); s=seconds%60
    return f"{h}:{m:02d}:{s:05.2f}"

def write_ass(segments, path, font, size, color, outline, position):
    colors={"White":"&H00FFFFFF","Yellow":"&H0000FFFF","Cyan":"&H00FFFF00","Green":"&H0000FF00","Pink":"&H00C0B0FF"}
    align={"Bottom":2,"Middle":5,"Top":8}[position]
    margin_v=55 if position=="Bottom" else (360 if position=="Middle" else 70)
    with open(path,"w",encoding="utf-8-sig") as f:
        f.write("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n")
        f.write("[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
        f.write(f"Style: Default,{font},{size},{colors[color]},&H000000FF,&H00101010,&H80000000,1,0,0,0,100,100,0,0,1,{outline},1,{align},70,70,{margin_v},1\n\n")
        f.write("[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
        for seg in segments:
            txt=seg["text"].replace("\n"," ").replace("{","\\{").replace("}","\\}")
            f.write(f"Dialogue: 0,{seconds_to_ass(seg['start'])},{seconds_to_ass(seg['end'])},Default,,0,0,0,,{txt}\n")

def probe_duration(path):
    if not shutil.which("ffprobe"): return 60.0
    p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(path)],capture_output=True,text=True)
    try: return max(float(p.stdout.strip()),1.0)
    except (ValueError, TypeError): return 60.0

# ---------- Sidebar navigation ----------
with st.sidebar:
    st.markdown('<div class="cf-brand"><span class="cf-logo">✦</span>ClipForge <span style="color:#a99cff">AI</span></div>',unsafe_allow_html=True)
    st.markdown('<div class="cf-eyebrow">WORKSPACE</div>',unsafe_allow_html=True)
    page=st.radio("Main navigation",["Home","Studio","Caption tools","Export & settings"],index=["Home","Studio","Caption tools","Export & settings"].index(st.session_state.page) if st.session_state.page in ["Home","Studio","Caption tools","Export & settings"] else 1,label_visibility="collapsed")
    st.session_state.page=page
    st.markdown("---")
    st.markdown('<div class="cf-eyebrow">CURRENT PROJECT</div>',unsafe_allow_html=True)
    st.session_state.project_name=st.text_input("Project name",value=st.session_state.project_name,label_visibility="collapsed",placeholder="Untitled project")
    if st.session_state.media_path:
        st.success("Video loaded",icon="✓")
        st.caption(f"{st.session_state.duration:.1f}s · {len(st.session_state.segments)} caption segments")
    else:
        st.caption("No video in this project yet.")
    st.markdown("---")
    st.caption("CLIPFORGE AI · EARLY ACCESS")
    st.caption("Local processing where supported. Don't upload confidential footage to a public deployment.")

# ---------- Page: Home ----------
if page == "Home":
    st.markdown('<span class="cf-chip">AI VIDEO WORKSPACE</span><span class="cf-chip">NO WATERMARK EXPORT</span>',unsafe_allow_html=True)
    st.title("Your next edit starts here.")
    st.markdown('<p class="cf-muted">Turn raw footage into captioned content with a simpler, creator-first workflow.</p>',unsafe_allow_html=True)
    st.markdown("")
    hero_left, hero_right = st.columns([1.25,0.75],gap="large")
    with hero_left:
        st.markdown('<div class="cf-panel"><div class="cf-eyebrow">CREATOR STUDIO</div><h2 style="font-size:2rem!important">Less editing busywork.<br>More time for the story.</h2><p class="cf-muted">Upload a clip, generate a transcript, style subtitles and export a clean MP4 — all from one workspace.</p></div>',unsafe_allow_html=True)
        if st.button("＋  Start a new edit",use_container_width=True):
            st.session_state.page="Studio"
            st.rerun()
    with hero_right:
        st.markdown('<div class="cf-panel"><div class="cf-eyebrow">YOUR WORKSPACE</div><h3>Project overview</h3>',unsafe_allow_html=True)
        st.metric("Current project", "Ready" if st.session_state.media_path else "Not started")
        st.metric("Caption segments",len(st.session_state.segments))
        st.metric("Export engine","FFmpeg ready" if has_ffmpeg() else "Needs FFmpeg")
        st.markdown('</div>',unsafe_allow_html=True)
    st.markdown("### A simple editing workflow")
    steps=st.columns(4)
    for col,num,title,desc in [
        (steps[0],"01","Upload","Bring in an MP4, MOV or WebM clip."),
        (steps[1],"02","Transcribe","Create captions with Whisper or add text manually."),
        (steps[2],"03","Refine","Edit the words, timings and caption look."),
        (steps[3],"04","Export","Download an SRT or rendered MP4.")
    ]:
        with col:
            st.markdown(f'<div class="cf-panel-soft"><div class="cf-eyebrow">{num}</div><h3>{title}</h3><p class="cf-muted">{desc}</p></div>',unsafe_allow_html=True)
    st.markdown("### Tools in this build")
    toolcols=st.columns(3)
    for col,title,desc,status in [
        (toolcols[0],"AI captions","Speech-to-text with a local Whisper model.","Available"),
        (toolcols[1],"Caption editor","Edit subtitle text and timing segments.","Available"),
        (toolcols[2],"Clean export","SRT download and MP4 subtitle rendering.","Available when FFmpeg is installed")
    ]:
        with col:
            st.markdown(f'<div class="cf-panel-soft"><h3>{title}</h3><p class="cf-muted">{desc}</p><span class="cf-chip">{status}</span></div>',unsafe_allow_html=True)

# ---------- Page: Studio ----------
elif page == "Studio":
    st.markdown('<div class="cf-eyebrow">EDITING WORKSPACE</div>',unsafe_allow_html=True)
    st.title(st.session_state.project_name or "Untitled project")
    st.markdown('<p class="cf-muted">Upload → transcribe → refine → export. Your current project stays in this session.</p>',unsafe_allow_html=True)
    upload_col, preview_col = st.columns([0.9,1.1],gap="large")
    with upload_col:
        st.markdown('<div class="cf-step">1</div> **Import media**',unsafe_allow_html=True)
        upload=st.file_uploader("Choose a video file",type=["mp4","mov","webm","m4v"],help="For best performance, test with a short clip.")
        if upload:
            if st.session_state.get("uploaded_name") != upload.name:
                suffix=Path(upload.name).suffix or ".mp4"
                tmp=tempfile.NamedTemporaryFile(delete=False,suffix=suffix)
                tmp.write(upload.getbuffer()); tmp.close()
                st.session_state.media_path=tmp.name
                st.session_state.uploaded_name=upload.name
                st.session_state.duration=probe_duration(tmp.name)
                st.session_state.segments=[]
            st.markdown(f'<div class="cf-panel-soft"><b>{html.escape(upload.name)}</b><br><span class="cf-muted">{st.session_state.duration:.1f} seconds · video loaded</span></div>',unsafe_allow_html=True)
        elif st.session_state.media_path:
            st.info(f"Loaded file: {st.session_state.uploaded_name or 'Video'}")
        else:
            st.markdown('<div class="cf-panel"><h3>Drop your video here</h3><p class="cf-muted">MP4 · MOV · WebM · M4V</p><p>Start with a short clip to keep processing fast.</p></div>',unsafe_allow_html=True)
        st.markdown('<div class="cf-step">2</div> **Generate captions**',unsafe_allow_html=True)
        lang=st.selectbox("Spoken language",["Auto detect","Hindi","English","Marathi","Bengali","Gujarati","Kannada","Malayalam","Odia","Punjabi","Tamil","Telugu"])
        model_size=st.selectbox("Transcription model",["tiny","base","small"],index=0,help="Tiny is the fastest CPU option; larger models may improve accuracy but use more memory.")
        if st.button("✦ Generate AI captions",use_container_width=True,disabled=not bool(st.session_state.media_path)):
            if not has_ffmpeg():
                st.error("FFmpeg is required for transcription. Check the deployment packages and restart.")
            else:
                try:
                    with st.spinner("Loading the speech model and transcribing… the first run downloads model files."):
                        from faster_whisper import WhisperModel
                        model=WhisperModel(model_size,device="cpu",compute_type="int8")
                        lang_map={"Auto detect":None,"Hindi":"hi","English":"en","Marathi":"mr","Bengali":"bn","Gujarati":"gu","Kannada":"kn","Malayalam":"ml","Odia":"or","Punjabi":"pa","Tamil":"ta","Telugu":"te"}
                        results,info=model.transcribe(st.session_state.media_path,language=lang_map.get(lang),word_timestamps=False,vad_filter=True)
                        st.session_state.segments=[{"start":float(x.start),"end":float(x.end),"text":x.text.strip()} for x in results]
                    st.success(f"Transcription complete · detected language: {info.language}")
                    st.rerun()
                except Exception as e:
                    st.error(f"Transcription failed: {e}")
        with st.expander("Add captions manually"):
            manual=st.text_area("One caption line per row",placeholder="Hello everyone!\nWelcome back to the channel.",height=120)
            if st.button("Create timed caption lines",use_container_width=True,disabled=not bool(st.session_state.media_path)):
                st.session_state.segments=parse_simple_transcript(manual,st.session_state.duration)
                st.success("Caption lines created. Review them in Caption tools.")
    with preview_col:
        st.markdown('<div class="cf-step">PREVIEW</div> **Video preview**',unsafe_allow_html=True)
        if upload:
            st.video(upload)
        elif st.session_state.media_path and Path(st.session_state.media_path).exists():
            st.video(st.session_state.media_path)
        else:
            st.markdown('<div class="cf-panel" style="min-height:260px;text-align:center;padding-top:70px"><div style="font-size:2rem">▶</div><h3>Preview will appear here</h3><p class="cf-muted">Import a video to start your edit.</p></div>',unsafe_allow_html=True)
        m1,m2,m3=st.columns(3)
        m1.metric("Duration",f"{st.session_state.duration:.1f}s" if st.session_state.media_path else "—")
        m2.metric("Captions",len(st.session_state.segments))
        m3.metric("Export engine","Ready" if has_ffmpeg() else "Unavailable")

# ---------- Page: Caption tools ----------
elif page == "Caption tools":
    st.markdown('<div class="cf-eyebrow">TRANSCRIPT & SUBTITLE CONTROL</div>',unsafe_allow_html=True)
    st.title("Caption tools")
    st.markdown('<p class="cf-muted">Review the transcript, adjust timing, then download subtitles or move to export.</p>',unsafe_allow_html=True)
    if not st.session_state.media_path:
        st.warning("First import a video in Studio.")
        if st.button("Go to Studio"):
            st.session_state.page="Studio"; st.rerun()
    if st.session_state.segments:
        st.markdown(f'<div class="cf-panel-soft"><b>{len(st.session_state.segments)} caption segments</b><br><span class="cf-muted">Changes apply to the current session. Keep timings in seconds.</span></div>',unsafe_allow_html=True)
        edited=[]
        for i,seg in enumerate(st.session_state.segments):
            with st.container(border=True):
                st.caption(f"CAPTION {i+1:03d}")
                a,b=st.columns([1,1])
                start=a.number_input("Start time (seconds)",min_value=0.0,value=max(0.0,float(seg["start"])),step=0.1,key=f"cap_start_{i}")
                end=b.number_input("End time (seconds)",min_value=0.1,value=max(float(seg["end"]),0.1),step=0.1,key=f"cap_end_{i}")
                txt=st.text_area("Caption text",value=seg["text"],height=68,key=f"cap_text_{i}")
                start=min(start,max(0.0,st.session_state.duration-0.05))
                end=max(end,start+0.05)
                edited.append({"start":start,"end":end,"text":txt.strip()})
        st.session_state.segments=edited
        c1,c2=st.columns(2)
        c1.download_button("Download SRT subtitles",srt_from_segments(edited),file_name="clipforge_captions.srt",mime="application/x-subrip",use_container_width=True)
        if c2.button("Go to Export & settings",use_container_width=True):
            st.session_state.page="Export & settings"; st.rerun()
        with st.expander("Replace transcript with manual text"):
            replacement=st.text_area("One caption line per row",height=130)
            if st.button("Replace caption segments"):
                st.session_state.segments=parse_simple_transcript(replacement,st.session_state.duration)
                st.rerun()
    else:
        st.markdown('<div class="cf-panel"><h3>No captions yet</h3><p class="cf-muted">Generate captions in Studio or paste a transcript there to start editing.</p></div>',unsafe_allow_html=True)
        if st.button("Open Studio"):
            st.session_state.page="Studio"; st.rerun()

# ---------- Page: Export & settings ----------
elif page == "Export & settings":
    st.markdown('<div class="cf-eyebrow">STYLE & DELIVERY</div>',unsafe_allow_html=True)
    st.title("Export & settings")
    st.markdown('<p class="cf-muted">Choose a caption style, then render a clean MP4. Export is processed by FFmpeg on the hosting machine.</p>',unsafe_allow_html=True)
    settings, summary=st.columns([1,0.8],gap="large")
    with settings:
        st.markdown('<div class="cf-panel-soft"><h3>Canvas & quality</h3></div>',unsafe_allow_html=True)
        aspect=st.selectbox("Canvas format",["9:16 · Reels / Shorts","16:9 · YouTube","1:1 · Square feed","4:5 · Portrait feed"])
        quality=st.selectbox("Output resolution",["Original resolution","1080p","720p"])
        st.markdown('<div class="cf-panel-soft"><h3>Subtitle appearance</h3></div>',unsafe_allow_html=True)
        template=st.selectbox("Style preset",["Creator Bold","Clean Minimal","Neon Pop","Podcast Yellow","Editorial White"])
        font=st.selectbox("Font",["DejaVu Sans","Arial","Liberation Sans","DejaVu Serif"])
        font_size=st.slider("Caption size",28,86,56,2)
        text_color=st.selectbox("Text colour",["White","Yellow","Cyan","Green","Pink"])
        outline=st.slider("Outline thickness",1,8,4)
        position=st.selectbox("Vertical position",["Bottom","Middle","Top"])
    with summary:
        st.markdown('<div class="cf-panel"><div class="cf-eyebrow">EXPORT CHECKLIST</div><h3>Ready when you are</h3></div>',unsafe_allow_html=True)
        st.metric("Source video","Loaded" if st.session_state.media_path else "Missing")
        st.metric("Caption segments",len(st.session_state.segments))
        st.metric("FFmpeg", "Available" if has_ffmpeg() else "Not found")
        if not st.session_state.media_path: st.warning("Import a video in Studio first.")
        if not st.session_state.segments: st.warning("Generate or add captions before rendering.")
        st.caption("No watermark is added by this app. Export time depends on video length and server resources.")
    st.markdown("---")
    disabled=not bool(st.session_state.media_path and st.session_state.segments)
    if st.button("Render clean MP4",use_container_width=True,disabled=disabled):
        if not has_ffmpeg():
            st.error("FFmpeg is required for video export.")
        else:
            try:
                with st.spinner("Rendering video… keep this page open while the export runs."):
                    with tempfile.TemporaryDirectory() as td:
                        ass_path=os.path.join(td,"captions.ass")
                        out_path=os.path.join(td,"clipforge_export.mp4")
                        write_ass(st.session_state.segments,ass_path,font,font_size,text_color,outline,position)
                        ass_escaped=ass_path.replace("\\","/").replace(":","\\:")
                        vf=f"subtitles='{ass_escaped}'"
                        # Preserve source aspect ratio by default; explicit canvas cropping is not yet implemented.
                        if quality=="1080p": vf+=",scale=-2:1080"
                        elif quality=="720p": vf+=",scale=-2:720"
                        cmd=["ffmpeg","-y","-i",st.session_state.media_path,"-vf",vf,"-c:v","libx264","-preset","veryfast","-crf","20","-c:a","aac","-b:a","192k","-movflags","+faststart",out_path]
                        run_cmd(cmd)
                        data=Path(out_path).read_bytes()
                st.success("Export finished. No watermark was added.")
                st.download_button("Download clean MP4",data,file_name="clipforge_export.mp4",mime="video/mp4",use_container_width=True)
            except Exception as e:
                st.error(f"Export failed. FFmpeg may lack subtitle/libass support. Details: {e}")
    with st.expander("Feature availability — honest status"):
        st.markdown("""
**Implemented in this build**
- Video upload and preview
- Whisper speech-to-text (first use downloads a model)
- Manual transcript entry and editable caption text/timing
- SRT subtitle download
- ASS-styled subtitle burn-in and MP4 export, without an app watermark

**Not implemented yet**
- Timeline with clip splitting, trimming and keyframes
- Word-by-word karaoke animation and a large template library
- Automatic silence removal
- AI B-roll generation, smart zoom and subject/background removal
- Audio library, cloud accounts, project autosave and multi-user storage

Canvas format is currently a planning setting; export preserves the source aspect ratio. Those features need separate implementation rather than decorative buttons.
""")

st.markdown("---")
st.caption("ClipForge AI Studio · Creator-first editing MVP · Independent project, not affiliated with Captik.")
