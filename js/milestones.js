// Dragon Ball milestones: seven orbs, one to seven stars, each for a real achievement.
// Worked out from the log every time (nothing to drift); only "already celebrated" is saved.
import { saveProfile } from './state.js';
import { esc } from './ui.js';
import { weekStart, prettyDay } from './time.js';
import { streak } from './insights.js';
import { restAllowance } from './homecards.js';

// [stars, title, how to earn]
const LIST = {
  engine: [[1, 'First session', 'Finish your first circuit.'], [2, '7 days in a row', 'Keep the streak going for a week.'],
    [3, 'First power level record', 'Beat your best reps on any exercise.'], [4, 'Weekly goal met', 'Train as many days as your weekly goal in one week.'],
    [5, '25 sessions', 'Finish 25 circuits.'], [6, '30 days in a row', 'Keep the streak going for 30 days.'], [7, '100 days logged', 'Log something on 100 different days.']],
  perf: [[1, 'First check-in', 'Do your first daily check-in.'], [2, '7 days in a row', 'Keep the streak going for a week.'],
    [3, 'First skill moved up', 'Move any skill up a stage.'], [4, 'Check-in week', 'Check in on 5 days in one week.'],
    [5, 'First competition-ready skill', 'Get a skill to competition-ready.'], [6, '30 days in a row', 'Keep the streak going for 30 days.'],
    [7, '100 days logged', 'Log something on 100 different days.']],
};

const nth = (list, n) => list.length >= n ? list[n - 1] : null;
// The first day some Sunday-to-Saturday week reached n items (pass distinct days to count days).
const firstWeekWith = (days, n) => {
  const per = {};
  for (const d of [...days].sort()) { const w = weekStart(d); if ((per[w] = (per[w] || 0) + 1) === n) return d; }
  return null;
};

// The first session that beat a best from an earlier session (rounds within one session don't count).
function firstRecord(sessions) {
  const best = {};
  for (const s of sessions) {
    const mine = {};
    for (const set of s.data.sets || []) for (const st of set.stages || []) {
      const k = set.exId + '|' + st.label;
      mine[k] = Math.max(mine[k] ?? 0, st.reps);
    }
    if (Object.entries(mine).some(([k, r]) => k in best && r > best[k])) return s.day;
    for (const [k, r] of Object.entries(mine)) best[k] = Math.max(best[k] ?? 0, r);
  }
  return null;
}

// A skill "moved up" only when a log entry follows a lower one; the starting stage isn't a move.
const firstMove = skills => skills.flatMap(k => (k.data.log || []).filter((l, i, log) => i > 0 && l.stage > log[i - 1].stage).map(l => l.day)).sort()[0] || null;

// Returns [{ stars, title, how, day }] with day = when it was earned, or null.
export function milestones(p, all, today, skills = []) {
  const days = [...new Set(all.map(e => e.day))].sort();
  const s = streak(all, today, restAllowance(p));
  const of = t => all.filter(e => e.type === t).sort((a, b) => a.day.localeCompare(b.day) || a.ts - b.ts);
  let got;
  if (p.kind === 'engine') {
    const sessions = of('session');
    // Counted in sessions, the same way Home's "This week: N of goal" counts them; no goal, no ball yet.
    got = [sessions[0]?.day, s.reached[7], firstRecord(sessions), p.about?.days ? firstWeekWith(sessions.map(x => x.day), +p.about.days) : null,
      nth(sessions, 25)?.day, s.reached[30], nth(days, 100)];
  } else {
    const checkins = of('checkin');
    const ready = skills.flatMap(k => (k.data.log || []).filter(l => l.stage === 3).map(l => l.day)).sort()[0] || null;
    got = [checkins[0]?.day, s.reached[7], firstMove(skills), firstWeekWith(new Set(checkins.map(x => x.day)), 5), ready, s.reached[30], nth(days, 100)];
  }
  // A ball once celebrated stays gathered, even if what earned it (a skill, say) is later deleted.
  const kept = new Set(p.coach?.balls || []);
  return LIST[p.kind].map(([stars, title, how], i) => ({ stars, title, how, day: got[i] || null, earned: !!got[i] || kept.has(stars) }));
}

// Star layouts inside a 40×40 orb, one to seven stars.
const SPOTS = [[[20, 21]], [[14, 21], [26, 21]], [[20, 14], [14, 25], [26, 25]], [[14, 15], [26, 15], [14, 26], [26, 26]],
  [[20, 12], [12, 19], [28, 19], [15, 29], [25, 29]], [[13, 13], [20, 13], [27, 13], [13, 26], [20, 26], [27, 26]],
  [[20, 11], [12, 16], [28, 16], [20, 21], [12, 27], [28, 27], [20, 31]]];
const star = (x, y, r) => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 5 * i - Math.PI / 2, d = i % 2 ? r * .45 : r; return `${(x + d * Math.cos(a)).toFixed(1)},${(y + d * Math.sin(a)).toFixed(1)}`; });
  return `<polygon points="${pts.join(' ')}"/>`;
};
export function ballSVG(stars, lit, px = 40) {
  const r = stars > 4 ? 3.6 : 4.6;
  return `<svg class="ball ${lit ? 'lit' : ''}" viewBox="0 0 40 40" width="${px}" height="${px}" aria-hidden="true">
    <circle cx="20" cy="20" r="18"/><ellipse cx="14" cy="11" rx="5" ry="3" class="shine"/>
    <g class="stars">${SPOTS[stars - 1].map(([x, y]) => star(x, y, r)).join('')}</g></svg>`;
}

export function ballsCard(list) {
  const n = list.filter(m => m.earned).length;
  return `<section class="card balls"><div class="row"><p class="lbl" style="margin:0">Dragon Balls</p><span class="num sub">${n} of 7</span></div>
    <div class="ballrow" role="img" aria-label="${n} of 7 Dragon Balls gathered">${list.map(m => ballSVG(m.stars, m.earned, 36)).join('')}</div>
    <ul class="list">${list.map(m => `<li><span>${m.stars}★ ${esc(m.title)}<br><span class="chain">${m.day ? 'Gathered ' + prettyDay(m.day) : m.earned ? 'Gathered' : esc(m.how)}</span></span>
      ${m.earned ? '<b aria-label="gathered">✓</b>' : ''}</li>`).join('')}</ul>
    ${n === 7 ? '<p class="note">All seven gathered. Make a wish, then go set a new record.</p>' : ''}</section>`;
}

// Home: a one-time card for balls gathered since the last visit.
export function newBallsCard(p, list) {
  const seen = new Set(p.coach?.balls || []);
  const fresh = list.filter(m => m.earned && !seen.has(m.stars));
  if (!fresh.length) return '';
  return `<section class="card coachnote"><p class="lbl">Dragon Ball${fresh.length > 1 ? 's' : ''} gathered</p>
    <div class="ballrow">${fresh.map(m => ballSVG(m.stars, true, 44)).join('')}</div>
    <p>${fresh.map(m => `<b>${m.stars}-star ball:</b> ${esc(m.title)}.`).join(' ')}</p>
    <button class="cta2" id="ballsSeen" data-stars="${fresh.map(m => m.stars).join(',')}" style="margin-top:10px;width:100%">Nice</button></section>`;
}

export function bindBalls(root, p) {
  root.querySelector('#ballsSeen')?.addEventListener('click', async e => {
    const add = e.target.dataset.stars.split(',').map(Number);
    p.coach = { ...(p.coach || {}), balls: [...new Set([...(p.coach?.balls || []), ...add])].sort() };
    await saveProfile(p); window.goku.render();
  });
}
