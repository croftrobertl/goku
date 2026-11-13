// Settings, profile management, and backup (export / import).
import { S, profile, saveProfile, KINDS, newProfile, capName, liveModules, soonModules, kindLabel, today } from './state.js';
import * as db from './db.js';
import { encryptJSON, decryptJSON } from './crypto.js';
import { showLock, lockNow } from './lock.js';
import { onboard, ACCENTS, ACCENT_NAMES } from './onboarding.js';
import { cleanBackup } from './validate.js';
import { planId, onHold } from './plan.js';
import { esc, ask, overlay, toast, guard } from './ui.js';
import { VERSION } from './version.js';
import { dayKey } from './time.js';
import { phoneCheck } from './devcheck.js';
import { THEMES, MODES } from './themes.js';
import { w, W, SKINS, skinOf, themeName } from './skins.js';
import { avatarHTML, avatarName, avatarPicker, pickAvatar, photoToAvatar } from './avatar.js';
import { QUESTIONS, essentials, setupFlow, goalsFor, EQUIPMENT, ALLERGIES, TZS } from './coach.js';
import { editHome } from './homelayout.js';
import { weight, weightUnit, length, lengthUnit } from './units.js';
import { deviceTZ, TZ, nextDayStart } from './time.js';
import { parseHealth, saveHealth, RECIPE } from './health.js';

export const SCHEMA_VERSION = 1;
const DAY = 86400000;

// ---------- Export format (documented in README) ----------
// Timestamps end in "At". dayEndsAt is an hour (0-6), not a timestamp, so it stays a number.
const isStamp = k => k.endsWith('At') && k !== 'dayEndsAt';
const toISO = o => { const r = { ...o }; for (const k in r) if (isStamp(k) && typeof r[k] === 'number') r[k] = r[k] ? new Date(r[k]).toISOString() : null; return r; };
const fromISO = o => { const r = { ...o }; for (const k in r) if (k.endsWith('At') && typeof r[k] === 'string') r[k] = Date.parse(r[k]) || 0; return r; };

export async function buildExport(p) {
  const list = await db.byIndex('entries', 'profile', p.id);
  const { lock, ...rest } = p;
  return {
    app: 'goku', schemaVersion: SCHEMA_VERSION, appVersion: VERSION, exportedAt: new Date().toISOString(),
    profile: toISO({ ...rest, lockRemember: lock.remember }),
    entries: list.map(e => ({ ...toISO({ id: e.id, type: e.type, day: e.day, updatedAt: e.updatedAt }),
      time: new Date(e.ts).toISOString(), data: toISO(e.data) })),
  };
}

function parseExport(obj) {
  if (obj?.app !== 'goku' || typeof obj.schemaVersion !== 'number') throw new Error("This file isn't a Goku backup.");
  if (obj.schemaVersion > SCHEMA_VERSION) throw new Error('This backup is from a newer version of Goku. Update the app first.');
  const raw = (Array.isArray(obj.entries) ? obj.entries : []).map(e => e && typeof e === 'object'
    ? { id: e.id, type: e.type, day: e.day, ts: Date.parse(e.time), updatedAt: Date.parse(e.updatedAt), data: e.data && typeof e.data === 'object' ? fromISO(e.data) : null }
    : null);
  const out = cleanBackup(obj.profile && typeof obj.profile === 'object' ? fromISO(obj.profile) : null, raw);
  // A backup from a newer Goku may hold answers this version doesn't know and would drop (2.15).
  const num = v => String(v || '').split('.').map(n => parseInt(n, 10) || 0);
  const [a, b] = [num(obj.appVersion), num(VERSION)];
  out.newer = a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2] ? true : false;
  out.madeBy = typeof obj.appVersion === 'string' ? obj.appVersion.slice(0, 12) : '';
  return out;
}

// ---------- Export: build first, then share from a fresh tap ----------
// Building (and encrypting) can take a moment, and iOS only opens the share sheet
// straight after a tap, so the file is prepared before the "Save" button appears.
export async function exportNow(encrypted = false) {
  const p = profile();
  let payload = await buildExport(p);
  if (encrypted) {
    const pass = await passphrase(true);
    if (!pass) return;
    toast('Encrypting…');
    payload = await encryptJSON(payload, pass);
  }
  const stamp = dayKey(Date.now(), 0, p.tz); // today's date in the profile's time zone
  const safe = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
  const name = `goku-${safe}-${stamp}${encrypted ? '-encrypted' : ''}.json`;
  const file = new File([JSON.stringify(payload, null, 1)], name, { type: 'application/json' });
  const canShare = !!navigator.canShare?.({ files: [file] });
  const { el, close } = overlay(`<div class="scroll" style="display:flex;flex-direction:column;justify-content:center">
    <p class="lbl">Backup ready</p><h1 data-raw>${esc(name)}</h1>
    <p class="sub" style="margin:8px 0 16px">${Math.max(1, Math.round(file.size / 1024))} KB · ${payload.entries ? payload.entries.length + ' entries' : 'encrypted'}.
    ${canShare ? 'Choose <b>Save to Files</b>, then iCloud Drive, so it survives a lost phone.' : 'Your browser will download it. Move it somewhere safe, like iCloud Drive.'}</p>
    <p class="msg" id="m" role="status"></p>
    ${canShare ? '<button class="cta" id="share">Save or share</button>' : ''}
    <button class="${canShare ? 'cta2' : 'cta'}" id="dl" style="width:100%;margin-top:10px">Download instead</button>
    <button class="cta2" id="x" data-close style="width:100%;margin-top:10px">Not now</button></div>`, { label: 'Backup ready' });
  const done = async how => {
    p.lastBackupAt = Date.now(); await saveProfile(p); close();
    toast(how === 'download' ? 'Downloaded. Check that it reached the Files app.' : 'Backup saved');
    window.goku.render();
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') close();
    if (b.id === 'share') {
      // No title: iOS saves a title as a stray text file next to the backup.
      try { await navigator.share({ files: [file] }); await done('share'); }
      catch (err) { if (err.name !== 'AbortError') el.querySelector('#m').textContent = "The share sheet didn't open. Try Download instead."; }
    }
    if (b.id === 'dl') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      await done('download');
    }
  });
}

