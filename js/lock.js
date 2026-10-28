// Passcode lock screen. Lock-screen only (data itself is not encrypted).
import { S, saveProfile } from './state.js';
import { hashPin, checkPin } from './crypto.js';
import { overlay, esc } from './ui.js';

const DAY = 86400000;
const MAX_TRIES = 5, WAIT_MS = 30000;
const RELOCK_AFTER_HIDDEN_MS = 2 * 60000; // "Always ask" relocks after 2 minutes away

const sessionUnlocked = new Set(); // in memory only, so a reload asks again
export const isUnlocked = p => !!p.lock.pin && !p.lock.needsNewPin && (p.lock.until > Date.now() || sessionUnlocked.has(p.id));
export const lockNow = p => { p.lock.until = 0; sessionUnlocked.delete(p.id); };

// Shows the lock for profile p. mode: 'unlock' | 'create'. Resolves true when unlocked.
export function showLock(p, { mode, onSwitch } = {}) {
  return new Promise(resolve => {
    const L = p.lock;
    let m = mode || (!L.pin || L.needsNewPin ? 'create' : 'unlock');
    let entry = '', first = '';
    document.documentElement.style.setProperty('--accent', p.accent);
    const { el, close } = overlay(`
      <div class="av" style="width:56px;height:56px;font-size:1.4rem">${esc(p.name.slice(0, 1).toUpperCase())}</div>
      <h1 id="lt"></h1><p class="sub" id="ls"></p>
      <div class="dots" id="dots" aria-hidden="true"></div>
      <p class="msg" id="lm" role="status" aria-live="polite"></p>
      <div class="pad" id="pad"></div>
      <div class="card" id="rem" style="margin:0;text-align:left;width:100%">
        <p class="lbl">Don't ask again on this phone for</p>
        <div class="seg" role="group" aria-label="Remember passcode for">
          <button data-rem="0">Always ask</button><button data-rem="1">1 day</button><button data-rem="7">1 week</button><button data-rem="30">30 days</button>
        </div>
      </div>
      <div class="row" style="justify-content:center;gap:16px">
        ${S.profiles.length > 1 ? '<button class="link" id="sw">Switch profile</button>' : ''}
        <button class="link" id="forgot">Forgot passcode?</button>
      </div>`, { label: 'Passcode', id: 'lock' });
    const $ = s => el.querySelector(s);

    function draw() {
      const t = {
        create: [L.needsNewPin ? 'Set a new passcode' : 'Create a passcode', `Choose 6 digits for ${p.name}. Every profile needs one.`],
        confirm: ['Confirm passcode', 'Enter the same 6 digits again.'],
        unlock: [p.name, 'Enter your passcode'],
      }[m];
      $('#lt').textContent = t[0]; $('#ls').textContent = t[1];
      $('#dots').innerHTML = [0, 1, 2, 3, 4, 5].map(i => `<i class="${i < entry.length ? 'on' : ''}"></i>`).join('');
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'Delete'];
      $('#pad').innerHTML = keys.map(k => k === '' ? '<span></span>' :
        `<button class="${k.length > 1 ? 'txt' : 'num'}" data-key="${k}" aria-label="${k}">${k}</button>`).join('');
      $('#rem').style.display = m === 'confirm' ? 'none' : '';
      el.querySelectorAll('[data-rem]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.rem === L.remember));
      $('#forgot').style.display = m === 'unlock' ? '' : 'none';
    }
    const msg = t => { $('#lm').textContent = t; };

    async function finish() {
      if (m === 'create') { first = entry; entry = ''; m = 'confirm'; draw(); return; }
      if (m === 'confirm') {
        if (entry !== first) { m = 'create'; entry = first = ''; draw(); msg("Those didn't match. Start again."); return; }
        L.pin = await hashPin(entry); L.needsNewPin = false;
        return done();
      }
      if (await checkPin(entry, L.pin)) return done();
      L.fails = (L.fails || 0) + 1; entry = ''; draw();
      if (L.fails >= MAX_TRIES) { L.fails = 0; L.waitUntil = Date.now() + WAIT_MS; msg('Too many tries. Wait 30 s.'); }
      else msg(`Wrong passcode. ${MAX_TRIES - L.fails} tries before a 30-second wait.`);
      await saveProfile(p);
    }

    async function done() {
      L.fails = 0;
      L.until = L.remember === 0 ? 0 : Date.now() + L.remember * DAY;
      sessionUnlocked.add(p.id);
      await saveProfile(p);
      close(); document.removeEventListener('keydown', onKey); resolve(true);
    }

    let busy = false;
    async function press(k) {
      if (busy) return;
      if (k === 'Delete') { entry = entry.slice(0, -1); draw(); return; }
      if (L.waitUntil > Date.now()) { msg(`Too many tries. Wait ${Math.ceil((L.waitUntil - Date.now()) / 1000)} s.`); return; }
      if (entry.length >= 6) return;
      entry += k; msg(''); draw();
      if (entry.length === 6) { busy = true; try { await finish(); } finally { busy = false; } }
    }

    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.key) press(b.dataset.key);
      else if (b.dataset.rem) { L.remember = +b.dataset.rem; draw(); }
      else if (b.id === 'sw') { close(); document.removeEventListener('keydown', onKey); resolve(false); onSwitch?.(); }
      else if (b.id === 'forgot') msg(S.profiles.length > 1
        ? 'Ask the other profile to open Settings, then "Reset another profile\'s passcode".'
        : 'With one profile there is no one to reset it. Restore from your latest backup.');
    });
    const onKey = e => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('Delete');
    };
    document.addEventListener('keydown', onKey);
    draw();
  });
}

// Session unlocks ("Always ask") end when the app has been hidden a while or reloaded.
let hiddenAt = 0;
export function watchRelock(onRelock) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_HIDDEN_MS) {
      sessionUnlocked.clear();
      onRelock();
    }
  });
}
