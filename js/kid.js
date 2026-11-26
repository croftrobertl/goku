// Lennon's kid mode (2.32, reviews 44 and 45). He is 7: five body-weight moves, one round of about 10 minutes,
// a star for each finished move, one Dragon Ball per finished workout, and a wish (a prize a grown-up picks) at seven.
// Grown-ups reach everything else with the profile's passcode.
// Sources: KidsHealth "Strength Training" (body-weight moves, close supervision), AAP HealthyChildren "Strength Training"
// ("Stop lifting at once if pain is felt") and mealtime tips (food is not a reward), FitnessGram curl-up (instead of sit-ups),
// CDC children's guidelines (push-ups count as muscle-strengthening). Tips simplified from Cleveland Clinic form pages.
import { profile, saveProfile, today } from './state.js';
import { art } from './skins.js';
import { artOf } from './muscles.js';
import { overlay, esc, beep, unlockAudio } from './ui.js';
import { showLock } from './lock.js';
import { choices, flipChoice, shutChoice, keepFocus } from './coach.js';

export const kidOn = p => p?.who === 'lennon';
const grown = new Set(); // profiles a grown-up has opened this session (in memory, so a reload is kid mode again)
export const grownUp = p => grown.has(p.id);
export const backToKid = p => { grown.delete(p.id); };

const REPS = 8, HOLD = 20;
// Each step: [library id or null, name in a sentence, title, tip]. Push-ups and the plank have easier versions a grown-up picks.
const PUSH = [['wall-pushup', 'wall push-ups', 'Wall Push-ups'], ['knee-pushup', 'knee push-ups', 'Knee Push-ups'], ['pushup', 'push-ups', 'Push-ups']];
const PLANK = [['knee-plank', 'a knee plank', 'Knee Plank'], ['plank', 'a plank', 'Plank']];
const TIP = {
  push: 'Keep your body straight like a board.',
  curl: 'Slide your hands forward, then lie back down.',
  squat: 'Point your knees at your toes, and keep your chest up.',
  plank: "Keep your body straight, and don't let your bottom sag.",
  jump: 'Jump up and spread out like a star, then land with your feet together.',
};
export const PRIZES = [['screen', '30 minutes of extra screen time'], ['park', 'A trip to the park'], ['toy', 'A small toy'], ['movie', 'A movie night'], ['game', 'A game with a grown-up'], ['own', 'Type your own']];
const prizeText = k => k?.own || PRIZES.find(([v]) => v === k?.pick)?.[1] || '';

// Older profiles and new ones both get the same starting point, once.
export function ensureKid(p) {
  if (!kidOn(p) || p.kid) return false;
  p.kid = { balls: 0, push: 0, plank: 0, rounds: 1, prize: null, days: [] };
  p.lock.remember = 90; // review 45: the tablet remembers the passcode for 90 days
  return true;
}

function steps(p) {
  const k = p.kid, push = PUSH[k.push] || PUSH[0], plank = PLANK[k.plank] || PLANK[0];
  const one = [
    { key: 'push', id: push[0], name: push[1], title: push[2], reps: REPS },
    { key: 'curl', id: 'curl-up', name: 'curl-ups', title: 'Curl-ups', reps: REPS },
    { key: 'squat', id: 'bw-squat', name: 'squats', title: 'Squats', reps: REPS },
    { key: 'plank', id: plank[0], name: plank[1], title: plank[2], hold: HOLD },
    { key: 'jump', id: 'star-jump', name: 'star jumps', title: 'Star Jumps', reps: REPS },
  ];
  return k.rounds === 2 ? [...one, ...one] : one;
}
const line = s => s.hold ? `Hold ${s.name} for ${s.hold} seconds. ${TIP[s.key]}` : `Do ${s.reps} ${s.name}. ${TIP[s.key]}`;

