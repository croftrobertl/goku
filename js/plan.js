// Starting points (2.18, review 11): what setup's coach starts a Strength-side profile on.
//   strength  timed circuits, as before (also the plan of every profile made before 2.18)
//   starter   Starter Workouts: one set of 8 to 12 reps of each move, no timer, ghost or drops
//   move      Move More: a weekly minutes goal that builds toward 150, plus workouts
//   food      Food Only: Nutrition, check-ins and weight; no training screens
//   comeback  circuits from Easy, with a step up after two solid weeks
// p.plan = { id, hold?, sets?, minGoal?, workouts? }. hold: a "yes" to the safety question keeps workouts off
// until the person taps "My doctor cleared me".
// Sources. Activity amounts: CDC. Starter format: CDC, "What Counts as Physical Activity for Adults" (Dec 6, 2023).
// Doctor advice: NHLBI, "Physical Activity and Your Heart: Risks" (Mar 24, 2022); CDC, "Adding Physical Activity as an Adult" (Dec 4, 2025).
import { sources, esc } from './ui.js';
import { addDays } from './time.js';

export const PLAN_IDS = ['strength', 'starter', 'move', 'food', 'comeback'];
export const PLAN_NAMES = { strength: 'Circuits', starter: 'Starter Workouts', move: 'Move More', food: 'Food Only', comeback: 'Comeback' };
export const planId = p => (p?.kind === 'engine' && PLAN_IDS.includes(p.plan?.id) ? p.plan.id : 'strength');
export const onHold = p => p?.kind === 'engine' && p.plan?.hold === true;
export const trainOff = p => p?.kind === 'engine' && (planId(p) === 'food' || onHold(p));
// Starter Workouts are the workout of the Starter plan, and of Move More unless that person already trains.
export const starterOn = p => !trainOff(p) && (planId(p) === 'starter' || (planId(p) === 'move' && p.plan.workouts !== 'circuit'));
export const starterSets = p => Math.min(3, Math.max(1, Math.round(p.plan?.sets || 1)));
export const MOVE_TARGET = 150, MOVE_START = 60, MOVE_STEP = 30;
export const moveGoal = p => Math.min(MOVE_TARGET, Math.max(30, Math.round(p.plan?.minGoal || MOVE_START)));

export const SRC = {
  cdcAdults: 'CDC, <a href="https://www.cdc.gov/physical-activity-basics/guidelines/adults.html" target="_blank" rel="noopener">Adult Activity: An Overview</a> (Dec. 20, 2023): adults need 150 minutes of moderate-intensity physical activity a week and at least 2 days of muscle-strengthening activity.',
  cdcCounts: 'CDC, <a href="https://www.cdc.gov/physical-activity-basics/adding-adults/what-counts.html" target="_blank" rel="noopener">What Counts as Physical Activity for Adults</a> (Dec. 6, 2023): 8 to 12 repetitions is one set; do at least one set, and two or three for more benefit, to the point where it\'s hard to do another repetition.',
  nhlbi: 'NHLBI, <a href="https://www.nhlbi.nih.gov/health/heart/physical-activity/risks" target="_blank" rel="noopener">Physical Activity and Your Heart: Risks</a> (updated Mar. 24, 2022): talk with your doctor if you have a heart problem or chronic disease, or symptoms such as chest pain or dizziness during physical activity.',
  cdcAdding: 'CDC, <a href="https://www.cdc.gov/physical-activity-basics/adding-adults/index.html" target="_blank" rel="noopener">Adding Physical Activity as an Adult</a> (Dec. 4, 2025): if you have a chronic health condition, talk with your doctor about suitable activity.',
  cdcKids: 'CDC, <a href="https://www.cdc.gov/physical-activity-basics/guidelines/children.html" target="_blank" rel="noopener">Child Activity: An Overview</a> (Dec. 4, 2025): ages 6 to 17 need 60 minutes or more of moderate-to-vigorous activity each day.',
};

// ----- Home cards -----
export const holdCard = () => `<section class="card"><p class="lbl">Workouts are waiting</p>
  <p>Check with your doctor first, and ask what kinds and amounts of activity are safe for you. Food logging and the daily check-in work as usual.</p>
  <button class="cta2" id="cleared" style="width:100%;margin-top:10px">My doctor cleared me</button>
  ${sources([SRC.nhlbi, SRC.cdcAdding])}</section>`;

