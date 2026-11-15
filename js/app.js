// Boot, routing, profile switching, the update bar.
import { w, W, setSkin, skinOf } from './skins.js';
import { weighIn, weightOn } from './weight.js';
import { S, loadProfiles, profile, today, KINDS, saveProfile, saveEntry, deleteEntry, kindLabel } from './state.js';
import * as db from './db.js';
import { showLock, isUnlocked, watchRelock } from './lock.js';
import { onboard } from './onboarding.js';
import { settingsView, backupAgeDays, youView, openSettingsGroup } from './settings.js';
import * as engine from './engine.js';
import * as perf from './perf.js';
import { formFor, auraSVG } from './auras.js';
import { setResting } from './avatar.js';
import { maybeOver9000 } from './scouter.js';
import { loggedEntries } from './insights.js';
import { $, esc, toast, ask, overlay, setAccent, setTheme, setFeedback, titleCase, startTitleCase, GLY } from './ui.js';

// One word under the center button: "Enter chamber" → Train, "Check in · 30 s" → Check in.
const SHORT = { 'Enter chamber': 'Train', 'Log a session': 'Log', 'Add exercise': 'Add', 'Add a skill': 'Add', 'Add food': 'Add' };
const shortLabel = s => s ? (s === W('enter') ? 'Train' : SHORT[s] || s.split(' · ')[0]) : ''; // the skin's "Enter the chamber" is Train too

// Quick Add (2.9, review 5): one panel with two groups, Food & Drink and Activity, so nothing overlaps.
// Activity starts with this screen's own action, then the main one when it's different.
const QA_SHORT = { 'Add exercise': 'Exercise', 'Add Exercise': 'Exercise', 'Log a session': 'Session', 'Log a Session': 'Session', 'Add a skill': 'Skill', 'Add a Skill': 'Skill' };
const qaLabel = s => QA_SHORT[s] || (s === W('enter') ? 'Train' : titleCase(shortLabel(s)));
async function kiMenu(p, action, scr) {
  db.setMeta('kiHint', true); document.querySelector('.kihint')?.remove();
  const main = scr.mainAction ? await scr.mainAction() : null;
  const food = [], act = [];
  if (p.modules?.nutrition !== false) {
    food.push(['Food', ICON.nutrition, () => { go('nutrition'); addFood(nowMeal(), today()); }]);
    food.push(['Water', ICON.water, async () => { await quickWater(p); toast('Glass of water logged'); render(); }]);
    food.push(['Supplements', ICON.pill, async () => {
      openNutritionDay(today()); await render(); window.scrollTo(0, 0); // always today, never the last day Nutrition showed
      const add = document.getElementById('addSupp'); add ? add.click() : toast('Turn on Supplements in Nutrition first');
    }]);
  }
  // 2.16 (review 10): the main action only, named plainly; a page's own Add or Save button stays on its page.
  const mainIsCheckin = !!main && /^check/i.test(main[0]); // a practice-log profile's main action is its check-in until that's done; it belongs under Body, once
  if (main && !mainIsCheckin) act.push([main[0] === W('enter') || shortLabel(main[0]) === 'Train' ? 'Workout' : qaLabel(main[0]), ICON.bolt, main[1]]);
  if (mainIsCheckin && p.kind === 'perf') act.push(['Session', ICON.bolt, () => perf.logSession()]); // logging a practice never waits for the check-in
  act.push(['Other Sport', ICON.run, () => logActivity()]);
  act.push(['Rest Day', ICON.moon, async () => { const id = p.id + ':rest:' + today(); await saveEntry('rest', {}, { id, day: today() }); toast('Rest day logged. Recovery is training too.', 6000, ['Undo', async () => { await deleteEntry(id); render(); }]); render(); }]);
  // Body: the daily check-in and a weigh-in are things you log too.
  const body = [];
  if (p.kind === 'perf') body.push(['Check-In', ICON.heart, mainIsCheckin ? main[1] : () => go('checkin')]);
  else if (p.modules?.nutrition !== false && p.modules?.gut !== false) body.push(['Check-In', ICON.heart, async () => {
    openNutritionDay(today()); await render();
    const f = document.querySelector('details.feel'); if (f) { f.open = true; f.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }
  }]);
  if (weightOn(p)) body.push(['Weigh-In', ICON.scale, () => weighIn(p)]);
  const items = [...food, ...act, ...body];
  const group = (name, list, start) => list.length ? `<p class="lbl qahead">${name}</p>
    <div class="qagrid">${list.map(([label, icon], i) => `<button class="cta2 qaitem" data-i="${start + i}">${icon}<span>${esc(label)}</span></button>`).join('')}</div>` : '';
  const { el, close } = overlay(`<div class="qasheet"><div class="qagrab" aria-hidden="true"></div>
      <div class="row"><h2>Quick Add</h2><button class="cta2 qax" id="x" data-close aria-label="Close">${GLY.close}</button></div>
      ${group('Food &amp; Drink', food, 0)}${group('Activity', act, food.length)}${group('Body', body, food.length + act.length)}</div>`, { label: 'Quick Add' });
  el.classList.add('kiov');
  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) { if (!e.target.closest('.qasheet')) close(); return; } // a tap outside the panel closes it
    if (b.id === 'x') return close();
    const it = items[+b.dataset.i]; if (!it) return; close(); await it[2]();
  });
}
function showKiHint() {
  const c = document.getElementById('cta'); if (!c || document.querySelector('.kihint')) return;
  const tip = document.createElement('div'); tip.className = 'kihint'; tip.setAttribute('role', 'status');
  tip.textContent = 'The center button has quick actions: train, food, water and more';
  document.body.append(tip);
  // Shown once (2.5): it counts as seen right away and fades after about 4 seconds.
  db.setMeta('kiHint', true);
  setTimeout(() => { tip.classList.add('out'); setTimeout(() => tip.remove(), 400); }, 4000);
}

