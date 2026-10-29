// "Test my phone": checks what a workout depends on, on this exact phone.
// Automatic checks run first; sound and the screen-on test need the person to confirm.
import * as db from './db.js';
import { overlay, ask, unlockAudio, beep, soundReady, keepAwake, awake, esc } from './ui.js';
import { VERSION } from './version.js';

const HANDS_OFF_S = 60;

export async function phoneCheck() {
  const results = [];
  const { el, close } = overlay(`<div class="row"><h1>Test my phone</h1><button class="cta2" id="x" data-close>Close</button></div>
    <p class="sub">Checks what a workout needs on this phone. About 2 minutes.</p>
    <div class="scroll"><ul class="list" id="res" aria-live="polite"></ul><div id="step"></div></div>`, { label: 'Test my phone' });
  const $ = s => el.querySelector(s);
  // Close must also release whatever step is waiting, or Settings stays busy behind it.
  let stopped = false, release = null;
  el.addEventListener('click', e => { if (e.target.closest('#x')) { stopped = true; keepAwake(false); release?.(); close(); } });

  const show = () => { $('#res').innerHTML = results.map(([ok, name, note]) =>
    `<li><span><b>${ok === true ? '✓' : ok === false ? '✗' : '–'} ${esc(name)}</b>${note ? `<br><span class="chain">${esc(note)}</span>` : ''}</span></li>`).join(''); };
  const add = (ok, name, note) => { results.push([ok, name, ok === false ? note : '']); show(); };
  const button = (label, sub = '') => new Promise(resolve => {
    release = resolve;
    $('#step').innerHTML = `${sub ? `<p class="sub" style="margin-top:12px">${sub}</p>` : ''}<button class="cta" id="go" style="margin-top:12px">${label}</button>`;
    $('#go').onclick = () => { $('#step').innerHTML = ''; resolve(); };
  });
  const yesNo = q => ask(q, '', [{ label: 'Yes', value: true }, { label: 'No', value: false }]);

  // Automatic checks
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  add(standalone, 'Opened from the Home Screen', 'Open Goku from its Home Screen icon. A Safari tab keeps separate data.');
  let stored = false;
  try { await db.setMeta('devcheck', Date.now()); stored = !!(await db.getMeta('devcheck')); await db.setMeta('devcheck', null); } catch { /* reported below */ }
  add(stored, 'Saves your data', 'Storage failed. Make sure the phone has free space, then try again.');
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  add(persisted ? true : null, persisted ? 'Storage protected from clearing' : 'Storage protection not granted (keep backups)');
  const offline = !!navigator.serviceWorker?.controller && await caches.has('goku-app-' + VERSION).catch(() => false);
  add(offline, 'Works offline', 'Close Goku fully and open it again while online.');
  const testFile = new File(['{}'], 'test.json', { type: 'application/json' });
  add(!!navigator.canShare?.({ files: [testFile] }), 'Backups can use the share sheet', 'Backups will download instead of opening the share sheet.');
  const held = 'wakeLock' in navigator && await keepAwake(true);
  add(held, 'Can ask to keep the screen on', 'This phone can\'t hold the screen on. Set Auto-Lock to Never during workouts.');
  keepAwake(false);
  if (stopped) return;

  // Sound
  await button('Play test sound', 'Turn the ringer switch on and the volume up.');
  if (stopped) return;
  await unlockAudio(); beep(880, 200, 2);
  add(soundReady() && await yesNo('Did you hear two beeps?'), 'Sound plays', 'Check the ringer switch, volume and Sound in Settings.');
  if (stopped) return;


  // Hands-off test: the real workout conditions
  await button(`Start ${HANDS_OFF_S}-second hands-off test`,
    `Put the phone down and don't touch it for ${HANDS_OFF_S} seconds. Watch whether the screen dims or locks. It beeps at 0.`);
  if (stopped) return;
  await unlockAudio();
  await keepAwake(true);
  const cancel = beep(988, 180, 2, HANDS_OFF_S);
  const end = Date.now() + HANDS_OFF_S * 1000;
  await new Promise(resolve => {
    const t = setInterval(() => {
      if (stopped) { clearInterval(t); cancel(); return resolve(); }
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      $('#step').innerHTML = `<p class="big num" style="text-align:center;margin-top:16px">${left}</p>
        <p class="sub" style="text-align:center">${awake() ? 'Holding the screen on' : 'The phone let go of the screen'}</p>`;
      if (left === 0) { clearInterval(t); resolve(); }
    }, 250);
  });
  keepAwake(false);
  if (stopped) return;
  $('#step').innerHTML = '';
  add(await yesNo('Did the screen stay on the whole time?'), 'Screen stays on during a workout', 'Set Auto-Lock to Never (Settings → Display & Brightness) while you train.');
  add(await yesNo('Did you hear the beep at 0?'), 'Rest-over beep plays on time', 'Keep Goku open and the ringer on during rest.');

  const fails = results.filter(r => r[0] === false).length;
  $('#step').innerHTML = `<p style="margin-top:12px"><b>${fails ? `${fails} thing${fails === 1 ? '' : 's'} to fix` : 'All set for workouts.'}</b></p>`;
}
