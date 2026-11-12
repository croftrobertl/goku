// Small DOM helpers shared by every screen.
import { THEMES } from './themes.js';
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// action: [label, fn] adds one button (2.8: Undo after Remove); the toast then stays a little longer.
export function toast(text, ms = 2400, action = null) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
  if (action) {
    const b = document.createElement('button'); b.textContent = action[0];
    b.onclick = () => { t.remove(); action[1](); };
    t.append(' ', b); ms = Math.max(ms, 6000);
  }
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
// A quick second tap on a sheet's button would land on whatever sits under it once the sheet
// closes (a double-tapped "Add" opened the camera), so real taps are ignored for a moment after.
function swallowTaps(ms = 350) {
  const stop = e => { if (e.isTrusted) { e.stopPropagation(); e.preventDefault(); } };
  document.addEventListener('click', stop, true);
  setTimeout(() => document.removeEventListener('click', stop, true), ms);
}

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
  // A search sheet starts in its search box, so typing and Enter search instead of pressing Close.
  // Otherwise the sheet itself takes focus (2.9), so no orange ring lands on Close when it opens.
  el.tabIndex = -1;
  (el.querySelector('input[type=search]') || el).focus({ preventScroll: true });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { el.querySelector('[data-close]')?.click(); return; }
    // Return saves a sheet with a single box (2.15): weigh-in, calorie target, a name. After the sheet's own handlers, so a search box keeps its Enter.
    if (e.key === 'Enter' && e.target.matches('input:not([type=search]):not([type=checkbox]):not([type=file])')) {
      setTimeout(() => {
        if (e.defaultPrevented || !el.isConnected) return;
        const boxes = [...el.querySelectorAll('input:not([type=checkbox]):not([type=file]), textarea, select')].filter(n => n.offsetParent !== null);
        const main = [...el.querySelectorAll('button.cta')].filter(n => n.offsetParent !== null && !n.hasAttribute('data-close'));
        if (boxes.length === 1 && main.length === 1) main[0].click();
      }, 0);
      return;
    }
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter(n => n.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  return { el, close: () => { el.remove(); swallowTaps(); if (before?.isConnected) before.focus({ preventScroll: true }); } };
}

// For long forms (2.15): resolves true when it's fine to close, asking first if anything was typed or tapped.
export function discardGuard(el) {
  let dirty = false;
  el.addEventListener('input', () => { dirty = true; });
  return { touch: () => { dirty = true; }, ok: async () => !dirty || !!(await ask('Discard what you entered?', '', [{ label: 'Discard', value: true, danger: true }])) };
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

// Fine print (2.5): a card's sources fold behind one small "Sources" link. items: HTML strings.
export const sources = (items, { numbered = false } = {}) => items.length ? `<details class="srcs"><summary>Sources</summary>${numbered
  ? `<ol class="foot">${items.map(i => `<li>${i}</li>`).join('')}</ol>` : items.map(i => `<p class="note">${i}</p>`).join('')}</details>` : '';

export const round = (n, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };

// ---------- Color: any accent stays readable as a fill and as text ----------
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))]; return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const mix = (c, to, t) => c.map((v, i) => v + (to[i] - v) * t);

// The theme and mode set the surfaces and text; the accent is then nudged until it reads
// at 4.5:1 on the theme's cards.
let look = { theme: 'capsule', mode: 'auto' };
export function setTheme(theme = 'capsule', mode = 'auto') { look = { theme: THEMES[theme] ? theme : 'capsule', mode }; }
export const isDark = () => look.mode === 'dark' || (look.mode === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
export function setAccent(accent) {
  const root = document.documentElement.style;
  const dark = isDark();
  const pal = THEMES[look.theme][dark ? 'dark' : 'light'];
  for (const [k, v] of Object.entries(pal)) root.setProperty('--' + k, v);
  root.setProperty('color-scheme', dark ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', pal.bg);
  const bg = pal.s1;
  // Link text is checked against every surface it can sit on (2.8.2): the page, cards and panels.
  const surfaces = [pal.bg, pal.s1, pal.s2].filter(Boolean);
  let text = hex(accent);
  for (let t = 0; t <= 1 && surfaces.some(b => contrast(toHex(text), b) < 4.5); t += 0.05) text = mix(hex(accent), dark ? [255, 255, 255] : [0, 0, 0], t);
  // Lines, rings, bars and selection outlines carry meaning without text, so they get their own
  // shade at 3:1 or more on the cards (the accessibility minimum for graphics).
  let line = hex(accent);
  for (let t = 0; t <= 1 && contrast(toHex(line), bg) < 3; t += 0.05) line = mix(hex(accent), dark ? [255, 255, 255] : [0, 0, 0], t);
  root.setProperty('--accent', accent);
  root.setProperty('--accent-text', toHex(text));
  root.setProperty('--accent-line', toHex(line));
  root.setProperty('--ink-manga', dark ? '#e6e1d3' : '#141414'); // comic-panel outlines: dark ink on light, light ink on dark
  root.setProperty('--shade-manga', dark ? toHex(line) : '#141414'); // hard shadows: ink in light mode, the theme color in dark mode
  root.setProperty('--on-accent', contrast(accent, '#06142e') >= contrast(accent, '#ffffff') ? '#06142e' : '#ffffff');
}

// ---------- Audio cue via Web Audio; unlocked by a tap ----------
let actx = null;
export function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') return actx.resume().catch(() => {});
  } catch { actx = null; }
  return Promise.resolve();
}
// Settings can mute sound; it defaults to on. (The rep buzz was removed in 1.7: iPhone web apps
// can't vibrate on their own.)
let prefs = { sound: true };
export const setFeedback = p => { prefs = { sound: p?.settings?.sound !== false }; };