// Tab icons: simple outline drawings in the panel style.
// Full-color Dragon Ball icons (2.21, reviews 20-21): renders Rob picked, one 120 px PNG each in img/ic.
const pic = n => `<img class="ic" src="img/ic/${n}.png" alt="" aria-hidden="true" width="28" height="28" draggable="false">`;
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  home: pic('home'),
  library: pic('library'),
  week: pic('week'),
  nutrition: pic('food'),
  history: pic('history'),
  pill: pic('supplements'),
  settings: pic('settings'),
  skills: pic('skills'),
  you: pic('you'),
  more: svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
  bolt: pic('workout'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  water: pic('water'),
  run: pic('sport'),
  heart: pic('checkin'),
  scale: pic('weigh'),
  moon: pic('rest'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};
import { prettyDay } from './time.js';
import { avatarHTML } from './avatar.js';
import { WHY } from './why.js';
import { setupFlow } from './coach.js';
import { skillsView } from './skills.js';
import { nutritionView, forgetHistory, resetNutritionDay, poweredUp, addFood, nowMeal, quickWater, openNutritionDay } from './nutrition.js';
import { logActivity } from './activity.js';
import { loadFoods, foodVocab } from './foods.js';
import { streakSeen, toggleKi } from './homecards.js';
import { setHomeView, homeView } from './homelayout.js';

// The Saga screen (2.5) is Home's game cards on a page of their own, reached from the status strip.
const sagaOf = home => async () => {
  const was = homeView(); setHomeView('saga');
  try { const v = await home(); return { ...v, cta: null, html: `<div class="row"><h1 style="margin:0">${esc(W('saga'))}</h1><button class="cta2" data-tab="home">Back to Home</button></div>${v.html}` }; }
  finally { setHomeView(was === 'saga' ? 'today' : was); }
};
const SCREENS = {
  engine: { tabs: engine.tabs, mainAction: engine.mainAction, home: engine.home, saga: sagaOf(engine.home), library: engine.libraryView, nutrition: nutritionView, history: engine.historyView },
  perf: { tabs: perf.tabs, mainAction: perf.mainAction, home: perf.home, saga: sagaOf(perf.home), week: perf.weekView, skills: skillsView, checkin: perf.checkinView, nutrition: nutritionView, history: perf.historyView },
};
const tabs = {}; // current tab per profile id
let update = null; // { reg, dismissed }

const goku = window.goku = { busy: false, toast, render, go, open, idle: () => render() };

function go(tab) { if (tab !== 'nutrition') forgetHistory(); tabs[S.current] = tab; render().then(() => window.scrollTo(0, 0)); if (tab === 'nutrition') warmFoods(); }
// The food list (and its spelling index) loads quietly when Nutrition is opened (2.15; it used to load after every
// launch and froze the screen for a moment even on days with no food to log).
let warmed = false;
function warmFoods() {
  const p = profile();
  if (warmed || !p || !p.modules || p.modules.nutrition === false) return;
  warmed = true;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 1500));
  idle(() => loadFoods().then(() => idle(() => foodVocab())).catch(() => { warmed = false; }));
}

