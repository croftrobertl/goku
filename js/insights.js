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
// A day counts when anything is logged, including a planned rest day. Every 7 days in a row
// earns a Senzu bean (up to 3). A missed day spends a bean instead of ending the streak.
export function streak(all, today) {
  const days = new Set(all.map(e => e.day));
  if (!days.size) return { days: 0, beans: 0, todayDone: false, saved: 0 };
  const first = [...days].sort()[0];
  let run = 0, beans = 0, saved = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    if (days.has(d)) { run++; if (run % 7 === 0 && beans < 3) beans++; }
    else if (d === today) break; // today isn't over yet
    else if (run > 0 && beans > 0) { beans--; saved++; }
    else run = 0;
  }
  return { days: run, beans, todayDone: days.has(today), saved };
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