function passphrase(creating) {
  return new Promise(resolve => {
    const { el, close } = overlay(`<h1>${creating ? 'Encrypt backup' : 'Encrypted backup'}</h1>
      <p class="sub" style="margin:8px 0">${creating
        ? 'Choose a passphrase. <b>If you forget it, this backup can never be opened.</b> Nobody, including the app, can recover it.'
        : 'Enter the passphrase used when this backup was made.'}</p>
      <label class="f"><span>Passphrase</span><input id="p1" type="password" autocomplete="off"></label>
      ${creating ? '<label class="f"><span>Repeat passphrase</span><input id="p2" type="password" autocomplete="off"></label>' : ''}
      <p class="msg" id="m" role="status"></p>
      <button class="cta" id="ok" style="margin-top:12px">${creating ? 'Encrypt' : 'Open backup'}</button>
      <button class="cta2" id="no" data-close style="width:100%;margin-top:8px">Cancel</button>`, { label: 'Passphrase' });
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'no') { close(); resolve(null); }
      if (b.id === 'ok') {
        const a = el.querySelector('#p1').value, c = el.querySelector('#p2')?.value;
        if (a.length < 8) { el.querySelector('#m').textContent = 'Use at least 8 characters.'; return; }
        if (creating && a !== c) { el.querySelector('#m').textContent = "The passphrases don't match."; return; }
        close(); resolve(a);
      }
    });
  });
}

// ---------- Import: only ever touches the open profile, or adds a new one ----------
export function importFlow() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json,.json';
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    try {
      if (f.size > 50 * 1024 * 1024) throw new Error('That file is too large to be a Goku backup.');
      let obj;
      try { obj = JSON.parse(await f.text()); } catch { throw new Error("This file isn't a Goku backup."); }
      if (obj?.encrypted) {
        const pass = await passphrase(false); if (!pass) return;
        try { obj = await decryptJSON(obj, pass); } catch { throw new Error("That passphrase didn't open this backup."); }
      }
      await previewImport(parseExport(obj));
    } catch (e) { await ask("Couldn't import", esc(e.message || 'The file could not be read.'), []); }
  };
  input.click();
}

// The profile a backup describes, built fresh for this phone (shared by Import → Add profile and the welcome screen's restore).
function profileFromBackup(prof) {
  const { lockRemember, ...rest } = prof, fresh = newProfile(prof.kind, prof.name);
  return { ...fresh, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)), accent: rest.accent || fresh.accent, modules: { ...fresh.modules, ...rest.modules },
    settings: { ...fresh.settings, ...Object.fromEntries(Object.entries(rest.settings).filter(([, v]) => v !== null)) },
    lock: { ...fresh.lock, remember: lockRemember } };
}
// "I have a backup" on the welcome screen (2.16): pick the file, see what's in it, set a passcode. Resolves with the profile, or null.
export function restoreFirst() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return resolve(null);
      try {
        if (f.size > 50 * 1024 * 1024) throw new Error('That file is too large to be a Goku backup.');
        let obj;
        try { obj = JSON.parse(await f.text()); } catch { throw new Error("This file isn't a Goku backup."); }
        if (obj?.encrypted) {
          const pass = await passphrase(false); if (!pass) return resolve(null);
          try { obj = await decryptJSON(obj, pass); } catch { throw new Error("That passphrase didn't open this backup."); }
        }
        const { prof, entries, skipped, newer, madeBy } = parseExport(obj);
        if (newer && !(await ask('This backup is from a newer Goku', `It was made by version ${esc(madeBy)}; this phone has ${esc(VERSION)}. Newer kinds of answers would be left out. Update Goku first if you can.`,
          [{ label: 'Import anyway', value: true }]))) return resolve(null);
        const days = entries.map(e => e.day).filter(d => d > '1970-01-01').sort();
        if (!(await ask('Restore this backup?', `<b>${esc(prof.name)}</b> · ${esc(kindLabel(prof))}<br>${entries.length} entries${days.length ? `, from ${esc(days[0])} to ${esc(days.at(-1))}` : ''}
          ${skipped ? `<br>${skipped} damaged entr${skipped === 1 ? 'y' : 'ies'} will be skipped.` : ''}<br><br>Next you choose a passcode for it on this phone.`, [{ label: 'Restore', value: true }]))) return resolve(null);
        const p = profileFromBackup(prof);
        await db.putMany('entries', entries); await saveProfile(p); await db.setMeta('seeded:' + p.id, true);
        await showLock(p, { mode: 'create' });
        resolve(p);
      } catch (e) { await ask("Couldn't restore", esc(e.message || 'The file could not be read.'), []); resolve(null); }
    };
    input.click();
  });
}