// A save or screen that fails out of sight says so (2.15), at most once every few seconds.
let lastOops = 0;
window.addEventListener('unhandledrejection', e => {
  console.error(e.reason);
  if (Date.now() - lastOops < 5000) return;
  lastOops = Date.now();
  toast(/quota/i.test(e.reason?.name + ' ' + e.reason?.message) ? "Couldn't save: this phone's storage is full." : "Something went wrong. Your last change may not have saved.", 5000);
});
// Coming back to the app on a new day redraws it (2.15), so Home and its buttons never log to yesterday.
let drawnDay = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !profile() || goku.busy || document.querySelector('.overlay')) return;
  if (drawnDay && drawnDay !== today()) { resetNutritionDay(); render(); }
});

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

let lastShown = null; // the profile and tab on screen, so only a real tab change fades in
async function draw() { db.memoOn(); try { await drawNow(); } finally { db.memoOff(); } }
async function drawNow() {
  const p = profile();
  if (!p) return;
  if (p.tzNext && Date.now() >= p.tzNext.at) { p.tz = p.tzNext.tz; delete p.tzNext; await saveProfile(p); } // the new zone's first day (2.8.2)
  setTheme(p.settings.theme, p.settings.mode);
  setAccent(p.accent);
  setSkin(skinOf(p));
  setFeedback(p);
  const scr = SCREENS[p.kind];
  { // Goku sleeps on a rest day (2.21), and wakes up if you train after all
    const t0 = today(), mine = (await loggedEntries(p).catch(() => [])).filter(e => e.day === t0);
    setResting(p.id, mine.some(e => e.type === 'rest') && !mine.some(e => e.type === 'session' || e.type === 'activity')); }
  const charged = await poweredUp(p).catch(() => false);
  // Transformation stages (2.2): the streak powers the aura up; a wish can make it eternal.
  const days = streakSeen[p.id] || 0;
  // Dragon Ball skin (2.20): the Super Saiyan forms, drawn as flames. Other skins keep the gold and blue rings.
  const form = skinOf(p) === 'dbz' && p.coach?.wish !== 'aura' ? formFor(days) : null;
  const [stage, stageName] = p.coach?.wish === 'aura' ? ['st-eternal', 'Eternal aura'] : form ? ['st-form', `${form[1]} · ${days}-day streak`]
    : days >= 30 ? ['st-blue', `Blue aura · ${days}-day streak`] : days >= 7 ? ['st-gold', `Gold aura · ${days}-day streak`] : ['', days ? `${days}-day streak` : 'Base form'];
  const list = scr.tabs(p);
  let tab = tabs[p.id] || 'home';
  if (tab !== 'settings' && tab !== 'you' && !list.some(([id]) => id === tab)) tab = tabs[p.id] = 'home';
  // "You" (2.16): the phone's fifth tab lists the pages that don't fit in the bar (History, Skills) and the main settings.
  const youPages = list.filter(x => !x[2] && ['history', 'skills'].includes(x[0]));
  // A screen that fails shows its error in the page (2.15); the bars and Settings keep working, so a backup can still be exported.
  let view;
  try { view = tab === 'settings' ? await settingsView() : tab === 'you' ? await youView(days, youPages) : await scr[tab](); }
  catch (e) { console.error(e); view = { failed: true, html: `<section class="card" style="margin-top:24px"><h1>This screen hit a problem</h1>
    <p class="sub">${esc(e?.message || e)}</p><p class="note">Your data is untouched. Other screens still work, and Settings can export a backup.</p>
    ${tab === 'settings' ? '' : '<button class="cta" id="errSettings" style="margin-top:12px">Open Settings</button>'}</section>` }; }
  const fk = focusKey();
  const age = backupAgeDays(p);
  const stale = age === null ? Date.now() - p.createdAt > 7 * 86400000 : age >= 7;
  const showUpd = update && !update.dismissed && !goku.busy;
  $('#app').innerHTML = `${showUpd ? `<div class="updbar" role="status"><span>A new version of Goku is ready.</span>
      <span class="row" style="gap:8px"><button class="cta2" id="updLater">Later</button><button class="cta" id="updNow" style="width:auto;min-height:44px;padding:0 16px">Update</button></span></div>` : ''}
    ${p.demo ? '<div class="demobar" role="status"><span>This is a sample with made-up data.</span><button class="cta2" id="demoEnd">Start my own</button></div>' : ''}
    <header class="top">
      <button class="chip" id="switch" aria-label="Profile: ${esc(p.name)}. ${S.profiles.length > 1 ? 'Switch or add a profile' : 'Add a profile'}">
        <span class="aura${charged ? ' charged' : ''} ${stage}" title="${esc(stageName)}${charged ? ' · protein goal reached today' : ''}">${form ? auraSVG(form, 36) : ''}${avatarHTML(p, 36)}</span><span class="chipname"><span class="cn">${esc(p.name.trim().split(/\s+/)[0])}</span>${p.coach?.wish === 'title' ? `<small class="wtitle">${esc(W('master'))}</small>` : ''}</span><span class="sub" aria-hidden="true">${GLY.swap}</span></button>
      <div class="meta"><div>${prettyDay(today())}</div>${stale ? `<button class="badge" id="bk">${age === null ? 'Not backed up' : `Backup: ${age} days ago`}</button>` : ''}</div>
    </header>
    <main id="main">${view.html}${view.cta && !view.ctaShown ? `<button class="cta pagecta" id="pageCta">${esc(view.cta[0])}</button>` : ''}</main>`;
  // Gentle Motion (2.20, review 10): a short fade when the tab changes, never on a redraw of the same tab.
  const shown = p.id + ':' + tab;
  if (lastShown && lastShown !== shown) $('#main').classList.add('fadein');
  lastShown = shown;
  try { view.bind?.($('#main')); } catch (e) { console.error(e); }
  if (tab === 'home' && !view.failed) loggedEntries(p).then(all => maybeOver9000(p, all, today())).catch(() => {});
  if (view.failed && $('#errSettings')) $('#errSettings').onclick = () => { openSettingsGroup('backup'); go('settings'); };
  drawnDay = today();
  // The page's own action at the bottom (2.8.2): Quick add stays a menu, so Save and Add are on the page too.
  if (view.cta && !view.ctaShown) $('#pageCta').onclick = () => view.cta[1]();
  // Tab bar (2.2): three main tabs with icons, a big center action, and More for the rest.
  // On desktop the same items line up in the sidebar, the action on top.
  const all = [...list, ...(list.some(([id]) => id === 'settings') ? [] : [['settings', 'Settings']])].filter(x => !x[2]);
  const main = all.filter(([id]) => !['history', 'settings', 'skills'].includes(id)).slice(0, 3);
  const more = all.filter(x => !main.includes(x));
  let action = view.cta || null;
  if (!action && scr.mainAction) { try { action = await scr.mainAction(); } catch (e) { console.error(e); } }
  const tabBtn = ([id, label], cls = '') => `<button data-tab="${id}" class="tb ${cls}" ${id === tab ? 'aria-current="page"' : ''}>${ICON[id] || ICON.more}<span>${label}</span></button>`;
  const inMore = more.some(([id]) => id === tab);
  $('#dock').innerHTML = `<div class="dock-in">
    <div class="brand" aria-hidden="true"><img src="icons/favicon-48.png" alt="" width="28" height="28"><span>Goku</span></div>
    <nav class="tabs" aria-label="Sections">${main.slice(0, 2).map(t => tabBtn(t)).join('')}
      <button class="tb center" id="cta" aria-label="Quick add${action ? ': ' + esc(action[0]) + ' and more' : ''}" aria-haspopup="dialog"><span class="ki-btn">${ICON.plus}</span><span>Quick add</span></button>
      ${main.slice(2).map(t => tabBtn(t)).join('')}
      ${more.map(t => tabBtn(t, 'more-item')).join('')}
      ${more.length ? `<button class="tb more-btn" data-tab="you" ${inMore || tab === 'you' ? 'aria-current="page"' : ''} aria-label="You: ${esc(more.map(m => m[1]).join(', '))}">${ICON.you}<span>You</span></button>` : ''}</nav></div>`;
  // The center button, "Quick add" since 2.8.1 (it was labelled with the first action), opens the Ki menu (2.3): this screen's action first, then quick logs.
  $('#cta').onclick = () => kiMenu(p, action, scr);
  if (!(await db.getMeta('kiHint'))) showKiHint();
  if (fk) { const el = document.querySelector(fk); // Chi-Chi 2: a control that is now disabled hands focus to a neighbour in its row
    (el?.disabled ? el.parentElement.querySelector('button:not([disabled])') : el)?.focus({ preventScroll: true }); }
}

