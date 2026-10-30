// Muscles and drawings (2.4).
// MAP: the muscles each move works, [main, also]. Read from how each exercise is done; stretches list
// the muscles they stretch. Regions match the shapes tagged in img/muscles.svg (tools/build-muscles.py).
// ART: start and finish drawings from Everkinetic (CC BY-SA 4.0) for moves that match one of theirs,
// with a note when the drawing uses different equipment from Goku's version.
import { esc } from './ui.js';

export const REGIONS = { chest: 'Chest', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms and grip',
  abs: 'Abs', obliques: 'Obliques', traps: 'Traps', lats: 'Lats', upperback: 'Upper back', lowback: 'Lower back', glutes: 'Glutes',
  hips: 'Hips', quads: 'Quads', hamstrings: 'Hamstrings', adductors: 'Inner thighs', calves: 'Calves', shins: 'Shins', neck: 'Neck' };

const m = (main, also = '') => [main.split(' '), also ? also.split(' ') : []];
const MAP = {
  'wall-pushup': m('chest', 'shoulders triceps'), 'incline-pushup': m('chest', 'shoulders triceps'), 'knee-pushup': m('chest', 'shoulders triceps'),
  pushup: m('chest', 'shoulders triceps abs'), 'decline-pushup': m('chest shoulders', 'triceps abs'), 'pike-pushup': m('shoulders', 'triceps traps'),
  'bench-dip': m('triceps', 'shoulders chest'), 'db-bench-press': m('chest', 'shoulders triceps'), 'db-floor-press': m('chest triceps', 'shoulders'),
  'db-shoulder-press': m('shoulders', 'triceps traps'), 'db-push-press': m('shoulders', 'triceps quads glutes'), 'lateral-raise': m('shoulders', 'traps'),
  'front-raise': m('shoulders', 'chest'), 'db-fly': m('chest', 'shoulders'), 'overhead-tricep': m('triceps'), 'band-chest-press': m('chest', 'shoulders triceps'),
  'bb-bench-press': m('chest', 'shoulders triceps'), 'bb-overhead-press': m('shoulders', 'triceps traps abs'), 'trx-chest-press': m('chest', 'shoulders triceps abs'),
  'db-row': m('lats upperback', 'biceps shoulders'), 'one-arm-row': m('lats upperback', 'biceps'), 'band-row': m('upperback lats', 'biceps'),
  'band-pull-apart': m('upperback shoulders', 'traps'), 'face-pull': m('shoulders upperback', 'traps'), 'inverted-row': m('lats upperback', 'biceps abs'),
  'trx-row': m('lats upperback', 'biceps abs'), 'dead-hang': m('forearms', 'lats shoulders'), 'scap-pullup': m('traps lats', 'forearms'),
  'negative-pullup': m('lats', 'biceps upperback forearms'), pullup: m('lats', 'biceps upperback forearms'), chinup: m('lats biceps', 'upperback forearms'),
  'db-curl': m('biceps', 'forearms'), 'hammer-curl': m('biceps forearms'), 'band-curl': m('biceps', 'forearms'), 'reverse-fly': m('shoulders upperback', 'traps'),
  ytw: m('upperback traps shoulders', 'lowback'), superman: m('lowback glutes', 'hamstrings upperback'), 'bb-row': m('lats upperback', 'biceps lowback'),
  'bw-squat': m('quads glutes', 'adductors hamstrings'), 'box-squat': m('quads glutes', 'adductors hamstrings'), 'goblet-squat': m('quads glutes', 'adductors abs'),
  'db-front-squat': m('quads', 'glutes abs'), 'bb-back-squat': m('quads glutes', 'hamstrings adductors lowback'), 'sumo-squat': m('adductors glutes quads', 'hamstrings'),
  'wall-sit': m('quads', 'glutes'), 'split-squat': m('quads glutes', 'hamstrings adductors'), 'reverse-lunge': m('glutes quads', 'hamstrings adductors'),
  'forward-lunge': m('quads glutes', 'hamstrings'), 'walking-lunge': m('quads glutes', 'hamstrings calves'), 'lateral-lunge': m('adductors glutes quads'),
  'step-up': m('quads glutes', 'hamstrings calves'), bulgarian: m('quads glutes', 'adductors hamstrings'), 'glute-bridge': m('glutes', 'hamstrings lowback'),
  'single-leg-bridge': m('glutes', 'hamstrings'), 'hip-thrust': m('glutes', 'hamstrings quads'), 'db-rdl': m('hamstrings glutes', 'lowback forearms'),
  'single-leg-rdl': m('hamstrings glutes', 'lowback hips'), 'kb-deadlift': m('glutes hamstrings', 'quads lowback forearms'),
  'bb-deadlift': m('glutes hamstrings lowback', 'quads traps forearms'), 'calf-raise': m('calves'), 'good-morning': m('hamstrings lowback', 'glutes'),
  cossack: m('adductors quads glutes', 'hamstrings'), 'nordic-curl': m('hamstrings', 'calves glutes'),
  plank: m('abs', 'shoulders obliques glutes'), 'knee-plank': m('abs', 'shoulders'), 'side-plank': m('obliques', 'abs hips shoulders'), 'dead-bug': m('abs', 'hips'),
  'bird-dog': m('lowback glutes', 'abs shoulders'), crunch: m('abs', 'obliques'), bicycle: m('abs obliques', 'hips'), 'reverse-crunch': m('abs', 'hips'),
  'leg-raise': m('abs hips'), 'hollow-hold': m('abs', 'hips quads'), 'mountain-climber': m('abs shoulders', 'hips quads'), 'russian-twist': m('obliques', 'abs'),
  'v-up': m('abs', 'hips'), 'flutter-kick': m('abs hips'), 'hanging-knee-raise': m('abs hips', 'forearms'), 'hanging-leg-raise': m('abs hips', 'forearms obliques'),
  'pallof-press': m('obliques abs', 'shoulders'), 'farmer-carry': m('forearms traps', 'abs obliques'), 'bear-hold': m('abs shoulders', 'quads'),
  'jump-squat': m('quads glutes', 'calves'), 'broad-jump': m('glutes quads', 'hamstrings calves'), 'box-jump': m('quads glutes', 'calves'),
  'tuck-jump': m('quads calves', 'abs hips'), skater: m('glutes quads', 'adductors calves hips'), burpee: m('quads chest', 'shoulders triceps abs'),
  'kb-swing': m('glutes hamstrings', 'lowback shoulders forearms'), 'ball-slam': m('lats abs', 'shoulders triceps'),
  'jumping-jack': m('calves shoulders', 'glutes hips'), 'high-knees': m('hips quads', 'calves abs'), 'butt-kicks': m('hamstrings', 'calves'),
  'shadow-box': m('shoulders', 'obliques triceps calves'),
  'cat-cow': m('lowback abs'), 'child-pose': m('lowback lats', 'glutes'), cobra: m('abs', 'hips'), 'down-dog': m('hamstrings calves', 'shoulders lats'),
  'hip-flexor': m('hips', 'quads'), pigeon: m('glutes', 'hips'), 'ham-stretch': m('hamstrings', 'lowback calves'), 'quad-stretch': m('quads', 'hips'),
  'calf-stretch': m('calves'), butterfly: m('adductors'), 'figure-four': m('glutes', 'hips'), 'open-book': m('upperback chest', 'obliques'),
  'arm-circles': m('shoulders'), 'leg-swings': m('hips hamstrings', 'adductors'), 'doorway-stretch': m('chest', 'shoulders'),
  'single-leg-balance': m('calves glutes', 'hips shins'), 'band-walk': m('glutes hips'), clamshell: m('glutes hips'), copenhagen: m('adductors', 'obliques'),
  'tib-raise': m('shins'), 'ankle-hops': m('calves', 'shins'), 'hollow-rock': m('abs', 'hips'), 'arch-hold': m('lowback glutes', 'hamstrings upperback'),
  'wall-handstand': m('shoulders', 'triceps traps abs'), 'l-sit': m('abs hips', 'triceps quads'), 'bridge-pose': m('shoulders lowback glutes', 'triceps hamstrings'),
};
const STRETCH = new Set(['cat-cow', 'child-pose', 'cobra', 'down-dog', 'hip-flexor', 'pigeon', 'ham-stretch', 'quad-stretch', 'calf-stretch', 'butterfly',
  'figure-four', 'open-book', 'doorway-stretch']);

