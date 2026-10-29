// Numbers worked out from the log: streak, weekly recap, recovery map, records, progression.
// All of it is recomputed from entries each time, so nothing here can drift out of date.
import * as db from './db.js';
import { addDays, weekStart, daysBetween } from './time.js';
import { activityGroups } from './activity.js';

const LOGGED = ['session', 'activity', 'checkin', 'gut', 'rest'];
export async function loggedEntries(p) {
  return (await db.byIndex('entries', 'profile', p.id)).filter(e => LOGGED.includes(e.type));
}

// ---------- Streak with Senzu saves ----------
// A day counts when anything is logged. Rest days count too, up to restPerWeek in each
// Sunday-to-Saturday week, so a streak can't run on rest alone. Every 7 days in a row
// earns a Senzu bean (up to 3). A missed day spends a bean instead of ending the streak.
// Rest logged before the cap arrived (1.4.1, week of Oct 25 2026) always counts, so updating never costs a streak.
const REST_CAP_FROM = '2026-10-25';
export function streak(all, today, restPerWeek = 2) {
  const days = new Set(all.filter(e => e.type !== 'rest').map(e => e.day));
  const rest = new Set(all.filter(e => e.type === 'rest' && !days.has(e.day)).map(e => e.day));
  const thisWeek = weekStart(today);
  const restUsed = [...rest].filter(d => d >= thisWeek && d <= today).length;
  const restLeft = Math.max(0, restPerWeek - restUsed);
  if (!days.size && !rest.size) return { days: 0, beans: 0, todayDone: false, saved: 0, restLeft, restPerWeek, reached: {} };
  const first = [...days, ...rest].sort()[0];
  let run = 0, beans = 0, saved = 0, week = null, used = 0;
  const reached = {}; // the first day a run hit 7 and 30 days, for milestones
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const ws = weekStart(d); if (ws !== week) { week = ws; used = 0; }
    const counts = days.has(d) || (rest.has(d) && (d < REST_CAP_FROM || used++ < restPerWeek));
    if (counts) { run++; if (run % 7 === 0 && beans < 3) beans++; for (const n of [7, 30]) if (run === n) reached[n] ||= d; }
    else if (d === today) break; // today isn't over yet
    else if (run > 0 && beans > 0) { beans--; saved++; }
    else run = 0;
  }
  const todayDone = days.has(today) || (rest.has(today) && (today < REST_CAP_FROM || restUsed <= restPerWeek));
  return { days: run, beans, todayDone, saved, restLeft, restPerWeek, reached };
}

// ---------- Recovery ("Senzu map") ----------
export const GROUPS = [['push', 'Push', 'chest, shoulders, triceps'], ['pull', 'Pull', 'back, biceps'], ['legs', 'Legs', 'quads, hamstrings, glutes'],
  ['core', 'Core', 'abs, obliques'], ['power', 'Power', 'jumps, sprints']];
export function recovery(sessions, activities, today) {
  const last = {};
  const mark = (g, day) => { if (!last[g] || day > last[g]) last[g] = day; };
  for (const s of sessions) for (const set of s.data.sets || []) mark(set.slot, s.day);
  for (const a of activities) for (const g of activityGroups(a.data.kind)) mark(g, a.day);
  return GROUPS.map(([id, name, detail]) => ({ id, name, detail, days: last[id] ? daysBetween(last[id], today) : null }));
}

// ---------- Records ("Power level records") ----------
// Best reps in one set, per exercise and drop stage; and the heaviest load used for it.
export function records(sessions) {
  const best = {};
  for (const s of sessions) for (const set of s.data.sets || []) for (const st of set.stages || []) {
    const k = set.exId + '|' + st.label;
    const b = best[k] ||= { reps: 0, load: null, day: s.day, name: set.name, stage: st.label };
    if (st.reps > b.reps) Object.assign(b, { reps: st.reps, day: s.day });
    if (st.load && (!b.load || st.load > b.load)) b.load = st.load;
  }
  return best;
}
export const recordFor = (best, exId, label) => best[exId + '|' + label]?.reps || 0;

// ---------- Auto-progression ----------
// Beating the ghost (more total reps than the session before) twice running at one gravity.
const total = s => s.data.sets.reduce((a, set) => a + set.stages.reduce((b, x) => b + x.reps, 0), 0);
export function progression(sessions, g) {
  const at = sessions.filter(s => s.data.gravity === g);
  if (at.length < 3) return null;
  const [a, b, c] = at.slice(-3).map(total);
  return b > a && c > b ? { latest: at[at.length - 1], reps: [a, b, c] } : null;
}

// ---------- Weekly recap ----------
export function lastWeek(today) { const ws = weekStart(today); return [addDays(ws, -7), addDays(ws, -1)]; }
export function recapNumbers(all, from, to) {
  const inWeek = all.filter(e => e.day >= from && e.day <= to);
  const of = t => inWeek.filter(e => e.type === t);
  return {
    sessions: of('session'), activities: of('activity'), checkins: of('checkin'), gut: of('gut'), rest: of('rest'),
    days: new Set(inWeek.map(e => e.day)).size,
  };
}
