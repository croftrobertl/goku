// Supplements (2.4): a searchable list, each logged with its dose and how many, and a check of
// what's been taken against the person's medicines. The interaction text is NIH's, word for word
// (data/interactions.json, built by tools/build-interactions.py). Goku never says a pair is safe.
import { profile, saveProfile, entries, today } from './state.js';
import { esc, overlay, guard, toast, ask } from './ui.js';
import { addDays } from './time.js';
import { vocabulary, expand, complete, dist, words } from './fuzzy.js';
import { isMinor } from './coach.js';

// [name, other names people search for, dose unit, form, NIH fact sheet key or null]. No doses are
// suggested: people enter the one on their label.
const LIST = [
  ['Vitamin D', 'd3 d2 cholecalciferol ergocalciferol', 'IU', 'softgel', 'VitaminD'],
  ['Vitamin C', 'ascorbic acid', 'mg', 'tablet', 'VitaminC'],
  ['Vitamin B12', 'b12 cobalamin methylcobalamin cyanocobalamin', 'mcg', 'tablet', 'VitaminB12'],
  ['Vitamin B6', 'b6 pyridoxine', 'mg', 'tablet', 'VitaminB6'],
  ['Vitamin A', 'retinol beta-carotene', 'mcg', 'softgel', 'VitaminA'],
  ['Vitamin E', 'tocopherol', 'IU', 'softgel', 'VitaminE'],
  ['Vitamin K', 'k1 k2 menaquinone phylloquinone', 'mcg', 'softgel', 'VitaminK'],
  ['Multivitamin', 'multi mvm one a day', '', 'tablet', 'MVMS'],
  ['Biotin', 'b7', 'mcg', 'tablet', 'Biotin'],
  ['Thiamin', 'b1 thiamine', 'mg', 'tablet', 'Thiamin'],
  ['Riboflavin', 'b2', 'mg', 'tablet', 'Riboflavin'],
  ['Niacin', 'b3 nicotinic acid niacinamide', 'mg', 'tablet', 'Niacin'],
  ['Pantothenic acid', 'b5', 'mg', 'tablet', 'PantothenicAcid'],
  ['Folic acid', 'folate b9 methylfolate', 'mcg', 'tablet', 'Folate'],
  ['Choline', '', 'mg', 'capsule', 'Choline'],
  ['Calcium', 'calcium carbonate calcium citrate', 'mg', 'tablet', 'Calcium'],
  ['Iron', 'ferrous sulfate ferrous gluconate', 'mg', 'tablet', 'Iron'],
  ['Magnesium', 'magnesium glycinate magnesium citrate magnesium oxide', 'mg', 'capsule', 'Magnesium'],
  ['Zinc', 'zinc gluconate zinc picolinate', 'mg', 'tablet', 'Zinc'],
  ['Potassium', 'potassium chloride', 'mg', 'tablet', 'Potassium'],
  ['Phosphorus', 'phosphate', 'mg', 'tablet', 'Phosphorus'],
  ['Iodine', 'potassium iodide kelp', 'mcg', 'tablet', 'Iodine'],
  ['Selenium', '', 'mcg', 'tablet', 'Selenium'],
  ['Chromium', 'chromium picolinate', 'mcg', 'tablet', 'Chromium'],
  ['Copper', '', 'mg', 'tablet', 'Copper'],
  ['Manganese', '', 'mg', 'tablet', 'Manganese'],
  ['Boron', '', 'mg', 'capsule', 'Boron'],
  ['Carnitine', 'l-carnitine acetyl-l-carnitine', 'mg', 'capsule', 'Carnitine'],
  ['Fish oil (omega-3)', 'omega 3 omega-3 epa dha krill oil', 'mg', 'softgel', 'Omega3FattyAcids'],
  ['Ashwagandha', 'withania', 'mg', 'capsule', 'Ashwagandha'],
  ['Valerian', 'valerian root', 'mg', 'capsule', 'Valerian'],
  ['Black cohosh', '', 'mg', 'capsule', 'BlackCohosh'],
  ['Caffeine', 'pre-workout preworkout', 'mg', 'capsule', 'Caffeine'],
  ['Ginseng', 'panax', 'mg', 'capsule', 'Ginseng'],
  ['Creatine', 'creatine monohydrate', 'g', 'scoop', null],
  ['Protein powder', 'whey casein pea protein shake', 'g', 'scoop', null],
  ['Electrolytes', 'electrolyte salt tablets hydration', '', 'packet', null],
  ['Beta-alanine', 'beta alanine', 'g', 'scoop', null],
  ['Collagen', 'collagen peptides', 'g', 'scoop', null],
  ['Melatonin', 'sleep', 'mg', 'tablet', null],
  ['Probiotic', 'probiotics', '', 'capsule', null],
  ['Turmeric', 'curcumin', 'mg', 'capsule', null],
  ['Glucosamine', 'chondroitin', 'mg', 'tablet', null],
  ['B complex', 'b-complex b vitamins', '', 'tablet', null],
  ['Elderberry', 'sambucus', 'mg', 'gummy', null],
  ['Echinacea', '', 'mg', 'capsule', null],
  ['BCAA', 'branched chain amino acids', 'g', 'scoop', null],
].map(([name, alt, unit, form, ods]) => ({ name, alt, unit, form, ods }));