export const musclesOf = id => MAP[id] || null;
export const stretches = id => STRETCH.has(id);

// [Everkinetic id, note]. Each pair was checked by eye against Goku's steps.
const ART = {
  pushup: ['0077'], 'decline-pushup': ['0075'], 'bench-dip': ['0162', 'Shown with the feet up on a second bench.'], 'db-bench-press': ['0055'],
  'lateral-raise': ['0018'], 'front-raise': ['0033'], 'db-fly': ['0056'], 'overhead-tricep': ['0198'], 'bb-bench-press': ['0042'],
  'band-pull-apart': ['0020'], 'inverted-row': ['0086'], pullup: ['0087'], 'db-curl': ['0224'], 'hammer-curl': ['0227'],
  'band-curl': ['0261', 'Shown one arm at a time.'], superman: ['0105'], 'bb-back-squat': ['0122'], 'sumo-squat': ['0152'],
  'reverse-lunge': ['0129', 'Shown holding dumbbells.'], 'forward-lunge': ['0115', 'Shown holding dumbbells.'], 'walking-lunge': ['0121'],
  'step-up': ['0137', 'Shown holding dumbbells.'], 'glute-bridge': ['0109'], 'db-rdl': ['0118', 'Shown with a barbell; dumbbells move the same way.'],
  'kb-deadlift': ['0107', 'Shown with dumbbells; a kettlebell moves the same way.'], 'bb-deadlift': ['0099'],
  'calf-raise': ['0281', 'Shown with a barbell on the back.'], 'good-morning': ['0101', 'Shown with a barbell on the back.'], 'side-plank': ['0113'],
  crunch: ['0291', 'Shown with the feet up on a bench.'], bicycle: ['0284'], 'reverse-crunch': ['0287'], 'leg-raise': ['0021', 'Shown lying on a bench.'],
  'reverse-fly': ['0032', 'Shown with the head resting on a bench.'],
};
export const artOf = id => ART[id] ? { start: `img/moves/${ART[id][0]}-relaxation.svg`, end: `img/moves/${ART[id][0]}-tension.svg`, note: ART[id][1] || '' } : null;
export const ART_FILES = Object.values(ART).flatMap(([n]) => [`img/moves/${n}-relaxation.svg`, `img/moves/${n}-tension.svg`]);

