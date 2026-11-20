// Wires the page: photos, layout, grade, per-panel crop, caption and export.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, panelAt, panelCount, freshPanel } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const $ = (id) => document.getElementById(id);

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

export const state = {
  photos: [],          // HTMLImageElement per tray slot (null when empty)
  photoNames: [],      // display name per tray slot
  panels: [freshPanel(0), freshPanel(0), freshPanel(0), freshPanel(0)],
  layout: 'hero',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'Neon nights · 2026',
  showCaption: true,
  selected: 0,
};

function redraw() {
  drawCover(canvas, state);
}

function syncPanelControls() {
  const panel = state.panels[state.selected] ?? freshPanel(0);
  $('zoom').value = panel.zoom;
  $('zoom-val').textContent = `${panel.zoom.toFixed(2)}×`;
  $('panx').value = panel.x;
  $('panx-val').textContent = panel.x.toFixed(2);
  $('pany').value = panel.y;
  $('pany-val').textContent = panel.y.toFixed(2);
  const select = $('panel-photo');
  select.innerHTML = '';
  state.photos.forEach((img, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1}. ${state.photoNames[i] ?? 'photo'}`;
    if (i === panel.photo) opt.selected = true;
    select.appendChild(opt);
  });
  if (state.photos.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'No photo loaded';
    select.appendChild(opt);
  }
  document.querySelectorAll('#tray img').forEach((el, i) => {
    el.classList.toggle('selected', i === panel.photo);
  });
}

function syncTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  state.photos.forEach((img, i) => {
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = state.photoNames[i] ?? `Photo ${i + 1}`;
    thumb.title = state.photoNames[i] ?? `Photo ${i + 1}`;
    thumb.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      syncPanelControls();
      redraw();
    });
    tray.appendChild(thumb);
  });
  $('tray-status').textContent = state.photos.length === 0
    ? 'No photos yet — try a sample below.'
    : `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded. Click a thumbnail to put it in the selected panel.`;
  syncPanelControls();
}

async function addPhotoFile(file) {
  if (state.photos.length >= 8) {
    status.textContent = 'Up to 8 photos — remove one first by reloading the page.';
    return;
  }
  const img = await loadImage(URL.createObjectURL(file));
  state.photos.push(img);
  state.photoNames.push(file.name);
  // First photo fills every panel; later ones fill empty panels.
  if (state.photos.length === 1) {
    state.panels.forEach((p) => { p.photo = 0; });
  }
  syncTray();
  redraw();
}

async function addSample(name) {
  try {
    const img = await loadImage(`samples/${name}.jpg`);
    state.photos.push(img);
    state.photoNames.push(`Sample: ${name}`);
    if (state.photos.length === 1) state.panels.forEach((p) => { p.photo = 0; });
    syncTray();
    redraw();
  } catch {
    status.textContent = `Could not load the ${name} sample.`;
  }
}

$('photo').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try { await addPhotoFile(file); } catch { status.textContent = `Could not read ${file.name}.`; }
  }
  e.target.value = '';
});
$('sample-pier').addEventListener('click', () => addSample('pier'));
$('sample-boulevard').addEventListener('click', () => addSample('boulevard'));

$('layout').addEventListener('change', (e) => {
  state.layout = e.target.value;
  const count = panelCount(state.layout);
  while (state.panels.length < count) state.panels.push(freshPanel(0));
  if (state.selected >= count) state.selected = 0;
  syncPanelControls();
  redraw();
});

$('grades').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-grade]');
  if (!btn) return;
  state.grade = btn.dataset.grade;
  document.querySelectorAll('.grade-btn').forEach((b) => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  redraw();
});

$('panel-photo').addEventListener('change', (e) => {
  state.panels[state.selected].photo = Number(e.target.value);
  syncPanelControls();
  redraw();
});
$('apply-all').addEventListener('click', () => {
  const photo = state.panels[state.selected].photo;
  state.panels.forEach((p) => { p.photo = photo; });
  redraw();
});

function bindCrop(id, valId, apply, format) {
  $(id).addEventListener('input', (e) => {
    const v = Number(e.target.value);
    apply(v);
    $(valId).textContent = format(v);
    redraw();
  });
}
bindCrop('zoom', 'zoom-val', (v) => { state.panels[state.selected].zoom = v; }, (v) => `${v.toFixed(2)}×`);
bindCrop('panx', 'panx-val', (v) => { state.panels[state.selected].x = v; }, (v) => v.toFixed(2));
bindCrop('pany', 'pany-val', (v) => { state.panels[state.selected].y = v; }, (v) => v.toFixed(2));
$('reset-panel').addEventListener('click', () => {
  state.panels[state.selected] = freshPanel(state.panels[state.selected].photo);
  syncPanelControls();
  redraw();
});

$('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
$('show-caption').addEventListener('change', (e) => { state.showCaption = e.target.checked; redraw(); });

$('export-size').addEventListener('change', (e) => {
  const [w, h] = e.target.value.split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  redraw();
});

// Click selects a panel; drag pans its photo; the wheel zooms it.
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(state, canvas.width, canvas.height, p.x, p.y);
  if (i < 0) return;
  state.selected = i;
  syncPanelControls();
  drag = { x: p.x, y: p.y, panel: { ...state.panels[i] } };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[state.selected];
  const rw = canvas.width;
  const rh = canvas.height;
  panel.x = Math.max(-0.5, Math.min(0.5, drag.panel.x + (p.x - drag.x) / rw));
  panel.y = Math.max(-0.5, Math.min(0.5, drag.panel.y + (p.y - drag.y) / rh));
  syncPanelControls();
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  const i = panelAt(state, canvas.width, canvas.height, p.x, p.y);
  if (i < 0) return;
  state.selected = i;
  const panel = state.panels[i];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  syncPanelControls();
  redraw();
}, { passive: false });

$('export').addEventListener('click', () => {
  const [w, h] = $('export-size').value.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, { ...state, selected: null });
  off.toBlob((blob) => {
    if (!blob) { status.textContent = 'Export failed — try again.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved vice-cover-${w}x${h}.png`;
  }, 'image/png');
});

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), state, { redraw, syncTray, loadImage, addSample });
} else {
  document.fonts.ready.then(redraw);
  syncTray();
  redraw();
}