export const UNITS = ['mg', 'mcg', 'g', 'IU', 'mL'];
const FORMS = [['capsule', 'capsules'], ['tablet', 'tablets'], ['softgel', 'softgels'], ['gummy', 'gummies'], ['scoop', 'scoops'], ['packet', 'packets'], ['drop', 'drops'], ['serving', 'servings']];
const plural = (form, n) => (FORMS.find(f => f[0] === form) || [form, form + 's'])[n === 1 ? 0 : 1];
const byName = n => LIST.find(s => s.name.toLowerCase() === String(n).toLowerCase())
  || LIST.find(s => words(s.alt).includes(String(n).toLowerCase()));

// "2 capsules · 500 mg each", "1 scoop · 5 g", or just "1 tablet".
export function amountText(s) {
  const n = s.qty || 1, each = s.dose ? `${s.dose} ${s.unit}` : '';
  return `${n} ${plural(s.form || 'serving', n)}${each ? ` · ${each}${n > 1 ? ' each' : ''}` : ''}`;
}

// ---------- Search ----------
let vocab = null;
const text = s => `${s.name} ${s.alt}`.toLowerCase().replace(/-/g, ' ');
const suppVocab = () => vocab ||= vocabulary(LIST.map(text));
function search(q) {
  if (!q.trim()) return { list: LIST, fixed: '' };
  const { groups, fixed } = expand(suppVocab(), q);
  const list = LIST.filter(s => groups.every(g => g.some(w => text(s).includes(w.replace(/-/g, ' ')))));
  list.sort((a, b) => +b.name.toLowerCase().startsWith(q.trim().toLowerCase()) - +a.name.toLowerCase().startsWith(q.trim().toLowerCase()));
  return { list, fixed };
}

// ---------- The day's supplements, stored on the day's gut entry ----------
// g.supps holds [{ name, dose, unit, form, qty }]; g.supplements keeps the names for the pattern finder.
export const suppsOf = g => g?.supps?.length ? g.supps : (g?.supplements || []).map(name => ({ name, qty: 1 }));
const sync = g => { g.supplements = [...new Set(g.supps.map(s => s.name.toLowerCase()))]; };

// Recent supplements with the dose last used, newest first, for one-tap adding.
export async function recentSupps(p = profile()) {
  const seen = new Map();
  for (const e of (await entries('gut', p)).sort((a, b) => b.day.localeCompare(a.day)))
    for (const s of suppsOf(e.data)) if (!seen.has(s.name.toLowerCase())) seen.set(s.name.toLowerCase(), s);
  return [...seen.values()].slice(0, 8);
}

