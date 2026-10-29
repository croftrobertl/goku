// Boot, routing, profile switching, the update bar.
import { S, loadProfiles, profile, today, KINDS, saveProfile, kindLabel } from './state.js';
import * as db from './db.js';
import { showLock, isUnlocked, watchRelock } from './lock.js';
import { onboard } from './onboarding.js';
import { settingsView, backupAgeDays } from './settings.js';
import * as engine from './engine.js';
import * as perf from './perf.js';
import { $, esc, toast, ask, overlay, setAccent, setTheme, setFeedback } from './ui.js';

// Tab icons: simple outline drawings in the panel style.
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  library: svg('<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>'),
  week: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  nutrition: svg('<path d="M12 7c-3-3-8-1-8 4 0 5 4 10 8 10s8-5 8-10c0-5-5-7-8-4z"/><path d="M12 7c0-2 1-4 3-4"/>'),
  history: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  skills: svg('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
};
import { prettyDay } from './time.js';
import { avatarHTML } from './avatar.js';
import { WHY } from './why.js';
import { setupFlow } from './coach.js';
import { skillsView } from './skills.js';
import { nutritionView, forgetHistory, poweredUp } from './nutrition.js';
import { loadFoods, foodVocab } from './foods.js';
import { streakSeen } from './homecards.js';

const SCREENS = {
  engine: { tabs: engine.tabs, mainAction: engine.mainAction, home: engine.home, library: engine.libraryView, nutrition: nutritionView, history: engine.historyView },
  perf: { tabs: perf.tabs, mainAction: perf.mainAction, home: perf.home, week: perf.weekView, skills: skillsView, checkin: perf.checkinView, nutrition: nutritionView, history: perf.historyView },
};
const tabs = {}; // current tab per profile id
let update = null; // { reg, dismissed }

const goku = window.goku = { busy: false, toast, render, go, open, idle: () => render() };

function go(tab) { if (tab !== 'nutrition') forgetHistory(); tabs[S.current] = tab; render().then(() => window.scrollTo(0, 0)); warmFoods(); }
// The food list (and its spelling index) loads quietly a moment after start, so the first search is instant.
let warmed = false;
function warmFoods() {
  const p = profile();
  if (warmed || !p || !p.modules || p.modules.nutrition === false) return;
  warmed = true;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 1500));
  idle(() => loadFoods().then(() => idle(() => foodVocab())).catch(() => { warmed = false; }));
}

let rendering = Promise.resolve();
function render() { rendering = rendering.then(draw, draw); return rendering; }

// Remembers which control had focus so a redraw doesn't throw VoiceOver back to the top.
function focusKey() {
  const a = document.activeElement;
  if (!a || a === document.body || !$('#app').contains(a) && !$('#dock').contains(a)) return null;
  if (a.id) return '#' + CSS.escape(a.id);
  const attr = [...a.attributes].find(x => x.name.startsWith('data-'));
  if (!attr) return null;
  const step = a.closest('[data-step]');
  return (step ? `[data-step="${CSS.escape(step.dataset.step)}"] ` : '') + `[${attr.name}="${CSS.escape(attr.value)}"]`;
}

