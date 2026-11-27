// Passcode lock screen. Lock-screen only (data itself is not encrypted).
import { setSkin, skinOf } from './skins.js';
import { S, saveProfile } from './state.js';
import { hashPin, checkPin } from './crypto.js';
import { overlay, esc, ask, setAccent, setTheme, announce } from './ui.js';
import { avatarHTML } from './avatar.js';
import { choices, flipChoice, shutChoice } from './coach.js';

const DAY = 86400000;
const MAX_TRIES = 5, WAIT_MS = 30000;
const RELOCK_AFTER_HIDDEN_MS = 2 * 60000; // "Always ask" relocks after 2 minutes away

const sessionUnlocked = new Set(); // in memory only, so a reload asks again
// A phone's only profile may go without a passcode (2.18, review 11); once a second profile exists, each is asked to create one.
export const noPinOk = p => p.lock.noPin === true && !p.lock.pin && (S.profiles.length <= 1 || p.demo === true); // Chi-Chi 2: the sample never needs one
export const isUnlocked = p => noPinOk(p) || (!!p.lock.pin && !p.lock.needsNewPin && (p.lock.until > Date.now() || sessionUnlocked.has(p.id)));
export const lockNow = p => { p.lock.until = 0; sessionUnlocked.delete(p.id); };

let active = null; // { id, promise } — never two lock screens at once

