// Nutrition (1.9): a food log in the style of the big calorie-counting apps, working fully
// offline. Each day is one 'food' entry: { items: [...], water }. Each item keeps its own
// copy of the food's numbers, so history never changes if the food list is updated.
// Symptom check-ins (the old Gut log) live in the same day's 'gut' entry.
import * as db from './db.js';
import { profile, saveProfile, entries, saveEntry, today, on } from './state.js';
import { esc, toast, overlay, stepper, round, guard, ask, dayPicker } from './ui.js';
import { addDays, prettyDay } from './time.js';
import { volume, volumeUnit, volumeSteps, length, lengthUnit, lengthStep } from './units.js';
import { fuelRanges } from './fuel.js';
import { whyBtn } from './why.js';
import { gutPatterns, HIGH_BLOAT } from './insights.js';
import { loadFoods, myFoods, search, suggestFoods, tidyName, portionsOf, defaultPortion, scale, sumN, byBarcode, NUTRIENTS, SOURCE_NOTE, fmt, kcalOf } from './foods.js';
import { scanBarcode } from './scan.js';

export const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks']];
// A small barcode picture, so the scan button is recognizable at a glance.
const BARCODE = '<svg viewBox="0 0 34 22" aria-hidden="true">' + [[0, 2], [3, 1], [5, 3], [9, 1], [11, 2], [14, 1], [16, 3], [20, 1], [22, 2], [25, 1], [27, 1], [29, 3], [33, 1]]
  .map(([x, w]) => `<rect x="${x}" y="1" width="${w}" height="20" fill="currentColor"/>`).join('') + '</svg>';
const ARROW_UP = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 13l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_DOWN = ARROW_UP.replace('M4 13l6-6 6 6', 'M4 7l6 6 6-6');
const mealName = k => MEALS.find(m => m[0] === k)?.[1] || 'Snacks';
const SYMPTOMS = [['heartburn', 'Heartburn'], ['cramps', 'Cramps'], ['gas', 'Gas'], ['nausea', 'Nausea'], ['lowEnergy', 'Low energy']];

let navDay = null, hist = null;
export const forgetHistory = () => { hist = null; };
export const openNutritionDay = day => { navDay = day; window.goku.go('nutrition'); };

const foodId = (p, day) => p.id + ':food:' + day;
// An empty day is removed rather than saved, so it never counts as a logged day.
const saveDay = (p, day, food, keep = false) => {
  if (!keep) hist = null; // water taps keep the cached history; foods change the pattern finder
  return food.items.length || food.water ? saveEntry('food', food, { id: foodId(p, day), day }) : db.del('entries', foodId(p, day));
};
const gutId = (p, day) => p.id + ':gut:' + day;
async function readDay(p, day) {
  const food = (await db.get('entries', foodId(p, day)))?.data || { items: [], water: null };
  const gut = (await db.get('entries', gutId(p, day)))?.data || null;
  return { food, gut };
}
// Older Gut logs had quick protein taps and fluids; they still count toward the day.
const legacyItems = gut => (gut?.protein || []).map((g, i) => ({ meal: 'snacks', name: 'Protein (quick add)', quick: true, n: { p: g }, legacy: i }));
const waterOf = (food, gut) => food.water ?? gut?.fluidsOz ?? 0;

// Protein in a day, for the weekly recap and anywhere else that needs it.
export const dayProtein = (food, gut) => Math.round([...(food?.items || []), ...legacyItems(gut)].reduce((a, it) => a + (it.n?.p || 0), 0));