// minutes: this week's training minutes (workouts and anything logged), Sunday to today.
export function moveCard(p, minutes) {
  const goal = moveGoal(p), done = Math.round(minutes), pct = Math.min(100, Math.round(done / goal * 100));
  return `<section class="card"><div class="row"><p class="lbl" style="margin:0">Move this week</p><b class="num">${done} of ${goal} min</b></div>
    <div class="bar" role="img" aria-label="${done} of ${goal} minutes this week" style="margin-top:8px"><i style="width:${pct}%"></i></div>
    <p class="sub" style="margin-top:8px">${done >= goal ? (goal < MOVE_TARGET ? 'You reached this week\'s goal.' : 'You reached 150 minutes, the amount the CDC advises for adults.')
      : `Walks and anything else you log count. ${goal < MOVE_TARGET ? `Building toward ${MOVE_TARGET} minutes a week.` : ''}`}</p>
    <button class="cta2" id="logMove" style="width:100%;margin-top:10px">Log a walk or activity</button>
    ${done >= goal && goal < MOVE_TARGET ? `<button class="cta2" id="raiseMove" style="width:100%;margin-top:8px">Raise my goal to ${Math.min(MOVE_TARGET, goal + MOVE_STEP)} minutes</button>` : ''}
    ${sources([SRC.cdcAdults])}</section>`;
}

// Twelve on every move, in each of the last two starter workouts, means a set can be added.
export function starterReady(p, sessions, moves) {
  const sets = starterSets(p), last = sessions.filter(s => s.data.starter).slice(-2);
  return last.length === 2 && moves > 0 && last.every(s => s.data.sets.length >= moves * sets && s.data.sets.every(x => (x.stages[0]?.reps || 0) >= 12));
}
export function starterCard(p, circuit, sessions, weekCount) {
  const sets = starterSets(p), ready = starterReady(p, sessions, circuit.length);
  return `<section class="card chamber"><p class="lbl">Today's workout</p><h1>Starter workout</h1>
    <p class="sub">${sets} set${sets === 1 ? '' : 's'} of 8 to 12 reps · ${circuit.length} move${circuit.length === 1 ? '' : 's'} · no timer</p>
    <p class="sub" style="text-align:center">${circuit.map(e => esc(e.data.name + (e.data.stages.length > 1 && e.data.stages.at(-1).label ? ` (${e.data.stages.at(-1).label})` : ''))).join(' · ')}</p>
    <p class="sub" style="text-align:center">This week: <b class="num">${weekCount}</b> of 2 workouts${weekCount >= 2 ? ' · goal met' : ''}</p>
    ${circuit.length ? '<button class="cta" id="startStarter" style="margin-top:12px">Start workout</button>' : ''}
    ${ready ? `<div class="ghost">You reached 12 on every move twice in a row. ${sets < 3 ? `Ready for ${sets + 1} sets?` : 'Ready for timed circuits at Easy?'}
      <button class="cta2" id="moreSets" style="width:100%;margin-top:8px">${sets < 3 ? `Yes, ${sets + 1} sets` : 'Yes, try circuits'}</button></div>` : ''}
    ${sources([SRC.cdcCounts])}</section>`;
}
// Comeback: four or more Easy circuits in the last 14 days earns the offer to step up.
export const comebackReady = (p, sessions, today) => planId(p) === 'comeback' && (p.settings.gravity || 50) === 10
  && sessions.filter(s => !s.data.starter && s.data.gravity === 10 && s.day >= addDays(today, -13)).length >= 4;
export const comebackNote = (p, sessions, today) => planId(p) !== 'comeback' ? '' : comebackReady(p, sessions, today)
  ? '<div class="ghost">Two solid weeks at Easy. Step up to Medium?<button class="cta2" id="stepUp" style="width:100%;margin-top:8px">Yes, step up</button></div>'
  : '<p class="sub" style="margin-top:8px">Comeback: starting at Easy. After two solid weeks, Goku offers the next level.</p>';

export const planLabel = p => esc(PLAN_NAMES[planId(p)]) + (onHold(p) ? ' · workouts waiting' : '');
