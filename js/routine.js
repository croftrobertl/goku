// Erica's routine (2.30, review 40): two whole-body workouts that take turns on the Starter plan. One set, then two,
// then one exercise at a time gets its next version. The exercises live in the library like any other.
import { planId, starterOn, starterSets, SRC } from './plan.js';
import { moveById } from './moves.js';
import { moveFor, moveData, howBtn } from './movepicker.js';
import { VEST_SRC } from './gear.js';
import { saveEntry, saveProfile } from './state.js';
import { weight, weightUnit } from './units.js';
import { esc, sources } from './ui.js';

// [move, stage to start on, amount shown, options]. each: one side is counted, then the other side is done.
// Amounts show the library's own weight when there is one.
const A = [['box-squat', 'higher chair', 'No weight'], ['perfect-pushup', 'knees', 'From the knees'], ['db-row', 'light', 'each hand', { load: 5 }],
  ['glute-bridge', 'two legs', 'Two legs'], ['aw-side-leg-lift', 'no weight', 'Each side, no weight', { each: true }], ['dead-bug', 'bent knees', 'Bent knees']];
const B = [['kb-deadlift', 'light', 'kettlebell', { load: 15 }], ['db-floor-press', 'light', 'each hand', { load: 5 }], ['db-shoulder-press', 'light', 'each hand', { load: 5 }],
  ['db-row', 'light', 'each hand', { load: 5 }], ['slider-reverse-lunge', 'holding a chair', 'Each side, holding a chair', { each: true }], ['bird-dog', 'standard', 'Each side', { each: true }]];
const LISTS = { A, B };
// After two sets, one step at a time, legs and core only: the dumbbells jump from 5 to 10 lb, too much to suggest for arms.
// [move, new stage, amount shown, how the offer reads]
export const STEPS = [['aw-side-leg-lift', 'ankle weight', 'Each side, ankle weight', 'add the ankle weight to the side-lying leg lift'],
  ['box-squat', 'lower chair', 'Lower chair', 'use a lower chair for the chair squat'],
  ['slider-reverse-lunge', 'short slide', 'Each side, short slide', 'do the slider lunge without the chair, with a short slide'],
  ['dead-bug', 'straight legs', 'Straight legs', 'do the dead bug with straight legs']];
const stepsTaken = p => Math.min(STEPS.length, Math.max(0, Math.round(p.plan?.step || 0)));
export const MAX_SETS = 2;

export const routineOn = p => p?.who === 'erica' && starterOn(p) && planId(p) === 'starter';
export const routineSets = p => Math.min(MAX_SETS, starterSets(p));
export const routineDays = p => parseInt(p.about?.days, 10) || 3;
// Profiles made before 2.30 switch to the routine once. What someone changes afterward stays changed.
export function addRoutine(p) {
  if (p?.who !== 'erica' || p.kind !== 'engine' || p.settings?.routine) return false;
  p.plan = { id: 'starter', sets: 1, ...(p.plan?.hold ? { hold: true } : {}) };
  p.settings.routine = true;
  return true;
}

const find = (lib, id) => id === 'perfect-pushup' ? lib.find(e => e.data.name.trim().toLowerCase() === 'perfect pushup') : lib.find(e => moveFor(e.data)?.id === id);
// Adds what the library lacks, once; an exercise deleted later stays deleted. Fixed ids, so two phones add the same ones.
async function stock(p, lib) {
  if (p.settings.routineLib) return lib;
  const out = [...lib];
  for (const [id, stage, , o = {}] of [...A, ...B]) {
    const have = find(out, id), st = have?.data.stages.find(s => s.label === stage);
    if (have) { if (o.load && st && !st.load) { st.load = o.load; await saveEntry('exercise', have.data, { id: have.id, day: have.day, ts: have.ts }); } continue; }
    const data = id === 'perfect-pushup' ? { name: 'Perfect Pushup', slot: 'push', module: null, order: 999, mode: 'reps', stages: ['deficit', 'flat', 'knees'].map(label => ({ label, load: null })) } : moveData(moveById(id));
    if (o.load) data.stages = data.stages.map(s => s.label === stage ? { ...s, load: o.load } : s);
    out.push(await saveEntry('exercise', data, { id: `routine-${p.id}-${id}`, day: '1970-01-01' }));
  }
  p.settings.routineLib = true;
  await saveProfile(p);
  return out;
}

let shown = null; // the workout picked with the A and B buttons; cleared once a workout starts
export const showRoutine = k => { shown = k; };
const done = sessions => sessions.filter(s => s.data.starter && s.data.routine);
export const nextUp = sessions => done(sessions).at(-1)?.data.routine === 'A' ? 'B' : 'A';
export const routineShown = sessions => shown || nextUp(sessions);