// One pass over the log for a picker's Recent list: newest first, one per food.
async function recentItems(p) {
  const days = (await entries('food', p)).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30);
  const seen = new Set(), out = [];
  for (const d of days) for (const it of [...d.data.items].reverse()) {
    const k = (it.name + '|' + it.brand).toLowerCase();
    if (!it.quick && !seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out.slice(0, 40);
}

let movingPantry = false;
// Pantry foods from the old Gut log become "My foods" the first time Nutrition opens.
async function movePantry(p) {
  if (!p.settings.pantry?.length || movingPantry) return;
  movingPantry = true;
  const list = p.settings.pantry;
  p.settings.pantry = []; // cleared in the profile itself, so a restored backup can't copy them twice
  await saveProfile(p);
  for (const x of list) await saveEntry('myfood', { name: x.n, brand: '', upc: '', unit: 'g', serving: '1 serving', servingG: 100,
    per: { kcal: null, p: x.g, c: null, f: null, fib: null, sug: null, na: null, sat: null } }, { day: '1970-01-01' });
  movingPantry = false;
}

// ---------- The tab ----------
export async function nutritionView() {
  const p = profile();
  const t = today();
  if (!navDay || navDay > t) navDay = t;
  const day = navDay;
  await movePantry(p);
  const { food, gut } = await readDay(p, day);
  const items = [...food.items, ...legacyItems(gut)];
  const tot = sumN(items);
  const target = p.settings.kcalTarget || null;
  const own = p.settings.proteinPer === 'meal' ? null : p.settings.proteinTarget;
  const range = fuelRanges(p, 0);
  const pGoal = own || range?.protein[0] || null;
  const macroK = (tot.p || 0) * 4 + (tot.c || 0) * 4 + (tot.f || 0) * 9;
  const pct = v => macroK ? Math.round(v / macroK * 100) : 0;
  const symptomsOn = on(p, 'gut');
  // Read the whole history once and reuse it until a symptom or food changes (water taps don't).
  if (symptomsOn && (!hist || hist.id !== p.id)) hist = { id: p.id, gut: await entries('gut', p), food: await entries('food', p), pattern: null };
  const allGut = symptomsOn ? hist.gut : [], allFood = symptomsOn ? hist.food : [];
  if (symptomsOn && !hist.pattern) hist.pattern = patternCard(gutPatterns(mergeForPatterns(allGut, allFood)));
  const water = waterOf(food, gut);

  const save = () => saveDay(p, day, food);
  const g = gut || { bloat: null, foods: [], supplements: [], fluidsOz: 0, protein: [], amWaist: null, pmWaist: null };
  const saveGut = () => { hist = null; return saveEntry('gut', g, { id: gutId(p, day), day }); };

  const mealCard = ([k, label]) => {
    const list = items.map((it, idx) => [it, idx]).filter(([it]) => (it.meal || 'snacks') === k);
    if (!list.length) return ''; // empty meals fold away; the line under them names what's left
    const kc = Math.round(list.reduce((a, [it]) => a + (it.n?.kcal || 0), 0));
    return `<section class="card meal"><div class="row"><h2 style="margin:0">${label}</h2><span class="num sub">${kc} cal</span></div>
      ${list.length ? `<ul class="list">${list.map(([it, idx]) => `<li><button class="itemrow" data-item="${idx}" aria-label="Edit ${esc(it.name)}">
        <span><b>${esc(tidyName(it.name, it.src))}</b>${it.brand ? ` <span class="sub">${esc(it.brand)}</span>` : ''}<br><span class="chain">${esc(amountText(it))}</span></span>
        <span class="num">${kcalOf(it.n) ?? '—'}</span></button></li>`).join('')}</ul>` : ''}
      ${list.filter(([it]) => it.legacy === undefined).length >= 2 ? `<div class="row" style="margin-top:6px;justify-content:center"><button class="link" data-savemeal="${k}">Save as a meal</button></div>` : ''}
      </section>`;
  };

  return {
    html: `<div class="row"><h1 style="margin:0">Nutrition</h1>${dayPicker(day, t, 'Nutrition day')}</div>
    <div class="cols"><div>
      <section class="card sum" style="margin-top:12px">
        <p class="lbl">Calories</p>
        <p class="big num" style="text-align:center;font-size:2.6rem;line-height:1.1">${Math.round(tot.kcal || 0)}${target ? `<span class="sub"> of ${target}</span>` : ''}</p>
        ${target ? kiBar('Calories', tot.kcal || 0, target, '', tot.kcal > target ? `${Math.round(tot.kcal - target)} over` : `${Math.round(target - (tot.kcal || 0))} left`, false) : ''}
        ${pGoal ? kiBar('Protein power', tot.p || 0, pGoal, ' g', tot.p >= pGoal ? 'Power level reached!' : `${Math.round(pGoal - (tot.p || 0))} g to go`, true) : ''}
        <div class="macros">
          <div class="mp"><b class="num">${pGoal ? `${Math.round(tot.p || 0)}<small>/${pGoal}</small>` : fmt(tot.p)}</b><span>Protein</span></div>
          <div class="mc"><b class="num">${fmt(tot.c)}</b><span>Carbs</span></div>
          <div class="mf"><b class="num">${fmt(tot.f)}</b><span>Fat</span></div>
          <div class="mfb"><b class="num">${fmt(tot.fib)}</b><span>Fiber</span></div></div>
        ${macroK ? `<div class="split" role="img" aria-label="Calories from protein ${pct(tot.p * 4)}%, carbohydrate ${pct(tot.c * 4)}%, fat ${pct(tot.f * 9)}%">
          <i class="sp" style="width:${pct(tot.p * 4)}%"></i><i class="sc" style="width:${pct(tot.c * 4)}%"></i><i class="sf" style="width:${pct(tot.f * 9)}%"></i></div>
          <p class="sub" style="text-align:center">Protein ${pct(tot.p * 4)}% · Carbs ${pct(tot.c * 4)}% · Fat ${pct(tot.f * 9)}% of calories</p>` : ''}
        ${range ? `<p class="sub" style="text-align:center;margin-top:6px">Your protein range: ${range.protein[0]}–${range.protein[1]} g a day ${whyBtn('protein', '0')}</p>` : ''}
        <div class="row" style="justify-content:center;margin-top:8px;gap:8px"><button class="link" id="kcalTarget">${target ? 'Change calorie target' : 'Set a calorie target'}</button>
          <button class="link" id="dayDetail">All nutrients</button></div>
      </section>
      <button class="cta addtop" id="addFood">+ Add food</button>
      ${MEALS.map(mealCard).join('')}
      ${(() => { const empty = MEALS.filter(([k]) => !items.some(it => (it.meal || 'snacks') === k)).map(m => m[1]);
        return empty.length === 4 ? '<p class="sub" style="text-align:center;margin:-6px 0 18px">Nothing logged yet. Tap Add food to start the day.</p>'
          : empty.length ? `<p class="sub" style="text-align:center;margin:-6px 0 18px">Not logged yet: ${empty.join(' · ')}</p>` : ''; })()}
    </div><div>
      <section class="card"><div class="row"><p class="lbl" style="margin:0">Water</p><span class="num big">${esc(volume(water, p))} <span class="sub">${volumeUnit(p)}</span></span></div>
        ${glasses(water, p)}
        <div class="row" style="justify-content:center;gap:8px;margin-top:8px">${volumeSteps(p).map(([label, oz]) => `<button class="cta2" data-fl="${oz}">${label > 0 ? '+' : '−'}${Math.abs(label)}</button>`).join('')}</div></section>
      ${symptomsOn ? `<details class="card fold feel" ${gut ? 'open' : ''}><summary class="lbl">How you feel today</summary>
        <p class="sub">Optional. It helps the pattern finder spot foods that line up with bad days.</p>
        <p class="lbl" style="margin-top:10px">Bloating (0 = none, 10 = worst)</p>${stepper('bloat', g.bloat ?? 'none', 'bloating')}
        <div class="pills" style="margin-top:10px">${SYMPTOMS.map(([k, n]) => `<button data-sym="${k}" aria-pressed="${!!g[k]}">${n}</button>`).join('')}</div>
        ${g.amWaist != null || g.pmWaist != null || p.settings.trackWaist ? `<p class="lbl" style="margin-top:12px">Waist (${lengthUnit(p) === 'cm' ? 'cm' : 'inches'})</p>
          <div class="waist"><span>Morning</span>${stepper('amWaist', length(g.amWaist, p) ?? 'none', 'morning waist')}
          <span>Evening</span>${stepper('pmWaist', length(g.pmWaist, p) ?? 'none', 'evening waist')}</div>`
          : '<button class="link" id="trackWaist" style="margin-top:8px">Also track waist size</button>'}
        <p class="lbl" style="margin-top:12px">Supplements</p>
        <div class="pills">${[...new Set([...allGut.flatMap(e => e.data.supplements || []).slice(-8), ...(g.supplements || [])])].map(v =>
          `<button data-supp="${esc(v)}" aria-pressed="${(g.supplements || []).includes(v)}">${esc(v)}</button>`).join('')}</div>
        <div class="supp"><input id="newSupp" placeholder="Add a supplement" maxlength="40" aria-label="Add a supplement"><button class="cta2" id="addSupp">Add</button></div>
      </details>
      ${hist.pattern}` : ''}
      <p class="note">${esc(SOURCE_NOTE)}</p>
    </div></div>`,
    bind(root) {
      root.addEventListener('click', guard(async e => {
        const b = e.target.closest('button'); if (!b || b.closest('.overlay')) return;
        if (b.dataset.dayshift) { navDay = addDays(day, +b.dataset.dayshift); if (navDay < addDays(t, -60)) navDay = addDays(t, -60); return window.goku.render(); }
        if (b.id === 'addFood') return addFood(nowMeal(), day);
        if (b.dataset.item !== undefined) {
          const it = items[+b.dataset.item];
          if (it.legacy !== undefined) { if (await ask('Remove this quick protein entry?', esc(it.n.p + ' g'), [{ label: 'Remove', value: true, danger: true }])) { g.protein.splice(it.legacy, 1); await saveGut(); window.goku.render(); } return; }
          return editItem(food, food.items.indexOf(it), day);
        }
        if (b.dataset.savemeal) return saveMeal(food.items.filter(it => it.meal === b.dataset.savemeal));
        if (b.id === 'kcalTarget') return setTarget(p);
        if (b.id === 'dayDetail') return dayDetail(items, day);
        if (b.dataset.fl) { food.water = Math.max(0, round(water + +b.dataset.fl, 2)); await saveDay(p, day, food, true); return window.goku.render(); }
        if (b.id === 'trackWaist') { p.settings.trackWaist = true; await saveProfile(p); return window.goku.render(); }
        const st = b.closest('[data-step]');
        if (st && b.dataset.d) {
          const k = st.dataset.step, d = +b.dataset.d;
          if (k === 'bloat') g.bloat = Math.min(10, Math.max(0, (g.bloat ?? (d > 0 ? -1 : 1)) + d));
          else { const last = allGut.map(x => x.data.amWaist ?? x.data.pmWaist).filter(v => v != null).pop() ?? 34; g[k] = Math.max(15, round((g[k] ?? last) + d * lengthStep(p), 3)); }
          await saveGut(); return window.goku.render();
        }
        if (b.dataset.sym) { g[b.dataset.sym] = !g[b.dataset.sym]; await saveGut(); return window.goku.render(); }
        if (b.dataset.supp) { const v = b.dataset.supp; g.supplements = (g.supplements || []).includes(v) ? g.supplements.filter(x => x !== v) : [...(g.supplements || []), v]; await saveGut(); return window.goku.render(); }
        if (b.id === 'addSupp') { const v = root.querySelector('#newSupp').value.trim().toLowerCase().slice(0, 40); if (!v) return; g.supplements = [...new Set([...(g.supplements || []), v])]; await saveGut(); return window.goku.render(); }
      }));
    },
  };
}

// The meal guess follows the profile's time zone, like the day itself does.
// Ki charge bar: fills like a power level; the protein one bursts when it reaches the goal.
// (Calories only fill: going past a calorie target isn't a win.)
function kiBar(label, value, goal, unit, note, burst) {
  const pct = Math.min(100, value / goal * 100), full = burst && value >= goal;
  return `<div class="ki${full ? ' full' : ''}"><div class="row"><span class="kil">${label}</span><b class="num">${Math.round(value)}${unit} / ${goal}${unit}</b></div>
    <div class="kibar" role="img" aria-label="${label}: ${Math.round(pct)} percent of ${goal}${unit}"><i style="width:${pct}%"></i></div>
    <p class="sub kin">${esc(note)}</p></div>`;
}
// Water as glasses: one per 8 oz (or 250 ml), eight shown. A picture of what's logged, not a target.
const GLASS = '<svg viewBox="0 0 20 26" aria-hidden="true"><path d="M2 2h16l-2 21a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" class="gl"/><path class="gw" d="M3.2 11h13.6l-1.2 12a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1z"/></svg>';
function glasses(waterOz, p) {
  const per = volumeUnit(p) === 'ml' ? 250 / 29.5735 : 8, n = waterOz / per, full = Math.floor(n);
  return `<div class="glasses" role="img" aria-label="${Math.round(n * 10) / 10} glasses of water">${Array.from({ length: 8 }, (_, i) =>
    `<span class="glass${i < full ? ' on' : i < n ? ' half' : ''}">${GLASS}</span>`).join('')}${n > 8 ? `<span class="sub">+${Math.round(n - 8)}</span>` : ''}</div>
    <p class="sub" style="text-align:center">Each glass is ${volumeUnit(p) === 'ml' ? '250 ml' : '8 oz'}.</p>`;
}

export const nowMeal = () => { const tz = profile().tz; let h; try { h = +new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()); } catch { h = new Date().getHours(); } return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; };
const amountText = it => it.quick ? (it.name === 'Quick add' ? 'Numbers only' : 'Quick add') : it.qty === 1 ? it.pl : `${round(it.qty, 2)} × ${it.pl}`;