// mode: 'unlock' | 'create' | 'verify'. cancellable adds a Cancel button.
// grown (2.33, review 47): a separate grown-up passcode kept in p.lock.grown, for a profile whose owner knows her own.
// It stays on this phone (never synced or backed up) and is asked for every time.
// Resolves true on success, false on Cancel or Switch profile.
export function showLock(p, { mode, onSwitch, cancellable = false, noLater = false, grown = false } = {}) {
  if (active && document.getElementById('lock')) {
    if (active.id === p.id) return active.promise;
    active.end(false);
  }
  let endRef = null;
  const promise = new Promise(resolve => {
    if (grown) { p.lock.grown ||= { pin: null, fails: 0, waitUntil: 0 }; noLater = true; cancellable = true; }
    const L = grown ? p.lock.grown : p.lock;
    let m = mode || (!L.pin || L.needsNewPin ? 'create' : 'unlock');
    const verifying = m === 'verify';
    if (verifying) m = 'unlock';
    let entry = '', first = '';
    setTheme(p.settings?.theme, p.settings?.mode); setSkin(skinOf(p));
    setAccent(p.accent);
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'Delete'];
    const { el, close } = overlay(`
      <div style="display:grid;place-items:center">${avatarHTML(p, 56)}</div>
      <h1 id="lt"></h1><p class="sub" id="ls"></p>
      <div class="dots" id="dots" aria-hidden="true">${'<i></i>'.repeat(6)}</div>
      <p class="sr" id="lcount" aria-live="polite"></p>
      <p class="msg" id="lm" role="status" aria-live="polite"></p>
      <div class="pad">${keys.map(k => k === '' ? '<span></span>' :
        `<button class="${k.length > 1 ? 'txt' : 'num'}" data-key="${k}" aria-label="${k}">${k}</button>`).join('')}</div>
      <div class="card" id="rem" style="margin:0;text-align:left;width:100%">
        <p class="lbl">Remember this phone for</p>
        <div id="remsel"></div>
      </div>
      <div class="row" style="justify-content:center;gap:16px;flex-wrap:wrap">
        ${cancellable ? '<button class="link" id="cancel" data-close>Cancel</button>' : ''}
        ${!cancellable && S.profiles.length > 1 ? '<button class="link" id="sw">Switch profile</button>' : ''}
        <button class="link" id="later" hidden>Add a passcode later</button>
        <button class="link" id="forgot">Forgot passcode?</button>
      </div>`, { label: 'Passcode', id: 'lock' });
    const $ = s => el.querySelector(s);
    const msg = t => { $('#lm').textContent = t; };

    function draw() {
      const t = {
        create: [L.needsNewPin ? 'Set a new passcode' : mode === 'create' && L.pin ? 'Choose a new passcode' : 'Create a passcode', `Choose 6 digits for ${p.name}.`],
        confirm: ['Confirm passcode', 'Enter the same 6 digits again.'],
        unlock: [p.name, verifying ? 'Enter your passcode to confirm' : 'Enter your passcode'],
      }[m];
      if (grown) t.splice(0, 2, ...{ create: ['Create a grown-up passcode', `Choose 6 digits that ${p.name} doesn't know.`], confirm: t, unlock: ['Grown-ups', 'Enter the grown-up passcode.'] }[m]);
      $('#lt').textContent = t[0]; $('#ls').textContent = t[1];
      el.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', i < entry.length));
      $('#rem').style.display = m === 'confirm' || verifying || grown ? 'none' : '';
      $('#remsel').innerHTML = choices([['0', 'Always ask'], ['1', '1 day'], ['7', '1 week'], ['30', '30 days'], ['90', '90 days']], { id: 'rem-lock', attr: 'data-rem', sel: [String(L.remember)], label: 'Remember this phone for' }); // 2.32 (review 46): a dropdown, since 90 days made five buttons too tight
      $('#forgot').style.display = m === 'unlock' && (!verifying || grown) ? '' : 'none';
      // Only for the phone's one profile, and only when it has no passcode yet.
      $('#later').hidden = noLater || !(m === 'create' && !L.pin && !L.needsNewPin && S.profiles.length <= 1);
    }
    // The spoken "Enter the same 6 digits again" is cleared, so it isn't read out after setup (2.8.2).
    const end = ok => { active = null; const live = document.getElementById('sr-live'); if (live) live.textContent = ''; close(); document.removeEventListener('keydown', onKey); resolve(ok); };
    endRef = end;

    async function finish() {
      if (m === 'create') { first = entry; entry = ''; m = 'confirm'; draw(); announce('Enter the same 6 digits again'); return; }
      if (m === 'confirm') {
        if (entry !== first) { m = 'create'; entry = first = ''; draw(); msg("Those didn't match. Start again."); return; }
        const wasReset = L.needsNewPin && L.resetBy ? { by: L.resetBy, at: L.resetAt } : null;
        L.pin = await hashPin(entry);
        if (grown) { L.fails = 0; await saveProfile(p); return end(true); }
        L.needsNewPin = false; delete L.resetBy; delete L.resetAt; delete L.noPin;
        await unlocked();
        if (wasReset) await ask('Your passcode was reset', `It was reset on ${esc(new Date(wasReset.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }))} from ${esc(wasReset.by)}'s profile. Your data is untouched.`, []);
        return;
      }
      if (await checkPin(entry, L.pin)) { if (verifying || grown) { L.fails = 0; await saveProfile(p); return end(true); } return unlocked(); }
      L.fails = (L.fails || 0) + 1; entry = ''; draw();
      if (L.fails >= MAX_TRIES) { L.fails = 0; L.waitUntil = Date.now() + WAIT_MS; msg('Too many tries. Wait 30 s.'); }
      else msg(`Wrong passcode. ${MAX_TRIES - L.fails} tries before a 30-second wait.`);
      await saveProfile(p);
    }

    async function unlocked() {
      L.fails = 0;
      L.until = L.remember === 0 ? 0 : Date.now() + L.remember * DAY;
      sessionUnlocked.add(p.id);
      await saveProfile(p);
      end(true);
    }

    let busy = false;
    async function press(k) {
      if (busy) return;
      if (k === 'Delete') { entry = entry.slice(0, -1); draw(); $('#lcount').textContent = `${entry.length} of 6`; return; }
      if (L.waitUntil > Date.now()) { msg(`Too many tries. Wait ${Math.ceil((L.waitUntil - Date.now()) / 1000)} s.`); return; }
      if (entry.length >= 6) return;
      entry += k; msg(''); draw(); $('#lcount').textContent = `${entry.length} of 6`;
      if (entry.length === 6) { busy = true; try { await finish(); } finally { busy = false; } }
    }

    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.key) press(b.dataset.key);
      else if (b.dataset.open) { flipChoice(b.dataset.open); draw(); el.querySelector(`[data-open="${b.dataset.open}"]`)?.focus(); }
      else if (b.dataset.rem) { L.remember = +b.dataset.rem; shutChoice('rem-lock'); draw(); el.querySelector('[data-open="rem-lock"]')?.focus(); }
      else if (b.id === 'cancel') end(false);
      else if (b.id === 'later') { L.noPin = true; sessionUnlocked.add(p.id); saveProfile(p).then(() => end(true)); }
      else if (b.id === 'sw') { end(false); onSwitch?.(); }
      // No reset from inside the app: anyone holding the phone could use one to approve their own prizes.
      else if (b.id === 'forgot' && grown) msg('Ask the grown-up who set it. It can\'t be reset in the app, so the approved prizes stay as they are.');
      else if (b.id === 'forgot') msg(S.profiles.length > 1
        ? 'Ask someone with another profile on this phone to open Settings and tap "Reset passcode" next to your name.'
        : 'With one profile there is no one to reset it. Restore from your latest backup.');
    });
    const onKey = e => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('Delete');
    };
    document.addEventListener('keydown', onKey);
    draw();
  });
  active = { id: p.id, promise, end: ok => endRef?.(ok) };
  return promise;
}

// Privacy curtain: covers the screen whenever the app is hidden. On iOS 27 the app
// switcher snapshot is taken before the page hears it's hidden, so the switcher can
// still show the last screen; the curtain only covers what's seen on return.
// "Always ask" unlocks end after 2 minutes away; onRelock decides what to do.
let hiddenAt = 0;
export function watchRelock(onRelock) {
  document.addEventListener('visibilitychange', () => {
    let curtain = document.getElementById('curtain');
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      if (!curtain) {
        curtain = document.createElement('div');
        curtain.id = 'curtain'; curtain.setAttribute('aria-hidden', 'true');
        curtain.innerHTML = '<img src="icons/favicon-192.png" alt="" width="96" height="96">';
        document.body.append(curtain);
      }
      return;
    }
    if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_HIDDEN_MS) { sessionUnlocked.clear(); onRelock(); }
    curtain?.remove();
  });
}