async function open(id) {
  if (S.current !== id) tabs[id] = 'home'; // opening someone else's profile starts on their Home
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

// With two profiles a tap opens the same small picker as with more (2.8.2): switch, or Add a profile.
async function chooseProfile() {
  const pick = await ask('Switch profile', 'Each profile keeps its own data and passcode.',
    [...S.profiles.map(x => ({ label: `${x.name} · ${kindLabel(x)}`, value: x.id })), { label: 'Add a profile', value: 'add' }]);
  if (pick === 'add') { const np = await onboard({ cancellable: true }); if (np) return open(np.id); }
  if (pick && pick !== 'add') return open(pick);
  if (!isUnlocked(profile())) return open(S.current);
}

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tab) { if (b.dataset.tab === 'settings') openSettingsGroup(null); go(b.dataset.tab); }
  else if (b.dataset.hview && !b.closest('.overlay')) { setHomeView(b.dataset.hview); tabs[S.current] = 'home'; render().then(() => window.scrollTo(0, 0)); }
  else if (b.dataset.go && !b.closest('.overlay')) go(b.dataset.go);
  else if (b.dataset.ki !== undefined) { const v = toggleKi(); b.closest('.ki').classList.toggle('open', v); b.setAttribute('aria-expanded', v); }
  else if (b.id === 'switch') {
    if (goku.busy) return toast('Finish your session first');
    if (S.profiles.length > 1) chooseProfile();
    else onboard({ cancellable: true }).then(np => np && open(np.id));
  } else if (b.id === 'bk') { openSettingsGroup('backup'); go('settings'); }
  else if (b.id === 'demoEnd') import('./demo.js').then(m => m.endDemo(profile()));
  else if (b.id === 'updLater') { update.dismissed = true; render(); }
  else if (b.id === 'updNow') applyUpdate();
  else if (b.dataset.why && WHY[b.dataset.why]) { const [t, html] = WHY[b.dataset.why](profile(), b.dataset.arg); ask(t, (skinOf(profile()) === 'dbz' ? '<img class="tipspic" src="img/pose/protips.png" alt="" aria-hidden="true" width="120" height="120">' : '') + html, []); } // Pro Tips Goku (2.21)
  else if (b.dataset.setup) setupFlow(profile(), async p => { await saveProfile(p); render(); }, { only: b.dataset.setup });
});

