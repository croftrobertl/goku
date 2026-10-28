// Passcode lock screen. Lock-screen only (data itself is not encrypted).
import { S, saveProfile } from './state.js';
import { hashPin, checkPin } from './crypto.js';
import { overlay, esc, ask, setAccent, announce } from './ui.js';

const DAY = 86400000;
const MAX_TRIES = 5, WAIT_MS = 30000;
const RELOCK_AFTER_HIDDEN_MS = 2 * 60000; // "Always ask" relocks after 2 minutes away

const sessionUnlocked = new Set(); // in memory only, so a reload asks again
export const isUnlocked = p => !!p.lock.pin && !p.lock.needsNewPin && (p.lock.until > Date.now() || sessionUnlocked.has(p.id));
export const lockNow = p => { p.lock.until = 0; sessionUnlocked.delete(p.id); };

let active = null; // { id, promise } — never two lock screens at once

// mode: 'unlock' | 'create' | 'verify'. cancellable adds a Cancel button.
// Resolves true on success, false on Cancel or Switch profile.
export function showLock(p, { mode, onSwitch, cancellable = false } = {}) {
  if (active && document.getElementById('lock')) {
    if (active.id === p.id) return active.promise;
    active.end(false);
  }
  let endRef = null;
  const promise = new Promise(resolve => {
    const L = p.lock;
    let m = mode || (!L.pin || L.needsNewPin ? 'create' : 'unlock');
    const verifying = m === 'verify';
    if (verifying) m = 'unlock';
    let entry = '', first = '';
    setAccent(p.accent);
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'Delete'];
    const { el, close } = overlay(`
      <div class="av" style="width:56px;height:56px;font-size:1.4rem">${esc(p.name.slice(0, 1).toUpperCase())}</div>
      <h1 id="lt"></h1><p class="sub" id="ls"></p>
      <div class="dots" id="dots" aria-hidden="true">${'<i></i>'.repeat(6)}</div>
      <p class="sr" id="lcount" aria-live="polite"></p>
      <p class="msg" id="lm" role="status" aria-live="polite"></p>
      <div class="pad">${keys.map(k => k === '' ? '<span></span>' :
        `<button class="${k.length > 1 ? 'txt' : 'num'}" data-key="${k}" aria-label="${k}">${k}</button>`).join('')}</div>
      <div class="card" id="rem" style="margin:0;text-align:left;width:100%">
        <p class="lbl">Don't ask again on this phone for</p>
        <div class="seg" role="group" aria-label="Remember passcode for">
          <button data-rem="0">Always ask</button><button data-rem="1">1 day</button><button data-rem="7">1 week</button><button data-rem="30">30 days</button>
        </div>
      </div>
      <div class="row" style="justify-content:center;gap:16px;flex-wrap:wrap">
        ${cancellable ? '<button class="link" id="cancel" data-close>Cancel</button>' : ''}
        ${!cancellable && S.profiles.length > 1 ? '<button class="link" id="sw">Switch profile</button>' : ''}
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
      $('#lt').textContent = t[0]; $('#ls').textContent = t[1];
      el.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', i < entry.length));
      $('#rem').style.display = m === 'confirm' || verifying ? 'none' : '';
      el.querySelectorAll('[data-rem]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.rem === L.remember));
      $('#forgot').style.display = m === 'unlock' && !verifying ? '' : 'none';
    }
    const end = ok => { active = null; close(); document.removeEventListener('keydown', onKey); resolve(ok); };
    endRef = end;

    async function finish() {
      if (m === 'create') { first = entry; entry = ''; m = 'confirm'; draw(); announce('Enter the same 6 digits again'); return; }
      if (m === 'confirm') {
        if (entry !== first) { m = 'create'; entry = first = ''; draw(); msg("Those didn't match. Start again."); return; }
        const wasReset = L.needsNewPin && L.resetBy ? { by: L.resetBy, at: L.resetAt } : null;
        L.pin = await hashPin(entry); L.needsNewPin = false; delete L.resetBy; delete L.resetAt;
        await unlocked();
        if (wasReset) await ask('Your passcode was reset', `It was reset on ${esc(new Date(wasReset.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }))} from ${esc(wasReset.by)}'s profile. Your data is untouched.`, []);
        return;
      }
      if (await checkPin(entry, L.pin)) { if (verifying) { L.fails = 0; await saveProfile(p); return end(true); } return unlocked(); }
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
      else if (b.dataset.rem) { L.remember = +b.dataset.rem; draw(); }
      else if (b.id === 'cancel') end(false);
      else if (b.id === 'sw') { end(false); onSwitch?.(); }
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

// Privacy curtain: covers the screen whenever the app is hidden, so the iPhone app
// switcher snapshot shows the orb, not someone's data (verify on iOS).
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
