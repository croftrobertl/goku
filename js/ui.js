// Small DOM helpers shared by every screen.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(text, ms = 2400) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

// Polite screen-reader announcement without moving focus.
export function announce(text) {
  let live = document.getElementById('sr-live');
  if (!live) {
    live = document.createElement('div');
    live.id = 'sr-live'; live.className = 'sr'; live.setAttribute('aria-live', 'polite');
    document.body.append(live);
  }
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 50);
}

// Runs an async handler at most once at a time, so double-taps can't double-save.
export function guard(fn) {
  let running = false;
  return async (...a) => {
    if (running) return;
    running = true;
    try { return await fn(...a); } finally { running = false; }
  };
}

// Full-screen layer with a focus trap. Esc presses the layer's [data-close] button.
// Returns { el, close }. content is an HTML string.
export function overlay(content, { label = 'Dialog', id } = {}) {
  const before = document.activeElement;
  const el = document.createElement('div');
  el.className = 'overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', label);
  if (id) el.id = id;
  el.innerHTML = `<div class="inner">${content}</div>`;
  document.body.append(el);
  el.querySelector('button, input, select, textarea')?.focus({ preventScroll: true });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { el.querySelector('[data-close]')?.click(); return; }
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter(n => n.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  return { el, close: () => { el.remove(); if (before?.isConnected) before.focus({ preventScroll: true }); } };
}

// Ask a question with buttons; resolves with the chosen value (or null on Cancel).
export function ask(title, body, buttons) {
  return new Promise(resolve => {
    const { el, close } = overlay(`
      <div class="scroll" style="display:flex;flex-direction:column;justify-content:center">
        <h1>${esc(title)}</h1><div class="sub" style="margin:8px 0 16px">${body}</div>
        ${buttons.map((b, i) => `<button class="${b.danger ? 'cta danger-fill' : i === 0 ? 'cta' : 'cta2'}" data-i="${i}" style="margin-top:10px;width:100%">${esc(b.label)}</button>`).join('')}
        <button class="${buttons.length ? 'cta2' : 'cta'}" data-i="-1" data-close style="margin-top:10px;width:100%">${buttons.length ? 'Cancel' : 'OK'}</button>
      </div>`, { label: title });
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      close(); resolve(+b.dataset.i < 0 ? null : buttons[+b.dataset.i].value);
    });
  });
}

export function stepper(key, value, label, unit = '') {
  return `<div class="step" data-step="${key}">
    <button type="button" data-d="-1" aria-label="Less ${esc(label)}">−</button>
    <span class="num" aria-live="polite">${esc(value)}${unit}</span>
    <button type="button" data-d="1" aria-label="More ${esc(label)}">+</button></div>`;
}

export const round = (n, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };

// ---------- Color: any accent stays readable as a fill and as text ----------
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))]; return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const mix = (c, to, t) => c.map((v, i) => v + (to[i] - v) * t);

export function setAccent(accent) {
  const root = document.documentElement.style;
  const dark = !matchMedia('(prefers-color-scheme: light)').matches;
  const bg = dark ? '#121a2e' : '#ffffff';
  let text = hex(accent);
  for (let t = 0; t <= 1 && contrast(toHex(text), bg) < 4.5; t += 0.05) text = mix(hex(accent), dark ? [255, 255, 255] : [0, 0, 0], t);
  root.setProperty('--accent', accent);
  root.setProperty('--accent-text', toHex(text));
  root.setProperty('--on-accent', contrast(accent, '#06142e') >= contrast(accent, '#ffffff') ? '#06142e' : '#ffffff');
}

// ---------- Audio cue via Web Audio; unlocked by a tap ----------
let actx = null;
export function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { actx = null; }
}
export function beep(freq = 880, ms = 160, times = 1) {
  if (!actx) return;
  for (let i = 0; i < times; i++) {
    const o = actx.createOscillator(), g = actx.createGain();
    const t0 = actx.currentTime + i * (ms / 1000 + 0.08);
    o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    o.start(t0); o.stop(t0 + ms / 1000 + 0.02);
  }
}

// Screen Wake Lock (verify on iOS). Silently does nothing where unsupported.
let wake = null, wantWake = false;
export async function keepAwake(on) {
  wantWake = on;
  try {
    if (on && 'wakeLock' in navigator) wake = await navigator.wakeLock.request('screen');
    else if (!on && wake) { await wake.release(); wake = null; }
  } catch { wake = null; }
}
document.addEventListener('visibilitychange', () => {
  if (wantWake && document.visibilityState === 'visible') keepAwake(true);
});

// ---------- Day picker: ‹ Wed, Oct 28 › for logging past days ----------
export function dayPicker(day, todayKey, label = 'Day') {
  const d = new Date(day + 'T12:00:00Z');
  const txt = day === todayKey ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `<div class="daypick" role="group" aria-label="${esc(label)}">
    <button type="button" data-dayshift="-1" aria-label="Previous day">‹</button>
    <span class="num" aria-live="polite">${esc(txt)}</span>
    <button type="button" data-dayshift="1" aria-label="Next day" ${day >= todayKey ? 'disabled' : ''}>›</button></div>`;
}