// Pattern finder: the day's foods come from the food log and any older Gut log names.
function mergeForPatterns(guts, foods) {
  const names = Object.fromEntries(foods.map(f => [f.day, f.data.items.filter(i => !i.quick).map(i => i.name.toLowerCase())]));
  return guts.map(e => ({ ...e, data: { ...e.data, foods: [...new Set([...(e.data.foods || []), ...(names[e.day] || [])])] } }));
}
const pctTxt = (n, d) => Math.round(n / d * 100) + '%';
function patternCard(g) {
  const head = '<section class="card"><p class="lbl">Pattern, not proof</p>';
  if (!g.ready) return `${head}<p class="sub">Once you've scored bloating on 14 days, including 3 days of ${HIGH_BLOAT} or more, this lists the foods and supplements that show up more often on those days.
    So far: ${g.days} scored day${g.days === 1 ? '' : 's'}, ${g.high} at ${HIGH_BLOAT}+.</p></section>`;
  return `${head}<p class="sub">High-bloating days are the ones you scored ${HIGH_BLOAT} or more: ${g.high} of your ${g.days} scored days.</p>
    ${g.rows.length ? `<ul class="list">${g.rows.map(r => `<li><span><b>${esc(r.name)}</b><br><span class="chain">${r.h} of ${g.high} high days (${pctTxt(r.h, g.high)}) · ${r.o} of ${g.other} other days (${pctTxt(r.o, g.other)})</span></span></li>`).join('')}</ul>`
      : '<p style="margin-top:8px">Nothing shows up more on high-bloating days yet.</p>'}
    <p class="note">Showing up together isn't proof that a food causes bloating. Talk with your doctor or a dietitian before cutting foods out.</p></section>`;
}

