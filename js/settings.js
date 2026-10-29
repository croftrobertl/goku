// Settings, profile management, and backup (export / import).
import { S, profile, saveProfile, KINDS, newProfile, liveModules, soonModules } from './state.js';
import * as db from './db.js';
import { encryptJSON, decryptJSON } from './crypto.js';
import { showLock, lockNow } from './lock.js';
import { onboard, ACCENTS } from './onboarding.js';
import { cleanBackup } from './validate.js';
import { esc, ask, overlay, toast, guard } from './ui.js';
import { VERSION } from './version.js';
import { dayKey } from './time.js';
import { phoneCheck } from './devcheck.js';
import { THEMES, MODES } from './themes.js';
import { avatarHTML, avatarName, avatarPicker, pickAvatar, photoToAvatar } from './avatar.js';
import { QUESTIONS, essentials, setupFlow, GOALS, EQUIPMENT, ALLERGIES } from './coach.js';
import { editHome } from './homelayout.js';
import { weight, weightUnit, length, lengthUnit } from './units.js';
import { deviceTZ, TZ } from './time.js';
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
  return cleanBackup(obj.profile && typeof obj.profile === 'object' ? fromISO(obj.profile) : null, raw);
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
    <p class="lbl">Backup ready</p><h1>${esc(name)}</h1>
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

