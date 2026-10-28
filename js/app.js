// Boot, routing, profile switching, the update banner.
import { S, loadProfiles, profile, today, KINDS } from './state.js';
import * as db from './db.js';
import { showLock, isUnlocked, watchRelock } from './lock.js';
import { onboard } from './onboarding.js';
import { settingsView, backupAgeDays } from './settings.js';
import * as engine from './engine.js';
import * as perf from './perf.js';
import { $, esc, toast, ask } from './ui.js';
import { prettyDay } from './time.js';

const SCREENS = {
  engine: { tabs: engine.TABS, home: engine.home, library: engine.libraryView, gut: engine.gutView, history: engine.historyView },
  perf: { tabs: perf.TABS, home: perf.home, week: perf.weekView, checkin: perf.checkinView, history: perf.historyView },
};
const tabs = {}; // current tab per profile id

const goku = window.goku = { busy: false, toast, render, go, open };

function go(tab) { tabs[S.current] = tab; render(); window.scrollTo(0, 0); }

let rendering = Promise.resolve();
function render() { rendering = rendering.then(draw, draw); return rendering; }

async function draw() {
  const p = profile();
  if (!p) return;
  document.documentElement.style.setProperty('--accent', p.accent);
  const scr = SCREENS[p.kind];
  const tab = tabs[p.id] || 'home';
  const view = tab === 'settings' ? await settingsView() : await scr[tab]();
  const age = backupAgeDays(p);
  const stale = age === null ? Date.now() - p.createdAt > 7 * 86400000 : age >= 7;
  const app = $('#app');
  app.innerHTML = `<header class="top">
      <button class="chip" id="switch" aria-label="Profile: ${esc(p.name)}. ${S.profiles.length > 1 ? 'Switch profile' : 'Add a profile'}">
        <span class="av">${esc(p.name.slice(0, 1).toUpperCase())}</span><span>${esc(p.name)}</span><span class="sub" aria-hidden="true">⇄</span></button>
      <div class="row" style="gap:8px">
        <div class="meta"><div>${prettyDay(today())}</div>${stale ? `<button class="badge" id="bk" style="min-height:0">${age === null ? 'Not backed up' : `Backup: ${age} days ago`}</button>` : ''}</div>
      </div>
    </header>
    <main id="main">${view.html}</main>`;
  app.classList.toggle('nodock', false);
  view.bind?.($('#main'));
  $('#dock').innerHTML = `<div class="dock-in">
    ${view.cta ? `<button class="cta" id="cta">${esc(view.cta[0])}</button>` : ''}
    <nav class="tabs" aria-label="Sections">${scr.tabs.map(([id, label]) =>
      `<button data-tab="${id}" ${id === tab ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav></div>`;
  if (view.cta) $('#cta').onclick = view.cta[1];
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
  if (p.kind === 'engine') engine.resumeRun();
}

async function chooseProfile() {
  const others = S.profiles.filter(x => x.id !== S.current);
  if (others.length === 1 && isUnlocked(profile())) return open(others[0].id);
  const pick = await ask('Switch profile', 'Each profile keeps its own data and passcode.',
    [...S.profiles.map(x => ({ label: `${x.name} · ${KINDS[x.kind].label}`, value: x.id })), { label: 'Add a profile', value: 'add' }]);
  if (pick === 'add') { const np = await onboard(); return open(np.id); }
  if (pick) return open(pick);
  if (!isUnlocked(profile())) return open(S.current);
}

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tab) go(b.dataset.tab);
  else if (b.id === 'switch') {
    if (goku.busy) return toast('Finish your session first');
    if (S.profiles.length > 1) chooseProfile();
    else onboard().then(np => open(np.id));
  } else if (b.id === 'bk') go('settings');
});

// ---------- Install gate (iOS keeps Home Screen app storage separate from Safari tabs — verify) ----------
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

function installGate() {
  return new Promise(resolve => {
    $('#app').innerHTML = `<section class="card" style="margin-top:24px">
      <p class="lbl">Before you start</p><h1>Add Goku to your Home Screen</h1>
      <p class="sub" style="margin-top:8px">On iPhone, data saved in a Safari tab is kept apart from the Home Screen app.
      Install first so nothing you log gets stranded here.</p>
      <ol style="line-height:1.9;padding-left:20px;margin:12px 0 0">
        <li>Tap the <b>Share</b> button in Safari's toolbar.</li>
        <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
        <li>Tap <b>Add</b>, then open Goku from your Home Screen.</li>
      </ol></section>
      <button class="link" id="anyway" style="width:100%">Use it in Safari anyway</button>`;
    $('#dock').innerHTML = '';
    $('#anyway').onclick = () => resolve();
  });
}

// ---------- Service worker + update banner ----------
function showUpdate(reg) {
  if ($('#upd')) return;
  const b = document.createElement('button');
  b.id = 'upd'; b.className = 'banner'; b.textContent = 'New version available · tap to update';
  b.onclick = () => {
    if (goku.busy) return toast('Finish your session first, then update');
    b.textContent = 'Updating…';
    reg.waiting?.postMessage('SKIP_WAITING');
  };
  document.body.append(b);
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(reg);
      });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !$('#upd')) return;
      reloaded = true; location.reload();
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
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
  watchRelock(() => { if (S.current && !goku.busy) open(S.current); });
}

boot().catch(e => {
  $('#app').innerHTML = `<section class="card" style="margin-top:24px"><h1>Goku couldn't start</h1>
    <p class="sub">${esc(e.message || e)}</p><p class="note">Your data is untouched. Close the app fully and open it again.</p></section>`;
});
