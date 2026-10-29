// Home cards both profile types share: the streak with Senzu saves and the weekly arc recap.
import { saveEntry, saveProfile } from './state.js';
import { esc, round, toast } from './ui.js';
import { prettyDay } from './time.js';
import { streak, lastWeek, recapNumbers } from './insights.js';
import { whyBtn } from './why.js';
import { fuelRanges } from './fuel.js';
import { readiness, sleepTargetFor } from './perf-score.js';

export function streakCard(p, all, today) {
  const s = streak(all, today);
  const beans = '🫘'.repeat(s.beans) || '—';
  return `<section class="card streak"><div class="row"><p class="lbl" style="margin:0">Streak</p>${whyBtn('streak', JSON.stringify(s))}</div>
    <div class="row" style="margin-top:4px"><span class="big num">${s.days}<span class="sub"> day${s.days === 1 ? '' : 's'}</span></span>
    <span aria-label="${s.beans} Senzu bean${s.beans === 1 ? '' : 's'}" title="Senzu beans">${beans}</span></div>
    ${s.todayDone ? '<p class="sub">Today counts. ✓</p>' : `<p class="sub">Log anything today to keep it going.</p>
      <button class="cta2" id="restDay" style="margin-top:8px;width:100%">Log a planned rest day</button>`}</section>`;
}

// Shown in a new week until dismissed, if anything was logged last week.
export function recapCard(p, all, today) {
  const [from, to] = lastWeek(today);
  if (p.coach?.recapSeen === from) return '';
  const n = recapNumbers(all, from, to);
  if (!n.days) return '';
  const rows = [], focus = [];
  if (p.kind === 'engine') {
    const reps = n.sessions.reduce((a, s) => a + s.data.sets.reduce((b, set) => b + set.stages.reduce((c, x) => c + x.reps, 0), 0), 0);
    const goal = +(p.about?.days || 0);
    rows.push(['Sessions', `${n.sessions.length}${goal ? ` of ${goal}` : ''}`], ['Total reps', reps]);
    if (n.activities.length) rows.push(['Other training', `${n.activities.reduce((a, x) => a + x.data.minutes, 0)} min`]);
    const range = fuelRanges(p, 0);
    if (range && n.gut.length) {
      const hit = n.gut.filter(g => g.data.protein.reduce((a, b) => a + b, 0) >= range.protein[0]).length;
      rows.push(['Protein range hit', `${hit} of ${n.gut.length} logged days`]);
      if (hit < Math.ceil(n.gut.length / 2)) focus.push(`Reach ${range.protein[0]} g of protein on more days. The Capsule pantry makes it one tap.`);
    }
    if (goal && n.sessions.length < goal) focus.push(`Fit in ${goal} sessions. Short ×10 or ×20 days still count.`);
    if (!focus.length) focus.push('Strong week. Try one gravity level higher, or beat your ghost by a few reps.');
  } else {
    const scores = n.checkins.map(c => readiness(c.data, sleepTargetFor(p)));
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const sleep = n.checkins.length ? round(n.checkins.reduce((a, c) => a + c.data.sleepH, 0) / n.checkins.length, 1) : null;
    rows.push(['Check-ins', `${n.checkins.length} of 7`]);
    if (avg !== null) rows.push(['Average readiness', avg]);
    if (sleep !== null) rows.push(['Average sleep', sleep + ' h']);
    const mins = n.sessions.reduce((a, s) => a + (s.data.minutes || 0), 0);
    if (mins) rows.push(['Training logged', `${round(mins / 60, 1)} h`]);
    if (sleep !== null && sleep < sleepTargetFor(p)) focus.push(`Aim for about ${sleepTargetFor(p)} hours of sleep. It was ${sleep} h on average.`);
    if (avg !== null && avg < 55) focus.push('Readiness ran low. Worth a chat with your coach about the week ahead.');
    if (n.checkins.length < 4) focus.push('Check in on more days so readiness can spot patterns.');
    if (!focus.length) focus.push('Great week. Keep the same rhythm.');
  }
  return `<section class="card recap"><p class="lbl">Arc recap · ${prettyDay(from)} – ${prettyDay(to)}</p>
    <ul class="list">${rows.map(([k, v]) => `<li><span>${esc(k)}</span><b class="num">${esc(v)}</b></li>`).join('')}</ul>
    <p style="margin-top:10px"><b>Next week's focus:</b> ${esc(focus[0])}</p>
    <button class="cta2" id="recapDone" data-week="${from}" style="margin-top:10px;width:100%">Got it</button></section>`;
}

export function bindShared(root, p, today) {
  root.querySelector('#restDay')?.addEventListener('click', async () => {
    await saveEntry('rest', {}, { id: p.id + ':rest:' + today, day: today }); toast('Rest day logged. Recovery is training too.'); window.goku.render();
  });
  root.querySelector('#recapDone')?.addEventListener('click', async e => {
    p.coach = { ...(p.coach || {}), recapSeen: e.target.dataset.week }; await saveProfile(p); window.goku.render();
  });
}
