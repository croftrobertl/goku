// Settings, profile management, and backup (export / import).
import { S, profile, saveProfile, MODULES, KINDS, newProfile } from './state.js';
import * as db from './db.js';
import { encryptJSON, decryptJSON } from './crypto.js';
import { showLock, lockNow } from './lock.js';
import { onboard, ACCENTS } from './onboarding.js';
import { esc, ask, overlay, toast } from './ui.js';
import { VERSION } from './version.js';

export const SCHEMA_VERSION = 1;
const DAY = 86400000;

// ---------- Export format (documented in README) ----------
const toISO = o => { const r = { ...o }; for (const k in r) if (k.endsWith('At') && typeof r[k] === 'number') r[k] = r[k] ? new Date(r[k]).toISOString() : null; return r; };
const fromISO = o => { const r = { ...o }; for (const k in r) if (k.endsWith('At') && typeof r[k] === 'string') r[k] = Date.parse(r[k]); return r; };

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
  const prof = fromISO(obj.profile);
  const entries = obj.entries.map(e => ({ id: e.id, profileId: prof.id, type: e.type, day: e.day,
    ts: Date.parse(e.time), updatedAt: Date.parse(e.updatedAt) || Date.parse(e.time), data: fromISO(e.data) }));
  return { prof, entries };
}

async function shareFile(name, text) {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

export async function exportNow(encrypted = false) {
  const p = profile();
  let payload = await buildExport(p);
  if (encrypted) {
    const pass = await passphrase(true);
    if (!pass) return;
    payload = await encryptJSON(payload, pass);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
  const ok = await shareFile(`goku-${safe}-${stamp}${encrypted ? '-encrypted' : ''}.json`, JSON.stringify(payload, null, 1));
  if (ok) { p.lastBackupAt = Date.now(); await saveProfile(p); toast('Backup created'); window.goku.render(); }
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
      <button class="cta" id="ok" style="margin-top:12px">${creating ? 'Encrypt and share' : 'Open backup'}</button>
      <button class="cta2" id="no" style="width:100%;margin-top:8px">Cancel</button>`, { label: 'Passphrase' });
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

export function importFlow() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json,.json';
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    try {
      let obj = JSON.parse(await f.text());
      if (obj?.encrypted) {
        const pass = await passphrase(false); if (!pass) return;
        try { obj = await decryptJSON(obj, pass); } catch { throw new Error("That passphrase didn't open this backup."); }
      }
      await previewImport(parseExport(obj));
    } catch (e) { await ask("Couldn't import", esc(e.message || 'The file could not be read.'), []); }
  };
  input.click();
}

async function previewImport({ prof, entries }) {
  const counts = {};
  for (const e of entries) counts[e.type] = (counts[e.type] || 0) + 1;
  const days = entries.map(e => e.day).filter(d => d > '1970-01-01').sort();
  const existing = S.profiles.find(p => p.id === prof.id);
  const body = `<b>${esc(prof.name)}</b> · ${esc(KINDS[prof.kind]?.label || prof.kind)}<br>
    ${Object.entries(counts).map(([k, n]) => `${n} ${esc(k)}${n === 1 ? '' : 's'}`).join(' · ') || 'No entries'}<br>
    ${days.length ? `From ${days[0]} to ${days[days.length - 1]}` : ''}<br><br>
    ${existing ? `This matches <b>${esc(existing.name)}</b> on this phone.<br><br>
      <b>Merge</b> keeps everything on this phone and adds or updates entries from the backup (the newer copy of each wins).<br>
      <b>Replace</b> deletes this profile's entries here and uses the backup's instead.`
      : 'This profile is not on this phone yet. It will be added and you will set a passcode for it.'}`;
  const choice = await ask('Import this backup?', body, existing
    ? [{ label: 'Merge', value: 'merge' }, { label: 'Replace', value: 'replace' }]
    : [{ label: 'Add profile', value: 'add' }]);
  if (!choice) return;
  if (choice === 'replace') {
    const sure = await ask('Replace everything?', `All entries for ${esc(existing.name)} on this phone will be deleted first. Export a backup now if you're unsure.`,
      [{ label: 'Replace', value: true }]);
    if (!sure) return;
  }
  const { lockRemember, ...rest } = prof;
  if (choice === 'add') {
    const p = { ...newProfile(prof.kind, prof.name), ...rest, lock: { ...newProfile(prof.kind, '').lock, remember: lockRemember ?? 7 } };
    await saveProfile(p);
    await db.putMany('entries', entries);
    await db.setMeta('seeded:' + p.id, true);
    S.current = p.id;
    await showLock(p, { mode: 'create' });
  } else if (choice === 'replace') {
    await db.deleteProfileEntries(existing.id);
    await db.putMany('entries', entries);
    Object.assign(existing, rest, { lock: existing.lock });
    await saveProfile(existing);
  } else {
    const here = new Map((await db.byIndex('entries', 'profile', existing.id)).map(e => [e.id, e]));
    await db.putMany('entries', entries.filter(e => !here.has(e.id) || (e.updatedAt || 0) > (here.get(e.id).updatedAt || 0)));
  }
  toast('Import complete');
  window.goku.render();
}