// The muscle map (2.5): the drawing is loaded once into a hidden <symbol>, and every map on screen
// is a <use> of it. Each muscle's fill reads --m-<region>, so a map's colors are just CSS variables.
const VIEW = '0 0 406.99026 354.43411';
let ready = null;
export const musclesReady = () => ready ||= fetch('img/muscles.svg').then(r => { if (!r.ok) throw new Error(); return r.text(); }).then(t => {
  if (document.getElementById('musbody')) return true;
  const inner = t.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  document.body.insertAdjacentHTML('beforeend', `<svg id="musdefs" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><symbol id="musbody" viewBox="${VIEW}">${inner}</symbol></svg>`);
  return true;
}).catch(e => { ready = null; throw e; });

// vars: { region: color }. Draws a map, or nothing until musclesReady() has run once.
export function bodyMap(vars, { cls = '', label = '' } = {}) {
  if (!document.getElementById('musbody')) return '';
  const style = Object.entries(vars).map(([r, c]) => `--m-${r}:${c}`).join(';');
  return `<svg class="mmap ${cls}" viewBox="${VIEW}" style="${style}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}><use href="#musbody"/></svg>`;
}
const workVars = id => { const mm = musclesOf(id); if (!mm) return null;
  return Object.fromEntries([...mm[1].map(r => [r, 'var(--mus-also)']), ...mm[0].map(r => [r, 'var(--mus-main)'])]); };
export const miniMap = id => { const v = workVars(id); return v ? bodyMap(v, { cls: 'mini' }) : ''; };
export async function muscleMap(id) {
  const v = workVars(id); if (!v) return '';
  try { await musclesReady(); } catch { return ''; }
  return bodyMap(v);
}

// The line under the map: "Works: Chest · Also: Shoulders, Triceps".
export function muscleLine(id) {
  const mm = musclesOf(id); if (!mm) return '';
  const names = l => l.map(r => REGIONS[r]).join(', ');
  return `<p class="musline"><span class="key main"></span>${stretches(id) ? 'Stretches' : 'Works'}: <b>${esc(names(mm[0]))}</b>${mm[1].length ? ` <span class="key also"></span>Also: ${esc(names(mm[1]))}` : ''}</p>`;
}