// ---------- Add food ----------
function itemFrom(f, qty, portion, meal) {
  return { meal, name: f.name, brand: f.brand || '', src: f.src, per: f.per, unit: f.unit, portions: f.portions || '', pl: portion.label, pg: portion.g, qty, n: scale(f.per, qty * portion.g) };
}
async function addItems(day, list) {
  const p = profile();
  hist = null;
  const { food } = await readDay(p, day);
  food.items.push(...list);
  await saveEntry('food', food, { id: foodId(p, day), day });
}

export function addFood(meal, day) {
  const p = profile();
  let tab = 'recent', q = '', all = null, mine = [], recent = [], meals = [], failed = false;
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Add food</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="seg meals" role="group" aria-label="Meal">${MEALS.map(([k, n]) => `<button data-meal="${k}" aria-pressed="${k === meal}">${n}</button>`).join('')}</div>
    <input id="fq" type="search" placeholder="Search foods, e.g. banana" autocomplete="off" enterkeyhint="search" aria-label="Search foods" style="margin-top:10px">
    <div class="pills sugg" id="fsugg" aria-label="Suggestions"></div>
    <div class="seg" id="tabs" role="group" aria-label="Show" style="margin-top:8px"></div>
    <p class="sub" id="fstat" role="status"></p>
    <div class="scroll" id="fres"></div>
    <div class="row" style="gap:8px;margin-top:8px;margin-right:3px"><button class="cta2" id="quick" style="flex:1">Quick add</button><button class="cta2" id="label" style="flex:1">Add from a label</button></div>
    <button class="cta2 scanbtn" id="scan">${BARCODE}<span>Scan a barcode</span></button>`, { label: 'Add food' });
  const $ = s => el.querySelector(s);
  const row = (f, key, sub) => `<li><button class="itemrow" data-pick="${esc(key)}"><span><b>${esc(f.name)}</b>${f.brand ? ` <span class="sub">${esc(f.brand)}</span>` : ''}<br>
    <span class="chain">${esc(sub)}</span></span><span class="num">${f.kc ?? ''}</span></button></li>`;
  const firstPortion = f => { const ps = portionsOf(f); return ps[defaultPortion(ps)]; };
  const sub = f => { const po = firstPortion(f); const k = kcalOf(scale(f.per, po.g)); f.kc = k == null ? '' : k; return po.label; };
  let shown = [];
  const draw = () => {
    $('#tabs').innerHTML = q ? '' : [['recent', 'Recent'], ['mine', 'My foods'], ['meals', 'Meals']].map(([k, n]) => `<button data-ftab="${k}" aria-pressed="${tab === k}">${n}</button>`).join('');
    if (q) {
      if (!all) { $('#fstat').textContent = failed ? "The food list couldn't load. Check your connection once, then it works offline." : 'Loading the food list…'; if (failed) { failed = false; loadFoods().then(list => { all = list; draw(); }).catch(() => { failed = true; draw(); }); } return; }
      shown = search([...mine, ...all], q, 60);
      $('#fsugg').innerHTML = suggestFoods(q).map(s => `<button data-fsugg="${esc(s)}">${esc(s)}</button>`).join('');
      $('#fstat').textContent = (shown.fixed ? `Showing results for “${shown.fixed}” · ` : '') + (shown.length ? `${shown.length >= 60 ? 'Top 60' : shown.length} matches` : '');
      $('#fres').innerHTML = shown.length ? `<ul class="list">${shown.map((f, i) => row(f, 's:' + i, (f.src === 'brand' ? '' : f.src === 'mine' ? 'My food · ' : '') + sub(f))).join('')}</ul>`
        : '<div class="empty"><p>No match. Try fewer words, or add it from its label.</p></div>';
      return;
    }
    $('#fstat').textContent = ''; $('#fsugg').innerHTML = '';
    if (tab === 'recent') $('#fres').innerHTML = recent.length ? `<ul class="list">${recent.map((it, i) => { const f = { ...it, kc: kcalOf(it.n) }; return row(f, 'r:' + i, amountText(it)); }).join('')}</ul>`
      : '<div class="empty"><p>Foods you log show up here for one-tap adding.</p></div>';
    if (tab === 'mine') $('#fres').innerHTML = mine.length ? `<ul class="list">${mine.map((f, i) => row(f, 'm:' + i, sub(f))).join('')}</ul>`
      : '<div class="empty"><p>Foods you add from a label show up here.</p></div>';
    if (tab === 'meals') $('#fres').innerHTML = meals.length ? `<ul class="list">${meals.map((m, i) => `<li><button class="itemrow" data-pick="ml:${i}"><span><b>${esc(m.data.name)}</b><br>
      <span class="chain">${m.data.items.length} foods</span></span><span class="num">${kcalOf(sumN(m.data.items))}</span></button></li>`).join('')}</ul>`
      : '<div class="empty"><p>Save a breakfast you often eat as a meal, then add it here in one tap.</p></div>';
  };
  const pick = async key => {
    const [kind, n] = key.split(':'), i = +n;
    if (kind === 'ml') {
      const m = meals[i];
      await addItems(day, m.data.items.map(it => ({ ...it, meal })));
      toast(`${m.data.name} added`); close(); return window.goku.render();
    }
    const f = kind === 's' ? shown[i] : kind === 'm' ? mine[i] : kind === 'r' ? { ...recent[i] } : null;
    if (!f) return;
    serving(f, { meal, qty: kind === 'r' ? recent[i].qty : 1, portionLabel: kind === 'r' ? recent[i].pl : null, onDone: async item => {
      await addItems(day, [item]); toast(`${item.name} added`); close(); window.goku.render();
    } });
  };
  el.addEventListener('input', e => { if (e.target.id === 'fq') { q = e.target.value.trim(); clearTimeout(el._t); el._t = setTimeout(draw, 120); } });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.meal) { meal = b.dataset.meal; el.querySelectorAll('[data-meal]').forEach(x => x.setAttribute('aria-pressed', x.dataset.meal === meal)); return; }
    if (b.dataset.ftab) { tab = b.dataset.ftab; return draw(); }
    if (b.dataset.fsugg) { q = b.dataset.fsugg; const i = $('#fq'); i.value = q + ' '; i.focus(); return draw(); }
    if (b.dataset.pick) return pick(b.dataset.pick);
    if (b.id === 'quick') return quickAdd(meal, async item => { await addItems(day, [item]); close(); window.goku.render(); });
    if (b.id === 'label') return labelFood({}, async f => { mine = await myFoods(); serving(f, { meal, onDone: async item => { await addItems(day, [item]); close(); window.goku.render(); } }); });
    if (b.id === 'scan') {
      const codes = await scanBarcode(); if (!codes) return;
      const code = codes.split(',')[0]; // a typed short code arrives with its long form after a comma
      const list = [...mine, ...(all || await loadFoods().catch(() => []))];
      const f = byBarcode(list, codes);
      if (f) return serving(f, { meal, onDone: async item => { await addItems(day, [item]); close(); window.goku.render(); } });
      if (await ask('Not in the food list yet', `Barcode ${esc(code)} isn't in Goku's food list. Add it from the label once, and the next scan finds it.`, [{ label: 'Add from the label', value: true }]))
        labelFood({ upc: code }, async nf => { mine = await myFoods(); serving(nf, { meal, onDone: async item => { await addItems(day, [item]); close(); window.goku.render(); } }); });
    }
  }));
  Promise.all([myFoods(), recentItems(p), entries('meal')]).then(([m, r, ml]) => { mine = m; recent = r; meals = ml; draw(); });
  loadFoods().then(list => { all = list; if (q) draw(); }).catch(() => { failed = true; draw(); });
  draw();
  setTimeout(() => $('#fq')?.focus(), 50);
}

// Amount and serving for one food, with its nutrition for that amount.
function serving(f, { meal, qty = 1, portionLabel = null, onDone, onRemove = null }) {
  const ps = portionsOf(f);
  let pi = portionLabel ? Math.max(0, ps.findIndex(x => x.label === portionLabel)) : defaultPortion(ps);
  if (portionLabel && ps.findIndex(x => x.label === portionLabel) < 0) ps.unshift({ label: portionLabel, g: f.pg || 100 }), pi = 0;
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">${esc(f.name)}</h1><button class="cta2" id="x" data-close>Back</button></div>
    ${f.brand ? `<p class="sub" style="text-align:center">${esc(f.brand)}</p>` : ''}
    <div class="scroll">
      <div class="row" style="gap:8px;margin-top:8px">
        <div style="width:170px"><label class="f" for="qty" style="margin:0"><span>Amount</span></label>
          <div class="amt"><button class="cta2" data-qd="-1" aria-label="Less">${ARROW_DOWN}</button><input id="qty" inputmode="decimal" value="${round(qty, 2)}" aria-label="Amount"><button class="cta2" data-qd="1" aria-label="More">${ARROW_UP}</button></div></div>
        <label class="f" style="flex:1;margin:0"><span>Serving</span><select id="por">${ps.map((x, i) => `<option value="${i}" ${i === pi ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label></div>
      <div class="seg" style="margin-top:8px">${[0.5, 1, 1.5, 2].map(v => `<button data-q="${v}">${v === 0.5 ? '½' : v === 1.5 ? '1½' : v}</button>`).join('')}</div>
      <div id="nt"></div>
      <p class="note">${f.src === 'brand' ? 'From the maker’s label (USDA Branded Foods).' : f.src === 'mine' ? 'Your own food, from its label.' : 'USDA FoodData Central.'}</p>
    </div>
    <button class="cta" id="ok">${onRemove ? 'Save' : 'Add to ' + esc(mealName(meal))}</button>
    ${onRemove ? '<button class="cta2 danger" id="rm" style="width:100%;margin-top:8px">Remove</button>' : ''}`, { label: f.name });
  const $ = s => el.querySelector(s);
  const amount = () => Math.max(0, +String($('#qty').value).replace(',', '.') || 0);
  const draw = () => {
    const n = scale(f.per, amount() * ps[pi].g);
    $('#nt').innerHTML = `<p class="big num" style="text-align:center;margin-top:12px">${kcalOf(n) ?? '—'} <span class="sub">calories</span></p>
      <ul class="list">${NUTRIENTS.slice(1).map(([k, label, u]) => `<li><span>${label}</span><span class="num">${fmt(n[k], u)}</span></li>`).join('')}</ul>
      <p class="sub" style="text-align:center">${round(amount() * ps[pi].g, 1)} ${f.unit === 'ml' ? 'ml' : 'g'} in all</p>`;
  };
  el.addEventListener('input', e => { if (e.target.id === 'qty') draw(); });
  el.addEventListener('change', e => { if (e.target.id === 'por') { pi = +e.target.value; draw(); } });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.q) { $('#qty').value = b.dataset.q; return draw(); }
    if (b.dataset.qd) { const stepBy = ps[pi].g <= 1 ? 10 : ps[pi].g >= 100 && /^100 /.test(ps[pi].label) ? 0.25 : 0.5; $('#qty').value = round(Math.max(0, amount() + +b.dataset.qd * stepBy), 2); return draw(); }
    if (b.id === 'ok') { if (!(amount() > 0)) return toast('Enter an amount'); close(); await onDone(itemFrom(f, amount(), ps[pi], meal)); }
    if (b.id === 'rm') { close(); await onRemove(); }
  }));
  draw();
}

function editItem(food, idx, day) {
  const it = food.items[idx]; if (!it) return;
  const p = profile();
  const store = async () => { await saveDay(p, day, food); window.goku.render(); };
  if (it.quick) return quickAdd(it.meal, async nx => { food.items[idx] = nx; await store(); }, it, async () => { food.items.splice(idx, 1); await store(); });
  serving({ ...it }, { meal: it.meal, qty: it.qty, portionLabel: it.pl, onDone: async nx => { food.items[idx] = { ...nx, meal: it.meal }; await store(); },
    onRemove: async () => { food.items.splice(idx, 1); await store(); toast('Removed'); } });
}

function quickAdd(meal, onDone, existing = null, onRemove = null) {
  const v = existing?.n || {};
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Quick add</h1><button class="cta2" id="x" data-close>Close</button></div>
    <p class="sub" style="text-align:center">For when you know the numbers but not the food. Leave anything blank.</p>
    <div class="scroll">
      <label class="f"><span>Name (optional)</span><input id="qn" maxlength="40" value="${esc(existing?.name && existing.name !== 'Quick add' ? existing.name : '')}"></label>
      ${[['kcal', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbohydrate (g)'], ['f', 'Fat (g)']].map(([k, n]) => `<label class="f"><span>${n}</span><input data-k="${k}" inputmode="decimal" value="${v[k] ?? ''}"></label>`).join('')}
    </div>
    <button class="cta" id="ok">${existing ? 'Save' : 'Add to ' + esc(mealName(meal))}</button>
    ${onRemove ? '<button class="cta2 danger" id="rm" style="width:100%;margin-top:8px">Remove</button>' : ''}`, { label: 'Quick add' });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.id === 'rm') { close(); return onRemove(); }
    if (b.id !== 'ok') return;
    const n = {};
    el.querySelectorAll('[data-k]').forEach(i => { const x = +String(i.value).replace(',', '.'); n[i.dataset.k] = i.value.trim() && x >= 0 && x < 20000 ? round(x, 1) : null; });
    if (Object.values(n).every(x => x == null)) return toast('Enter at least one number');
    close();
    await onDone({ meal, name: el.querySelector('#qn').value.trim().slice(0, 40) || 'Quick add', brand: '', quick: true, n });
  }));
}

