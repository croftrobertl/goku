// Two Stats cards from review 12 (2.19): this week against the same days last week, and the last two weeks of check-ins.
import { esc, round } from './ui.js';
import { addDays, weekStart } from './time.js';
import { weight, weightUnit } from './units.js';
import { weightTrend, trendOn } from './weight.js';
import { minutesOf } from './activity.js';

const reps = s => s.data.sets.reduce((a, set) => a + set.stages.reduce((b, st) => b + st.reps, 0), 0);
const mins = s => Math.max(1, (s.data.endedAt - s.data.startedAt) / 60000);
const avg = l => l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;

// Same days of the week: Sunday to today, against Sunday to the same weekday last week.
export function compareCard(p, all, weighs, t) {
  const a0 = weekStart(t), b0 = addDays(a0, -7), b1 = addDays(t, -7);
  const span = (from, to) => { const in_ = e => e.day >= from && e.day <= to, ss = all.filter(e => e.type === 'session' && in_(e)), acts = all.filter(e => e.type === 'activity' && in_(e));
    const foods = all.filter(e => e.type === 'food' && in_(e) && (e.data.items || []).length), guts = all.filter(e => e.type === 'gut' && in_(e) && e.data.sleepH != null);
    return { n: ss.length, min: Math.round(ss.reduce((x, s) => x + mins(s), 0) + minutesOf(acts)), reps: ss.length ? Math.round(avg(ss.map(reps))) : null,
      p: foods.length ? Math.round(avg(foods.map(e => e.data.items.reduce((x, i) => x + (i.n?.p || 0), 0)))) : null, sleep: guts.length ? avg(guts.map(e => e.data.sleepH)) : null }; };
  const now = span(a0, t), was = span(b0, b1), pts = weightTrend(weighs);
  // [label, now, was, shown now, shown was, change text, better when higher? (null: no color)]
  const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;
  const rows = [];
  const add = (label, a, b, fmt, diff, up = true) => { if (a == null && b == null || !a && !b) return;
    const d = a != null && b != null ? diff(a, b) : null;
    rows.push(`<li><span>${label}</span><span class="cmp"><span class="sub">was ${b == null ? '—' : fmt(b)}</span><b class="num">${a == null ? '—' : fmt(a)}</b>
      <span class="chg ${d == null || d.v === 0 || up === null ? '' : (d.v > 0) === up ? 'up' : 'down'}">${d == null ? '' : d.v === 0 ? 'same' : `${d.v > 0 ? '↑' : '↓'} ${d.t}`}</span></span></li>`); };
  add('Workouts', now.n, was.n, String, (a, b) => ({ v: a - b, t: String(Math.abs(a - b)) }));
  add('Training minutes', now.min, was.min, String, (a, b) => { const x = pct(a, b); return { v: a - b, t: x == null ? `${Math.abs(a - b)} min` : `${Math.abs(x)}%` }; });
  add('Reps per workout', now.reps, was.reps, String, (a, b) => { const x = pct(a, b); return { v: a - b, t: `${Math.abs(x)}%` }; });
  add('Protein a day', now.p, was.p, v => `${v} g`, (a, b) => { const x = pct(a, b); return { v: a - b, t: `${Math.abs(x)}%` }; });
  add('Sleep a night', now.sleep, was.sleep, v => `${round(v, 1)} h`, (a, b) => ({ v: round(a - b, 1), t: `${round(Math.abs(a - b), 1)} h` }));
  if (pts.length >= 2) { const a = trendOn(pts, t), b = pts.some(x => x.day <= b1) ? trendOn(pts, b1) : null; const u = weightUnit(p);
    add('Weight trend', a, b, v => `${weight(v, p)} ${u}`, (x, y) => ({ v: round(x - y, 1), t: `${weight(Math.abs(x - y), p)} ${u}` }), null); }
  if (!rows.length) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], d = new Date(t + 'T12:00:00Z').getUTCDay();
  return `<section class="card compare"><div class="row"><p class="lbl" style="margin:0">This Week vs Last Week</p><span class="sub">${d ? `Sun–${days[d]}` : 'Sunday'}</span></div>
    <ul class="list" style="margin-top:6px">${rows.join('')}</ul>
    <p class="note">The same days of each week, so ${days[d]} is compared with last ${days[d]}'s week so far.</p></section>`;
}

// One dot per day for each check-in answer, last 14 days. Shape carries the meaning too, not only color:
// a good day is a full dot, an in-between day a small dot, a hard day a ring.
const Q = [['Energy', 'energy', false], ['Sleep', 'sleepH', null], ['Soreness', 'soreness', true], ['Stress', 'stress', true], ['Mood', 'mood', false]];
const score = (k, v, worseHigh) => { if (v == null) return null; if (k === 'sleepH') return v >= 8 ? 5 : v >= 7 ? 4 : v >= 6.5 ? 3 : v >= 6 ? 2 : 1; return worseHigh ? 6 - v : v; };
export function feelGrid(guts, t) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)), by = Object.fromEntries(guts.map(e => [e.day, e.data]));
  const rows = Q.filter(([, k]) => days.some(d => by[d]?.[k] != null));
  if (!rows.length || days.filter(d => by[d] && rows.some(([, k]) => by[d][k] != null)).length < 3) return '';
  const dot = (k, d, worseHigh) => { const s = score(k, by[d]?.[k], worseHigh); return `<i class="fd ${s == null ? 'none' : s >= 4 ? 'good' : s === 3 ? 'mid' : 'hard'} s${s ?? 0}"></i>`; };
  const name = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return `<section class="card feelgrid"><p class="lbl">Check-Ins · Last 2 Weeks</p>
    <div class="fg" role="img" aria-label="Check-in answers for the last 14 days. Tap a day below to open it.">
    ${rows.map(([n, k, w]) => `<span class="fgl">${n}</span>${days.map(d => dot(k, d, w)).join('')}`).join('')}</div>
    <div class="fg fgdays"><span></span>${days.map(d => `<button data-nday="${d}" aria-label="Open ${esc(name(d))}">${'SMTWTFS'[new Date(d + 'T12:00:00Z').getUTCDay()]}</button>`).join('')}</div>
    <p class="note">Full dot: a good day for that answer. Small dot: in between. Ring: a hard day. Tap a day to open it in Nutrition.</p></section>`;
}
