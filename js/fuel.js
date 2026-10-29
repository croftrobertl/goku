// Fuel ranges. Every number comes from a published position statement and is shown with
// its source in a footnote. No calorie numbers are shown.
import { esc, round } from './ui.js';
import { kgOf } from './units.js';
import { isMinor, proteinIdeas } from './coach.js';

export const SOURCES = {
  issn: 'Jäger R, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.',
  acsm: 'Thomas DT, Erdman KA, Burke LM. Nutrition and Athletic Performance (Academy of Nutrition and Dietetics, Dietitians of Canada, American College of Sports Medicine). Med Sci Sports Exerc. 2016;48(3):543–568.',
};

// Carbohydrate tiers from the 2016 joint position statement (g/kg/day). The minutes that
// pick a tier are Goku's reading of "about 1 h a day", "1–3 h" and "4–5 h or more".
const CARB_TIERS = [
  [45, 'Light day (skill work or under 45 min)', 3, 5],
  [90, 'Moderate day (about an hour)', 5, 7],
  [240, 'High day (1–3+ hours)', 6, 10],
  [Infinity, 'Very high day (4+ hours)', 8, 12],
];
export const carbTier = minutes => CARB_TIERS.find(t => minutes < t[0]);

// minutes: training planned for the day. Returns null until a weight is known.
export function fuelRanges(p, minutes) {
  const kg = kgOf(p);
  if (!kg) return null;
  const meals = +(p.about?.meals || 0);
  const t = carbTier(minutes);
  return {
    protein: [Math.round(kg * 1.4), Math.round(kg * 2.0)],
    perMeal: meals ? Math.round(kg * 0.25) : null,
    meals,
    carbs: [Math.round(kg * t[2]), Math.round(kg * t[3])], tier: t[1],
  };
}

const why = (k, m) => `<button class="why" data-why="${k}" data-arg="${+m || 0}">Why?</button>`;

export function fuelCard(p, minutes, { title = 'Fuel today' } = {}) {
  const r = fuelRanges(p, minutes);
  if (!r) return `<section class="card"><p class="lbl">${esc(title)}</p>
    <p class="sub">Add your weight and Goku sizes protein and carbohydrate ranges for you.</p>
    <button class="cta2" data-setup="body" style="margin-top:8px;width:100%">Add my weight</button></section>`;
  const likes = p.about?.likes || [];
  const own = p.settings.proteinPer === 'meal' ? null : p.settings.proteinTarget;
  const allowed = proteinIdeas(p);
  const ideas = [...new Set([...likes.filter(x => allowed.includes(x)), ...allowed])].slice(0, 6);
  return `<section class="card"><p class="lbl">${esc(title)}</p>
    <div class="row" style="margin-top:4px"><span>Protein<sup>1</sup> ${why('protein', minutes)}</span><b class="num">${r.protein[0]}–${r.protein[1]} g</b></div>
    ${own ? `<p class="sub" style="text-align:right">your target ${own} g ${own < r.protein[0] ? 'is below this range' : own > r.protein[1] ? 'is above this range' : 'sits inside it ✓'}</p>` : ''}
    ${r.perMeal ? `<p class="sub" style="text-align:right">about ${r.perMeal} g at each of your ${r.meals} meals<sup>1</sup></p>` : ''}
    <div class="row" style="margin-top:8px"><span>Carbohydrate<sup>2</sup> ${why('carbs', minutes)}</span><b class="num">${r.carbs[0]}–${r.carbs[1]} g</b></div>
    <p class="sub" style="text-align:right">${esc(r.tier)}</p>
    ${ideas.length ? `<p class="sub" style="margin-top:8px">Protein ideas: ${ideas.map(esc).join(' · ')}</p>` : ''}
    <ol class="foot"><li>1.4–2.0 g per kg a day; about 0.25 g per kg per meal. ${esc(SOURCES.issn)}</li>
      <li>3–12 g per kg a day by training load. ${esc(SOURCES.acsm)}</li></ol>
    ${minutes ? `<p class="note">Counting ${minutes} minutes of training today.</p>` : ''}
    <p class="note">${isMinor(p) ? 'These ranges come from studies of adults. For athletes under 18, a pediatrician or sports dietitian should confirm them.'
      : 'General ranges, not a prescription. A sports dietitian can fine-tune them.'}</p></section>`;
}
