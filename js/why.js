// "Why this number?": every range or suggestion can explain its own math in plain words.
// Buttons carry data-why="key" (and data-arg when needed); app.js opens the explanation.
import { esc, round } from './ui.js';
import { kgOf, weight, weightUnit } from './units.js';
import { SOURCES, carbTier, fuelRanges } from './fuel.js';
import { isMinor } from './coach.js';
import { readiness, sleepTargetFor } from './perf-score.js';

export const whyBtn = (key, arg = '') => `<button class="why" data-why="${key}" data-arg="${esc(arg)}">Why?</button>`;

const kgLine = p => { const kg = kgOf(p); return `Your weight: ${weight(p.about.weightLb, p)} ${weightUnit(p)}${weightUnit(p) === 'kg' ? '' : ` (${round(kg, 1)} kg)`}.`; };

export const WHY = {
  protein: (p, minutes) => {
    const kg = kgOf(p), r = fuelRanges(p, +minutes || 0);
    return ['Your protein range', `<p>${p.kind === 'perf' ? 'Sized from your saved weight.' : esc(kgLine(p))}</p>
      <p style="margin-top:8px">${round(kg, 1)} kg × 1.4 g = <b>${r.protein[0]} g</b>, up to ${round(kg, 1)} kg × 2.0 g = <b>${r.protein[1]} g</b> a day.</p>
      ${r.perMeal ? `<p style="margin-top:8px">Per meal: ${round(kg, 1)} kg × 0.25 g ≈ <b>${r.perMeal} g</b>, across your ${r.meals} meals.</p>` : ''}
      ${p.settings.proteinTarget && p.settings.proteinPer !== 'meal' ? `<p style="margin-top:8px">Your own target of ${esc(p.settings.proteinTarget)} g ${p.settings.proteinTarget < r.protein[0] ? 'is below' : p.settings.proteinTarget > r.protein[1] ? 'is above' : 'sits inside'} this range.</p>` : ''}
      <p class="note">${esc(SOURCES.issn)}</p>${isMinor(p) ? '<p class="note">These ranges come from studies of adults; under 18, a pediatrician or sports dietitian should confirm them.</p>' : ''}`];
  },
  carbs: (p, minutes) => {
    const kg = kgOf(p), t = carbTier(+minutes || 0), r = fuelRanges(p, +minutes || 0);
    return ['Your carbohydrate range', `<p>Training counted today: <b>${esc(+minutes || 0)} minutes</b> (${esc(t[1].toLowerCase())}).</p>
      <p style="margin-top:8px">That tier is ${t[2]}–${t[3]} g per kg: ${round(kg, 1)} kg × ${t[2]} = <b>${r.carbs[0]} g</b> to × ${t[3]} = <b>${r.carbs[1]} g</b>.</p>
      <p style="margin-top:8px">Tiers: under 45 min, light 3–5; under 90 min, moderate 5–7; under 4 h, high 6–10; 4 h or more, very high 8–12. The minute cut-offs are Goku's reading of the statement's wording.</p>
      <p class="note">${esc(SOURCES.acsm)}</p>`];
  },
  readiness: (p, json) => {
    const c = JSON.parse(json || '{}'), target = sleepTargetFor(p);
    const parts = [['Sleep hours', Math.min(c.sleepH / target, 1) * 30, 30, `${c.sleepH} h of a ${target} h target`], ['Sleep quality', (c.sleepQ - 1) / 4 * 10, 10],
      ['Low tiredness', (5 - c.fatigue) / 4 * 15, 15], ['Low stress', (5 - c.stress) / 4 * 10, 10], ['Mood', (c.mood - 1) / 4 * 10, 10],
      ['Fun', (c.fun - 1) / 4 * 10, 10], ['No soreness', Math.max(0, 15 - (c.sore?.length || 0) * 5), 15, `${c.sore?.length || 0} sore area(s), 5 off each`]];
    // Whole points that add up to the score shown: round down, then hand the rest to the largest remainders.
    const score = readiness({ sore: [], ...c }, target), shown = parts.map(x => Math.floor(x[1]));
    let left = score - shown.reduce((a, b) => a + b, 0);
    for (const i of parts.map((x, i) => i).sort((a, b) => (parts[b][1] % 1) - (parts[a][1] % 1))) if (left-- > 0) shown[i]++;
    return ['How readiness is scored', `<ul class="list">${parts.map(([n, , max, note], i) => `<li><span>${n}${note ? `<br><span class="chain">${esc(note)}</span>` : ''}</span><span class="num">${shown[i]} / ${max}</span></li>`).join('')}
      <li><b>Readiness</b><b class="num">${score} / 100</b></li></ul>
      <p class="note">Sleep target: ${target === 9 ? 'middle of the 8–10 h the American Academy of Sleep Medicine recommends for ages 13–18' : '7 or more hours, AASM and Sleep Research Society adult consensus'}. It's a conversation starter, not a verdict.</p>`];
  },
  streak: (p, json) => {
    const s = JSON.parse(json || '{}');
    return ['How the streak works', `<p>Any day you log something counts: a session, an activity, a check-in, a gut log, or a planned rest day.</p>
      <p style="margin-top:8px">Rest days count up to <b>${esc(s.restPerWeek)}</b> a week, the days your plan leaves free, so the streak still needs training.</p>
      <p style="margin-top:8px">Every 7 days in a row earns a Senzu bean (you can hold 3). Miss a day and a bean is spent instead of losing the streak.</p>
      <p style="margin-top:8px">Right now: <b>${esc(s.days)}</b> days, <b>${esc(s.beans)}</b> bean${s.beans === 1 ? '' : 's'}${s.saved ? `, ${esc(s.saved)} day${s.saved === 1 ? '' : 's'} saved so far` : ''}.</p>
      <p class="note">Rest is part of training, so logging a rest day keeps the streak too.</p>`];
  },
  progress: (p, json) => {
    const r = JSON.parse(json || '[]');
    return ['Why the coach says level up', `<p>Your last three sessions at this gravity: <b>${r.map(esc).join(' → ')}</b> reps.</p>
      <p style="margin-top:8px">You beat your ghost twice in a row, which means the current level is getting easier. A small step up keeps you progressing.</p>
      <p class="note">Progressive overload: gradually raising load or volume as you adapt (ACSM position stand on resistance training progression, 2009).</p>`];
  },
  load: p => ['How the trend is counted', p.kind === 'perf'
  ? `<p>Each session's load is its minutes × your effort (0 easy, 10 all-out). A 120-minute practice at effort 6 is 720.</p>
    <p style="margin-top:8px">Bars add up each Sunday-to-Saturday week. The dashed line is the average of the 4 weeks before this one. Until the week ends, a short line on this week's bar marks where an average week would be by today, so a Monday isn't compared with whole weeks.</p>
    <p class="note">Session-RPE method: Foster C, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109–115. Goku shows the trend only. It doesn't judge it; that's a conversation for you and your coach.</p>`
  : `<p>Each bar adds up a week's training minutes: circuits from start to finish, plus other training you log.</p>
    <p style="margin-top:8px">Circuits don't ask for an effort score, so Goku counts minutes rather than minutes × effort. The dashed line is the average of the 4 weeks before this one, and the short line on this week's bar is where an average week would be by today.</p>
    <p class="note">Goku shows the trend only. It doesn't judge it.</p>`],
  power: p => ['How the power level works', `<p>It's a game score Goku made up to make a week of good habits feel like charging up. It isn't a health, fitness or body measure, and it doesn't compare you with anyone.</p>
    <ul class="list" style="margin-top:8px"><li><span>Training: days you trained in the last 7, against your weekly goal</span><b>up to 4,000</b></li>
    <li><span>Fuel: days you reached your protein goal (or logged food, if there's no goal)</span><b>up to 2,500</b></li>
    <li><span>Recovery: ${p.kind === 'perf' ? 'your average readiness from check-ins' : 'days you logged anything at all'}</span><b>up to 2,500</b></li></ul>
    <p class="note">The highest reading is 9,000. Rest days count toward showing up, so resting never lowers it.</p>`],
  weekgoal: p => ['Your weekly goal', `<p>You told the coach you can train <b>${esc(p.about?.days)}</b> days a week. Sessions from Sunday to Saturday count toward it.</p>
    <p class="note">Change it in Settings → About you.</p>`],
};
