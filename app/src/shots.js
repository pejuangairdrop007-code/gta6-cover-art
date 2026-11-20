// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo
// loaded; ?shot=cover shows the cover alone, drawn by the app itself.
// `photo` picks the sample (samples/<photo>.jpg), `caption` the title,
// `layout` and `grade` pick the look. window.__shotReady is set once painted.
export async function runShot(shot, query, state, { redraw, syncTray, loadImage }) {
  const photoName = query.get('photo') ?? 'pier';
  const title = query.get('caption') ?? 'Sunset Heist';
  state.layout = query.get('layout') ?? 'hero';
  state.grade = query.get('grade') ?? 'sunset';
  state.title = title;
  state.subtitle = query.get('subtitle') ?? 'Neon nights · 2026';
  const img = await loadImage(`samples/${photoName}.jpg`);
  state.photos = [img];
  state.photoNames = [`Sample: ${photoName}`];
  state.panels.forEach((p) => { p.photo = 0; });
  const layoutEl = document.getElementById('layout');
  if (layoutEl) layoutEl.value = state.layout;
  document.querySelectorAll('.grade-btn').forEach((b) => {
    const on = b.dataset.grade === state.grade;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const titleEl = document.getElementById('title');
  if (titleEl) titleEl.value = title;
  const canvas = document.getElementById('cover');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.selected = null;
  }
  await document.fonts.ready;
  syncTray();
  redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
