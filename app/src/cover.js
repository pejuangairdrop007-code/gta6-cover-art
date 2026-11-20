// Renders the multi-panel cover onto a canvas. The cover state is plain data:
//   { photos: [HTMLImageElement|null, ...], panels: [{ photo, zoom, x, y }, ...],
//     layout: 'hero'|'grid'|'strip'|'bleed', grade: 'sunset'|'neon'|'gold'|'noir',
//     title, subtitle, showCaption, selected }
// Panels are rectangles in fractions of the canvas; each panel shows its photo
// cover-fit, panned and zoomed by its own crop. The grade is a colour wash plus
// a vignette, and the caption is set in the bundled Anton (SIL OFL) face.

export const LAYOUTS = ['hero', 'grid', 'strip', 'bleed'];
export const GRADES = ['sunset', 'neon', 'gold', 'noir'];

/** Panel rectangles for a layout, as [x, y, w, h] fractions of the canvas. */
export function layoutRects(layout, count) {
  if (layout === 'grid') {
    return [
      [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5],
    ].slice(0, count);
  }
  if (layout === 'strip') {
    return [
      [0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1],
    ].slice(0, count);
  }
  if (layout === 'bleed') return [[0, 0, 1, 1]];
  // hero: one big panel on the left, three stacked on the right.
  return [
    [0, 0, 0.62, 1],
    [0.62, 0, 0.38, 1 / 3], [0.62, 1 / 3, 0.38, 1 / 3], [0.62, 2 / 3, 0.38, 1 / 3],
  ].slice(0, count);
}

/** How many panels a layout shows. */
export function panelCount(layout) {
  return layout === 'grid' ? 4 : layout === 'bleed' ? 1 : layout === 'strip' ? 3 : 4;
}

/** A fresh crop for one panel: the photo centred, unzoomed. */
export function freshPanel(photo = 0) {
  return { photo, zoom: 1, x: 0, y: 0 };
}

const GRADIENTS = {
  sunset: { top: 'rgba(255, 107, 53, 0.28)', bottom: 'rgba(194, 24, 91, 0.55)', wash: 'rgba(255, 140, 66, 0.10)' },
  neon: { top: 'rgba(0, 229, 255, 0.22)', bottom: 'rgba(124, 77, 255, 0.55)', wash: 'rgba(0, 229, 255, 0.10)' },
  gold: { top: 'rgba(255, 179, 0, 0.20)', bottom: 'rgba(255, 112, 67, 0.50)', wash: 'rgba(255, 200, 80, 0.10)' },
  noir: { top: 'rgba(120, 144, 156, 0.12)', bottom: 'rgba(0, 0, 0, 0.55)', wash: 'rgba(90, 110, 130, 0.12)' },
};

/** Draws one photo cover-fit into a rectangle, honouring a panel crop. */
function drawPanelPhoto(ctx, img, rx, ry, rw, rh, panel) {
  const base = Math.max(rw / img.naturalWidth, rh / img.naturalHeight);
  const scale = base * panel.zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const dx = rx + (rw - pw) / 2 + panel.x * rw;
  const dy = ry + (rh - ph) / 2 + panel.y * rh;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.restore();
}

/** The grade wash: a vertical colour gradient, a warm wash and a vignette. */
function applyGrade(ctx, w, h, grade) {
  const g = GRADIENTS[grade] ?? GRADIENTS.sunset;
  const tint = ctx.createLinearGradient(0, 0, 0, h);
  tint.addColorStop(0, g.top);
  tint.addColorStop(1, g.bottom);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = g.wash;
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

const GRADE_SHADOWS = {
  sunset: 'rgba(232, 62, 140, 0.85)',
  neon: 'rgba(0, 229, 255, 0.85)',
  gold: 'rgba(255, 140, 0, 0.85)',
  noir: 'rgba(0, 0, 0, 0.9)',
};

/** The caption: a big Anton title with a dark outline, over a subtitle strip. */
function drawCaption(ctx, w, h, state) {
  if (!state.showCaption) return;
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim();
  const margin = w * 0.045;
  const bottom = h * 0.965;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (subtitle) {
    ctx.font = `700 ${Math.round(h * 0.024)}px system-ui, sans-serif`;
    const sw = ctx.measureText(subtitle.toUpperCase()).width;
    const pad = h * 0.012;
    const barH = h * 0.042;
    const barY = bottom - h * 0.155 - barH;
    ctx.fillStyle = 'rgba(20, 8, 28, 0.82)';
    ctx.fillRect(margin, barY, sw + pad * 2, barH);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(subtitle.toUpperCase(), margin + pad, barY + barH * 0.72);
  }
  if (!title) return;
  let size = h * 0.115;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  while (ctx.measureText(title).width > w - margin * 2 && size > 16) {
    size -= 2;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  // Two lines when the title is long: split on the middle space.
  const words = title.split(' ');
  let lines = [title];
  if (words.length > 1 && ctx.measureText(title).width > w * 0.86) {
    let best = 1;
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i += 1) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const diff = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(16, 6, 24, 0.9)';
  ctx.lineWidth = size * 0.14;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = GRADE_SHADOWS[state.grade] ?? GRADE_SHADOWS.sunset;
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  lines.forEach((line, i) => {
    const y = bottom - (lines.length - 1 - i) * size * 1.02;
    ctx.strokeText(line, margin, y);
    ctx.fillText(line, margin, y);
  });
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Draws the whole cover for `state` onto `canvas` at its own size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const count = panelCount(state.layout);
  const rects = layoutRects(state.layout, count);
  const gap = Math.max(2, Math.round(w * 0.006));
  ctx.fillStyle = '#f5eef7';
  ctx.fillRect(0, 0, w, h);
  rects.forEach(([fx, fy, fw, fh], i) => {
    const rx = fx * w + (fx > 0 ? gap / 2 : 0);
    const ry = fy * h + (fy > 0 ? gap / 2 : 0);
    const rw = fw * w - (fx > 0 ? gap / 2 : 0) - (fx + fw < 1 ? gap / 2 : 0);
    const rh = fh * h - (fy > 0 ? gap / 2 : 0) - (fy + fh < 1 ? gap / 2 : 0);
    const panel = state.panels[i] ?? freshPanel(0);
    const img = state.photos[panel.photo] ?? null;
    if (img) {
      drawPanelPhoto(ctx, img, rx, ry, rw, rh, panel);
    } else {
      ctx.fillStyle = '#2b1838';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = `700 ${Math.round(rh * 0.08)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', rx + rw / 2, ry + rh / 2);
      ctx.textBaseline = 'alphabetic';
    }
  });
  applyGrade(ctx, w, h, state.grade);
  // A thin frame and a selected-panel outline for the editor.
  ctx.strokeStyle = '#f5eef7';
  ctx.lineWidth = gap;
  ctx.strokeRect(gap / 2, gap / 2, w - gap, h - gap);
  if (state.selected != null && rects[state.selected]) {
    const [fx, fy, fw, fh] = rects[state.selected];
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = Math.max(3, w * 0.006);
    ctx.strokeRect(fx * w + 2, fy * h + 2, fw * w - 4, fh * h - 4);
  }
  drawCaption(ctx, w, h, state);
}

/** Which panel index holds canvas point (px, py), or -1. */
export function panelAt(state, w, h, px, py) {
  const rects = layoutRects(state.layout, panelCount(state.layout));
  const i = rects.findIndex(([fx, fy, fw, fh]) =>
    px >= fx * w && px < (fx + fw) * w && py >= fy * h && py < (fy + fh) * h);
  return i;
}