// Keeps the page's bottom padding equal to the dock's real height (it grows with text size).
// 2.9: the whole bar counts (padding, border and the iPhone home-bar area), plus the + button
// that pokes up above it. On desktop the dock is a side menu, so nothing is reserved.
const wide = matchMedia('(min-width: 900px)');
const dockSize = () => {
  const d = $('#dock'), top = d.getBoundingClientRect().top, btn = d.querySelector('.ki-btn');
  const poke = btn ? Math.max(0, top - btn.getBoundingClientRect().top) : 0;
  document.documentElement.style.setProperty('--dock-h', wide.matches || !d.offsetHeight ? '0px' : Math.ceil(d.offsetHeight + poke) + 'px');
};
new ResizeObserver(dockSize).observe($('#dock'));
new MutationObserver(dockSize).observe($('#dock'), { childList: true });
wide.addEventListener('change', dockSize);
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
      <button class="link" id="anyway" style="width:100%">Try It in Safari Anyway<span class="gatehint" data-raw>Data kept in a Safari tab may be deleted</span></button>`;
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

let profilesLoaded = false; // set once the saved profiles are read, so a new phone and an existing user aren't confused
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    // With no profile yet (install screen, first setup) there's nothing to lose, so a new version
    // goes live at once (2.10.1); otherwise the Update bar asks first.
    const ready = () => { if (update) return; update = { reg, dismissed: false }; if (profilesLoaded && !S.profiles.length && !document.querySelector('.overlay')) return applyUpdate(); if (profile()) render(); };
    if (reg.waiting && navigator.serviceWorker.controller) ready();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ready(); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadOnChange) { reloadOnChange = false; location.reload(); } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !goku.busy) reg.update().catch(() => {}); });
  } catch { /* offline first load or file:// — the app still runs */ }
}

// Android's Back button (2.8.1): one spare history entry sits on top, so Back closes the open sheet
// first, asks before leaving a workout, and otherwise leaves the app as before.
function watchBack() {
  history.replaceState({ goku: 'base' }, '');
  history.pushState({ goku: 'guard' }, '');
  let leaving = false;
  // Still here after Back (an installed app can't be closed from the page): the next tap puts the spare entry back.
  addEventListener('click', () => { if (leaving) { leaving = false; history.pushState({ goku: 'guard' }, ''); } }, true);
  addEventListener('popstate', async () => {
    if (leaving) return; // back on the bottom entry: the next Back leaves
    const top = [...document.querySelectorAll('.overlay')].pop();
    if (top && top.id !== 'runner') {
      // Setup's own Back goes one step back (2.8.2), so first-time setup doesn't close and lose its answers.
      const x = top.querySelector('[data-goback]') || top.querySelector('[data-close]');
      if (x) { history.pushState({ goku: 'guard' }, ''); x.click(); return; }
    }
    if (document.getElementById('runner')) {
      history.pushState({ goku: 'guard' }, '');
      if (await ask('Close Goku?', 'Your workout stays saved and picks up where you left off.', [{ label: 'Close Goku', value: 'leave' }]) === 'leave') { leaving = true; history.go(-2); }
      return;
    }
    leaving = true; history.back(); // nothing to close: leave the app
  });
}

async function boot() {
  registerSW();
  watchBack();
  startTitleCase();
  if (isIOS && !standalone) { await loadProfiles(); profilesLoaded = true; if (update && !S.profiles.length) return applyUpdate(); await installGate(); }
  await loadProfiles(); profilesLoaded = true;
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
