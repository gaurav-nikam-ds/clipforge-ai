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