async function previewImport({ prof, entries, skipped }) {
  const cur = profile();
  const other = S.profiles.find(p => p.id === prof.id && p.id !== cur.id);
  if (other) {
    await ask('This backup belongs to another profile', `It's a backup of <b>${esc(other.name)}</b>. To protect their data, open their profile (with their passcode) and import it there.`, []);
    return;
  }
  const mine = prof.id === cur.id;
  const counts = {};
  for (const e of entries) counts[e.type] = (counts[e.type] || 0) + 1;
  const days = entries.map(e => e.day).filter(d => d > '1970-01-01').sort();
  const body = `<b>${esc(prof.name)}</b> · ${esc(KINDS[prof.kind].label)}<br>
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
      const fresh = newProfile(prof.kind, prof.name);
      const p = { ...fresh, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)), accent: rest.accent || fresh.accent, modules: { ...fresh.modules, ...rest.modules },
        settings: { ...fresh.settings, ...Object.fromEntries(Object.entries(rest.settings).filter(([, v]) => v !== null)) },
        lock: { ...fresh.lock, remember: lockRemember } };
      await db.putMany('entries', entries);
      await saveProfile(p);
      await db.setMeta('seeded:' + p.id, true);
      if (await showLock(p, { mode: 'create' })) window.goku.open(p.id);
      else window.goku.render();
    } else if (choice === 'replace') {
      await db.replaceProfileEntries(cur.id, entries);
      Object.assign(cur, { name: rest.name, accent: rest.accent || cur.accent, dayEndsAt: rest.dayEndsAt, modules: { ...cur.modules, ...rest.modules },
        units: rest.units || cur.units, tz: rest.tz || cur.tz, about: rest.about || cur.about, coach: rest.about ? rest.coach || cur.coach : cur.coach,
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
    units: `${p.units === 'metric' ? 'Metric' : 'US units'} · ${p.tz || TZ}`,
    birthYear: a.birthYear ? String(a.birthYear) : '',
    body: [a.heightIn != null ? `${length(a.heightIn, p)} ${lengthUnit(p)}` : '', a.weightLb != null ? (p.kind === 'perf' ? 'weight saved' : `${weight(a.weightLb, p)} ${weightUnit(p)}`) : ''].filter(Boolean).join(' · '),
    experience: pick(QUESTIONS.find(q => q.id === 'experience').options, a.experience),
    goal: pick(GOALS[p.kind], a.goal),
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
  const { el, close } = overlay(`<div class="row"><h1>Avatar</h1><button class="cta2" id="x" data-close>Done</button></div>
    <div class="scroll" id="av"></div>`, { label: 'Choose an avatar' });
  const draw = () => { el.querySelector('#av').innerHTML = avatarPicker(p); };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') { close(); window.goku.render(); return; }
    if (b.dataset.avatar) { pickAvatar(p, b.dataset.avatar); await saveProfile(p); draw(); }
  });
  el.addEventListener('change', async e => {
    if (!e.target.matches('[data-avatar-photo]')) return;
    try { p.avatar = await photoToAvatar(e.target.files[0]); t.value = ''; e.target.value = ''; await saveProfile(p); draw(); }
    catch (err) { toast(err.message || "That photo couldn't be read."); }
  });
  draw();
}

// ---------- Settings screen ----------
export async function settingsView() {
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
      <p class="lbl" style="margin-top:14px">Color</p>
      <div class="swatches">${ACCENTS.map(c => `<button style="background:${c}" data-acc="${c}" aria-pressed="${c === p.accent}" aria-label="Color ${c}"></button>`).join('')}</div>
    </section>
    <section class="card"><p class="lbl">Theme</p>
      <div class="themes">${Object.entries(THEMES).map(([id, t]) => `<button data-theme="${id}" aria-pressed="${(p.settings.theme || 'capsule') === id}">
        <span class="tsw" aria-hidden="true" style="background:${t.dark.s1};box-shadow:inset -18px 0 0 ${t.light.s1}"><i style="background:${t.accent}"></i></span>
        <span><b>${esc(t.name)}</b><br><span class="sub">${esc(t.desc)}</span></span></button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Light or dark">${MODES.map(([v, l]) => `<button data-mode="${v}" aria-pressed="${(p.settings.mode || 'auto') === v}">${l}</button>`).join('')}</div>
      <p class="note">Picking a theme also sets its matching color. You can still change the color above.</p>
    </section>
    <section class="card"><p class="lbl">What the app shows</p>
      ${liveModules(p.kind).map(([k, n, d]) => `<label class="toggle"><span><b>${n}</b><br><span class="sub">${d}</span></span>
        <input type="checkbox" data-mod="${k}" ${p.modules[k] !== false ? 'checked' : ''}></label>`).join('')}
      ${soon.length ? `<p class="lbl" style="margin-top:14px">Coming soon</p><p class="sub">${soon.map(m => esc(m[1])).join(' · ')}</p>` : ''}
      <button class="cta2" id="editHome" style="width:100%;margin-top:12px">Arrange Home cards</button>
    </section>
    ${p.kind === 'engine' ? `<section class="card"><p class="lbl">Protein target</p>
      <div class="row"><input id="pt" inputmode="numeric" value="${p.settings.proteinTarget ?? ''}" placeholder="grams" aria-label="Protein target in grams" style="width:120px">
      <div class="seg" style="margin:0;flex:1"><button data-per="day" aria-pressed="${p.settings.proteinPer === 'day'}">Per day</button><button data-per="meal" aria-pressed="${p.settings.proteinPer === 'meal'}">Per meal</button></div></div>
    </section>` : ''}
    <section class="card"><p class="lbl">Duels</p>
      <label class="toggle"><span><b>Duel other profiles on this phone</b><br><span class="sub">Shares only how many days you trained this week, with profiles that also turn this on. Off until you choose.</span></span>
        <input type="checkbox" data-duel ${p.settings.duel === true ? 'checked' : ''}></label>
    </section>
    <section class="card"><p class="lbl">Sound and haptics</p>
      ${[['sound', 'Sound cues', 'Beeps when rest ends and at the time cap.'], ['haptics', 'Buzz on each rep', 'A light tap you can feel when a rep counts.']].map(([k, n, d]) =>
        `<label class="toggle"><span><b>${n}</b><br><span class="sub">${d}</span></span><input type="checkbox" data-fb="${k}" ${p.settings[k] !== false ? 'checked' : ''}></label>`).join('')}
      <button class="cta2" id="devcheck" style="width:100%;margin-top:8px">Test my phone</button>
      <p class="note">Checks that the screen stays on, sound plays and saving works on this phone.</p>
    </section>
    <section class="card"><p class="lbl">Units and time</p>
      <div class="seg" role="group" aria-label="Units"><button data-units="imperial" aria-pressed="${p.units !== 'metric'}">lb · in · oz</button>
        <button data-units="metric" aria-pressed="${p.units === 'metric'}">kg · cm · ml</button></div>
      <label class="f"><span>Time zone</span><select id="tz">${[...new Set([p.tz || TZ, deviceTZ(), 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London'])]
        .map(z => `<option ${z === (p.tz || TZ) ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></label>
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
    <section class="card"><p class="lbl">Scouter link · Apple Health</p>
      <p class="sub">Bring sleep and workouts from the Health app into Goku with an Apple Shortcut. Everything stays on this phone.</p>
      <button class="cta2" id="health" style="width:100%;margin-top:8px">Import from Health</button>
      <button class="link" id="healthHow" style="width:100%">How to set up the shortcut</button>
    </section>
    <section class="card"><p class="lbl">Passcode</p>
      <p class="sub">Don't ask again on this phone for</p>
      <div class="seg">${[[0, 'Always ask'], [1, '1 day'], [7, '1 week'], [30, '30 days']].map(([v, l]) => `<button data-rem="${v}" aria-pressed="${p.lock.remember === v}">${l}</button>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="cta2" id="chg">Change passcode</button><button class="cta2" id="lockNow">Lock now</button></div>
    </section>
    <section class="card"><p class="lbl">Profiles on this phone</p>
      ${others.map(o => `<div class="toggle"><span>${esc(o.name)}<br><span class="sub">${esc(KINDS[o.kind].label)}</span></span>
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
        if (t.id === 'nm' && t.value.trim()) { p.name = t.value.trim().slice(0, 24); await saveProfile(p); window.goku.render(); }
        if ('duel' in t.dataset) { p.settings.duel = t.checked; await saveProfile(p); window.goku.render(); }
        if (t.dataset.fb) { p.settings[t.dataset.fb] = t.checked; await saveProfile(p); window.goku.render(); }
        if (t.dataset.mod) { p.modules[t.dataset.mod] = t.checked; await saveProfile(p); window.goku.render(); }
        if (t.id === 'pt') { p.settings.proteinTarget = t.value ? +t.value.replace(/\D/g, '') || null : null; await saveProfile(p); }
        if (t.id === 'de') { p.dayEndsAt = +t.value; await saveProfile(p); }
        if (t.id === 'tz') { p.tz = t.value; await saveProfile(p); window.goku.render(); }
        if (t.matches('[data-avatar-photo]')) {
          try { p.avatar = await photoToAvatar(t.files[0]); t.value = ''; await saveProfile(p); toast('Photo saved'); window.goku.render(); }
          catch (err) { toast(err.message || "That photo couldn't be read."); }
        }
      });
      root.addEventListener('click', guard(async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.acc) { p.accent = b.dataset.acc; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.theme) { p.settings.theme = b.dataset.theme; p.accent = THEMES[b.dataset.theme].accent; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.units) { p.units = b.dataset.units; await saveProfile(p); window.goku.render(); }
        else if (b.id === 'avatar') avatarSheet(p);
        else if (b.dataset.about) setupFlow(p, saveAndDraw, { only: b.dataset.about });
        else if (b.id === 'aboutAll') setupFlow(p, saveAndDraw);
        else if (b.id === 'editHome') editHome(p);
        else if (b.dataset.mode) { p.settings.mode = b.dataset.mode; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.per) { p.settings.proteinPer = b.dataset.per; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.rem) {
          p.lock.remember = +b.dataset.rem;
          p.lock.until = p.lock.remember ? Date.now() + p.lock.remember * DAY : 0;
          await saveProfile(p); window.goku.render();
        }
        else if (b.id === 'exp') await exportNow(false);
        else if (b.id === 'expEnc') await exportNow(true);
        else if (b.id === 'imp') importFlow();
        else if (b.id === 'health') healthImport();
        else if (b.id === 'healthHow') ask('Set up the Scouter link', `<ol style="padding-left:20px;line-height:1.6">${RECIPE.map(x => `<li style="margin-top:6px">${esc(x)}</li>`).join('')}</ol>
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
