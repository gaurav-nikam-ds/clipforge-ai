(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const video = $("#sourceVideo");
  window.__cfSourceFile = null;
  if (!video) return;

  // Adds real, client-side editing controls to the existing ClipForge editor.
  const panel = document.createElement("div");
  panel.className = "cf-edit-tools";
  panel.innerHTML = `
    <div class="cf-tools-head"><strong>Quick edit tools</strong><span>Local · no API required</span></div>
    <div class="cf-tools-grid">
      <label>Preview speed
        <select id="cfSpeed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1× Normal</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
      </label>
      <label>Jump to (seconds)
        <input id="cfSeek" type="number" min="0" step="0.1" value="0">
      </label>
    </div>
    <div class="cf-tools-actions">
      <button type="button" id="cfSplit">Split caption at playhead</button>
      <button type="button" id="cfDuplicate">Duplicate caption</button>
      <button type="button" id="cfMerge">Merge with previous</button>
      <button type="button" id="cfJump">Go to time</button><button type="button" id="cfTranscribe">Transcribe locally (AI)</button>
    </div>
    <p id="cfTranscribeStatus" class="cf-tools-note">Local AI transcription downloads an open-source model to your browser on first use. It can be slow and needs sufficient RAM.</p><p class="cf-tools-note">Caption split/merge edits are applied to the current caption track. Speed changes the preview and is used during browser recording export. This is not a full multi-clip video timeline yet.</p>`;
  const mediaPanel = $(".media-panel");
  if (mediaPanel) mediaPanel.appendChild(panel);

  const style = document.createElement("style");
  style.textContent = `
    .cf-edit-tools{margin-top:12px;padding:14px;border:1px solid #343044;border-radius:12px;background:linear-gradient(135deg,#191722,#14151c);color:#ece9f6}
    .cf-tools-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
    .cf-tools-head strong{font-size:12px}.cf-tools-head span,.cf-tools-note{font-size:9px;color:#9291a4}
    .cf-tools-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .cf-tools-grid label{font-size:10px;color:#a9a6ba;display:grid;gap:6px}
    .cf-tools-grid select,.cf-tools-grid input{width:100%;min-width:0;background:#101117;border:1px solid #363542;border-radius:7px;padding:9px;color:#f2effa}
    .cf-tools-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
    .cf-tools-actions button{background:#262136;border:1px solid #4b3d66;border-radius:7px;padding:8px 10px;color:#d8c9ff;font-size:10px;cursor:pointer}
    .cf-tools-actions button:hover{border-color:#ac91ff}.cf-tools-note{line-height:1.6;margin:10px 0 0}
  `;
  document.head.appendChild(style);

  const state = () => {
    // app.js keeps its state private; read the visible selected caption row as the source of truth.
    const item = $(".caption-item.selected") || $(".caption-item");
    const index = item ? [...document.querySelectorAll(".caption-item")].indexOf(item) : -1;
    const text = item?.querySelector("[data-text]");
    const start = item?.querySelector("[data-start]");
    const end = item?.querySelector("[data-end]");
    return { item, index, text, start, end };
  };
  const notify = (message) => {
    const toast = $("#toast");
    if (toast) { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2400); }
  };
  const fire = (element, eventName) => element?.dispatchEvent(new Event(eventName, { bubbles: true }));

  $("#cfSpeed").addEventListener("change", (e) => {
    video.playbackRate = Number(e.target.value) || 1;
    notify("Playback speed set to " + e.target.value + "×");
  });
  video.addEventListener("timeupdate", () => { $("#cfSeek").value = (video.currentTime || 0).toFixed(2); });


  let localTranscriber = null;
  $("#cfTranscribe")?.addEventListener("click", async () => {
    const button=$("#cfTranscribe"),status=$("#cfTranscribeStatus"),file=window.__cfSourceFile;
    if(!file)return notify("Import a video before transcription");
    if(!$("#manualTranscript")){notify("Open the Captions page once and try again");return}
    button.disabled=true;status.textContent="Preparing audio for local transcription…";
    let audioCtx;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)throw new Error("Web Audio is not supported in this browser.");
      audioCtx=new Ctx();
      const decoded=await audioCtx.decodeAudioData((await file.arrayBuffer()).slice(0));
      const targetRate=16000,outputLength=Math.ceil(decoded.duration*targetRate),mono=new Float32Array(outputLength);
      for(let ch=0;ch<decoded.numberOfChannels;ch++){
        const source=decoded.getChannelData(ch),ratio=decoded.sampleRate/targetRate;
        for(let i=0;i<outputLength;i++){
          const pos=i*ratio,left=Math.floor(pos),right=Math.min(source.length-1,left+1),fraction=pos-left;
          mono[i]+=((source[left]||0)*(1-fraction)+(source[right]||0)*fraction)/decoded.numberOfChannels;
        }
      }
      status.textContent="Loading Whisper model. First use may download over 100 MB; keep this tab open.";
      if(!localTranscriber){
        const mod=await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
        localTranscriber=await mod.pipeline("automatic-speech-recognition","Xenova/whisper-tiny",{progress_callback:p=>{
          if(p&&p.status)status.textContent="Loading local AI model: "+p.status+(p.file?" · "+p.file:"");
        }});
      }
      status.textContent="Transcribing locally. Longer videos may take several minutes…";
      const result=await localTranscriber(mono,{sampling_rate:targetRate,return_timestamps:true,chunk_length_s:30,stride_length_s:5});
      const chunks=Array.isArray(result.chunks)?result.chunks.filter(x=>x.text&&x.text.trim()):[];
      const toStamp=n=>{n=Math.max(0,Number(n)||0);const ms=Math.round(n*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),z=ms%1000;return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+","+String(z).padStart(3,"0")};
      let srtText="";
      if(chunks.length){
        srtText=chunks.map((x,i)=>{const t=x.timestamp||[0,decoded.duration],a=Number.isFinite(t[0])?t[0]:0,b=Number.isFinite(t[1])?t[1]:Math.min(decoded.duration,a+3);return (i+1)+"\n"+toStamp(a)+" --> "+toStamp(Math.max(a+.1,b))+"\n"+x.text.trim()}).join("\n\n");
      }else{
        const text=String(result.text||"").trim();
        if(!text)throw new Error("No speech was detected. Try a clearer clip or a different language.");
        srtText="1\n"+toStamp(0)+" --> "+toStamp(decoded.duration)+"\n"+text;
      }
      const srtFile=new File([srtText],"clipforge-transcript.srt",{type:"application/x-subrip"});
      const input=$("#srtFile"),dt=new DataTransfer();dt.items.add(srtFile);input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
      status.textContent="Transcription complete · "+(chunks.length||1)+" timed segment(s). Review and correct names, punctuation and timings before export.";
      notify("Local AI transcript created");
    }catch(err){
      status.textContent="Transcription failed: "+(err&&err.message?err.message:"model or audio error")+". Try Chrome/Edge, a shorter video, or use the manual/SRT workflow.";
    }finally{if(audioCtx)await audioCtx.close().catch(()=>{});button.disabled=false;}
  });

  $("#cfJump").addEventListener("click", () => {
    const t = Math.max(0, Number($("#cfSeek").value) || 0);
    if (Number.isFinite(video.duration)) video.currentTime = Math.min(t, video.duration);
    else video.currentTime = t;
    notify("Moved playhead to " + t.toFixed(1) + "s");
  });

  $("#cfSplit").addEventListener("click", () => {
    const s = state();
    const t = video.currentTime || 0;
    if (!s.item || !s.start || !s.end || !s.text) return notify("Add or select a caption first");
    const a = Number(s.start.value), b = Number(s.end.value);
    if (t <= a + 0.08 || t >= b - 0.08) return notify("Playhead must be inside the selected caption");
    s.end.value = t.toFixed(2);
    fire(s.end, "change");
    const add = $("#addCaption");
    if (add) add.click();
    setTimeout(() => {
      const items = [...document.querySelectorAll(".caption-item")];
      const next = items[items.length - 1];
      if (!next) return;
      const nextText = next.querySelector("[data-text]");
      const nextStart = next.querySelector("[data-start]");
      const nextEnd = next.querySelector("[data-end]");
      if (nextText) { nextText.value = s.text.value; fire(nextText, "input"); }
      if (nextStart) { nextStart.value = t.toFixed(2); fire(nextStart, "change"); }
      if (nextEnd) { nextEnd.value = b.toFixed(2); fire(nextEnd, "change"); }
      notify("Caption split at " + t.toFixed(2) + "s");
    }, 80);
  });

  $("#cfDuplicate").addEventListener("click", () => {
    const s = state();
    if (!s.item || !s.text || !s.start || !s.end) return notify("Add or select a caption first");
    const text = s.text.value, start = Number(s.end.value), end = start + Math.max(0.2, Number(s.end.value) - Number(s.start.value));
    $("#addCaption")?.click();
    setTimeout(() => {
      const items = [...document.querySelectorAll(".caption-item")], next = items[items.length - 1];
      if (!next) return;
      const t = next.querySelector("[data-text]"), a = next.querySelector("[data-start]"), b = next.querySelector("[data-end]");
      if (t) { t.value = text; fire(t, "input"); }
      if (a) { a.value = start.toFixed(2); fire(a, "change"); }
      if (b) { b.value = end.toFixed(2); fire(b, "change"); }
      notify("Caption duplicated after selected line");
    }, 80);
  });

  $("#cfMerge").addEventListener("click", () => {
    const s = state();
    const items = [...document.querySelectorAll(".caption-item")];
    if (s.index <= 0 || !s.item) return notify("Select a caption after the first line");
    const prev = items[s.index - 1];
    const prevText = prev?.querySelector("[data-text]");
    const prevEnd = prev?.querySelector("[data-end]");
    if (!prevText || !prevEnd || !s.text || !s.end) return notify("Could not find adjacent captions");
    prevText.value = (prevText.value.trim() + " " + s.text.value.trim()).trim();
    prevEnd.value = s.end.value;
    fire(prevText, "input"); fire(prevEnd, "change");
    const del = s.item.querySelector("[data-delete]");
    del?.click();
    notify("Merged caption into previous line");
  });

  // Multi-track timeline: seek the source video and reposition timed caption clips by dragging.
  const oldTimeline = $(".timeline-panel");
  const multi = document.createElement("div");
  multi.className = "cf-multitrack";
  multi.innerHTML = `
    <div class="cf-mt-head"><div><strong>Timeline · multi-track view</strong><small>Split, remove, reorder source clips · drag captions to retime</small></div><span id="cfMtDuration">00:00</span></div><div class="cf-clip-actions"><button type="button" id="cfSplitVideo">Split video at playhead</button><button type="button" id="cfRemoveVideo">Remove selected clip</button><button type="button" id="cfMoveClipLeft">Move clip left</button><button type="button" id="cfMoveClipRight">Move clip right</button><button type="button" id="cfResetClips">Reset video edits</button><button type="button" id="cfDetectSilence">Detect & remove silence</button></div><div class="cf-silence-settings"><label>Silence threshold (dB) <input id="cfSilenceDb" type="number" min="-70" max="-15" value="-42" step="1"></label><label>Minimum silence (sec) <input id="cfSilenceMin" type="number" min="0.2" max="5" value="0.6" step="0.1"></label></div><div class="cf-clip-sequence" id="cfClipSequence"></div>
    <div class="cf-mt-scroll"><div class="cf-mt-ruler" id="cfMtRuler"></div>
      <div class="cf-mt-lane"><div class="cf-mt-label">VIDEO</div><div class="cf-mt-track" id="cfMtVideo"><div class="cf-mt-video-clip">Source video · full clip</div></div></div>
      <div class="cf-mt-lane"><div class="cf-mt-label">CAPTIONS</div><div class="cf-mt-track" id="cfMtCaptions"></div></div>
    </div>
    <p class="cf-mt-status" id="cfMtStatus">Import a video to create a timeline.</p>`;
  if (oldTimeline) oldTimeline.appendChild(multi);
  const mtStyle = document.createElement("style");
  mtStyle.textContent = `
    .cf-multitrack{margin-top:16px;padding:14px;border:1px solid #30303e;border-radius:12px;background:#101117;color:#f0eef7}
    .cf-mt-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}
    .cf-mt-head strong{display:block;font-size:12px}.cf-mt-head small,.cf-mt-status{display:block;color:#9998ac;font-size:10px;line-height:1.6;margin-top:5px}
    .cf-mt-head>span{font-size:11px;color:#c4b4ff;white-space:nowrap}
    .cf-mt-scroll{overflow-x:auto;padding-bottom:4px}.cf-mt-ruler,.cf-mt-lane{min-width:600px;width:100%;display:grid;grid-template-columns:72px minmax(520px,1fr);gap:8px}
    .cf-mt-ruler{height:24px;position:relative;margin-bottom:5px}.cf-mt-tick{position:absolute;top:0;font-size:9px;color:#85859a;transform:translateX(-50%)}
    .cf-mt-lane{margin:7px 0;align-items:stretch}.cf-mt-label{font-size:9px;letter-spacing:.08em;color:#a5a3b7;display:flex;align-items:center}
    .cf-mt-track{height:42px;position:relative;border:1px solid #30303b;border-radius:7px;background:repeating-linear-gradient(90deg,#171821 0,#171821 calc(10% - 1px),#292936 calc(10% - 1px),#292936 10%);overflow:visible}
    .cf-mt-video-clip{position:absolute;inset:4px 0;background:linear-gradient(90deg,#393052,#4a3b6b);border:1px solid #7d68ac;border-radius:5px;padding:7px 10px;font-size:10px;color:#e9ddff;overflow:hidden;white-space:nowrap}
    .cf-mt-caption{position:absolute;top:5px;height:30px;min-width:12px;border:1px solid #9b83e8;border-radius:5px;background:#65509a;color:white;font-size:9px;padding:0 5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:grab;touch-action:none;user-select:none}
    .cf-mt-caption.selected{outline:2px solid #d5c5ff;z-index:2}.cf-mt-caption:active{cursor:grabbing}
    .cf-mt-playhead{position:absolute;top:-1px;bottom:-1px;width:2px;background:#ff9b78;z-index:5;pointer-events:none}
    .cf-mt-status{margin-bottom:0}.cf-clip-actions{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.cf-clip-actions button{background:#22202e;border:1px solid #4a405f;border-radius:7px;padding:7px 9px;color:#ded3ff;font-size:10px;cursor:pointer}.cf-silence-settings{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}.cf-silence-settings label{font-size:10px;color:#aaa7bb;display:flex;align-items:center;gap:7px}.cf-silence-settings input{width:72px;background:#101117;border:1px solid #363542;border-radius:6px;padding:6px;color:#f2effa}.cf-clip-sequence{display:flex;gap:7px;overflow-x:auto;padding:4px 0 8px}.cf-seq-clip{flex:0 0 150px;min-width:120px;text-align:left;padding:9px;background:#252137;border:1px solid #5c4b7c;border-radius:8px;color:#f2eaff;cursor:pointer}.cf-seq-clip.selected{outline:2px solid #c2aaff}.cf-seq-clip small{display:block;color:#b0a6c8;font-size:9px;margin-top:5px}
  `;
  document.head.appendChild(mtStyle);
  const fmtMt = (n) => { n=Math.max(0,Number(n)||0); return String(Math.floor(n/60)).padStart(2,"0")+":"+String(Math.floor(n%60)).padStart(2,"0"); };
  const mtDuration = () => Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;

  // Non-destructive source clip sequence. Each item references a range in the original file.
  let clipSequence = [];
  let selectedClip = 0;
  let clipSequenceDuration = 0;
  const cloneSequence = () => clipSequence.map(x=>({start:x.start,end:x.end}));
  window.__cfGetClipSequence = () => cloneSequence();
  window.__cfResetClipSequence = () => { clipSequence=[];selectedClip=0;clipSequenceDuration=0;renderMultiTrack(); };
  function ensureClipSequence() {
    const d=mtDuration();
    if(d>0 && (!clipSequence.length || Math.abs(clipSequenceDuration-d)>.05)){
      clipSequence=[{start:0,end:d}];selectedClip=0;clipSequenceDuration=d;
    }
  }
  function renderClipSequence() {
    const host=$("#cfClipSequence");if(!host)return;ensureClipSequence();host.innerHTML="";
    if(!clipSequence.length){host.textContent="Import a video to create editable clips.";return;}
    clipSequence.forEach((clip,i)=>{
      const b=document.createElement("button");b.type="button";b.className="cf-seq-clip"+(i===selectedClip?" selected":"");
      b.innerHTML="<strong>Clip "+(i+1)+"</strong><small>"+fmtMt(clip.start)+" – "+fmtMt(clip.end)+" · "+(clip.end-clip.start).toFixed(1)+"s</small>";
      b.addEventListener("click",()=>{selectedClip=i;video.currentTime=clip.start;renderMultiTrack();});host.appendChild(b);
    });
    const track=$("#cfMtVideo");if(track){
      track.querySelectorAll(".cf-mt-source-segment").forEach(e=>e.remove());
      const base=track.querySelector(".cf-mt-video-clip");if(base)base.style.display="none";
      const d=mtDuration();
      clipSequence.forEach((clip,i)=>{
        const b=document.createElement("button");b.type="button";b.className="cf-mt-source-segment"+(i===selectedClip?" selected":"");
        b.textContent="Clip "+(i+1);b.title=clip.start.toFixed(2)+"–"+clip.end.toFixed(2)+" seconds";
        b.style.cssText="position:absolute;top:4px;bottom:4px;left:"+(d?clip.start/d*100:0)+"%;width:"+(d?(clip.end-clip.start)/d*100:100)+"%;min-width:18px;overflow:hidden;white-space:nowrap;background:"+(i===selectedClip?"#7659b5":"#43345f")+";border:1px solid #9c83dc;border-radius:5px;color:#fff;font-size:9px;cursor:pointer";
        b.addEventListener("click",e=>{e.stopPropagation();selectedClip=i;video.currentTime=clip.start;renderMultiTrack();});track.appendChild(b);
      });
    }
  }
  $("#cfSplitVideo")?.addEventListener("click",()=>{
    ensureClipSequence();const clip=clipSequence[selectedClip],t=video.currentTime;
    if(!clip||t<=clip.start+.12||t>=clip.end-.12){$("#cfMtStatus").textContent="Move the playhead inside the selected clip before splitting.";return;}
    const second={start:t,end:clip.end};clip.end=t;clipSequence.splice(selectedClip+1,0,second);selectedClip++;
    renderMultiTrack();$("#cfMtStatus").textContent="Source clip split at "+t.toFixed(2)+"s. Both clips remain editable.";
  });
  $("#cfRemoveVideo")?.addEventListener("click",()=>{
    if(!clipSequence.length)return;clipSequence.splice(selectedClip,1);selectedClip=Math.max(0,Math.min(selectedClip,clipSequence.length-1));renderMultiTrack();
    $("#cfMtStatus").textContent=clipSequence.length?"Clip removed from the export sequence.":"All video clips removed; reset edits to restore the source.";
  });
  $("#cfMoveClipLeft")?.addEventListener("click",()=>{
    if(selectedClip<=0)return;[clipSequence[selectedClip-1],clipSequence[selectedClip]]=[clipSequence[selectedClip],clipSequence[selectedClip-1]];selectedClip--;renderMultiTrack();
  });
  $("#cfMoveClipRight")?.addEventListener("click",()=>{
    if(selectedClip<0||selectedClip>=clipSequence.length-1)return;[clipSequence[selectedClip+1],clipSequence[selectedClip]]=[clipSequence[selectedClip],clipSequence[selectedClip+1]];selectedClip++;renderMultiTrack();
  });
  $("#cfResetClips")?.addEventListener("click",()=>{clipSequence=[];selectedClip=0;ensureClipSequence();renderMultiTrack();$("#cfMtStatus").textContent="Source video restored as one full-length clip.";});

  $("#cfDetectSilence")?.addEventListener("click",async()=>{
    if(!video.src||!video.duration)return notify("Import a video first");
    const button=$("#cfDetectSilence"),status=$("#cfMtStatus"),original=button.textContent;
    if(!window.AudioContext&&!window.webkitAudioContext)return notify("This browser does not support local audio analysis");
    button.disabled=true;button.textContent="Analyzing audio…";status.textContent="Decoding the audio locally in your browser. Large videos may need time and memory.";
    let audioCtx;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;audioCtx=new Ctx();
      const buffer=await video.src.startsWith("blob:")?await (async()=>{const file=video.files?.[0];return file?file.arrayBuffer():null})():null;
      // The original File object is retained by the main editor; use the local file reference when exposed.
      const file=window.__cfSourceFile;
      const bytes=buffer|| (file?await file.arrayBuffer():null);
      if(!bytes)throw new Error("The local source file is unavailable for audio analysis. Re-import the video and try again.");
      const decoded=await audioCtx.decodeAudioData(bytes.slice(0));
      const threshold=Math.pow(10,(Math.max(-70,Math.min(-15,Number($("#cfSilenceDb").value)||-42)))/20);
      const minSilence=Math.max(.2,Math.min(5,Number($("#cfSilenceMin").value)||.6));
      const step=.1,total=decoded.duration,windows=Math.ceil(total/step),rms=new Float32Array(windows);
      for(let ch=0;ch<decoded.numberOfChannels;ch++){
        const data=decoded.getChannelData(ch);
        for(let i=0;i<windows;i++){
          const a=Math.floor(i*step*decoded.sampleRate),b=Math.min(data.length,Math.floor((i+1)*step*decoded.sampleRate));
          let sum=0;for(let j=a;j<b;j++)sum+=data[j]*data[j];rms[i]+=b>a?Math.sqrt(sum/(b-a))/decoded.numberOfChannels:0;
        }
      }
      const silent=[];let run=-1;
      for(let i=0;i<=windows;i++){
        const quiet=i<windows&&rms[i]<threshold;
        if(quiet&&run<0)run=i;
        if(!quiet&&run>=0){const a=run*step,b=Math.min(total,i*step);if(b-a>=minSilence)silent.push({start:a,end:b});run=-1;}
      }
      if(!silent.length){status.textContent="No silence longer than "+minSilence.toFixed(1)+"s found at "+$("#cfSilenceDb").value+" dB. No edits made.";return;}
      ensureClipSequence();
      const kept=[];
      for(const clip of clipSequence){
        let cursor=clip.start;
        for(const gap of silent){
          if(gap.end<=cursor||gap.start>=clip.end)continue;
          const gapStart=Math.max(clip.start,gap.start),gapEnd=Math.min(clip.end,gap.end);
          if(gapStart>cursor+.05)kept.push({start:cursor,end:gapStart});
          cursor=Math.max(cursor,gapEnd);
        }
        if(clip.end>cursor+.05)kept.push({start:cursor,end:clip.end});
      }
      const removed=clipSequence.reduce((sum,x)=>sum+x.end-x.start,0)-kept.reduce((sum,x)=>sum+x.end-x.start,0);
      if(!kept.length)throw new Error("The selected settings marked the entire clip as silence. Adjust the threshold and retry.");
      clipSequence=kept;selectedClip=Math.min(selectedClip,clipSequence.length-1);renderMultiTrack();
      status.textContent="Removed "+silent.length+" detected silence region(s) · "+removed.toFixed(1)+"s removed. Export will use the edited clip sequence.";
    }catch(err){status.textContent="Silence detection failed: "+(err.message||"audio decode error");}
    finally{if(audioCtx)await audioCtx.close().catch(()=>{});button.disabled=false;button.textContent=original;}
  });


  function renderMultiTrack() {
    ensureClipSequence();
    const duration = mtDuration(), ruler=$("#cfMtRuler"), videoTrack=$("#cfMtVideo"), capTrack=$("#cfMtCaptions");
    if (!ruler || !videoTrack || !capTrack) return;
    $("#cfMtDuration").textContent=fmtMt(duration);
    ruler.innerHTML="";
    const ticks=Math.max(1,Math.ceil(duration/5));
    for(let i=0;i<=ticks;i++){
      const sec=Math.min(duration,i*5),tick=document.createElement("span");
      tick.className="cf-mt-tick";tick.style.left=(duration?sec/duration*100:0)+"%";tick.textContent=fmtMt(sec);ruler.appendChild(tick);
    }
    const oldClip=videoTrack.querySelector(".cf-mt-video-clip");
    if(oldClip){oldClip.style.left="0";oldClip.style.width="100%";oldClip.textContent=video.src?(video.currentSrc.split("/").pop().split("?")[0]||"Source video · full clip"):"No video loaded";}
    videoTrack.querySelectorAll(".cf-mt-playhead").forEach(e=>e.remove());
    capTrack.innerHTML="";
    const items=[...document.querySelectorAll(".caption-item")];
    items.forEach((item,i)=>{
      const text=item.querySelector("[data-text]"),start=item.querySelector("[data-start]"),end=item.querySelector("[data-end]");
      if(!text||!start||!end)return;
      const a=Math.max(0,Number(start.value)||0),b=Math.max(a+.1,Number(end.value)||a+.1),block=document.createElement("button");
      block.type="button";block.className="cf-mt-caption"+(item.classList.contains("selected")?" selected":"");
      block.textContent=text.value||("Caption "+(i+1));block.title=(text.value||"Caption")+" · "+a.toFixed(2)+"–"+b.toFixed(2)+"s";
      block.style.left=(duration?Math.min(100,a/duration*100):0)+"%";
      block.style.width=(duration?Math.max(1,(b-a)/duration*100):8)+"%";
      block.addEventListener("click",()=>{video.currentTime=Math.min(a,duration||a);item.click();renderMultiTrack();});
      block.addEventListener("pointerdown",e=>{
        if(!duration)return;
        e.preventDefault();e.stopPropagation();
        const track=capTrack.getBoundingClientRect(),originX=e.clientX,originA=Number(start.value)||0,originB=Number(end.value)||originA+.1;
        block.setPointerCapture?.(e.pointerId);
        const move=ev=>{const delta=(ev.clientX-originX)/track.width*duration;const na=Math.max(0,Math.min(duration-(originB-originA),originA+delta));block.style.left=(na/duration*100)+"%";block.dataset.pendingStart=String(na);};
        const up=ev=>{
          block.removeEventListener("pointermove",move);block.removeEventListener("pointerup",up);block.removeEventListener("pointercancel",up);
          const na=Number(block.dataset.pendingStart);
          if(Number.isFinite(na)){start.value=na.toFixed(2);end.value=Math.min(duration,na+(originB-originA)).toFixed(2);fire(start,"change");fire(end,"change");video.currentTime=na;renderMultiTrack();}
        };
        block.addEventListener("pointermove",move);block.addEventListener("pointerup",up);block.addEventListener("pointercancel",up);
      });
      capTrack.appendChild(block);
    });
    renderClipSequence();
    const pct=duration?Math.min(100,video.currentTime/duration*100):0;
    [videoTrack,capTrack].forEach(track=>{const line=document.createElement("div");line.className="cf-mt-playhead";line.style.left=pct+"%";track.appendChild(line);});
    $("#cfMtStatus").textContent=duration?("Playhead "+video.currentTime.toFixed(2)+"s · "+items.length+" caption clip(s). Drag blocks horizontally to retime them. Video source is one clip in this build."): "Import a video to create a timeline.";
  }
  $("#cfMtVideo")?.addEventListener("click",e=>{const duration=mtDuration();if(!duration)return;const rect=e.currentTarget.getBoundingClientRect();video.currentTime=Math.max(0,Math.min(duration,(e.clientX-rect.left)/rect.width*duration));});
  video.addEventListener("loadedmetadata",renderMultiTrack);
  video.addEventListener("timeupdate",()=>{const duration=mtDuration();if(!duration)return;const pct=Math.min(100,video.currentTime/duration*100);document.querySelectorAll(".cf-mt-playhead").forEach(line=>line.style.left=pct+"%");$("#cfMtStatus").textContent="Playhead "+video.currentTime.toFixed(2)+"s · drag caption blocks to retime.";});
  const mtObserver=new MutationObserver(()=>renderMultiTrack());
  const capList=$("#captionList");if(capList)mtObserver.observe(capList,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class"]});
  window.addEventListener("resize",renderMultiTrack);
  setTimeout(renderMultiTrack,250);

  // Export trim points are persisted as UI values and consumed by app.js during recording.
  const trimStart = $("#cfTrimStart"), trimEnd = $("#cfTrimEnd"), trimSummary = $("#cfTrimSummary");
  const updateTrimSummary = () => {
    if (!trimStart || !trimEnd || !trimSummary) return;
    const a = Math.max(0, Number(trimStart.value) || 0);
    const b = Number(trimEnd.value) > 0 ? Number(trimEnd.value) : (Number.isFinite(video.duration) ? video.duration : 0);
    trimSummary.textContent = b > a ? ("Export range: " + a.toFixed(1) + "s – " + b.toFixed(1) + "s (" + (b-a).toFixed(1) + " seconds)") : "End must be after start.";
  };
  video.addEventListener("loadedmetadata", () => {
    if (trimEnd && Number(trimEnd.value) <= 0) trimEnd.value = (video.duration || 0).toFixed(2);
    updateTrimSummary();
  });
  [trimStart, trimEnd].forEach(el => el?.addEventListener("input", updateTrimSummary));
  $("#cfSetTrimStart")?.addEventListener("click", () => {
    if (!video.src) return notify("Import a video first");
    trimStart.value = (video.currentTime || 0).toFixed(2);
    updateTrimSummary(); notify("Trim start set to playhead");
  });
  $("#cfSetTrimEnd")?.addEventListener("click", () => {
    if (!video.src) return notify("Import a video first");
    trimEnd.value = (video.currentTime || 0).toFixed(2);
    updateTrimSummary(); notify("Trim end set to playhead");
  });
  $("#cfResetTrim")?.addEventListener("click", () => {
    trimStart.value = "0";
    trimEnd.value = Number.isFinite(video.duration) ? video.duration.toFixed(2) : "";
    updateTrimSummary(); notify("Full video range restored");
  });

})();