async function previewImport({ prof, entries, skipped, newer, madeBy }) {
  const cur = profile();
  if (newer && !(await ask('This backup is from a newer Goku', `It was made by version ${esc(madeBy)}; this phone has ${esc(VERSION)}. Newer kinds of answers would be left out. Update Goku first if you can.`,
    [{ label: 'Import anyway', value: true }]))) return;
  const other = S.profiles.find(p => p.id === prof.id && p.id !== cur.id);
  if (other) {
    await ask('This backup belongs to another profile', `It's a backup of <b>${esc(other.name)}</b>. To protect their data, open their profile (with their passcode) and import it there.`, []);
    return;
  }
  const mine = prof.id === cur.id;
  const counts = {};
  for (const e of entries) counts[e.type] = (counts[e.type] || 0) + 1;
  const days = entries.map(e => e.day).filter(d => d > '1970-01-01').sort();
  const body = `<b>${esc(prof.name)}</b> · ${esc(kindLabel(prof))}<br>
    ${Object.entries(counts).map(([k, n]) => `${n} ${esc(k)}${n === 1 ? '' : 's'}`).join(' · ') || 'No entries'}<br>
    ${days.length ? `From ${esc(days[0])} to ${esc(days[days.length - 1])}` : ''}
    ${skipped ? `<br>${skipped} damaged entr${skipped === 1 ? 'y' : 'ies'} will be skipped.` : ''}<br><br>
    ${mine ? `<b>Merge</b> keeps everything here and adds or updates entries from the backup (the newer copy of each wins).<br>
      <b>Replace</b> swaps this profile's entries for the backup's, all at once.`
      : 'This profile is not on this phone yet. It will be added as a new profile, and you will set its passcode.'}`;
  const choice = await ask('Import this backup?', body, mine
    ? [{ label: 'Merge', value: 'merge' }, { label: 'Replace', value: 'replace' }]
    : [{ label: 'Add profile', value: 'add' }]);
  if (!choice) return;
  if (choice === 'replace' && !(await ask('Replace everything?',
    `All entries for ${esc(cur.name)} on this phone will be swapped for the backup's. If anything goes wrong, nothing is changed. Export a backup first if you're unsure.`,
    [{ label: 'Replace', value: true, danger: true }]))) return;
  const { lockRemember, ...rest } = prof;
  try {
    if (choice === 'add') {
      const p = profileFromBackup(prof);
      await db.putMany('entries', entries);
      await saveProfile(p);
      await db.setMeta('seeded:' + p.id, true);
      if (await showLock(p, { mode: 'create' })) window.goku.open(p.id);
      else window.goku.render();
    } else if (choice === 'replace') {
      await db.replaceProfileEntries(cur.id, entries);
      Object.assign(cur, { name: rest.name, accent: rest.accent || cur.accent, dayEndsAt: rest.dayEndsAt, modules: { ...cur.modules, ...rest.modules },
        units: rest.units || cur.units, tz: rest.tz || cur.tz, custom: rest.custom, about: rest.about || cur.about, coach: rest.about ? rest.coach || cur.coach : cur.coach,
        avatar: rest.avatar === undefined ? cur.avatar : rest.avatar,
        // Duels stay as chosen on this phone, and an older backup without a Home layout keeps this one.
        settings: { ...cur.settings, ...Object.fromEntries(Object.entries(rest.settings).filter(([k, v]) => v !== null && k !== 'duel' && !(['homeOrder', 'homeHidden'].includes(k) && !v.length))) } });
      await saveProfile(cur);
    } else {
      const here = new Map((await db.byIndex('entries', 'profile', cur.id)).map(e => [e.id, e]));
      await db.putMany('entries', entries.filter(e => !here.has(e.id) || (e.updatedAt || 0) > (here.get(e.id).updatedAt || 0)));
    }
    toast('Import complete');
  } catch (e) {
    await ask('Import stopped', `Nothing was changed. (${esc(e.message || 'Unknown error')})`, []);
  }
  window.goku.render();
}

export const backupAgeDays = p => p.lastBackupAt ? Math.floor((Date.now() - p.lastBackupAt) / DAY) : null;

async function deleteThisProfile() {
  const p = profile();
  const sure = await ask(`Delete ${p.name}?`,
    `Every session, check-in and log for <b>${esc(p.name)}</b> on this phone will be erased. This can't be undone. Export a backup first if you might want it back.`,
    [{ label: 'Export a backup first', value: 'export' }, { label: 'Delete profile', value: 'delete', danger: true }]);
  if (sure === 'export') return exportNow(false);
  if (sure !== 'delete') return;
  if (!(await showLock(p, { mode: 'verify', cancellable: true }))) return;
  await db.deleteProfile(p.id);
  S.profiles = S.profiles.filter(x => x.id !== p.id);
  toast('Profile deleted');
  if (S.profiles.length) window.goku.open(S.profiles[0].id);
  else { const np = await onboard(); window.goku.open(np.id); }
}

function healthImport() {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.txt,.csv,text/plain,text/csv' });
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    try { await readHealthFile(f); } catch (e) { ask('Import stopped', `Nothing was changed. (${esc(e.message || 'Unknown error')})`, []); }
  };
  input.click();
}
async function readHealthFile(f) {
    if (f.size > 2e6) return ask("That file is too big", "A Scouter file is usually a few kilobytes. Pick the file the shortcut saved.", []);
    const r = parseHealth(await f.text(), profile());
    if (!r.nights.length && !r.workouts.length) return ask('Nothing to import', `No sleep or workout lines were found${r.bad ? ` (${r.bad} lines weren't recognized)` : ''}. See "How to set up the shortcut".`, []);
    const ok = await ask('Import from Health?', `${r.nights.length} night${r.nights.length === 1 ? '' : 's'} of sleep and ${r.workouts.length} workout${r.workouts.length === 1 ? '' : 's'}${r.bad ? `; ${r.bad} lines skipped` : ''}. Workouts are added as other training; sleep fills in your check-ins and recovery notes.`, [{ label: 'Import', value: true }]);
    if (!ok) return;
    const n = await saveHealth(r); toast(n ? `Imported ${n} new item${n === 1 ? '' : 's'}` : 'Already up to date'); window.goku.render();
}

const saveAndDraw = async p => { await saveProfile(p); window.goku.render(); };

// Readable summary of each coach answer for the About you list.
function aboutRows(p) {
  const a = p.about || {};
  const pick = (list, v) => list.find(x => x[0] === v)?.[1];
  const qs = essentials(p).concat(QUESTIONS.filter(q => ['meals', 'sleep', 'comp'].includes(q.id) && (!q.kinds || q.kinds.includes(p.kind))));
  const shown = {
    units: `${p.units === 'metric' ? 'Metric' : 'US units'} · ${p.tzNext?.tz || p.tz || TZ}`,
    birthYear: a.birthYear ? String(a.birthYear) : '',
    body: [a.heightIn != null ? `${length(a.heightIn, p)} ${lengthUnit(p)}` : '', a.weightLb != null ? (p.kind === 'perf' ? 'weight saved' : `${weight(a.weightLb, p)} ${weightUnit(p)}`) : ''].filter(Boolean).join(' · '),
    experience: pick(QUESTIONS.find(q => q.id === 'experience').options, a.experience),
    goal: pick(goalsFor(p), a.goal),
    equipment: a.equipment ? (a.equipment.map(v => pick(EQUIPMENT, v)).join(', ') || 'Bodyweight only') : '',
    days: a.days ? a.days + ' days a week' : '',
    diet: { any: 'Everything', pescatarian: 'Pescatarian', vegetarian: 'Vegetarian', vegan: 'Vegan' }[a.diet],
    allergies: a.allergies ? ([...a.allergies.map(v => pick(ALLERGIES, v)), a.allergyOther].filter(Boolean).join(', ') || 'None') : '',
    limits: a.limits === '' ? 'None' : a.limits,
    meals: a.meals ? a.meals + ' a day' : '',
    sleep: a.sleepH ? a.sleepH + ' hours' : '',
    comp: a.comp || '',
  };
  return qs.map(q => [q.id, q.title.replace(/\?$/, ''), shown[q.id === 'sleep' ? 'sleep' : q.id]]);
}

function avatarSheet(p) {
  const { el, close } = overlay(`<div class="row"><h1>Avatar</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="av"></div>`, { label: 'Choose an avatar' });
  const draw = () => { el.querySelector('#av').innerHTML = avatarPicker(p); };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') { close(); window.goku.render(); return; }
    if (b.dataset.avatar) { pickAvatar(p, b.dataset.avatar); await saveProfile(p); draw(); }
  });
  el.addEventListener('change', async e => {
    if (!e.target.matches('[data-avatar-photo]')) return;
    try { p.avatar = await photoToAvatar(e.target.files[0]); e.target.value = ''; await saveProfile(p); draw(); }
    catch (err) { toast(err.message || "That photo couldn't be read."); }
  });
  draw();
}