// A food typed in from its Nutrition Facts label, saved to My foods.
export function labelFood(pre = {}, onSaved = () => {}) {
  const F = [['kcal', 'Calories', ''], ['f', 'Total fat', 'g'], ['sat', 'Saturated fat', 'g'], ['na', 'Sodium', 'mg'], ['c', 'Total carbohydrate', 'g'],
    ['fib', 'Dietary fiber', 'g'], ['sug', 'Total sugars', 'g'], ['p', 'Protein', 'g']];
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Add from a label</h1><button class="cta2" id="x" data-close>Close</button></div>
    <p class="sub" style="text-align:center">Copy the Nutrition Facts panel for one serving. It saves to My foods.</p>
    <div class="scroll">
      <label class="f"><span>Food name</span><input id="ln" maxlength="60" value="${esc(pre.name || '')}" placeholder="e.g. Caramel flan"></label>
      <label class="f"><span>Brand (optional)</span><input id="lb" maxlength="40" value="${esc(pre.brand || '')}"></label>
      <div class="row" style="gap:8px"><label class="f" style="flex:1"><span>Serving size</span><input id="ls" maxlength="30" placeholder="e.g. 1 cup"></label>
        <label class="f" style="width:90px"><span>Weight</span><input id="lg" inputmode="decimal" placeholder="g"></label>
        <label class="f" style="width:70px"><span>Unit</span><select id="lu"><option>g</option><option>ml</option></select></label></div>
      ${F.map(([k, n, u]) => `<label class="f"><span>${n}${u ? ' (' + u + ')' : ''}</span><input data-k="${k}" inputmode="decimal"></label>`).join('')}
      <label class="f"><span>Barcode (optional)</span><input id="lc" inputmode="numeric" maxlength="14" value="${esc(pre.upc || '')}"></label>
    </div>
    <p class="msg" id="lm" role="status"></p>
    <button class="cta" id="ok">Save food</button>`, { label: 'Add from a label' });
  const $ = s => el.querySelector(s);
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.id !== 'ok') return;
    const name = $('#ln').value.trim().slice(0, 60), g = +String($('#lg').value).replace(',', '.');
    if (!name || !(g > 0 && g <= 5000)) { $('#lm').textContent = 'Add the food name and the serving weight from the label (the number in g or ml).'; return; }
    const per = {};
    el.querySelectorAll('[data-k]').forEach(i => { const x = +String(i.value).replace(',', '.'); per[i.dataset.k] = i.value.trim() && x >= 0 && x < 100000 ? round(x * 100 / g, 2) : null; });
    if (per.kcal == null) { $('#lm').textContent = 'Add the calories from the label.'; return; }
    const unit = $('#lu').value === 'ml' ? 'ml' : 'g';
    const serving = (($('#ls').value.trim().replace(/\|/g, '/').replace(/;/g, ',') || '1 serving') + ` (${round(g, 1)} ${unit})`).slice(0, 48);
    const e2 = await saveEntry('myfood', { name, brand: $('#lb').value.trim().slice(0, 40), upc: $('#lc').value.replace(/\D/g, '').slice(0, 14), unit, serving, servingG: round(g, 1), per }, { day: '1970-01-01' });
    close(); toast('Saved to My foods');
    onSaved({ i: 'my:' + e2.id, mine: e2, name, brand: e2.data.brand, per, unit, portions: `${serving}|${round(g, 1)}`, upc: e2.data.upc, src: 'mine' });
  }));
}

async function saveMeal(items) {
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Save as a meal</h1><button class="cta2" id="x" data-close>Close</button></div>
    <p class="sub" style="text-align:center">${items.length} foods, ${kcalOf(sumN(items))} calories. Add them all in one tap next time.</p>
    <label class="f" style="margin-top:12px"><span>Meal name</span><input id="mn" maxlength="40" placeholder="e.g. My usual breakfast"></label>
    <button class="cta" id="ok" style="margin-top:12px">Save meal</button>`, { label: 'Save as a meal' });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.id !== 'ok') return;
    const name = el.querySelector('#mn').value.trim().slice(0, 40);
    if (!name) return toast('Give the meal a name');
    await saveEntry('meal', { name, items: items.map(({ meal, ...it }) => it) }, { day: '1970-01-01' });
    close(); toast(`${name} saved. Find it under Meals when you add food.`);
  }));
}

