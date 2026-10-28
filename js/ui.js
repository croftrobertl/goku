// Small DOM helpers shared by every screen.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(text, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

// Full-screen layer. Returns { el, close }. content is an HTML string.
export function overlay(content, { label = 'Dialog', id } = {}) {
  const el = document.createElement('div');
  el.className = 'overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', label);
  if (id) el.id = id;
  el.innerHTML = `<div class="inner">${content}</div>`;
  document.body.append(el);
  const first = el.querySelector('button, input, select, textarea');
  first?.focus({ preventScroll: true });
  return { el, close: () => el.remove() };
}

// Ask a question with buttons; resolves with the chosen value (or null on Cancel).
export function ask(title, body, buttons) {
  return new Promise(resolve => {
    const { el, close } = overlay(`
      <div class="scroll" style="display:flex;flex-direction:column;justify-content:center">
        <h1>${esc(title)}</h1><div class="sub" style="margin:8px 0 16px">${body}</div>
        ${buttons.map((b, i) => `<button class="${i === 0 ? 'cta' : 'cta2'}" data-i="${i}" style="margin-top:10px;width:100%">${esc(b.label)}</button>`).join('')}
        <button class="${buttons.length ? 'cta2' : 'cta'}" data-i="-1" style="margin-top:10px;width:100%">${buttons.length ? 'Cancel' : 'OK'}</button>
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

// Audio cue via Web Audio; must be unlocked by a tap first.
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
let wake = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wake = await navigator.wakeLock.request('screen');
    else if (!on && wake) { await wake.release(); wake = null; }
  } catch { wake = null; }
}
document.addEventListener('visibilitychange', () => {
  if (wake && document.visibilityState === 'visible') keepAwake(true);
});