// Home of the Nutrition card. g = the day's gut data (or null), recent = recentSupps().
export function suppCard(g, recent, meds) {
  const list = suppsOf(g);
  return `<section class="card supps"><div class="row"><p class="lbl" style="margin:0">Supplements</p><button class="cta2" id="addSupp">+ Add</button></div>
    ${list.length ? `<ul class="list">${list.map((s, i) => `<li><button class="itemrow" data-supp="${i}" aria-label="Edit ${esc(s.name)}"><span><b>${esc(s.name)}</b><br>
      <span class="chain">${esc(amountText(s))}</span></span></button></li>`).join('')}</ul>` : '<p class="sub">None logged today.</p>'}
    <div class="row" style="justify-content:center;gap:14px;margin-top:8px">${list.length >= 2 ? '<button class="link" id="saveStack">Save as a stack</button>' : ''}
      <button class="link" id="checkInt">Check interactions</button></div></section>`;
}

// Add or edit one supplement. save(list) writes the day; i = index when editing.
export function pickSupplement(g, save, recent) {
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Add a supplement</h1><button class="cta2" id="x" data-close>Close</button></div>
    <input id="sq" type="search" placeholder="Search, e.g. vitamin D" autocomplete="off" enterkeyhint="search" aria-label="Search supplements">
    <p class="sub" id="sfix" role="status"></p>
    <div class="scroll" id="sres"></div>`, { label: 'Add a supplement' });
  const $ = s => el.querySelector(s);
  const draw = () => {
    const q = $('#sq').value, { list, fixed } = search(q);
    $('#sfix').textContent = fixed ? `Showing results for “${fixed}”` : '';
    const mine = q.trim() ? [] : recent, stacks = q.trim() ? [] : profile().settings.stacks || [];
    const typed = q.trim() && !list.some(s => s.name.toLowerCase() === q.trim().toLowerCase()) ? q.trim().slice(0, 40) : '';
    $('#sres').innerHTML = `${stacks.length ? `<p class="lbl">Stacks</p><ul class="list">${stacks.map((st, i) => `<li><button class="itemrow" data-stack="${i}"><span><b>${esc(st.name)}</b><br><span class="chain">${esc(st.items.map(x => x.name).join(', '))}</span></span><span class="sub">Log all</span></button>
        <button class="cta2" data-rmstack="${i}" aria-label="Delete ${esc(st.name)}">×</button></li>`).join('')}</ul>` : ''}
      ${mine.length ? `<p class="lbl">Yours</p><ul class="list">${mine.map((s, i) => `<li><button class="itemrow" data-mine="${i}"><span><b>${esc(s.name)}</b><br><span class="chain">${esc(amountText(s))}</span></span><span class="sub">Add</span></button></li>`).join('')}</ul>` : ''}
      ${list.length ? `${mine.length ? '<p class="lbl" style="margin-top:12px">All</p>' : ''}<ul class="list">${list.map(s => `<li><button class="itemrow" data-name="${esc(s.name)}"><span><b>${esc(s.name)}</b></span></button></li>`).join('')}</ul>` : ''}
      ${typed ? `<ul class="list"><li><button class="itemrow" data-custom="${esc(typed)}"><span><b>Add “${esc(typed)}”</b><br><span class="chain">Not in Goku's list. You can still log it.</span></span></button></li></ul>` : ''}`;
  };
  draw();
  $('#sq').addEventListener('input', draw);
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.stack !== undefined) { const st = profile().settings.stacks[+b.dataset.stack]; close(); return save([...suppsOf(g), ...st.items.map(x => ({ ...x }))], `${st.name} logged`); }
    if (b.dataset.rmstack !== undefined) { const pr = profile(), st = pr.settings.stacks[+b.dataset.rmstack];
      if (await ask(`Delete the ${esc(st.name)} stack?`, 'Days you already logged keep their supplements.', [{ label: 'Delete', value: true, danger: true }])) { pr.settings.stacks.splice(+b.dataset.rmstack, 1); await saveProfile(pr); draw(); } return; }
    if (b.dataset.mine !== undefined) { close(); return save([...suppsOf(g), { ...recent[+b.dataset.mine] }], `${recent[+b.dataset.mine].name} logged`); }
    const name = b.dataset.name || b.dataset.custom; if (!name) return;
    close(); const c = byName(name);
    editSupplement({ name, dose: null, unit: c?.unit || 'mg', form: c?.form || 'serving', qty: 1 }, s => save([...suppsOf(g), s], `${s.name} logged`));
  }));
}

// The amount sheet: dose from the label, and how many.
export function editSupplement(s, done, remove = null) {
  const d = { ...s, qty: s.qty || 1 };
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">${esc(d.name)}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll">
      <p class="lbl">How many</p>
      <div class="amt"><div class="step" data-step="qty"><button type="button" data-d="-1" aria-label="Fewer">−</button>
        <span class="num" id="qn" aria-live="polite">${d.qty}</span><button type="button" data-d="1" aria-label="More">+</button></div>
        <select id="form" aria-label="Form">${FORMS.map(([k]) => `<option value="${k}" ${k === d.form ? 'selected' : ''}>${plural(k, 2)}</option>`).join('')}</select></div>
      <p class="lbl" style="margin-top:14px">Dose in each (optional, from the label)</p>
      <div class="amt"><input id="dose" type="number" inputmode="decimal" min="0" step="any" value="${d.dose ?? ''}" placeholder="e.g. 500" aria-label="Dose">
        <select id="unit" class="unit" aria-label="Unit">${UNITS.map(u => `<option ${u === d.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <p class="note">Goku doesn't suggest doses. Use the one on your label or the one your doctor gave you.</p>
    </div>
    <button class="cta" id="ok">${remove ? 'Save' : 'Log it'}</button>
    ${remove ? '<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Remove</button>' : ''}`, { label: d.name });
  const $ = q => el.querySelector(q);
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.d) { d.qty = Math.min(20, Math.max(1, d.qty + +b.dataset.d)); $('#qn').textContent = d.qty; return; }
    if (b.id === 'del') { close(); return remove(); }
    if (b.id !== 'ok') return;
    const dose = parseFloat($('#dose').value);
    close(); done({ name: d.name, dose: dose > 0 && dose < 100000 ? Math.round(dose * 100) / 100 : null, unit: $('#unit').value, form: $('#form').value, qty: d.qty });
  }));
}

// The card's taps. g is the day's gut data; write(g) saves it and redraws.
export async function bindSupps(root, g, write, recent) {
  root.querySelector('#addSupp')?.addEventListener('click', () => pickSupplement(g, (list, msg) => { g.supps = list; sync(g); toast(msg); write(g); }, recent));
  root.querySelector('#checkInt')?.addEventListener('click', () => checkInteractions());
  // Stacks (2.5): today's supplements saved under a name, then logged together with one tap.
  root.querySelector('#saveStack')?.addEventListener('click', () => {
    const p = profile(), items = suppsOf(g).map(({ name, dose, unit, form, qty }) => ({ name, dose: dose ?? null, unit: unit || 'mg', form: form || 'serving', qty: qty || 1 }));
    const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Save as a stack</h1><button class="cta2" id="x" data-close>Close</button></div>
      <p class="sub">${esc(items.map(x => x.name).join(', '))}</p>
      <label class="f"><span>Name</span><input id="sn" maxlength="30" value="${new Date().getHours() < 12 ? 'Morning stack' : 'Evening stack'}"></label>
      <button class="cta" id="ok" style="margin-top:14px">Save stack</button>`, { label: 'Save as a stack' });
    el.addEventListener('click', guard(async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'x') return close();
      if (b.id !== 'ok') return;
      const name = el.querySelector('#sn').value.trim().slice(0, 30) || 'My stack';
      p.settings.stacks = [...(p.settings.stacks || []).filter(s => s.name !== name), { name, items }].slice(-10);
      await saveProfile(p); close(); toast(`${name} saved. Find it under Add.`);
    }));
  });
  root.querySelectorAll('[data-supp]').forEach(b => b.addEventListener('click', () => {
    const list = suppsOf(g), i = +b.dataset.supp;
    editSupplement(list[i], s => { list[i] = s; g.supps = list; sync(g); write(g); },
      async () => { if (await ask(`Remove ${esc(list[i].name)}?`, '', [{ label: 'Remove', value: true, danger: true }])) { list.splice(i, 1); g.supps = list; sync(g); write(g); } });
  }));
}