// The tablet's own voice (no internet). It follows the app's sound setting.
function say(p, text) {
  try { if (p.settings?.sound === false || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; speechSynthesis.speak(u); } catch { /* no voice on this device */ }
}

const ball = (n, lit, px) => `<img src="${art(`balls/${lit ? 'lit' : 'dim'}-${n}.png`)}" alt="" width="${px}" height="${px}">`;
const row7 = n => `<div class="kballs" role="img" aria-label="${n} of 7 Dragon Balls">${[1, 2, 3, 4, 5, 6, 7].map(i => ball(i, i <= n, 40)).join('')}</div>`;
const stars = (got, of) => `<p class="kstars" role="img" aria-label="${got} of ${of} stars">${'★'.repeat(got)}<span class="off">${'★'.repeat(of - got)}</span></p>`;
const SAFE = '<p class="ksafe sub">A grown-up should be nearby. If anything hurts, stop and tell them.</p>';

// Home (review 45: Goku and one big button).
export function kidHome(p) {
  const k = p.kid;
  return { html: `<div class="kid">${k.balls >= 7 ? wishHTML(p)
    : `<img class="kpose big" src="${art('pose/letstrain.png')}" alt="" width="240" height="240">
    <button class="cta kgo" id="kidGo">Let's train!</button>${row7(k.balls)}`}
    <p class="kgrown"><button class="link" id="kidGrown">Grown-ups</button></p></div>`,
  bind: root => {
    root.querySelector('#kidGo')?.addEventListener('click', () => kidRun(p));
    root.querySelector('#kidAgain')?.addEventListener('click', () => collectAgain(p));
    root.querySelector('#kidGrown').addEventListener('click', () => grownUps(p));
  } };
}

function wishHTML(p) {
  const prize = prizeText(p.kid.prize);
  return `<img class="kpose" src="${art('pose/shenron.png')}" alt="Shenron rises from the seven Dragon Balls" width="200" height="298">
    <h1>You found all seven! Shenron is here.</h1>
    ${prize ? `<p class="sub">Your wish is:</p><p class="kprize">${esc(prize)}</p><p class="sub">Show this to a grown-up.</p>`
      : '<p class="kprize">Ask a grown-up to choose your prize.</p>'}
    <button class="cta kgo" id="kidAgain">Collect them again</button>`;
}

async function collectAgain(p) {
  p.kid = { ...p.kid, balls: 0, prize: null };
  await saveProfile(p); window.goku.render();
}

// The workout: one move per screen, a tap for each rep, a big star after each move, a Dragon Ball at the end.
async function kidRun(p) {
  await unlockAudio();
  const list = steps(p);
  let i = 0, count = 0, got = 0, phase = 'move', timer = null, left = 0;
  const { el, close } = overlay('', { label: 'Workout', id: 'kidrun' });
  el.classList.add('kidrun');
  const inner = el.querySelector('.inner');
  const stop = () => { clearInterval(timer); timer = null; try { speechSynthesis.cancel(); } catch { /* none */ } };
  const done = () => { stop(); close(); window.goku.render(); };
  function draw() {
    const s = list[i], a = s && s.id && artOf(s.id);
    if (phase === 'move') inner.innerHTML = `<div class="kid">
      <p class="kwhere">Move ${i + 1} of ${list.length}</p><h1>${esc(s.title)}</h1>
      ${a ? `<div class="kfig"><img src="${a.end}" alt=""></div>` : ''}
      <p class="ktip">${esc(TIP[s.key])}</p>
      <button class="kring" id="kTap" aria-label="${s.hold ? (timer ? `${left} seconds left` : 'Start the hold') : `Count one. ${count} of ${s.reps} so far`}">${s.hold ? (timer ? left : '▶') : count}</button>
      <p class="sub">${s.hold ? (timer ? 'Hold it until the circle reaches 0.' : `Get into position, then tap the circle. Hold for ${s.hold} seconds.`) : `Tap the circle after each one. You get a star at ${s.reps}.`}</p>
      <p><button class="link" id="kSay">🔊 Hear it again</button></p>${SAFE}
      <p><button class="link" id="kStop">Stop for today</button></p></div>`;
    else if (phase === 'star') inner.innerHTML = `<div class="kid">
      <p class="kwhere">Move ${i + 1} of ${list.length}</p><p class="kbigstar" aria-hidden="true">★</p><h1>You earned a star!</h1>
      <p class="sub">You finished the ${esc(s.key === 'plank' ? 'plank' : s.name)}.</p>${stars(got, list.length)}
      <button class="cta kgo" id="kNext">${i + 1 < list.length ? `Next: ${esc(list[i + 1].title)}` : 'Finish'}</button></div>`;
    else inner.innerHTML = `<div class="kid">
      <img class="kpose" src="${art('pose/cheer.png')}" alt="" width="190" height="190">${stars(got, list.length)}
      ${ball(p.kid.balls, true, 120)}<h1>You found the <span class="nw">${p.kid.balls}-star</span> Dragon Ball!</h1>${row7(p.kid.balls)}
      <p class="sub">${p.kid.balls >= 7 ? 'You have all seven. It is time for your wish!' : `Find ${7 - p.kid.balls} more to make a wish.`}</p>
      <button class="cta kgo" id="kYay">Yay!</button></div>`;
    inner.querySelector('#kTap')?.addEventListener('click', tap);
    inner.querySelector('#kSay')?.addEventListener('click', () => say(p, line(s)));
    inner.querySelector('#kStop')?.addEventListener('click', done);
    inner.querySelector('#kNext')?.addEventListener('click', next);
    inner.querySelector('#kYay')?.addEventListener('click', done);
    inner.querySelector('#kTap, #kNext, #kYay')?.focus({ preventScroll: true });
  }
  function star() { stop(); got++; phase = 'star'; beep(1046, 140, 2); draw(); }
  function tap() {
    const s = list[i];
    if (s.hold) {
      if (timer) return;
      left = s.hold;
      timer = setInterval(() => { left--; if (left <= 0) star(); else { const r = inner.querySelector('#kTap'); if (r) { r.textContent = left; r.setAttribute('aria-label', `${left} seconds left`); } } }, 1000);
      draw(); return;
    }
    count++; beep(660, 60);
    if (count >= s.reps) star(); else { const r = inner.querySelector('#kTap'); r.textContent = count; r.setAttribute('aria-label', `Count one. ${count} of ${s.reps} so far`); }
  }
  async function next() {
    if (i + 1 < list.length) { i++; count = 0; phase = 'move'; draw(); say(p, line(list[i])); return; }
    p.kid = { ...p.kid, balls: Math.min(7, p.kid.balls + 1), days: [...(p.kid.days || []), today(p)].slice(-200) };
    await saveProfile(p); phase = 'ball'; beep(880, 180, 3); draw();
  }
  draw(); say(p, line(list[0]));
}

// Grown-ups: the passcode, then the prize, the levels and the full app.
async function grownUps(p) {
  const ok = await showLock(p, { mode: p.lock.pin ? 'verify' : 'create', cancellable: true, noLater: true });
  if (!ok || !p.lock.pin) return; // "Add a passcode later" doesn't open the grown-up area
  const k = p.kid;
  const sel = { prize: k.prize?.own ? 'own' : k.prize?.pick || '', push: String(k.push), plank: String(k.plank), rounds: String(k.rounds) };
  let own = k.prize?.own || '';
  const { el, close } = overlay('', { label: 'Grown-ups', id: 'kidgrown' });
  const inner = el.querySelector('.inner');
  const draw = () => { inner.innerHTML = `<h1>Grown-ups</h1>
    <p class="lbl">Prize for the next wish</p><p class="sub">Lennon sees it only when all seven Dragon Balls are gathered. Please don't use food as a prize.</p>
    ${choices(PRIZES, { attr: 'data-prize', sel: [sel.prize], list: true, label: 'Prize' })}
    ${sel.prize === 'own' ? `<input id="kgOwn" maxlength="60" placeholder="Type the prize" aria-label="Prize" value="${esc(own)}">` : ''}
    <p class="lbl" style="margin-top:16px">Push-ups</p>${choices([['0', 'Against a wall'], ['1', 'On the knees'], ['2', 'Full push-ups']], { id: 'kpush', attr: 'data-kpush', sel: [sel.push], label: 'Push-ups' })}
    <p class="lbl">Plank</p>${choices([['0', 'On the knees'], ['1', 'On the toes']], { id: 'kplank', attr: 'data-kplank', sel: [sel.plank], label: 'Plank' })}
    <p class="lbl">Rounds</p>${choices([['1', 'One round, about 10 minutes'], ['2', 'Two rounds, about 20 minutes']], { id: 'krounds', attr: 'data-krounds', sel: [sel.rounds], label: 'Rounds' })}
    <button class="cta" id="kgSave" style="margin-top:16px">Save</button>
    <button class="cta2" id="kgFull" style="margin-top:10px">Open the full app</button>
    <p style="text-align:center"><button class="link" data-close>Close</button></p>`; };
  draw();
  el.addEventListener('input', e => { if (e.target.id === 'kgOwn') own = e.target.value; });
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-close')) return close();
    if (b.dataset.open) { flipChoice(b.dataset.open); return keepFocus(inner, draw); }
    for (const [key, at] of [['prize', 'prize'], ['push', 'kpush'], ['plank', 'kplank'], ['rounds', 'krounds']]) {
      const v = b.dataset[at]; if (v === undefined) continue;
      sel[key] = v; if (key !== 'prize') shutChoice('k' + key);
      keepFocus(inner, draw); if (key === 'prize' && v === 'own') inner.querySelector('#kgOwn')?.focus();
      return;
    }
    if (b.id === 'kgSave' || b.id === 'kgFull') {
      const prize = sel.prize === 'own' ? (own.trim() ? { own: own.trim().slice(0, 60) } : null) : sel.prize ? { pick: sel.prize } : null;
      p.kid = { ...p.kid, prize, push: +sel.push, plank: +sel.plank, rounds: +sel.rounds };
      await saveProfile(p);
      if (b.id === 'kgFull') grown.add(p.id);
      close(); window.goku.render();
    }
  });
}