// delay (seconds) books the sound ahead on the audio clock, so a rest-over cue lands on
// time even if the page is busy. Returns a function that cancels it.
export function beep(freq = 880, ms = 160, times = 1, delay = 0) {
  if (!actx || !prefs.sound) return () => {};
  const oscs = [];
  for (let i = 0; i < times; i++) {
    const o = actx.createOscillator(), g = actx.createGain();
    const t0 = actx.currentTime + delay + i * (ms / 1000 + 0.08);
    o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    o.start(t0); o.stop(t0 + ms / 1000 + 0.02);
    oscs.push(o);
  }
  return () => oscs.forEach(o => { try { o.stop(); } catch { /* already ended */ } });
}
export const soundReady = () => !!actx && actx.state === 'running';


// Screen Wake Lock: supported in iOS 27 Home Screen apps; whether the screen really stays
// on is checked with "Test my phone" in Settings. Silently does nothing where unsupported.
let wake = null, wantWake = false;
export async function keepAwake(on) {
  wantWake = on;
  try {
    if (on && 'wakeLock' in navigator) {
      if (!wake || wake.released) wake = await navigator.wakeLock.request('screen');
    } else if (!on && wake) { await wake.release(); wake = null; }
  } catch { wake = null; }
  return awake();
}
export const awake = () => !!wake && !wake.released;
document.addEventListener('visibilitychange', () => {
  if (wantWake && document.visibilityState === 'visible') keepAwake(true);
});

// Fast taps. In a Home Screen app iOS ignores touch-action and treats two quick taps as
// zoom, which swallowed reps (seen on iOS 27). A still, short touch on a button is
// handled the moment the finger lifts; scrolls, long presses and pinches are untouched.
const TAPPABLE = 'button, [role="button"]'; // includes the SVG body-map zones
let touch = null;
document.addEventListener('touchstart', e => {
  const t = e.touches[0];
  touch = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: Date.now(), b: e.target.closest(TAPPABLE) } : null;
}, { passive: true });
document.addEventListener('touchend', e => {
  const s = touch; touch = null;
  const t = e.changedTouches[0];
  if (!s?.b || s.b.disabled || e.touches.length) return;
  if (Math.hypot(t.clientX - s.x, t.clientY - s.y) > 10 || Date.now() - s.at > 600) return;
  if (document.elementFromPoint(t.clientX, t.clientY)?.closest(TAPPABLE) !== s.b) return;
  e.preventDefault();
  const a = document.activeElement;
  if (a && a !== s.b && a.matches('input, textarea, select')) a.blur();
  s.b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); // SVG has no .click()
}, { passive: false });

// ---------- Day picker: ‹ Wed, Oct 28 › for logging past days ----------
export function dayPicker(day, todayKey, label = 'Day') {
  const d = new Date(day + 'T12:00:00Z');
  const txt = day === todayKey ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `<div class="daypick" role="group" aria-label="${esc(label)}">
    <button type="button" data-dayshift="-1" aria-label="Previous day">‹</button>
    <span class="num" aria-live="polite">${esc(txt)}</span>
    <button type="button" data-dayshift="1" aria-label="Next day" ${day >= todayKey ? 'disabled' : ''}>›</button></div>`;
}

// Title Case for headings, labels, buttons and tabs (2.9, review 5). Small words stay lowercase
// unless first; units, numbers and words that already have capitals (brands, Ki, NIH) are kept.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via', 'with', 'from', 'into']);
const UNIT = new Set(['g', 'kg', 'lb', 'lbs', 'oz', 'ml', 'cal', 'kcal', 'mg', 'mcg', 'min', 's', 'h', 'in', 'cm', 'km', 'mi']);
const ALWAYS_LOWER = new Set(['g', 'kg', 'lb', 'lbs', 'oz', 'ml', 'cal', 'kcal', 'mg', 'mcg', 'cm', 'km']); // even first, as in "lb · in · oz"
export const titleCase = str => { let i = -1; return String(str).split(/(\s+)/).map(word => {
  if (!word || /^\s+$/.test(word)) return word;
  i++;
  if (/[A-Z]/.test(word) || /\d/.test(word)) return word;
  const bare = word.toLowerCase().replace(/[^a-z']/g, '');
  if (ALWAYS_LOWER.has(bare) || (i > 0 && (SMALL.has(bare) || UNIT.has(bare)))) return word;
  return word.split('-').map(part => part.replace(/^([("'“‘]*)([a-z])/, (_, pre, c) => pre + c.toUpperCase())).join('-');
}).join(''); };

// Applied as the page draws: every heading, label, button and tab label gets Title Case.
// Names from data (exercises, foods, supplements, your own words) are marked data-raw and left alone.
const TC = 'h1, h2, h3, .lbl, .link, summary:not(.hrow > summary), .hrow > summary > b, .cta, .cta2, nav.tabs .tb > span, .seg button, .qahead, .qaitem span, label.toggle > span > b';
const tcText = el => {
  if (el.closest('[data-raw], input, textarea, .itemrow, .list')) return;
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('[data-raw]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let first = true;
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const v = n.nodeValue; if (!v.trim()) continue;
    const t = first ? titleCase(v) : titleCase('x ' + v).slice(2);
    if (t !== v) n.nodeValue = t;
    first = false;
  }
};
const tcIn = root => { if (root.nodeType !== 1) return; if (root.matches(TC)) tcText(root); root.querySelectorAll(TC).forEach(tcText); };
export function startTitleCase() {
  tcIn(document.body);
  new MutationObserver(list => { for (const m of list) { const host = m.target.nodeType === 1 ? m.target : m.target.parentElement; const near = host?.closest(TC); if (near) tcText(near); m.addedNodes.forEach(tcIn); } })
    .observe(document.body, { childList: true, subtree: true });
}