function setTarget(p) {
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Calorie target</h1><button class="cta2" id="x" data-close>Close</button></div>
    <p class="sub" style="text-align:center">Optional. Goku doesn't pick a number for you: needs depend on age, growth, size and training. A doctor or registered dietitian can help you choose one.</p>
    <label class="f" style="margin-top:12px"><span>Calories a day</span><input id="kt" inputmode="numeric" value="${p.settings.kcalTarget ?? ''}"></label>
    <button class="cta" id="ok" style="margin-top:12px">Save</button>
    ${p.settings.kcalTarget ? '<button class="cta2" id="clr" style="width:100%;margin-top:8px">No target</button>' : ''}`, { label: 'Calorie target' });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.id === 'clr') { p.settings.kcalTarget = null; await saveProfile(p); close(); return window.goku.render(); }
    if (b.id !== 'ok') return;
    const v = Math.round(+el.querySelector('#kt').value.replace(/\D/g, ''));
    if (!(v >= 800 && v <= 6000)) return toast('Enter a number between 800 and 6000');
    p.settings.kcalTarget = v; await saveProfile(p); close(); window.goku.render();
  }));
}

function dayDetail(items, day) {
  const tot = sumN(items);
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">All nutrients</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll"><ul class="list">${NUTRIENTS.map(([k, label, u]) => `<li><span>${label}</span><b class="num">${k === 'kcal' ? Math.round(tot.kcal || 0) : fmt(tot[k], u)}</b></li>`).join('')}</ul>
    <p class="note">Totals for ${esc(prettyDay(day))}. Foods missing a number (some labels skip fiber or sugar) count as zero for it.</p></div>`, { label: 'All nutrients' });
  el.addEventListener('click', e => { if (e.target.closest('#x')) close(); });
}