async function draw() {
  const p = profile();
  if (!p) return;
  setTheme(p.settings.theme, p.settings.mode);
  setAccent(p.accent);
  setFeedback(p);
  const scr = SCREENS[p.kind];
  const charged = await poweredUp(p).catch(() => false);
  // Transformation stages (2.2): the streak powers the aura up; a wish can make it eternal.
  const days = streakSeen[p.id] || 0;
  const [stage, stageName] = p.coach?.wish === 'aura' ? ['st-eternal', 'Eternal aura'] : days >= 30 ? ['st-blue', `Blue aura · ${days}-day streak`]
    : days >= 7 ? ['st-gold', `Gold aura · ${days}-day streak`] : ['', days ? `${days}-day streak` : 'Base form'];
  const list = scr.tabs(p);
  let tab = tabs[p.id] || 'home';
  if (tab !== 'settings' && !list.some(([id]) => id === tab)) tab = tabs[p.id] = 'home';
  const view = tab === 'settings' ? await settingsView() : await scr[tab]();
  const fk = focusKey();
  const age = backupAgeDays(p);
  const stale = age === null ? Date.now() - p.createdAt > 7 * 86400000 : age >= 7;
  const showUpd = update && !update.dismissed && !goku.busy;
  $('#app').innerHTML = `${showUpd ? `<div class="updbar" role="status"><span>A new version of Goku is ready.</span>
      <span class="row" style="gap:8px"><button class="cta2" id="updLater">Later</button><button class="cta" id="updNow" style="width:auto;min-height:44px;padding:0 16px">Update</button></span></div>` : ''}
    <header class="top">
      <button class="chip" id="switch" aria-label="Profile: ${esc(p.name)}. ${S.profiles.length > 1 ? 'Switch profile' : 'Add a profile'}">
        <span class="aura${charged ? ' charged' : ''} ${stage}" title="${esc(stageName)}${charged ? ' · protein goal reached today' : ''}">${avatarHTML(p, 36)}</span><span class="chipname">${esc(p.name)}${p.coach?.wish === 'title' ? '<small class="wtitle">Dragon Ball master</small>' : ''}</span><span class="sub" aria-hidden="true">⇄</span></button>
      <div class="meta"><div>${prettyDay(today())}</div>${stale ? `<button class="badge" id="bk">${age === null ? 'Not backed up' : `Backup: ${age} days ago`}</button>` : ''}</div>
    </header>
    <main id="main">${view.html}</main>`;
  view.bind?.($('#main'));
  // Tab bar (2.2): three main tabs with icons, a big center action, and More for the rest.
  // On desktop the same items line up in the sidebar, the action on top.
  const all = [...list, ...(list.some(([id]) => id === 'settings') ? [] : [['settings', 'Settings']])].filter(x => !x[2]);
  const main = all.filter(([id]) => !['history', 'settings', 'skills'].includes(id)).slice(0, 3);
  const more = all.filter(x => !main.includes(x));
  const action = view.cta || (scr.mainAction ? await scr.mainAction() : null);
  const tabBtn = ([id, label], cls = '') => `<button data-tab="${id}" class="tb ${cls}" ${id === tab ? 'aria-current="page"' : ''}>${ICON[id] || ICON.more}<span>${label}</span></button>`;
  const inMore = more.some(([id]) => id === tab);
  $('#dock').innerHTML = `<div class="dock-in">
    <div class="brand" aria-hidden="true"><img src="icons/favicon-48.png" alt="" width="28" height="28"><span>Goku</span></div>
    <nav class="tabs" aria-label="Sections">${main.slice(0, 2).map(t => tabBtn(t)).join('')}
      ${action ? `<button class="tb center" id="cta" aria-label="${esc(action[0])}"><span class="ki-btn">${ICON.bolt}</span><span>${esc(action[0])}</span></button>` : '<span class="tb center" aria-hidden="true"></span>'}
      ${main.slice(2).map(t => tabBtn(t)).join('')}
      ${more.map(t => tabBtn(t, 'more-item')).join('')}
      ${more.length ? `<button class="tb more-btn" id="moreTabs" ${inMore ? 'aria-current="page"' : ''} aria-label="More: ${esc(more.map(m => m[1]).join(', '))}">${ICON.more}<span>More</span></button>` : ''}</nav></div>`;
  if (action) {
    let running = false;
    $('#cta').onclick = async () => { if (running) return; running = true; try { await action[1](); } finally { running = false; } };
  }
  if (more.length) $('#moreTabs').onclick = () => {
    const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">More</h1><button class="cta2" id="x" data-close>Close</button></div>
      <div class="moregrid">${more.map(([id, label]) => `<button class="card pick" data-go="${id}">${ICON[id] || ''}<b>${esc(label)}</b></button>`).join('')}</div>`, { label: 'More' });
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; close(); if (b.dataset.go) go(b.dataset.go); });
  };
  if (fk) document.querySelector(fk)?.focus({ preventScroll: true });
}

async function open(id) {
  S.current = id;
  const p = profile();
  await db.setMeta('lastProfile', id);
  if (!isUnlocked(p)) {
    $('#app').innerHTML = ''; $('#dock').innerHTML = '';
    const ok = await showLock(p, { onSwitch: chooseProfile });
    if (!ok) return;
  }
  await render();
  warmFoods();
  if (p.kind === 'engine') engine.resumeRun();
}

async function chooseProfile() {
  const others = S.profiles.filter(x => x.id !== S.current);
  if (others.length === 1 && isUnlocked(profile())) return open(others[0].id);
  const pick = await ask('Switch profile', 'Each profile keeps its own data and passcode.',
    [...S.profiles.map(x => ({ label: `${x.name} · ${kindLabel(x)}`, value: x.id })), { label: 'Add a profile', value: 'add' }]);
  if (pick === 'add') { const np = await onboard({ cancellable: true }); if (np) return open(np.id); }
  if (pick && pick !== 'add') return open(pick);
  if (!isUnlocked(profile())) return open(S.current);
}

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tab) go(b.dataset.tab);
  else if (b.id === 'switch') {
    if (goku.busy) return toast('Finish your session first');
    if (S.profiles.length > 1) chooseProfile();
    else onboard({ cancellable: true }).then(np => np && open(np.id));
  } else if (b.id === 'bk') go('settings');
  else if (b.id === 'updLater') { update.dismissed = true; render(); }
  else if (b.id === 'updNow') applyUpdate();
  else if (b.dataset.why && WHY[b.dataset.why]) { const [t, html] = WHY[b.dataset.why](profile(), b.dataset.arg); ask(t, html, []); }
  else if (b.dataset.setup) setupFlow(profile(), async p => { await saveProfile(p); render(); }, { only: b.dataset.setup });
});

// Keeps the page's bottom padding equal to the dock's real height (it grows with text size).
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--dock-h', Math.ceil(e.contentRect.height) + 'px')).observe($('#dock'));
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => profile() && setAccent(profile().accent));

// ---------- Install gate (iOS keeps Home Screen app storage separate from Safari tabs — verify) ----------
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

function installGate() {
  return new Promise(resolve => {
    $('#app').innerHTML = `<section class="card" style="margin-top:24px">
      <p class="lbl">Before you start</p><h1>Add Goku to your Home Screen</h1>
      <p class="sub" style="margin-top:8px">On iPhone, data saved in a Safari tab is kept apart from the Home Screen app,
      and Safari can delete it after 7 days without a visit. Install first so nothing you log gets stranded or lost.</p>
      <ol style="line-height:1.9;padding-left:20px;margin:12px 0 0">
        <li>Tap <b>Share</b>. It's in Safari's toolbar, or inside the <b>☰</b> or <b>•••</b> menu.</li>
        <li>Tap <b>View More</b> if you see it, then <b>Add to Home Screen</b>.</li>
        <li>Tap <b>Add</b>, then open Goku from your Home Screen.</li>
      </ol></section>
      <button class="link" id="anyway" style="width:100%">Try it in Safari anyway (data may be deleted)</button>`;
    $('#dock').innerHTML = '';
    $('#anyway').onclick = () => resolve();
  });
}

// ---------- Service worker + update bar ----------
let reloadOnChange = false;
function applyUpdate() {
  if (goku.busy) return toast('Finish your session first, then update');
  reloadOnChange = true;
  const btn = $('#updNow'); if (btn) btn.textContent = 'Updating…';
  if (update?.reg.waiting) update.reg.waiting.postMessage('SKIP_WAITING');
  else location.reload();
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const ready = () => { if (!update) { update = { reg, dismissed: false }; if (profile()) render(); } };
    if (reg.waiting && navigator.serviceWorker.controller) ready();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ready(); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadOnChange) { reloadOnChange = false; location.reload(); } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !goku.busy) reg.update().catch(() => {}); });
  } catch { /* offline first load or file:// — the app still runs */ }
}

async function boot() {
  registerSW();
  if (isIOS && !standalone) await installGate();
  await loadProfiles();
  if (!S.profiles.length) {
    const p = await onboard();
    db.requestPersist();
    S.current = p.id;
    await render();
  } else {
    db.requestPersist();
    const last = await db.getMeta('lastProfile');
    await open(S.profiles.some(p => p.id === last) ? last : S.profiles[0].id);
  }
  // Relock covers the screen instead of redrawing it, so nothing typed is lost.
  watchRelock(() => {
    const p = profile();
    if (p && !goku.busy && !isUnlocked(p)) showLock(p, { onSwitch: chooseProfile });
  });
}

boot().catch(e => {
  $('#app').innerHTML = `<section class="card" style="margin-top:24px"><h1>Goku couldn't start</h1>
    <p class="sub">${esc(e.message || e)}</p><p class="note">Your data is untouched. Close the app fully and open it again.</p></section>`;
});
