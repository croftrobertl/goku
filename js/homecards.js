// Home cards both profile types share: the streak with Senzu saves and the weekly arc recap.
import { saveEntry, saveProfile } from './state.js';
import { esc, round, toast } from './ui.js';
import { prettyDay, weekday, minutesNow, clockOf } from './time.js';
import { streak, lastWeek, recapNumbers } from './insights.js';
import { whyBtn } from './why.js';
import { dayProtein, quickLog, quickWater, addFood, nowMeal } from './nutrition.js';
import { sumN } from './foods.js';
import { volume, volumeUnit } from './units.js';
import { fuelRanges } from './fuel.js';
import { readiness, sleepTargetFor } from './perf-score.js';
import { powerLevel } from './scouter.js';

// A Senzu bean, drawn small (2.5: no emoji in the interface).
const BEAN = '<svg class="bean" viewBox="0 0 20 14" aria-hidden="true"><path d="M3 8c0-4 4-6 8-6s6 2 6 4-2 3-4 3-3 3-6 3-4-1-4-4z"/></svg>';

// Rest days that count each week: the days you don't plan to train (at least 1; 2 with no plan).
const offDay = d => d.gym + d.vault === 0;
export function restAllowance(p) {
  if (p.kind === 'engine') return p.about?.days ? Math.max(1, 7 - +p.about.days) : 2;
  const plan = p.settings.weekPlan || [], off = plan.filter(offDay).length;
  return !plan.length || off === 7 ? 2 : Math.max(1, off);
}

// The last streak seen per profile, so the header can show the aura stage on any tab.
export const streakSeen = {};

export function streakCard(p, all, today) {
  const s = streak(all, today, restAllowance(p));
  streakSeen[p.id] = s.days;
  const plan = p.kind === 'perf' ? p.settings.weekPlan || [] : [];
  const plannedRest = plan.length && !plan.every(offDay) && offDay(plan[weekday(today)]);
  return `<section class="card streak"><div class="row"><p class="lbl" style="margin:0">Streak</p>${whyBtn('streak', JSON.stringify(s))}</div>
    <div class="row" style="margin-top:4px"><span class="big num">${s.days}<span class="sub"> day${s.days === 1 ? '' : 's'}</span></span>
    ${s.beans ? `<span aria-label="${s.beans} Senzu bean${s.beans === 1 ? '' : 's'}" title="Senzu beans">${BEAN.repeat(s.beans)}</span>` : '<span class="sub">no beans yet</span>'}</div>
    ${s.todayDone ? '<p class="sub">Today counts. ✓</p>' : s.restLeft ? `<p class="sub">${plannedRest ? 'Today is a planned rest day.' : 'Log anything today to keep it going.'}</p>
      <button class="cta2" data-restday style="margin-top:8px;width:100%">${plannedRest ? 'Count today\'s rest' : 'Log a planned rest day'}</button>`
      : `<p class="sub">This week's ${s.restPerWeek} rest day${s.restPerWeek === 1 ? ' is' : 's are'} used. Log training to keep it going.</p>`}</section>`;
}

// Streak at risk (2.3): from 6 PM in the profile's time zone, when nothing is logged yet today
// and there's a streak of 2+ days to protect. The day ends at dayEndsAt (3 AM by default).
export function riskCard(p, all, today) {
  const s = streak(all, today, restAllowance(p));
  const now = minutesNow(p.tz), late = now >= 18 * 60 || now < (p.dayEndsAt ?? 3) * 60; // after midnight still counts
  if (s.todayDone || s.days < 2 || !late) return '';
  const ends = clockOf((p.dayEndsAt ?? 3) * 60);
  return `<section class="card risk" role="status"><p class="lbl">Streak at risk</p>
    <h2>Your ${s.days}-day streak needs one log by ${ends}</h2>
    <p class="sub">${s.beans ? `A Senzu bean would save it, but logging anything keeps your ${s.beans === 1 ? 'bean' : 'beans'}.` : 'No Senzu beans left to save it.'} Anything counts: food, water, training${s.restLeft ? ' or a rest day' : ''}.</p>
    <div class="qlog"><button class="cta2" data-qadd>Log food</button><button class="cta2" data-qwater>Log water</button>${s.restLeft ? '<button class="cta2" data-restday>Rest day</button>' : ''}</div></section>`;
}