// ---------- Settings screen ----------
// Settings in groups (2.16, review 10): eight rows, each opening its own page, with a search box.
// The full page is still built in one piece below; this picks which of its sections to show.
const GROUPS = [
  ['look', 'Profile and Look', /^(Profile|Skin|Theme)$/],
  ['shows', 'What the App Shows', /^What the app shows$/],
  ['training', 'Training', /^(Starting point|Protein target|Duels|Sound)$/],
  ['units', 'Units and Time', /^Units and time$/],
  ['about', 'About You', /^About you$/],
  ['backup', 'Backup and Health', /^(Backup|.* link · Apple Health)$/],
  ['pass', 'Passcode and Profiles', /^(Passcode|Profiles on this phone)$/],
  ['goku', 'About Goku', /^About$/],
];
let openGroup = null, findText = '';
export const openSettingsGroup = g => { openGroup = g; findText = ''; };
const plain = h => h.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
export async function settingsView() {
  const p = profile(), full = await settingsFull();
  const secs = (full.html.match(/<section class="card"[\s\S]*?<\/section>/g) || []).map(h => {
    const label = plain(h.match(/<p class="lbl"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '').trim();
    return { h, label, g: GROUPS.find(([, , rx]) => rx.test(label))?.[0] || 'goku' };
  });
  if (openGroup && !GROUPS.some(g => g[0] === openGroup)) openGroup = null;
  const age = backupAgeDays(p), mods = liveModules(p.kind), onN = mods.filter(([k]) => p.modules[k] !== false).length;
  const asked = essentials(p).length;
  const state = {
    look: `${SKINS[skinOf(p)]?.name || ''} · ${themeName(p.settings.theme || 'capsule', THEMES[p.settings.theme] || THEMES.capsule)}`,
    shows: `${onN} of ${mods.length} on`,
    training: p.kind === 'engine' ? `${p.settings.proteinTarget ? p.settings.proteinTarget + ' g protein · ' : ''}Sound ${p.settings.sound !== false ? 'on' : 'off'}` : `Sound ${p.settings.sound !== false ? 'on' : 'off'}`,
    units: `${p.units === 'metric' ? 'kg · cm · ml' : 'lb · in · oz'} · ${(p.tz || '').split('/').pop().replace(/_/g, ' ')}`,
    about: `${asked} answers your coach uses`,
    backup: age === null ? 'Never backed up' : age === 0 ? 'Backed up today' : `Backed up ${age} day${age === 1 ? '' : 's'} ago`,
    pass: `${S.profiles.length} profile${S.profiles.length === 1 ? '' : 's'} on this phone`,
    goku: `Version ${VERSION}`,
  };
  const row = ([id, name]) => `<li><button class="itemrow" data-sgroup="${id}"><span><b>${name}</b><br><span class="chain" data-raw="">${esc(state[id])}</span></span><span class="chev" aria-hidden="true">›</span></button></li>`;
  const q = findText.trim().toLowerCase();
  const hits = q ? secs.filter(x => plain(x.h).toLowerCase().includes(q)) : [];
  const html = openGroup
    ? `<div class="row"><button class="cta2" id="sback" aria-label="Back to Settings">‹ Settings</button></div><h1>${GROUPS.find(g => g[0] === openGroup)[1]}</h1>${secs.filter(x => x.g === openGroup).map(x => x.h).join('')}`
    : `<h1>Settings</h1><input type="search" id="sfind" placeholder="Search settings" aria-label="Search settings" value="${esc(findText)}" style="width:100%;margin-bottom:12px">
      ${q ? (hits.length ? hits.map(x => x.h).join('') : '<div class="empty"><p>Nothing in Settings matches that.</p></div>')
        : `<section class="card"><ul class="list">${GROUPS.slice(0, 5).map(row).join('')}</ul></section><section class="card"><ul class="list">${GROUPS.slice(5).map(row).join('')}</ul></section>`}`;
  return { html, bind(root) {
    full.bind(root);
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sgroup) { openGroup = b.dataset.sgroup; window.goku.render().then(() => window.scrollTo(0, 0)); }
      if (b.id === 'sback') { openGroup = null; window.goku.render().then(() => window.scrollTo(0, 0)); }
    });
    let timer; root.querySelector('#sfind')?.addEventListener('input', e => { findText = e.target.value; clearTimeout(timer);
      timer = setTimeout(async () => { await window.goku.render(); const i = document.querySelector('#sfind'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
  } };
}

// "You" (2.16, review 10): the fifth tab on a phone. Your name and streak, then History and the settings people open most.
export async function youView(streakDays, pages = [['history', 'History']]) {
  const SUBS = { history: 'Calendar, sessions and records', skills: 'Each skill from learning to competition-ready' };
  const p = profile(), age = backupAgeDays(p), mods = liveModules(p.kind), onN = mods.filter(([k]) => p.modules[k] !== false).length;
  const row = (go, name, sub) => `<li><button class="itemrow" data-you="${go}"><span><b>${name}</b><br><span class="chain" data-raw="">${esc(sub)}</span></span><span class="chev" aria-hidden="true">›</span></button></li>`;
  const goals = await goalsCard(p);
  return { html: `<h1>You</h1>
    <section class="card"><div class="row"><span class="row" style="justify-content:flex-start;gap:12px">${avatarHTML(p, 48)}<span><b style="font-size:1.25rem">${esc(p.name)}</b><br><span class="sub">${esc(kindLabel(p))}</span></span></span>
      <span style="text-align:right"><b class="num" style="font-size:1.25rem">${streakDays}</b><br><span class="sub">day streak</span></span></div></section>
    ${goals}
    <section class="card"><ul class="list">
      ${pages.map(([id, name]) => row('page:' + id, esc(name), SUBS[id] || '')).join('')}
      ${row('look', 'Look', `${SKINS[skinOf(p)]?.name || ''} · ${themeName(p.settings.theme || 'capsule', THEMES[p.settings.theme] || THEMES.capsule)}`)}
      ${row('shows', 'What the App Shows', `${onN} of ${mods.length} on`)}
      ${row('backup', 'Backup', age === null ? 'Never backed up' : age === 0 ? 'Backed up today' : `Backed up ${age} day${age === 1 ? '' : 's'} ago`)}
      ${row('all', 'All Settings', 'Units, passcode, sound and more')}</ul></section>`,
    bind(root) { root.addEventListener('click', async e => {
      const gb = e.target.closest('[data-goal]'); // My Goals: each Edit opens where that target is set
      if (gb) { const k = gb.dataset.goal;
        if (k === 'days' || k === 'sleep') return; // handled by the app's data-setup handler
        if (k === 'kcal') return (await import('./nutrition.js')).setTarget(p);
        if (k === 'weight') return window.goku.go('saga');
        openSettingsGroup('training'); return window.goku.go('settings'); }
      const b = e.target.closest('[data-you]'); if (!b) return; const k = b.dataset.you;
      if (k.startsWith('page:')) return window.goku.go(k.slice(5));
      openSettingsGroup(k === 'all' ? null : k); window.goku.go('settings'); }); } };
}

// My Goals (2.19, review 12): every target in one list with progress; each Edit opens where that target is set.
// Only goals that apply to this profile show; one that isn't set says so and offers Set.
async function goalsCard(p) {
  const { entries } = await import('./state.js'), { addDays, weekStart } = await import('./time.js');
  const t = today(), wk = weekStart(t), eng = p.kind === 'engine', bodyOn = eng || p.settings.bodyGoals === true;
  const { planId, moveGoal } = await import('./plan.js');
  const food = (await entries('food', p)).find(e => e.day === t)?.data.items || [], sum = k => Math.round(food.reduce((a, i) => a + (i.n?.[k] || 0), 0));
  const sessions = eng ? (await entries('session', p)).filter(s => s.day >= wk) : [], acts = (await entries('activity', p)).filter(a => a.day >= wk);
  const guts = (await entries('gut', p)).filter(g => g.day >= addDays(t, -7) && g.data.sleepH != null);
  const svg = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = { bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'), run: svg('<circle cx="15" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 4"/>'), drop: svg('<path d="M12 3c-3 4-6 6.5-6 10a6 6 0 0 0 12 0c0-3.5-3-6-6-10z"/>'),
    flame: svg('<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-6 6-6 9 0 1 .3 2 .8 2.8C7.5 14 7 13 7 12c-2 1.5-2 3-2 3 0 4 3 7 7 7z"/>'), scale: svg('<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 9a5 5 0 0 1 8 0"/><path d="M12 9l1.5-2"/>'), moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>') };
  const rows = [];
  const row = (k, icon, name, sub, pct, set, extra = '') => rows.push(`<li class="goal"><span class="gic">${icon}</span><span class="gtx"><b>${name}</b><br><span class="chain" data-raw>${esc(sub)}</span>
    ${pct != null ? `<span class="gbar"><i style="width:${Math.round(Math.min(1, pct) * 100)}%"></i></span>` : ''}</span><button class="cta2 rowedit" data-goal="${k}" ${extra} aria-label="${set ? 'Edit' : 'Set'} ${name}">${set ? 'Edit' : 'Set'}</button></li>`);
  if (eng && planId(p) !== 'food') { const d = +p.about?.days || 0; row('days', IC.bolt, 'Workouts', d ? `${d} a week · ${sessions.length} so far this week` : 'Not set', d ? sessions.length / d : null, !!d, 'data-setup="days"'); }
  if (eng && planId(p) === 'move') { const m = Math.round(sessions.reduce((a, s) => a + Math.max(1, (s.data.endedAt - s.data.startedAt) / 60000), 0) + acts.reduce((a, x) => a + (x.data.minutes || 0), 0)), g = moveGoal(p);
    row('move', IC.run, 'Move minutes', `${g} a week · ${m} so far this week`, m / g, true); }
  if (eng) { const g = p.settings.proteinTarget; row('protein', IC.drop, 'Protein', g ? `${g} g ${p.settings.proteinPer === 'meal' ? 'a meal' : 'a day'} · ${sum('p')} g today` : 'Not set · a range sized for you shows in Nutrition', g && p.settings.proteinPer !== 'meal' ? sum('p') / g : null, !!g); }
  if (bodyOn && p.modules.nutrition !== false) { const g = p.settings.kcalTarget; row('kcal', IC.flame, 'Calories', g ? `${g.toLocaleString('en-US')} a day · ${sum('kcal').toLocaleString('en-US')} today` : 'Not set', g ? sum('kcal') / g : null, !!g); }
  if (eng && (await import('./weight.js')).weightOn(p)) { const { arcsOf, arcProgress } = await import('./saga.js');
    const a = (await arcsOf(p)).filter(x => !x.data.done && x.data.link?.type === 'weight').pop(), pr = a ? arcProgress(a, { weighs: await entries('weigh', p) }) : null;
    row('weight', IC.scale, 'Weight', pr ? pr.label : 'Not set', pr ? pr.pct : null, !!a); }
  if (eng) { const h = p.about?.sleepH, got = guts.length ? Math.round(guts.reduce((a, g) => a + g.data.sleepH, 0) / guts.length * 10) / 10 : null;
    row('sleep', IC.moon, 'Sleep', h ? `${h} h a night${got != null ? ` · ${got} h this past week` : ''}` : 'Not set', h && got != null ? got / h : null, !!h, 'data-setup="sleep"'); }
  return rows.length ? `<section class="card goals"><p class="lbl">My Goals</p><ul class="list">${rows.join('')}</ul></section>` : '';
}

async function settingsFull() {
  const p = profile();
  const others = S.profiles.filter(x => x.id !== p.id);
  const age = backupAgeDays(p);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const soon = soonModules(p.kind);
  return {
    html: `<h1>Settings</h1>
    <div class="cols"><div>
    <section class="card" style="margin-top:12px"><p class="lbl">Profile</p>
      <div class="row" style="justify-content:flex-start;gap:12px">${avatarHTML(p, 56)}<span><b>${esc(avatarName(p))}</b><br>
        <button class="link" id="avatar" style="padding:0">Change avatar</button></span></div>
      <label class="f"><span>Name</span><input id="nm" value="${esc(p.name)}" maxlength="24"></label>
    </section>
    <section class="card"><p class="lbl">Skin</p>
      <p class="sub">Changes the words, avatars and look for you only. Everything works the same.</p>
      <div class="themes">${Object.entries(SKINS).map(([id, k]) => `<button data-skin="${id}" aria-pressed="${skinOf(p) === id}">
        <span><b>${esc(k.name)}</b><br><span class="sub">${esc(k.desc)}</span></span></button>`).join('')}</div>
    </section>
    <section class="card"><p class="lbl">Theme</p>
      <div class="themes">${Object.entries(THEMES).filter(([id, t]) => !t.locked || p.coach?.wish === 'theme').map(([id, t]) => `<button data-theme="${id}" aria-pressed="${(p.settings.theme || 'capsule') === id}">
        <span class="tsw" aria-hidden="true" style="background:${t.dark.s1};box-shadow:inset -18px 0 0 ${t.light.s1}"><i style="background:${t.accent}"></i></span>
        <span><b>${esc(themeName(id, t))}</b><br><span class="sub">${esc(t.desc)}</span></span></button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Light or dark">${MODES.map(([v, l]) => `<button data-mode="${v}" aria-pressed="${(p.settings.mode || 'auto') === v}">${l}</button>`).join('')}</div>
      <details class="tcustom"${p.accent !== THEMES[p.settings.theme || 'capsule']?.accent ? ' open' : ''}><summary>Customize this theme</summary>
        <p class="sub">Accent color for buttons and highlights. Picking a theme again resets it.</p>
        <div class="swatches">${ACCENTS.map(c => `<button style="background:${c}" data-acc="${c}" aria-pressed="${c === p.accent}" aria-label="${ACCENT_NAMES[c] || 'Color'}"></button>`).join('')}</div></details>
    </section>
    <section class="card"><p class="lbl">What the app shows</p>
      ${liveModules(p.kind).map(([k, n, d]) => `<label class="toggle"><span><b>${n}</b><br><span class="sub">${d}</span></span>
        <input type="checkbox" data-mod="${k}" ${p.modules[k] !== false ? 'checked' : ''}></label>`).join('')}
      ${p.kind === 'perf' ? `<label class="toggle"><span><b>Calorie target and waist size</b><br><span class="sub">Adds "Set a calorie target" and waist tracking to Nutrition. Off unless you turn it on.</span></span>
        <input type="checkbox" data-body ${p.settings.bodyGoals === true || p.settings.kcalTarget || p.settings.trackWaist ? 'checked' : ''}></label>` : ''}
      ${soon.length ? `<p class="lbl" style="margin-top:14px">Coming soon</p><p class="sub">${soon.map(m => esc(m[1])).join(' · ')}</p>` : ''}
      <button class="cta2" id="editHome" style="width:100%;margin-top:12px">Arrange Home cards</button>
    </section>
    ${p.kind === 'engine' ? `<section class="card"><p class="lbl">Starting point</p>
      <p class="sub">What Home and the workouts are built around. Setup's coach picked one; switch any time.</p>
      ${[['strength', 'Circuits', 'Timed circuits with a rest timer and a ghost to race.'], ['comeback', 'Comeback', 'Timed circuits from Easy, with a step up after two solid weeks.'], ['starter', 'Starter Workouts', 'One set of 8 to 12 reps of each move. No timer.'],
        ['move', 'Move More', 'A weekly minutes goal that builds toward 150, plus workouts.'], ['food', 'Food Only', 'Nutrition, check-ins and weight. No training screens.']]
        .map(([id, n, d]) => `<button class="card pick" data-plan="${id}" aria-pressed="${planId(p) === id}" style="text-align:left;padding:10px 14px;margin-top:8px"><b>${n}</b><br><span class="sub">${d}</span></button>`).join('')}
      ${onHold(p) ? '<p class="sub" style="margin-top:10px">Workouts are waiting for your doctor\'s OK. Tap “My doctor cleared me” on Home when you have it.</p>' : ''}
    </section>` : ''}
    ${p.kind === 'engine' ? `<section class="card"><p class="lbl">Protein target</p>
      <div class="row"><input id="pt" inputmode="numeric" value="${p.settings.proteinTarget ?? ''}" placeholder="grams" aria-label="Protein target in grams" style="width:120px">
      <div class="seg" style="margin:0;flex:1"><button data-per="day" aria-pressed="${p.settings.proteinPer === 'day'}">Per day</button><button data-per="meal" aria-pressed="${p.settings.proteinPer === 'meal'}">Per meal</button></div></div>
    </section>` : ''}
    <section class="card"><p class="lbl">Duels</p>
      <label class="toggle"><span><b>Duel other profiles on this phone</b><br><span class="sub">Shares only how many days you trained this week, with profiles that also turn this on. Off until you choose.</span></span>
        <input type="checkbox" data-duel ${p.settings.duel === true ? 'checked' : ''}></label>
    </section>
    <section class="card"><p class="lbl">Sound</p>
      ${[['sound', 'Sound cues', 'Beeps when rest ends and at the time cap.']].map(([k, n, d]) =>
        `<label class="toggle"><span><b>${n}</b><br><span class="sub">${d}</span></span><input type="checkbox" data-fb="${k}" ${p.settings[k] !== false ? 'checked' : ''}></label>`).join('')}
      <button class="cta2" id="devcheck" style="width:100%;margin-top:8px">Test my phone</button>
      <p class="note">Checks that the screen stays on, sound plays and saving works on this phone.</p>
    </section>
    <section class="card"><p class="lbl">Units and time</p>
      <div class="seg" role="group" aria-label="Units"><button data-units="imperial" aria-pressed="${p.units !== 'metric'}">lb · in · oz</button>
        <button data-units="metric" aria-pressed="${p.units === 'metric'}">kg · cm · ml</button></div>
      <label class="f"><span>Time zone</span><select id="tz">${[...new Set([p.tzNext?.tz || p.tz || TZ, p.tz || TZ, deviceTZ(), ...TZS])]
        .map(z => `<option ${z === (p.tzNext?.tz || p.tz || TZ) ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></label>
      ${p.tzNext ? `<p class="note">Starts with your next day. Until then, today stays on ${esc(p.tz || TZ)}.</p>` : ''}
      <label class="f"><span>Day ends at</span>
      <select id="de">${[0, 1, 2, 3, 4, 5, 6].map(h => `<option value="${h}" ${h === p.dayEndsAt ? 'selected' : ''}>${h === 0 ? 'Midnight' : h + ':00 AM'}</option>`).join('')}</select></label>
      <p class="note">Entries before this hour count toward the day before.</p>
    </section>
    <section class="card"><p class="lbl">About you</p>
      <p class="sub">Your coach uses these to tailor your plan and fuel ranges. Tap any to change it.</p>
      <ul class="list">${aboutRows(p).map(([id, label, value]) => `<li><span>${esc(label)}<br><span class="chain">${esc(value || 'Not answered')}</span></span>
        <button class="cta2" data-about="${id}" aria-label="Change ${esc(label)}">Change</button></li>`).join('')}</ul>
      <button class="cta2" id="aboutAll" style="width:100%;margin-top:8px">Go through all questions</button>
    </section>
    </div><div>
    <section class="card" ${age === null || age >= 7 ? 'style="border-color:var(--warn)"' : ''}><p class="lbl">Backup</p>
      <p>${age === null ? 'Never backed up.' : age === 0 ? 'Backed up today.' : `Last backup ${age} day${age === 1 ? '' : 's'} ago.`}</p>
      <p class="note">Data lives only on this phone. Export saves a file you can keep in Files or iCloud Drive.</p>
      <button class="cta" id="exp" style="margin-top:12px">Export backup</button>
      <button class="cta2" id="expEnc" style="width:100%;margin-top:8px">Export encrypted backup</button>
      <button class="cta2" id="imp" style="width:100%;margin-top:8px">Import a backup</button>
    </section>
    <section class="card"><p class="lbl">${esc(W('scouter'))} link · Apple Health</p>
      <p class="sub">Bring sleep and workouts from the Health app into Goku with an Apple Shortcut. Everything stays on this phone.</p>
      <button class="cta2" id="health" style="width:100%;margin-top:8px">Import from Health</button>
      <button class="link" id="healthHow" style="width:100%">How to set up the shortcut</button>
    </section>
    <section class="card"><p class="lbl">Passcode</p>
      <p class="sub">Remember this phone for</p>
      <div class="seg">${[[0, 'Always ask'], [1, '1 day'], [7, '1 week'], [30, '30 days']].map(([v, l]) => `<button data-rem="${v}" aria-pressed="${p.lock.remember === v}">${l}</button>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="cta2" id="chg">Change passcode</button><button class="cta2" id="lockNow">Lock now</button></div>
    </section>
    <section class="card"><p class="lbl">Profiles on this phone</p>
      ${others.map(o => `<div class="toggle"><span class="pname"><span class="cn">${esc(o.name)}</span><span class="sub">${esc(kindLabel(o))}</span></span>
        <span class="row" style="gap:8px"><button class="cta2" data-open="${esc(o.id)}">Open</button><button class="cta2" data-reset="${esc(o.id)}">Reset passcode</button></span></div>`).join('')}
      <button class="cta2" id="add" style="width:100%;margin-top:8px">Add a profile</button>
    </section>
    <section class="card"><p class="lbl">About</p>
      <p class="sub">Goku ${esc(VERSION)} · data format ${SCHEMA_VERSION}</p>
      <p class="sub">Storage: ${persisted ? 'protected from automatic clearing' : 'not yet protected; keep regular backups'}</p>
      <p class="note">No accounts, no servers, no tracking. Nothing you enter leaves this phone unless you export it.</p>
      <button class="cta2 danger" id="delp" style="width:100%;margin-top:12px">Delete this profile</button>
    </section>
    </div></div>`,
    bind(root) {
      root.addEventListener('change', async e => {
        const t = e.target;
        if (t.id === 'nm' && t.value.trim()) { p.name = capName(t.value.slice(0, 24)); await saveProfile(p); window.goku.render(); }
        if ('body' in t.dataset) { p.settings.bodyGoals = t.checked; if (!t.checked) { p.settings.kcalTarget = null; p.settings.trackWaist = false; } await saveProfile(p); window.goku.render(); }
        if ('duel' in t.dataset) { p.settings.duel = t.checked; await saveProfile(p); window.goku.render(); }
        if (t.dataset.fb) { p.settings[t.dataset.fb] = t.checked; await saveProfile(p); window.goku.render(); }
        if (t.dataset.mod) { p.modules[t.dataset.mod] = t.checked; await saveProfile(p); window.goku.render(); }
        if (t.id === 'pt') { const v = +t.value.replace(/\D/g, '') || null, most = p.settings.proteinPer === 'meal' ? 150 : 500;
          if (v && !(v >= 10 && v <= most)) return toast(`Protein target: 10 to ${most} grams`); // a typo like 1985 isn't saved
          p.settings.proteinTarget = v; await saveProfile(p); }
        if (t.id === 'de') { p.dayEndsAt = +t.value; await saveProfile(p); }
        if (t.id === 'tz') {
          // The new zone starts with the next training day; today keeps its date (2.8.2).
          if (t.value === p.tz) delete p.tzNext;
          else { p.tzNext = { tz: t.value, at: nextDayStart(p.dayEndsAt ?? 3, p.tz || TZ) }; toast(`${t.value} starts with your next day. Today keeps its date.`); }
          await saveProfile(p); window.goku.render();
        }
        if (t.matches('[data-avatar-photo]')) {
          try { p.avatar = await photoToAvatar(t.files[0]); t.value = ''; await saveProfile(p); toast('Photo saved'); window.goku.render(); }
          catch (err) { toast(err.message || "That photo couldn't be read."); }
        }
      });
      root.addEventListener('click', guard(async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.acc) { p.accent = b.dataset.acc; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.skin) {
          // A skin brings its own theme (Encore → Pastel tour); leaving it goes back to the default theme.
          const was = SKINS[skinOf(p)], next = SKINS[b.dataset.skin]; p.settings.skin = b.dataset.skin;
          const theme = next.theme || (was.theme && p.settings.theme === was.theme ? 'capsule' : null);
          if (theme) { p.settings.theme = theme; p.accent = THEMES[theme].accent; }
          await saveProfile(p); window.goku.render(); }
        else if (b.dataset.theme) { p.settings.theme = b.dataset.theme; p.accent = THEMES[b.dataset.theme].accent; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.units) { p.units = b.dataset.units; await saveProfile(p); window.goku.render(); }
        else if (b.id === 'avatar') avatarSheet(p);
        else if (b.dataset.about) setupFlow(p, saveAndDraw, { only: b.dataset.about });
        else if (b.id === 'aboutAll') setupFlow(p, saveAndDraw);
        else if (b.id === 'editHome') editHome(p);
        else if (b.dataset.mode) { p.settings.mode = b.dataset.mode; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.per) { p.settings.proteinPer = b.dataset.per; await saveProfile(p); window.goku.render(); }
        // Starting point (2.18): the doctor hold stays until it's cleared on Home; a first move to gentler plans starts at Easy.
        else if (b.dataset.plan) { const id = b.dataset.plan; if (id === planId(p)) return;
          p.plan = { id, ...(p.plan?.hold ? { hold: true } : {}), ...(id === 'move' ? { minGoal: p.plan?.minGoal || 60 } : {}), ...(id === 'starter' ? { sets: p.plan?.sets || 1 } : {}) };
          if (id === 'comeback') p.settings.gravity = 10;
          await saveProfile(p); toast(`${({ strength: 'Circuits', comeback: 'Comeback', starter: 'Starter Workouts', move: 'Move More', food: 'Food Only' })[id]} from now on`); window.goku.render(); }
        else if (b.dataset.rem) {
          p.lock.remember = +b.dataset.rem;
          p.lock.until = p.lock.remember ? Date.now() + p.lock.remember * DAY : 0;
          await saveProfile(p); window.goku.render();
        }
        else if (b.id === 'exp') await exportNow(false);
        else if (b.id === 'expEnc') await exportNow(true);
        else if (b.id === 'imp') importFlow();
        else if (b.id === 'health') healthImport();
        else if (b.id === 'healthHow') ask(`Set up the ${W('scouter')} link`, `<ol style="padding-left:20px;line-height:1.6">${RECIPE.map(x => `<li style="margin-top:6px">${esc(x)}</li>`).join('')}</ol>
          <p class="note">Shortcuts differ a little between iOS versions. If an import shows nothing, check the file has lines like: sleep, 2026-10-28T23:10:00, 2026-10-29T06:40:00.</p>`, []);
        else if (b.id === 'chg') { if (await showLock(p, { mode: 'create', cancellable: true })) toast('Passcode changed'); window.goku.render(); }
        else if (b.id === 'lockNow') { lockNow(p); await saveProfile(p); window.goku.open(p.id); }
        else if (b.id === 'delp') await deleteThisProfile();
        else if (b.id === 'devcheck') await phoneCheck();
        else if (b.dataset.open) window.goku.open(b.dataset.open);
        else if (b.dataset.reset) {
          const o = S.profiles.find(x => x.id === b.dataset.reset);
          if (await ask(`Reset ${o.name}'s passcode?`, `${esc(o.name)} will choose a new passcode the next time the profile opens, and will be told it was reset from ${esc(p.name)}'s profile. Their data is kept.`, [{ label: 'Reset passcode', value: true }])) {
            o.lock = { ...o.lock, pin: null, needsNewPin: true, until: 0, fails: 0, waitUntil: 0, resetBy: p.name, resetAt: Date.now() };
            lockNow(o); await saveProfile(o); toast('Passcode reset');
          }
        }
        else if (b.id === 'add') { const np = await onboard({ cancellable: true }); if (np) window.goku.open(np.id); }
      }));
    },
  };
}