// The workout as circuit entries: copies with the one stage to do, and the amount to show.
export async function routineCircuit(p, lib, key) {
  const all = await stock(p, lib), taken = STEPS.slice(0, stepsTaken(p));
  return LISTS[key].map(([id, stage, amount, o = {}]) => {
    const e = find(all, id); if (!e) return null;
    const step = taken.find(s => s[0] === id);
    const st = e.data.stages.find(s => s.label === (step?.[1] || stage)) || e.data.stages.at(-1) || { label: '', load: null };
    return { ...e, data: { ...e.data, name: e.data.name === 'DB row' ? 'Bent-over dumbbell row' : e.data.name, moveId: id === 'perfect-pushup' ? 'knee-pushup' : e.data.moveId, stages: [st] }, amount: step?.[2] || amount, weighted: !!o.load, each: !!o.each };
  }).filter(Boolean);
}
export const amountText = (x, load, p) => !x.weighted ? x.amount + (load ? `, ${weight(load, p)} ${weightUnit(p)}` : '')
  : load ? `${weight(load, p)} ${weightUnit(p)} ${x.amount}` : 'No weight';

// Twelve on every exercise, at the current sets and step, in A and then B (or B and then A): ready for the next step.
export function routineReady(p, sessions) {
  const last = done(sessions).filter(s => s.ts > (p.plan?.stepAt || 0)).slice(-2), sets = routineSets(p);
  return last.length === 2 && last[0].data.routine !== last[1].data.routine
    && last.every(s => s.data.sets.length >= LISTS[s.data.routine].length * sets && s.data.sets.every(x => (x.stages[0]?.reps || 0) >= 12));
}
// One step: a second set, then the next harder version. Returns the toast, or null when there is none left.
export function routineStep(p) {
  if (routineSets(p) < MAX_SETS) { p.plan = { ...p.plan, sets: routineSets(p) + 1, stepAt: Date.now() }; return `${routineSets(p)} sets from now on`; }
  const s = STEPS[stepsTaken(p)]; if (!s) return null;
  p.plan = { ...p.plan, step: stepsTaken(p) + 1, stepAt: Date.now() };
  return `${moveById(s[0]).name}: ${s[1]} from now on`;
}
// The vest is 12 lb and Harvard's limit is 10% of body weight, so a known weight under 120 lb gets a plain walk.
const walkLine = p => p.about?.weightLb && p.about.weightLb < 120
  ? 'Once a week, on a day off: a 15-minute walk. The 12 lb vest is more than 10% of your body weight, the most Harvard Health advises.'
  : 'Once a week, on a day off: a 15-minute vest walk if 120 lb or more (Harvard Health: no more than 10% of body weight). Henry Ford Health starts at 3% or less; a plain walk is fine too.';

export function routineCard(p, circuit, sessions, weekCount, key) {
  const sets = routineSets(p), days = routineDays(p), step = STEPS[stepsTaken(p)], ready = routineReady(p, sessions) && (sets < MAX_SETS || step);
  return `<section class="card chamber"><p class="lbl">Today's workout</p><h1>${esc(p.name)}'s workout</h1>
    <div class="seg" role="group" aria-label="Workout" style="margin-top:10px">${['A', 'B'].map(k => `<button data-routine="${k}" aria-pressed="${k === key}">Workout ${k}</button>`).join('')}</div>
    <p class="sub" style="text-align:center;margin-top:8px">${sets} set${sets === 1 ? '' : 's'} of 8 to 12 reps · ${circuit.length} move${circuit.length === 1 ? '' : 's'} · no timer</p>
    <p class="sub" style="text-align:center">Warm up first: walk for 5 to 10 minutes.</p>
    ${circuit.length ? '<button class="cta" id="startStarter" style="margin-top:12px">Start workout</button>' : ''}
    <div style="margin-top:14px">${circuit.map(e => `<div class="row" style="padding:7px 0;border-top:1px solid var(--line);text-align:left"><b style="font-weight:650">${esc(e.data.name)}</b><span class="sub" style="text-align:right">${esc(amountText(e, e.data.stages[0].load, p))}</span></div>`).join('')}</div>
    <p class="sub" style="text-align:center">This week: <b class="num">${weekCount}</b> of ${days} workout${days === 1 ? '' : 's'}${weekCount >= days ? ' · goal met' : ''}</p>
    ${ready ? `<div class="ghost">You reached 12 on every move in both workouts. ${sets < MAX_SETS ? `Ready for ${sets + 1} sets?` : `Ready for one step up: ${esc(step[3])}?`}
      <button class="cta2" id="moreSets" style="width:100%;margin-top:8px">${sets < MAX_SETS ? `Yes, ${sets + 1} sets` : 'Yes, step up'}</button></div>` : ''}
    <div class="row" style="margin-top:12px;text-align:left"><span class="note" style="margin:0">${walkLine(p)}</span>${howBtn('vest-walk', 'Weighted vest walk')}</div>
    ${sources([SRC.cdcCounts, SRC.cdcAdults, SRC.harvard7, ...VEST_SRC])}</section>`;
}