// ---------- Body map (2.5): recovery and this week's work, by muscle ----------
// Other training counts for the muscles it mostly uses; kinds Goku can't place (sport, lift, other) don't count.
const ACT = { run: 'quads hamstrings calves glutes', soccer: 'quads hamstrings calves glutes adductors hips', bike: 'quads glutes calves',
  swim: 'lats shoulders upperback triceps chest', hike: 'quads glutes calves hamstrings' };
// sessions and acts: entries from the last 7 days; moveOf(exId) -> catalog move id or null.
export function bodyWork(sessions, acts, moveOf, today, weekStart) {
  const last = {}, week = {};
  const hit = (r, day, w) => { if (!last[r] || day > last[r]) last[r] = day; if (day >= weekStart) week[r] = (week[r] || 0) + w; };
  for (const s of sessions) for (const set of s.data.sets || []) {
    const mm = musclesOf(moveOf(set.exId)); if (!mm) continue;
    mm[0].forEach(r => hit(r, s.day, 1)); mm[1].forEach(r => hit(r, s.day, 0.5));
  }
  for (const a of acts) for (const r of (ACT[a.data.kind] || '').split(' ').filter(Boolean)) hit(r, a.day, 1);
  const days = Object.fromEntries(Object.entries(last).map(([r, d]) => [r, Math.round((Date.parse(today) - Date.parse(d)) / 864e5)]));
  return { days, week };
}
export function bodyMapCard({ days, week }) {
  const rec = Object.fromEntries(Object.entries(days).filter(([, d]) => d <= 2).map(([r, d]) => [r, ['var(--mus-main)', 'var(--mus-also)', 'var(--mus-faint)'][d]]));
  const wk = Object.fromEntries(Object.entries(week).map(([r, n]) => [r, n >= 10 ? 'var(--mus-main)' : n >= 5 ? 'var(--mus-also)' : 'var(--mus-faint)']));
  const names = l => l.map(r => REGIONS[r]).join(', ') || 'none yet';
  const fresh = Object.keys(REGIONS).filter(r => r !== 'neck' && !(r in days));
  const map = (v, label) => bodyMap(v, { label }) || '<p class="sub">The body map loads once you’re online.</p>';
  return `<section class="card bodymap"><div class="row"><p class="lbl" style="margin:0">Body map</p>
      <div class="seg mini" role="group" aria-label="Body map view"><button data-bm="rec" aria-pressed="true">Recovery</button><button data-bm="week" aria-pressed="false">This week</button></div></div>
    <div class="bm-rec">${map(rec, `Worked today: ${names(Object.keys(days).filter(r => days[r] === 0))}. Rested 3 days or more: ${names(fresh)}.`)}
      <p class="mkey sub" aria-hidden="true"><i style="background:var(--mus-main)"></i>today <i style="background:var(--mus-also)"></i>1 day <i style="background:var(--mus-faint)"></i>2 days <i style="background:#d8d3cb"></i>rested</p></div>
    <div class="bm-week" hidden>${map(wk, `This week: ${names(Object.keys(week))}.`)}
      <p class="mkey sub" aria-hidden="true"><i style="background:var(--mus-main)"></i>10+ sets <i style="background:var(--mus-also)"></i>5–9 <i style="background:var(--mus-faint)"></i>1–4 <i style="background:#d8d3cb"></i>none</p>
      ${fresh.length ? `<p class="sub">Not trained in 7 days: ${esc(names(fresh))}.</p>` : ''}</div>
    <p class="note">From your circuits and other training. Supporting muscles count as half a set. If something still feels sore, swap or skip it.</p></section>`;
}
export function bindBodyMap(root) {
  root.querySelector('.bodymap')?.addEventListener('click', e => {
    const b = e.target.closest('[data-bm]'); if (!b) return;
    const card = b.closest('.bodymap');
    card.querySelectorAll('[data-bm]').forEach(x => x.setAttribute('aria-pressed', x === b));
    card.querySelector('.bm-rec').hidden = b.dataset.bm !== 'rec'; card.querySelector('.bm-week').hidden = b.dataset.bm !== 'week';
  });
}
