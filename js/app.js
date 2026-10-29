// Boot, routing, profile switching, the update bar.
import { S, loadProfiles, profile, today, KINDS, saveProfile, kindLabel } from './state.js';
import * as db from './db.js';
import { showLock, isUnlocked, watchRelock } from './lock.js';
import { onboard } from './onboarding.js';
import { settingsView, backupAgeDays } from './settings.js';
import * as engine from './engine.js';
import * as perf from './perf.js';
import { $, esc, toast, ask, setAccent, setTheme, setFeedback } from './ui.js';
import { prettyDay } from './time.js';
import { avatarHTML } from './avatar.js';
import { WHY } from './why.js';
import { setupFlow } from './coach.js';
import { skillsView } from './skills.js';
import { nutritionView, forgetHistory, poweredUp } from './nutrition.js';
import { loadFoods, foodVocab } from './foods.js';

const SCREENS = {
  engine: { tabs: engine.tabs, home: engine.home, library: engine.libraryView, nutrition: nutritionView, history: engine.historyView },
  perf: { tabs: perf.tabs, home: perf.home, week: perf.weekView, skills: skillsView, checkin: perf.checkinView, nutrition: nutritionView, history: perf.historyView },
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
        <span class="aura${charged ? ' charged' : ''}"${charged ? ' title="Protein goal reached today"' : ''}>${avatarHTML(p, 36)}</span><span class="chipname">${esc(p.name)}</span><span class="sub" aria-hidden="true">⇄</span></button>
      <div class="meta"><div>${prettyDay(today())}</div>${stale ? `<button class="badge" id="bk">${age === null ? 'Not backed up' : `Backup: ${age} days ago`}</button>` : ''}</div>
    </header>
    <main id="main">${view.html}</main>`;
  view.bind?.($('#main'));
  $('#dock').innerHTML = `<div class="dock-in">
    <div class="brand" aria-hidden="true"><img src="icons/favicon-48.png" alt="" width="28" height="28"><span>Goku</span></div>
    ${view.cta ? `<button class="cta" id="cta">${esc(view.cta[0])}</button>` : ''}
    <nav class="tabs" aria-label="Sections">${[...list, ...(list.some(([id]) => id === 'settings') ? [] : [['settings', 'Settings']])].filter(x => !x[2]).map(([id, label]) =>
      `<button data-tab="${id}" ${id === tab ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav></div>`;
  if (view.cta) {
    let running = false;
    $('#cta').onclick = async () => { if (running) return; running = true; try { await view.cta[1](); } finally { running = false; } };
  }
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
