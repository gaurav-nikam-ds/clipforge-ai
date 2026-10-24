(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const video = $("#sourceVideo");
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
      <button type="button" id="cfJump">Go to time</button>
    </div>
    <p class="cf-tools-note">Caption split/merge edits are applied to the current caption track. Speed changes the preview and is used during browser recording export. This is not a full multi-clip video timeline yet.</p>`;
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
    <div class="cf-mt-head"><div><strong>Timeline · multi-track view</strong><small>Drag caption blocks to retime · click a block to seek</small></div><span id="cfMtDuration">00:00</span></div>
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
    .cf-mt-status{margin-bottom:0}
  `;
  document.head.appendChild(mtStyle);
  const fmtMt = (n) => { n=Math.max(0,Number(n)||0); return String(Math.floor(n/60)).padStart(2,"0")+":"+String(Math.floor(n%60)).padStart(2,"0"); };
  const mtDuration = () => Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  function renderMultiTrack() {
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
    const pct=duration?Math.min(100,video.currentTime/duration*100):0;
    [videoTrack,capTrack].forEach(track=>{const line=document.createElement("div");line.className="cf-mt-playhead";line.style.left=pct+"%";track.appendChild(line);});
    $("#cfMtStatus").textContent=duration?("Playhead "+video.currentTime.toFixed(2)+"s · "+items.length+" caption clip(s). Drag blocks horizontally to retime them. Video source is one clip in this build."): "Import a video to create a timeline.";
  }
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