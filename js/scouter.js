// Scouter (2.2): a playful "power level" from the last 7 days, shown on a scouter-style
// gauge. It is a game score Goku invented, not a health or fitness measure, and says so.
//   Training  up to 4,000: training days against your weekly goal
//   Fuel      up to 2,500: days your protein goal was met (or days with food logged)
//   Recovery  up to 2,500: average readiness (gymnastics), or days you showed up (strength)
import { addDays } from './time.js';
import { dayProtein, proteinGoal } from './nutrition.js';
import { readiness, sleepTargetFor } from './perf-score.js';
import { esc } from './ui.js';
import { whyBtn } from './why.js';

export const MAX_POWER = 9000;

export function powerLevel(p, all, today) {
  const from = addDays(today, -6), week = all.filter(e => e.day >= from && e.day <= today);
  const days = type => new Set(week.filter(e => type.includes(e.type)).map(e => e.day));
  const plan = p.settings.weekPlan;
  const goalDays = p.kind === 'engine' ? +(p.about?.days || 3) : Math.max(1, plan?.filter(d => d.gym + d.vault).length || 4);
  const trained = days(['session', 'activity']).size;
  const training = Math.round(Math.min(1, trained / goalDays) * 4000);
  const goal = proteinGoal(p);
  const byDay = {};
  for (const e of week) if (e.type === 'food' || e.type === 'gut') (byDay[e.day] ||= {})[e.type] = e.data;
  const fedDays = Object.values(byDay).filter(d => goal ? dayProtein(d.food, d.gut) >= goal : d.food?.items?.length).length;
  const fuel = Math.round(Math.min(1, fedDays / 7) * 2500);
  const checks = week.filter(e => e.type === 'checkin');
  const recovery = Math.round(p.kind === 'perf' && checks.length
    ? checks.reduce((a, c) => a + readiness(c.data, sleepTargetFor(p)), 0) / checks.length / 100 * Math.min(1, checks.length / 4) * 2500
    : Math.min(1, new Set(week.map(e => e.day)).size / 7) * 2500);
  return { total: training + fuel + recovery, training, fuel, recovery, trained, goalDays, fedDays, goal, checks: checks.length };
}

const tier = n => n >= 8000 ? 'Over 8,000' : n >= 6000 ? 'Elite' : n >= 4000 ? 'Strong' : n >= 2000 ? 'Rising' : 'Warming up';

// The gauge card. extra = HTML shown inside (readiness for gymnastics).
export function scouterCard(p, all, today, { extra = '', title = 'Scouter' } = {}) {
  const pl = powerLevel(p, all, today);
  const R = 92, C = 2 * Math.PI * R, pct = pl.total / MAX_POWER;
  const ticks = Array.from({ length: 36 }, (_, i) => { const a = i * 10 * Math.PI / 180, r1 = 104, r2 = i % 3 ? 108 : 113;
    return `<line x1="${(120 + Math.sin(a) * r1).toFixed(1)}" y1="${(120 - Math.cos(a) * r1).toFixed(1)}" x2="${(120 + Math.sin(a) * r2).toFixed(1)}" y2="${(120 - Math.cos(a) * r2).toFixed(1)}"/>`; }).join('');
  // Compact (2.3): a slim strip with the reading; tap it to open the gauge and the breakdown.
  return `<section class="card scouter compact" aria-labelledby="h-scouter">
    <div class="row"><p class="lbl" id="h-scouter" style="margin:0">${esc(title)}</p><span class="scan">Reading</span></div>
    ${extra}
    <details class="scdet"><summary><span class="sm">Power level</span> <b class="num">${pl.total.toLocaleString('en-US')}</b> <span class="sm">${tier(pl.total)}</span>
      <span class="minibar" aria-hidden="true"><i style="width:${Math.round(pct * 100)}%"></i></span></summary>
    <div class="gauge" role="img" aria-label="Power level ${pl.total.toLocaleString('en-US')} of ${MAX_POWER.toLocaleString('en-US')}, ${tier(pl.total)}">
      <svg viewBox="0 0 240 240" aria-hidden="true"><g class="tick">${ticks}</g>
        <circle cx="120" cy="120" r="${R}" class="track"/>
        <circle cx="120" cy="120" r="${R}" class="fill" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 120 120)"/></svg>
      <div class="read"><span class="sm">Power level</span><b class="num">${pl.total.toLocaleString('en-US')}</b><span class="sm">${tier(pl.total)}</span></div>
    </div>
    <ul class="list scl">
      <li><span>Training · ${pl.trained} of ${pl.goalDays} days</span><b class="num">${pl.training.toLocaleString('en-US')}</b></li>
      <li><span>Fuel · ${pl.fedDays} of 7 days${pl.goal ? ' at your protein goal' : ' with food logged'}</span><b class="num">${pl.fuel.toLocaleString('en-US')}</b></li>
      <li><span>Recovery · ${p.kind === 'perf' && pl.checks ? `readiness, ${pl.checks} check-ins` : 'days you showed up'}</span><b class="num">${pl.recovery.toLocaleString('en-US')}</b></li></ul>
    <p class="note" style="text-align:center">A game score from your last 7 days, not a health measure. ${whyBtn('power')}</p></details></section>`;
}