export const backupAgeDays = p => p.lastBackupAt ? Math.floor((Date.now() - p.lastBackupAt) / DAY) : null;

// ---------- Settings screen ----------
export async function settingsView() {
  const p = profile();
  const others = S.profiles.filter(x => x.id !== p.id);
  const age = backupAgeDays(p);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  return {
    html: `<h1>Settings</h1>
    <div class="cols"><div>
    <section class="card" style="margin-top:12px"><p class="lbl">Profile</p>
      <label class="f"><span>Name</span><input id="nm" value="${esc(p.name)}" maxlength="24"></label>
      <p class="lbl" style="margin-top:14px">Color</p>
      <div class="swatches">${ACCENTS.map(c => `<button style="background:${c}" data-acc="${c}" aria-pressed="${c === p.accent}" aria-label="Color ${c}"></button>`).join('')}</div>
    </section>
    <section class="card"><p class="lbl">What the app shows</p>
      ${MODULES[p.kind].map(([k, n, d]) => `<label class="toggle"><span><b>${n}</b><br><span class="sub">${d}</span></span>
        <input type="checkbox" data-mod="${k}" ${p.modules[k] !== false ? 'checked' : ''}></label>`).join('')}
    </section>
    ${p.kind === 'engine' ? `<section class="card"><p class="lbl">Protein target</p>
      <div class="row"><input id="pt" inputmode="numeric" value="${p.settings.proteinTarget ?? ''}" placeholder="grams" aria-label="Protein target in grams" style="width:120px">
      <div class="seg" style="margin:0;flex:1"><button data-per="day" aria-pressed="${p.settings.proteinPer === 'day'}">Per day</button><button data-per="meal" aria-pressed="${p.settings.proteinPer === 'meal'}">Per meal</button></div></div>
    </section>` : ''}
    <section class="card"><p class="lbl">Day ends at</p>
      <select id="de" aria-label="Day ends at">${[0, 1, 2, 3, 4, 5, 6].map(h => `<option value="${h}" ${h === p.dayEndsAt ? 'selected' : ''}>${h === 0 ? 'Midnight' : h + ':00 AM'}</option>`).join('')}</select>
      <p class="note">Entries before this hour count toward the day before. Times are US Eastern.</p>
    </section>
    </div><div>
    <section class="card" ${age === null || age >= 7 ? 'style="border-color:var(--warn)"' : ''}><p class="lbl">Backup</p>
      <p>${age === null ? 'Never backed up.' : age === 0 ? 'Backed up today.' : `Last backup ${age} day${age === 1 ? '' : 's'} ago.`}</p>
      <p class="note">Data lives only on this phone. Export saves a file you can keep in Files or iCloud Drive.</p>
      <button class="cta" id="exp" style="margin-top:12px">Export backup</button>
      <button class="cta2" id="expEnc" style="width:100%;margin-top:8px">Export encrypted backup</button>
      <button class="cta2" id="imp" style="width:100%;margin-top:8px">Import a backup</button>
    </section>
    <section class="card"><p class="lbl">Passcode</p>
      <p class="sub">Don't ask again on this phone for</p>
      <div class="seg">${[[0, 'Always ask'], [1, '1 day'], [7, '1 week'], [30, '30 days']].map(([v, l]) => `<button data-rem="${v}" aria-pressed="${p.lock.remember === v}">${l}</button>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="cta2" id="chg">Change passcode</button><button class="cta2" id="lockNow">Lock now</button></div>
    </section>
    <section class="card"><p class="lbl">Profiles on this phone</p>
      ${others.map(o => `<div class="toggle"><span>${esc(o.name)}<br><span class="sub">${esc(KINDS[o.kind].label)}</span></span>
        <span class="row" style="gap:8px"><button class="cta2" data-open="${o.id}">Open</button><button class="cta2" data-reset="${o.id}">Reset passcode</button></span></div>`).join('')}
      <button class="cta2" id="add" style="width:100%;margin-top:8px">Add a profile</button>
    </section>
    <section class="card"><p class="lbl">About</p>
      <p class="sub">Goku ${esc(VERSION)} · data format ${SCHEMA_VERSION}</p>
      <p class="sub">Storage: ${persisted ? 'protected from automatic clearing' : 'not yet protected; keep regular backups'}</p>
      <p class="note">No accounts, no servers, no tracking. Nothing you enter leaves this phone unless you export it.</p>
    </section>
    </div></div>`,
    bind(root) {
      root.addEventListener('change', async e => {
        const t = e.target;
        if (t.id === 'nm' && t.value.trim()) { p.name = t.value.trim(); await saveProfile(p); window.goku.render(); }
        if (t.dataset.mod) { p.modules[t.dataset.mod] = t.checked; await saveProfile(p); }
        if (t.id === 'pt') { p.settings.proteinTarget = t.value ? +t.value.replace(/\D/g, '') || null : null; await saveProfile(p); }
        if (t.id === 'de') { p.dayEndsAt = +t.value; await saveProfile(p); }
      });
      root.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.acc) { p.accent = b.dataset.acc; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.per) { p.settings.proteinPer = b.dataset.per; await saveProfile(p); window.goku.render(); }
        else if (b.dataset.rem) {
          p.lock.remember = +b.dataset.rem;
          p.lock.until = p.lock.remember ? Date.now() + p.lock.remember * DAY : 0;
          await saveProfile(p); window.goku.render();
        }
        else if (b.id === 'exp') exportNow(false);
        else if (b.id === 'expEnc') exportNow(true);
        else if (b.id === 'imp') importFlow();
        else if (b.id === 'chg') { await showLock(p, { mode: 'create' }); toast('Passcode changed'); window.goku.render(); }
        else if (b.id === 'lockNow') { lockNow(p); await saveProfile(p); window.goku.open(p.id); }
        else if (b.dataset.open) window.goku.open(b.dataset.open);
        else if (b.dataset.reset) {
          const o = S.profiles.find(x => x.id === b.dataset.reset);
          if (await ask(`Reset ${o.name}'s passcode?`, `${esc(o.name)} will choose a new passcode the next time the profile opens. Their data is kept.`, [{ label: 'Reset passcode', value: true }])) {
            o.lock = { ...o.lock, pin: null, needsNewPin: true, until: 0, fails: 0, waitUntil: 0 };
            lockNow(o); await saveProfile(o); toast('Passcode reset');
          }
        }
        else if (b.id === 'add') { const np = await onboard(); window.goku.open(np.id); }
      });
    },
  };
}