// ---------- Interactions ----------
let data = null;
const loadData = () => data ||= fetch('data/interactions.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).catch(e => { data = null; throw e; });
const norm = s => String(s).toLowerCase().replace(/[®™]/g, '').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();
// A medicine matches a section when it names one of its medicines, or is a near spelling of one.
function hits(med, tags) {
  const m = norm(med); if (m.length < 3) return false;
  return tags.some(t => m === t || (t.length >= 4 && ` ${m} `.includes(` ${t} `)) || (m.length >= 5 && t.includes(m))
    || (m.length >= 6 && !m.includes(' ') && !t.includes(' ') && Math.abs(m.length - t.length) <= 1 && dist(m, t, 1) <= 1));
}
const odsUrl = (slug, src = 'Consumer') => `https://ods.od.nih.gov/factsheets/${slug}-${src}/`;
// NIH's own sentence about spacing doses apart, when a paragraph has one ("…at least 4 hours…").
const spacing = x => x.t.join(' ').split(/(?<=\.)\s+/).find(t => /\b\d+(?:\s+to\s+\d+)?\s+hours?\b|at different times|\bhours? apart\b/i.test(t)) || '';
const sheetFor = (db, name) => { const c = byName(name); return c?.ods ? db[c.ods] : null; };

// The check (2.5): your medicines, then the supplements to check (logged in the last 30 days, plus any
// you're thinking of starting), then what NIH says for each match. Unknown medicines are named.
export async function checkInteractions(p = profile()) {
  let db;
  try { db = await loadData(); } catch { toast("The interaction list couldn't load. Connect once, then it works offline."); return; }
  const t = today(p), from = addDays(t, -30);
  const logged = [...new Set((await entries('gut', p)).filter(e => e.day >= from).flatMap(e => suppsOf(e.data).map(s => s.name)))];
  const considering = [];
  const allItems = Object.values(db).flatMap(s => s.x);
  const medVocab = vocabulary(allItems.flatMap(x => x.m));
  p.settings.meds ||= [];
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Interaction check</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="ib"></div>`, { label: 'Interaction check' });
  const hitHTML = (name, other, x, sheet) => { const sp = spacing(x);
    return `<div class="hit"><p><b>${esc(name)}</b> and <b>${esc(other)}</b></p>${sp ? `<p class="space">${esc(sp)}</p>` : ''}
      <details><summary>What NIH says${x.h ? ` about ${esc(x.h.toLowerCase())}` : ''}</summary>${x.t.map(s => `<p>${esc(s)}</p>`).join('')}
      <p class="note">${x.own ? 'Heading added by Goku. ' : ''}NIH Office of Dietary Supplements, ${sheet.src === 'Consumer' ? '' : 'health professional '}fact sheet updated ${esc(sheet.d)}. <a href="${odsUrl(sheet.slug, sheet.src)}" target="_blank" rel="noopener">Read it</a></p></details></div>`; };
  const draw = () => {
    const meds = p.settings.meds, list = [...new Set([...logged, ...considering])];
    const hitsList = [], clear = [], noText = [];
    for (const name of list) {
      const sheet = sheetFor(db, name);
      if (!sheet) { noText.push(name); continue; }
      const found = sheet.x.flatMap(x => [...meds.filter(med => hits(med, x.m)).map(med => [med, x]),
        ...(x.s || []).filter(sn => list.some(n => byName(n)?.name === sn)).map(sn => [sn, x])]);
      if (found.length) hitsList.push(...found.map(([other, x]) => hitHTML(name, other, x, sheet))); else clear.push(name);
    }
    const unknownMeds = meds.filter(med => !allItems.some(x => hits(med, x.m)));
    el.querySelector('#ib').innerHTML = `
      <p class="lbl">Your medicines</p>
      <div class="pills">${meds.map((m, i) => `<button data-rmmed="${i}" aria-label="Remove ${esc(m)}">${esc(m)} ×</button>`).join('')}</div>
      <div class="supp"><input id="med" placeholder="Add a medicine, e.g. Synthroid" maxlength="60" autocomplete="off" aria-label="Add a medicine"><button class="cta2" id="addMed">Add</button></div>
      <div class="pills sugg" id="medsugg"></div>
      <p class="note">Saved on this phone and in your backups.${isMinor(p) ? ' Ask a parent to help you list them.' : ''}</p>
      <p class="lbl" style="margin-top:14px">Supplements to check</p>
      <div class="pills">${list.map(n => `<span class="pill">${esc(n)}${considering.includes(n) && !logged.includes(n) ? ' <small>thinking of starting</small>' : ''}</span>`).join('')}</div>
      <div class="supp"><input id="consider" placeholder="Thinking of starting one? e.g. iron" maxlength="40" autocomplete="off" aria-label="Check a supplement you're thinking of starting"></div>
      <div class="pills sugg" id="supsugg"></div>
      ${!list.length ? '<p class="sub">Log a supplement in Nutrition, or type one above.</p>'
        : !meds.length && !hitsList.length ? '<p class="sub">Add a medicine above to check these.</p>'
        : `${hitsList.join('')}
          ${clear.length ? `<p class="sub" style="margin-top:8px">Nothing in Goku's NIH list for ${clear.map(esc).join(', ')} with ${meds.length ? 'your medicines' : 'each other'}. That isn't proof they're safe together.</p>` : ''}`}
      ${unknownMeds.length ? `<p class="sub warnline" style="margin-top:8px">Goku doesn't recognize ${unknownMeds.map(esc).join(', ')}, so ${unknownMeds.length > 1 ? 'they weren\'t' : 'it wasn\'t'} checked. Try the generic name, or ask your pharmacist.</p>` : ''}
      ${noText.length ? `<p class="sub" style="margin-top:8px">NIH has no interaction text in Goku for ${noText.map(esc).join(', ')}.</p>` : ''}
      <p class="note" style="margin-top:14px">This only knows the medicines NIH names in its supplement fact sheets. Before starting a supplement, ask a pharmacist or your doctor, and tell them everything you take.</p>`;
  };
  draw();
  const addMed = async v => { v = v.trim().slice(0, 60); if (!v || p.settings.meds.some(m => m.toLowerCase() === v.toLowerCase())) return; p.settings.meds = [...p.settings.meds, v].slice(0, 30); await saveProfile(p); draw(); el.querySelector('#med')?.focus(); };
  const consider = v => { const c = byName(v) || search(v).list[0]; const n = c ? c.name : v.trim().slice(0, 40); if (n && !considering.includes(n)) considering.push(n); draw(); el.querySelector('#consider')?.focus(); };
  el.addEventListener('input', e => {
    if (e.target.id === 'med') el.querySelector('#medsugg').innerHTML = complete(medVocab, e.target.value.toLowerCase(), 5).map(s => `<button data-msugg="${esc(s)}">${esc(s)}</button>`).join('');
    if (e.target.id === 'consider') el.querySelector('#supsugg').innerHTML = (e.target.value.trim() ? search(e.target.value).list.slice(0, 5) : []).map(c => `<button data-ssugg="${esc(c.name)}">${esc(c.name)}</button>`).join('');
  });
  el.addEventListener('keydown', e => { if (e.key !== 'Enter') return; if (e.target.id === 'med') addMed(e.target.value); if (e.target.id === 'consider' && e.target.value.trim()) consider(e.target.value); });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.id === 'addMed') return addMed(el.querySelector('#med').value);
    if (b.dataset.msugg) return addMed(b.dataset.msugg);
    if (b.dataset.ssugg) return consider(b.dataset.ssugg);
    if (b.dataset.rmmed !== undefined) { p.settings.meds.splice(+b.dataset.rmmed, 1); await saveProfile(p); draw(); }
  }));
}
