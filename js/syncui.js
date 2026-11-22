// Cloud sync screens (2.24, review 26): the card in Backup and Sync, making an account, the recovery key,
// signing in on another phone, and the account actions. The work itself is in sync.js.
import * as sync from './sync.js';
import { S, today } from './state.js';
import * as db from './db.js';
import { overlay, ask, toast, esc, GLY } from './ui.js';
import { addDays } from './time.js';

const USER = /^[a-z0-9][a-z0-9._-]{2,29}$/, MIN_PW = 10;
const ago = t => { const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} minute${m === 1 ? '' : 's'} ago` : m < 1440 ? `${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? '' : 's'} ago` : `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? '' : 's'} ago`; };

// One line for the You tab's "Backup and Sync" row, or null when sync is off.
export function syncLine(link) {
  if (!link) return null;
  if (!link.token) return 'Not syncing · sign in again';
  if (link.error) return 'Not synced yet · ' + (link.lastAt ? 'last ' + ago(link.lastAt) : 'waiting for internet');
  return link.lastAt ? 'Synced ' + ago(link.lastAt) : 'Syncing…';
}

export function syncCard(link) {
  if (!link) return `<section class="card"><p class="lbl">Cloud Sync</p><p>Off.</p>
    <p class="note">Keep this profile on more than one phone, and safe if a phone is lost. It's locked with your password before it leaves the phone, so nobody else can read it, not even Cloudflare.</p>
    <button class="cta" id="syncOn" style="margin-top:12px">Turn on sync</button><button class="cta2" id="syncHave" style="width:100%;margin-top:8px">I already have an account</button></section>`;
  if (!link.token) return `<section class="card" style="border-color:var(--warn)"><p class="lbl">Cloud Sync</p><p>Not syncing. Sign in again.</p>
    <p class="note">The password was changed on another phone. Everything here is safe and will sync once you sign in.</p>
    <button class="cta" id="syncAgain" style="margin-top:12px">Sign in again</button>
    <button class="link" id="syncOut" style="width:100%;margin-top:4px">Stop syncing on this phone</button></section>`;
  return `<section class="card"><p class="lbl">Cloud Sync</p><p data-raw>${esc(link.lastAt ? 'Synced ' + ago(link.lastAt) + '.' : 'Syncing…')}</p>
    ${link.error ? `<p class="note" style="color:var(--warn)" data-raw>${esc(link.error)}</p>` : ''}
    <p class="note">Signed in as <b data-raw>${esc(link.user)}</b>. Changes sync by themselves when there's internet.</p>
    <button class="cta2" id="syncNow" style="width:100%;margin-top:12px">Sync now</button><button class="cta2" id="syncHist" style="width:100%;margin-top:8px">Backup history</button><button class="cta2" id="syncPw" style="width:100%;margin-top:8px">Change password</button>
    <button class="cta2" id="syncOut" style="width:100%;margin-top:8px">Sign out on this phone</button><button class="link" id="syncDel" style="width:100%;margin-top:4px">Delete the cloud copy</button></section>`;
}

// Handles the card's buttons. Returns true when the click was one of them.
export async function syncClick(b, p) {
  const id = b.id, redraw = () => window.goku.render();
  if (id === 'syncOn') { if (await createFlow(p)) redraw(); return true; }
  if (id === 'syncHave' || id === 'syncAgain') { const pid = await signInFlow({ again: id === 'syncAgain' ? (await sync.getLink(p.id))?.user : null }); if (pid) { if (pid !== p.id) await window.goku.open(pid); else redraw(); } return true; }
  if (id === 'syncNow') { b.disabled = true; b.textContent = 'Syncing…'; await sync.syncNow(p.id); const l = await sync.getLink(p.id); toast(l?.error ? l.error : 'Synced', l?.error ? 5000 : 2400); redraw(); return true; }
  if (id === 'syncHist') { await historyFlow(p); return true; }
  if (id === 'syncPw') { await passwordFlow(p); return true; }
  if (id === 'syncOut') {
    if (await ask('Sign out on this phone?', 'Syncing stops here. Everything stays on this phone and in the cloud. You can sign in again any time.', [{ label: 'Sign out', value: true }])) { await sync.signOut(p.id); toast('Signed out of sync'); redraw(); }
    return true;
  }
  if (id === 'syncDel') { await deleteFlow(p); redraw(); return true; }
  return false;
}

// A sheet with a form. onSubmit(values, msg) does the work and returns true to close, or a message to show.
function form(html, label, onSubmit, { goback } = {}) {
  return new Promise(resolve => {
    const { el, close } = overlay(`<div class="scroll">${html}<p class="msg" id="m" role="status"></p></div>`, { label });
    const msg = t => { el.querySelector('#m').textContent = t; };
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { close(); resolve(null); return; }
      if (b.hasAttribute('data-goback') && goback) { goback(msg); return; }
      if (!(b.classList.contains('cta') || b.hasAttribute('data-act')) || b.disabled || b.id === 'kSave') return;
      const vals = Object.fromEntries([...el.querySelectorAll('input')].map(i => [i.id, i.value]));
      const was = b.textContent; b.disabled = true; msg('');
      try { const r = await onSubmit(vals, msg, b, el); if (r && r !== true && typeof r === 'object') { close(); resolve(r); return; } if (r === true) { close(); resolve(true); return; } if (typeof r === 'string') msg(r); }
      catch (err) { msg(err.message || 'Something went wrong.'); }
      if (el.isConnected) { b.disabled = false; b.textContent = was; }
    });
    el.addEventListener('input', () => msg(''));
  });
}
const checkUser = u => USER.test(u) ? '' : 'Usernames are 3 to 30 letters, numbers, dots, dashes or underscores, starting with a letter or number.';
const checkPw = (a, c) => a.length < MIN_PW ? `Use at least ${MIN_PW} characters.` : a !== c ? "The passwords don't match." : '';
const working = (b, t) => { b.textContent = t; };

// Turn on sync: account, then the recovery key. Resolves true when sync is on.
async function createFlow(p) {
  let key = null;
  const ok = await form(`<h1>Turn On Sync</h1><p class="sub" style="margin:8px 0">One account for this profile. Pick a username, and a password of at least ${MIN_PW} characters.</p>
    <label class="f"><span>Username</span><input id="u" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
    <label class="f"><span>Password</span><input id="p1" type="password" autocomplete="new-password"></label>
    <label class="f"><span>Repeat password</span><input id="p2" type="password" autocomplete="new-password"></label>
    <p class="note" style="margin-top:8px">Nobody can reset a forgotten password, not even Goku. Next you'll get a recovery key that can.</p>
    <button class="cta" style="margin-top:12px">Create account</button><button class="cta2" data-close style="width:100%;margin-top:8px">Cancel</button>`, 'Turn on sync',
  async (v, msg, b) => {
    const u = v.u.trim().toLowerCase(), bad = checkUser(u) || checkPw(v.p1, v.p2); if (bad) return bad;
    working(b, 'Creating…'); key = await sync.signUp(p, u, v.p1); return true;
  });
  if (!ok) return false;
  await keySheet(key);
  toast('Sync is on');
  return true;
}

// Shown once. Done unlocks after typing the key's last four characters (review 26).
function keySheet(key) {
  const last = key.slice(-4);
  return form(`<h1>Your Recovery Key</h1><p class="sub" style="margin:8px 0">If you forget your password, this is the only way back in. Keep it somewhere that isn't this phone.</p>
    <p class="num" data-raw style="font:700 1.35rem/1.6 ui-monospace,Menlo,monospace;text-align:center;letter-spacing:.04em;margin:16px 0;user-select:all">${key.slice(0, 19)}<br>${key.slice(20)}</p>
    <button class="cta" id="kSave">Save to Files</button><button class="cta2" id="kCopy" style="width:100%;margin-top:8px">Copy</button>
    <label class="f" style="margin-top:12px"><span>To check you have it, type its last four characters</span><input id="k4" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="4"></label>
    <button class="cta" id="kDone" style="margin-top:8px" disabled>Done</button><button data-goback hidden></button>`, 'Recovery key',
  async (v, msg) => v.k4.trim().toUpperCase() === last ? true : 'Those aren\'t the last four characters. Look again at the key above.',
  { goback: msg => msg('Save your recovery key first, then type its last four characters.') });
}
document.addEventListener('input', e => { if (e.target.id === 'k4') e.target.closest('.inner').querySelector('#kDone').disabled = e.target.value.trim().length < 4; });
document.addEventListener('click', async e => { // the key sheet's Save and Copy
  const b = e.target.closest('#kSave, #kCopy'); if (!b) return;
  const key = b.closest('.inner').querySelector('.num').innerText.replace(/\s+/g, '-');
  if (b.id === 'kCopy') { try { await navigator.clipboard.writeText(key); toast('Copied. Paste it somewhere safe.'); } catch { toast('Copy didn\'t work. Write it down instead.'); } return; }
  const file = new File([`Goku recovery key\n\n${key}\n\nKeep this somewhere safe that isn't your phone. It's the only way back in if you forget your sync password.\n`], 'goku-recovery-key.txt', { type: 'text/plain' });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (err) { if (err.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

// Sign in (a new phone, another profile, or again after a reset). "Forgot your password?" goes to the recovery key
// and a new password. Resolves with the profile id, or null.
export async function signInFlow({ again = null } = {}) {
  const r = await form(`<h1>${again ? 'Sign In Again' : 'Sign In to Sync'}</h1><p class="sub" style="margin:8px 0">${again ? 'Use the new password.' : 'Brings your profile onto this phone, with everything in it.'}</p>
    <label class="f"><span>Username</span><input id="u" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(again || '')}"></label>
    <label class="f"><span>Password</span><input id="p1" type="password" autocomplete="current-password"></label>
    <button class="cta" style="margin-top:12px">Sign in</button><button class="link" id="forgot" data-act style="width:100%;margin-top:4px">Forgot your password? Use your recovery key</button>
    <button class="cta2" data-close style="width:100%;margin-top:8px">Cancel</button>`, 'Sign in to sync',
  async (v, msg, b) => {
    if (b.id === 'forgot') return { forgot: true, user: v.u };
    const u = v.u.trim().toLowerCase(); if (!u || !v.p1) return 'Enter your username and password.';
    working(b, 'Signing in…'); return { pid: await sync.signIn(u, v.p1) };
  });
  if (!r?.forgot) return finishSignIn(r);
  const r2 = await form(`<h1>Use Your Recovery Key</h1><p class="sub" style="margin:8px 0">Then choose a new password. Other phones will need it to keep syncing.</p>
    <label class="f"><span>Username</span><input id="u" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(r.user)}"></label>
    <label class="f"><span>Recovery key</span><input id="rk" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-…"></label>
    <label class="f"><span>New password</span><input id="p1" type="password" autocomplete="new-password"></label>
    <label class="f"><span>Repeat new password</span><input id="p2" type="password" autocomplete="new-password"></label>
    <button class="cta" style="margin-top:12px">Set new password</button><button class="cta2" data-close style="width:100%;margin-top:8px">Cancel</button>`, 'Recovery key',
  async (v, msg, b) => {
    const u = v.u.trim().toLowerCase(), bad = checkUser(u) || checkPw(v.p1, v.p2); if (bad) return bad;
    working(b, 'Checking…'); return { pid: await sync.signIn(u, null, { recovery: v.rk, newPassword: v.p1 }) };
  });
  const pid = await finishSignIn(r2);
  if (pid) toast('New password set. Signed in.');
  return pid;
}
async function finishSignIn(r) {
  if (!r?.pid) return null;
  await db.setMeta('seeded:' + r.pid, true); // its library came with it; don't add the starter set again
  const p = S.profiles.find(x => x.id === r.pid);
  const { isUnlocked, showLock } = await import('./lock.js');
  if (p && !isUnlocked(p)) await showLock(p, { mode: 'create' });
  return r.pid;
}

async function passwordFlow(p) {
  const ok = await form(`<h1>Change Password</h1><p class="sub" style="margin:8px 0">Your other phones will ask for the new one.</p>
    <label class="f"><span>Current password</span><input id="p0" type="password" autocomplete="current-password"></label>
    <label class="f"><span>New password</span><input id="p1" type="password" autocomplete="new-password"></label>
    <label class="f"><span>Repeat new password</span><input id="p2" type="password" autocomplete="new-password"></label>
    <button class="cta" style="margin-top:12px">Change password</button><button class="cta2" data-close style="width:100%;margin-top:8px">Cancel</button>`, 'Change password',
  async (v, msg, b) => { const bad = checkPw(v.p1, v.p2); if (bad) return bad; working(b, 'Changing…'); await sync.changePassword(p.id, v.p0, v.p1); return true; });
  if (ok) toast('Password changed');
}

async function deleteFlow(p) {
  if (!(await ask('Delete the cloud copy?', 'This erases this profile from the cloud for good, and other phones stop syncing it. Everything on this phone stays.', [{ label: 'Continue', value: true, danger: true }]))) return;
  const ok = await form(`<h1>Delete the Cloud Copy</h1><p class="sub" style="margin:8px 0">Enter your sync password to confirm. This can't be undone.</p>
    <label class="f"><span>Password</span><input id="p0" type="password" autocomplete="current-password"></label>
    <button class="cta" style="margin-top:12px">Delete it</button><button class="cta2" data-close style="width:100%;margin-top:8px">Cancel</button>`, 'Delete cloud copy',
  async (v, msg, b) => { if (!v.p0) return 'Enter your password.'; working(b, 'Deleting…'); await sync.deleteAccount(p.id, v.p0); return true; });
  if (ok) toast('Cloud copy deleted. Everything here stays.');
}

// Backup History (2.26, review 28): the cloud's copy of each of the last 90 days. Pick one, then Merge or Replace.
// A copy of right now is saved first, so a restore can be undone from the same list.
const dayName = (p, id) => { const d = id.slice(0, 10), t = today(p);
  return d === t ? 'Today' : d === addDays(t, -1) ? 'Yesterday' : new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
const clock = (p, at) => { try { return new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: p.tz || undefined }); } catch { return new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } };
// "Nov 19, 2026", "Aug 22 to Nov 19, 2026", or with both years when they differ.
const span = (a, b) => { const f = (d, y) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(y ? { year: 'numeric' } : {}) });
  return a === b ? f(b, true) : `${f(a, a.slice(0, 4) !== b.slice(0, 4))} to ${f(b, true)}`; };
async function historyFlow(p) {
  const { el, close } = overlay(`<div class="scroll"><h1>Backup History</h1>
    <p class="sub" style="margin:8px 0">One locked copy for each day something changed, kept for 90 days. Pick a day to restore.</p>
    <div id="hlist"><p class="note" role="status" style="text-align:center;font-size:.9rem">Loading…</p></div></div>
    <button class="cta2" data-close style="width:100%;margin-bottom:12px">Close</button>`, { label: 'Backup history' }); // Close sits under the list, always in view (review 29)
  const box = el.querySelector('#hlist');
  let snaps = [];
  try { snaps = await sync.listSnapshots(p.id); }
  catch (e) { box.innerHTML = `<p class="msg" role="status" data-raw>${esc(e.message || 'Something went wrong.')}</p>`; }
  if (snaps.length) box.innerHTML = `<ul class="list">${snaps.map((s, i) => `<li><button class="itemrow" data-snap="${i}"><span><b data-raw>${esc(dayName(p, s.id))} · ${esc(clock(p, s.at))}</b><br>
    <span class="chain" data-raw>${s.pre ? 'Before a restore' : ''}${s.pre && s.n != null ? ' · ' : ''}${s.n != null ? `${s.n.toLocaleString('en-US')} entr${s.n === 1 ? 'y' : 'ies'}` : ''}</span></span><span class="chev" aria-hidden="true">${GLY.right}</span></button></li>`).join('')}</ul>`;
  else if (!box.querySelector('.msg')) box.innerHTML = '<p class="note" style="text-align:center;font-size:.9rem">No copies yet. The first one is saved after the next sync.</p>';
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-close')) return close();
    if (b.dataset.snap == null) return;
    const s = snaps[+b.dataset.snap], label = `${dayName(p, s.id)} · ${clock(p, s.at)}`, rows = [...el.querySelectorAll('[data-snap]')];
    rows.forEach(r => { r.disabled = true; });
    const back2 = () => { rows.forEach(r => { r.disabled = false; }); b.focus({ preventScroll: true }); }; // the row was disabled, so focus has to be put back by hand
    const fail = async m => { await ask('Restore stopped', `Nothing was changed. (${esc(m || 'Unknown error')})`, []); back2(); };
    let back;
    try {
      const { parseExport } = await import('./settings.js');
      back = parseExport(await sync.getSnapshot(p.id, s.id));
      if (back.prof?.id !== p.id) throw new Error('That copy belongs to another profile.');
    } catch (err) { return fail(err.message); }
    const days = back.entries.map(x => x.day).filter(d => d > '1970-01-01').sort(), n = back.entries.length;
    const choice = await ask(`Restore ${label}?`, `<b>${esc(back.prof.name)}</b><br>${n.toLocaleString('en-US')} entr${n === 1 ? 'y' : 'ies'}${days.length ? ` · ${esc(span(days[0], days.at(-1)))}` : ''}<br><br>
      <b>Merge</b> keeps everything here and brings back anything that's missing.<br>
      <b>Replace</b> makes this profile exactly what it was that day, on every phone that syncs it.<br><br>
      Goku saves a copy of right now first, so you can undo this.`, [{ label: 'Merge', value: 'merge' }, { label: 'Replace', value: 'replace' }], { nobal: true });
    if (!choice) { back2(); return; }
    try {
      await sync.snapshotBeforeRestore(p.id); // no safety copy, no restore
      await (await import('./settings.js')).applyBackup(p, back.prof, back.entries, choice);
    } catch (err) { return fail(err.message); }
    close(); toast('Backup restored'); sync.syncSoon(p.id, 300); window.goku.render();
  });
}