// The day's protein goal: your own daily target, else the bottom of the coach range.
export function proteinGoal(p) {
  const own = p.settings.proteinPer === 'meal' ? null : p.settings.proteinTarget;
  return own || fuelRanges(p, 0)?.protein[0] || null;
}
// True when today's protein reached the goal: the avatar's aura powers up.
export async function poweredUp(p) {
  if (p.modules?.nutrition === false) return false;
  const goal = proteinGoal(p);
  return !!goal && (await dayTotals(p, today(p))).p >= goal;
}

// One glass of water from the Ki menu: 8 oz, or 250 ml in metric.
export async function quickWater(p = profile()) {
  const day = today(p), { food, gut } = await readDay(p, day);
  food.water = round(waterOf(food, gut) + (volumeUnit(p) === 'ml' ? 250 / 29.5735 : 8), 2);
  await saveDay(p, day, food, true);
  return food.water;
}

// One-tap log (2.3): adds one first serving of an everyday food to the meal for now.
export async function quickLog(name, p = profile()) {
  const f = (await loadFoods()).find(x => x.src === 'common' && x.name === name);
  if (!f) { toast("That food isn't in the list. Try Add food."); return null; }
  const po = portionsOf(f)[0]; // the everyday list puts its friendly serving first
  await addItems(today(p), [itemFrom(f, 1, po, nowMeal())]);
  toast(`Logged ${f.name.toLowerCase()}, ${po.label.replace(/,? \(?NFS\)?/g, '')}`);
  return f;
}

// Home's "Food today" card.
export async function dayTotals(p, day) {
  const { food, gut } = await readDay(p, day);
  const items = [...food.items, ...legacyItems(gut)];
  return { kcal: Math.round(sumN(items).kcal || 0), p: dayProtein(food, gut), n: items.length };
}

// History: one row per day with food or a check-in.
export async function nutritionDays(p) {
  const food = await entries('food', p), gut = await entries('gut', p);
  const days = {};
  for (const f of food) days[f.day] = { ...(days[f.day] || {}), kcal: Math.round(sumN(f.data.items).kcal || 0), n: f.data.items.length };
  for (const g of gut) days[g.day] = { ...(days[g.day] || {}), bloat: g.data.bloat };
  return Object.entries(days).sort((a, b) => b[0].localeCompare(a[0])).map(([day, v]) => ({ day, ...v }));
}