// The status strip (2.5): streak and power level on one line above Today. Each opens more.
export function statusStrip(p, all, today) {
  const s = streak(all, today, restAllowance(p)); streakSeen[p.id] = s.days;
  const pl = powerLevel(p, all, today).total;
  return `<div class="strip"><button data-hview="stats"><b class="num">${s.days}</b> day streak${s.todayDone ? '' : ' · log today'}</button>
    <button data-go="saga"><b class="num">${pl.toLocaleString('en-US')}</b> power level · Saga</button></div>`;
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
    // The same protein number the Gut log shows: your own daily target, else the bottom of the range.
    const own = p.settings.proteinPer === 'meal' ? null : p.settings.proteinTarget;
    const target = own || fuelRanges(p, 0)?.protein[0];
    // Days with food logged (or older Gut logs with protein taps), protein from both.
    const byDay = {};
    for (const g of n.gut) (byDay[g.day] ||= {}).gut = g.data;
    for (const f of n.food) (byDay[f.day] ||= {}).food = f.data;
    const days = Object.values(byDay).filter(d => d.food?.items?.length || d.gut?.protein?.length);
    if (target && days.length) {
      const hit = days.filter(d => dayProtein(d.food, d.gut) >= target).length;
      rows.push([own ? 'Protein target hit' : 'Protein range hit', `${hit} of ${days.length} logged days`]);
      if (hit < Math.ceil(days.length / 2)) focus.push(`Reach ${target} g of protein on more days. Saved meals in Nutrition make it one tap.`);
    }
    if (goal && n.sessions.length < goal) focus.push(`Fit in ${goal} sessions. Short ×10 or ×20 days still count.`);
    if (!focus.length) focus.push('Strong week. Try one gravity level higher, or beat your ghost by a few reps.');
  } else {
    const scores = n.checkins.map(c => readiness(c.data, sleepTargetFor(p)));
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const sleep = n.checkins.length ? round(n.checkins.reduce((a, c) => a + c.data.sleepH, 0) / n.checkins.length, 1) : null;
    rows.push(['Check-ins', `${new Set(n.checkins.map(c => c.day)).size} of 7`]); // days, so an edited day never counts twice
    if (avg !== null) rows.push(['Average readiness', avg]);
    if (sleep !== null) rows.push(['Average sleep', sleep + ' h']);
    const mins = n.sessions.reduce((a, s) => a + (s.data.minutes || 0), 0);
    if (mins) rows.push(['Training logged', `${round(mins / 60, 1)} h`]);
    if (sleep !== null && sleep < sleepTargetFor(p)) focus.push(`Aim for about ${sleepTargetFor(p)} hours of sleep. It was ${sleep} h on average.`);
    if (avg !== null && avg < 55) focus.push('Readiness ran low. Worth a chat with your coach about the week ahead.');
    if (n.checkins.length < 4) focus.push('Check in on more days so readiness can spot patterns.');
    if (!focus.length) focus.push('Great week. Keep the same rhythm.');
  }
  // Nutrition for the week, on days something was eaten or drunk.
  if (p.modules?.nutrition !== false) {
    const fed = n.food.filter(f => f.data.items?.length), watered = n.food.filter(f => f.data.water);
    if (fed.length) rows.push(['Average calories', `${Math.round(fed.reduce((a, f) => a + sumN(f.data.items).kcal, 0) / fed.length)} on ${fed.length} day${fed.length === 1 ? '' : 's'}`]);
    if (watered.length) rows.push(['Average water', `${volume(watered.reduce((a, f) => a + f.data.water, 0) / watered.length, p)} ${volumeUnit(p)}`]);
  }
  return `<section class="card recap"><p class="lbl">Arc recap · ${prettyDay(from)} – ${prettyDay(to)}</p>
    <ul class="list">${rows.map(([k, v]) => `<li><span>${esc(k)}</span><b class="num">${esc(v)}</b></li>`).join('')}</ul>
    <p class="say"><b>Next week's focus:</b> ${esc(focus[0])}</p>
    <button class="cta2" id="recapDone" data-week="${from}" style="margin-top:10px;width:100%">Got it</button></section>`;
}

export function bindShared(root, p, today) {
  root.querySelectorAll('[data-restday]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    await saveEntry('rest', {}, { id: p.id + ':rest:' + today, day: today }); toast('Rest day logged. Recovery is training too.'); window.goku.render();
  }));
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-qlog],[data-qwater],[data-qadd]'); if (!b || b.disabled) return;
    if (b.dataset.qadd !== undefined) return addFood(nowMeal(), today);
    b.disabled = true;
    if (b.dataset.qwater !== undefined) { await quickWater(p); toast('Glass of water logged'); } else await quickLog(b.dataset.qlog, p);
    window.goku.render();
  });
  root.querySelector('#recapDone')?.addEventListener('click', async e => {
    p.coach = { ...(p.coach || {}), recapSeen: e.target.dataset.week }; await saveProfile(p); window.goku.render();
  });
}
