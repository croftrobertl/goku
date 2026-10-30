// The coach: questions that tailor Goku to each person. Essentials are asked at setup
// (about 3 minutes); follow-ups come one or two a day on Home. Every question here feeds
// something the app actually does with the answer (see "used for" on each).
import { esc, overlay, round, toast } from './ui.js';
import { weight, weightUnit, toLb, length, lengthUnit, toIn } from './units.js';
import { dayKey, deviceTZ, validTZ, daysBetween } from './time.js';

const VOICE = '<p class="voice">You can tap the mic on your keyboard to talk instead of typing.</p>';
const yearNow = () => new Date().getFullYear();
const todayOf = p => dayKey(Date.now(), p.dayEndsAt ?? 3, p.tz);
export const ageOf = p => p.about?.birthYear ? yearNow() - p.about.birthYear : null;
export const isMinor = p => { const a = ageOf(p); return a !== null && a < 18; };

export const GOALS = {
  engine: [['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['conditioning', 'Fitness and conditioning'],
    ['leaner', 'Lose fat'], ['sport', 'Play my sport better'], ['health', 'Health and longevity']],
  perf: [['skills', 'Learn new skills'], ['strength', 'Stronger for my skills'], ['flex', 'More flexible'],
    ['compete', 'Compete well'], ['healthy', 'Stay healthy and injury-free'], ['fun', 'Have fun']],
};
export const EQUIPMENT = [['db', 'Dumbbells'], ['trx', 'Suspension trainer (TRX)'], ['bar', 'Pull-up bar, rings or playset']];
export const ALLERGIES = [['dairy', 'Dairy'], ['gluten', 'Gluten'], ['peanuts', 'Peanuts'], ['nuts', 'Tree nuts'], ['eggs', 'Eggs'], ['soy', 'Soy'], ['fish', 'Fish'], ['shellfish', 'Shellfish']];
const TZS = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage',
  'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Australia/Sydney'];

// Protein foods, tagged with what rules them out.
export const PROTEIN_FOODS = [
  ['Chicken', ['meat']], ['Turkey', ['meat']], ['Lean beef', ['meat']], ['Pork', ['meat']], ['Salmon', ['fish']], ['Tuna', ['fish']],
  ['Shrimp', ['shellfish']], ['Eggs', ['eggs', 'vegan']], ['Greek yogurt', ['dairy', 'vegan']], ['Cottage cheese', ['dairy', 'vegan']],
  ['Milk', ['dairy', 'vegan']], ['Whey shake', ['dairy', 'vegan']], ['Tofu', ['soy']], ['Tempeh', ['soy']], ['Edamame', ['soy']],
  ['Lentils', []], ['Chickpeas', []], ['Black beans', []], ['Peanut butter', ['peanuts']], ['Almonds', ['nuts']], ['Seitan', ['gluten']],
  ['Pea protein shake', []],
];
export function proteinIdeas(p) {
  const a = p.about || {};
  const out = new Set(a.allergies || []);
  if (a.diet === 'vegetarian') out.add('meat').add('fish').add('shellfish');
  if (a.diet === 'pescatarian') out.add('meat');
  if (a.diet === 'vegan') out.add('meat').add('fish').add('shellfish').add('vegan');
  return PROTEIN_FOODS.filter(([, bans]) => !bans.some(b => out.has(b))).map(([n]) => n);
}

// ---------- Questions ----------
// type: choice | multi | number | text | date | units | body | yesno
export const QUESTIONS = [
  { id: 'units', essential: true, title: 'Units and time', type: 'units',
    help: 'Used for every weight, length and drink amount, and for when your training day starts.' },
  { id: 'birthYear', essential: true, title: 'What year were you born?', type: 'number', key: 'birthYear', min: 1920, max: () => yearNow() - 5,
    help: p => p.kind === 'perf' ? 'Sets your sleep target and how fueling advice is worded.' : 'Sets age-appropriate sleep and fueling guidance.' },
  { id: 'body', essential: true, title: 'Height and weight', type: 'body',
    help: p => p.kind === 'perf' ? 'Only used to size your fueling ranges. Your weight is never shown on any screen, chart or summary.'
      : 'Sizes your protein and carbohydrate ranges. Skip it if you like.' },
  { id: 'experience', essential: true, kinds: ['engine'], title: 'How long have you trained seriously?', type: 'choice', key: 'experience',
    options: [['0', 'Less than a year'], ['1', '1–3 years'], ['3', '3–5 years'], ['5', '5–10 years'], ['10', 'More than 10 years']],
    help: 'Sets where your starting gravity level begins.' },
  { id: 'goal', essential: true, title: 'What matters most right now?', type: 'choice', key: 'goal', options: p => GOALS[p.kind],
    help: 'Shapes your starting plan and what the coach checks in about.' },
  { id: 'equipment', essential: true, kinds: ['engine'], title: 'What equipment do you have?', type: 'multi', key: 'equipment', options: EQUIPMENT,
    help: 'Your exercise library is built from this. Pick none for bodyweight only.' },
  { id: 'days', essential: true, kinds: ['engine'], title: 'How many days a week can you train?', type: 'choice', key: 'days',
    options: [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], help: 'Home tracks your sessions against this each week.', big: 'days a week',
    cheer: { 2: 'Two days you keep beats five you skip.', 3: 'Three days: a classic training rhythm.', 4: 'Four days: plenty of training, room to recover.',
      5: 'Five days: a serious schedule.', 6: 'Six days. Rest days still keep your streak alive.' } },
  { id: 'diet', essential: true, title: 'How do you eat?', type: 'choice', key: 'diet',
    options: [['any', 'I eat everything'], ['pescatarian', 'Pescatarian'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan']],
    help: 'Protein ideas only suggest foods that fit.' },
  { id: 'allergies', essential: true, title: 'Any food allergies or foods you avoid?', type: 'multi', key: 'allergies', options: ALLERGIES, other: 'allergyOther',
    help: 'Those foods are left out of every suggestion.' },
  { id: 'limits', essential: true, title: 'Any injuries, pain or limits a coach should know about?', type: 'text', key: 'limits',
    help: 'Shown as a reminder on your plan. Leave blank if none.' },
  // Follow-ups
  { id: 'meals', title: 'How many times a day do you usually eat?', type: 'choice', key: 'meals',
    options: [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6+']], help: 'Splits your protein range into amounts per meal.', big: 'times a day',
    cheer: { 2: 'Two bigger meals.', 3: 'Three square meals.', 4: 'Four chances to fit in protein.', 5: 'Five: steady fuel all day.', 6: 'Six or more: a grazing pro.' } },
  { id: 'likes', title: 'Which protein foods do you actually like?', type: 'multi', key: 'likes', options: p => proteinIdeas(p).map(n => [n, n]),
    when: p => p.about?.meals, help: 'Your fuel ideas will lead with these.' },
  { id: 'sleep', kinds: ['engine'], title: 'How many hours do you usually sleep?', type: 'number', key: 'sleepH', min: 3, max: 12, step: 0.5,
    help: 'Under the recommended amount, the coach reminds you that recovery suffers.' },
  { id: 'feel', kinds: ['engine'], title: 'How did your sessions feel this week?', type: 'choice', key: '_feel', repeat: 7,
    options: [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']],
    when: (p, ctx) => ctx.sessionsThisWeek > 0, help: 'The coach suggests your next gravity level from this.' },
  { id: 'reweigh', title: 'Has your weight changed?', type: 'body', repeat: 28, onlyWeight: true,
    when: p => p.about?.weightLb && daysBetween(dayKey(p.about.weightAt || 0), dayKey()) >= 28,
    help: 'Keeps your fueling ranges accurate. Skip if nothing changed.' },
  { id: 'comp', kinds: ['perf'], title: 'When is your next competition?', type: 'date', key: 'comp',
    when: p => !p.about?.comp || p.about.comp < dayKey(), help: 'Home shows a countdown. Leave blank if none is planned.' },
  { id: 'schedule', kinds: ['perf'], title: 'Have your usual training hours changed?', type: 'yesno', key: '_schedule', repeat: 14,
    when: p => p.settings.weekPlan?.some(d => d.gym + d.vault), help: 'Keeps your week and fueling ranges right.' },
];
const forKind = (q, p) => !q.kinds || q.kinds.includes(p.kind);
const val = (v, p) => typeof v === 'function' ? v(p) : v;
export const answered = (q, p) => {
  const a = p.about || {};
  if (q.type === 'units') return !!p.tz;
  if (q.type === 'body') return a.weightLb != null || a.heightIn != null;
  if (q.key?.startsWith('_') || q.repeat) return false;
  if (q.type === 'date') return !!a[q.key] && a[q.key] >= todayOf(p); // a past date means ask about the next one
  return a[q.key] != null && a[q.key] !== '';
};
export const essentials = p => QUESTIONS.filter(q => q.essential && forKind(q, p));

// Setup screens: related essentials share a screen, so setup is 5 screens, not 10.
const GROUPS = [['Units and time', ['units']], ['About you', ['birthYear', 'body']], ['Your training', ['experience', 'goal', 'equipment', 'days']],
  ['Food', ['diet', 'allergies']], ['Anything to watch?', ['limits']]];
export const setupScreens = (p, only = null) => only ? [[null, QUESTIONS.filter(q => q.id === only)]]
  : GROUPS.map(([title, ids]) => [title, ids.map(id => QUESTIONS.find(q => q.id === id)).filter(q => forKind(q, p))]).filter(([, qs]) => qs.length);
export const screenHTML = (qs, p) => qs.map(q => questionHTML(q, p)).join('<hr class="qsep">');
// A tap inside one of a screen's questions.
export function screenClick(qs, p, b, root) {
  const q = qs.find(x => x.id === b.closest('.q')?.dataset.qid);
  if (!q) return false;
  if (questionClick(q, p, b) !== 'redraw') return false;
  qs.forEach(x => questionRead(x, p, root)); // keep what was typed elsewhere on the screen
  return true;
}
// Reads every question on a screen; shows the first problem next to its question.
export function screenRead(qs, p, root) {
  for (const q of qs) {
    const err = questionRead(q, p, root);
    if (err) { const m = root.querySelector(`.q[data-qid="${q.id}"] .msg`); if (m) m.textContent = err; return false; }
  }
  qs.forEach(q => { if (q.type === 'multi') p.about[q.key] ||= []; markAsked(q, p); }); // Next with nothing picked means "none"
  return true;
}
export const missingEssentials = p => essentials(p).filter(q => !answered(q, p));

// ---------- Rendering one question ----------
export function questionHTML(q, p) {
  const a = p.about || {};
  const help = val(q.help, p);
  let body = '';
  if (q.type === 'units') {
    const tz = p.tz || deviceTZ();
    const list = [...new Set([tz, ...TZS])];
    body = `<div class="seg" role="group" aria-label="Units"><button data-units="imperial" aria-pressed="${p.units !== 'metric'}">lb · in · oz</button>
      <button data-units="metric" aria-pressed="${p.units === 'metric'}">kg · cm · ml</button></div>
      <label class="f"><span>Time zone</span><select id="q-tz">${list.map(z => `<option ${z === tz ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></label>
      <p class="note">${p.tz ? '' : 'Detected from this phone. '}Your training day starts at 3 AM in this zone; change that in Settings.</p>`;
  } else if (q.type === 'body') {
    body = `${q.onlyWeight ? '' : `<label class="f"><span>Height (${lengthUnit(p)})</span>
      <input id="q-h" inputmode="decimal" value="${esc(length(a.heightIn, p) ?? '')}" placeholder="${lengthUnit(p) === 'cm' ? '170' : '67'}"></label>`}
      <label class="f"><span>Weight (${weightUnit(p)})</span>
      <input id="q-w" inputmode="decimal" value="${p.kind === 'perf' ? '' : esc(weight(a.weightLb, p))}"
        placeholder="${p.kind === 'perf' && a.weightLb ? 'Saved. Type a new weight to change it' : weightUnit(p) === 'kg' ? '70' : '155'}"></label>`;
  } else if (q.type === 'choice' || q.type === 'yesno') {
    const opts = q.type === 'yesno' ? [['yes', 'Yes'], ['no', 'No']] : val(q.options, p);
    body = `<div class="pills" style="margin-top:8px">${opts.map(([v, l]) => `<button data-q="${esc(v)}" aria-pressed="${String(a[q.key]) === v}">${esc(l)}</button>`).join('')}</div>`;
    // Giant number (2.3): one big number with − and +, and a line that cheers the pick.
    if (q.big) {
      const i = opts.findIndex(([v]) => String(a[q.key]) === v), mid = Math.floor(opts.length / 2);
      const lo = i < 0 ? mid : Math.max(0, i - 1), hi = i < 0 ? mid : Math.min(opts.length - 1, i + 1);
      body = `<div class="giant"><button data-q="${esc(opts[lo][0])}" aria-label="Fewer"${i === 0 ? ' disabled' : ''}>−</button>
        <span class="gn" aria-live="polite"><b class="num">${i < 0 ? '?' : esc(opts[i][1])}</b><span class="sub">${esc(q.big)}</span></span>
        <button data-q="${esc(opts[hi][0])}" aria-label="More"${i === opts.length - 1 ? ' disabled' : ''}>+</button></div>
        <p class="cheer">${i < 0 ? 'Tap + or − to pick.' : esc(q.cheer?.[opts[i][0]] || '')}</p>${body}`;
    }
  } else if (q.type === 'multi') {
    const sel = a[q.key] || [];
    body = `<div class="pills" style="margin-top:8px">${val(q.options, p).map(([v, l]) => `<button data-qm="${esc(v)}" aria-pressed="${sel.includes(v)}">${esc(l)}</button>`).join('')}</div>
      ${q.other ? `<label class="f"><span>Anything else</span><input id="q-other" value="${esc(a[q.other] || '')}" maxlength="80" autocapitalize="sentences"></label>${VOICE}` : ''}`;
  } else if (q.type === 'number') {
    body = `<input id="q-n" type="number" inputmode="decimal" step="${q.step || 1}" min="${q.min}" max="${val(q.max, p)}" value="${esc(a[q.key] ?? '')}" aria-label="${esc(q.title)}" style="margin-top:8px">`;
  } else if (q.type === 'text') {
    body = `<textarea id="q-t" maxlength="300" autocapitalize="sentences" aria-label="${esc(q.title)}" style="margin-top:8px">${esc(a[q.key] || '')}</textarea>${VOICE}`;
  } else if (q.type === 'date') {
    body = `<input id="q-d" type="date" min="${dayKey()}" value="${esc(a[q.key] || '')}" aria-label="${esc(q.title)}" style="margin-top:8px">`;
  }
  return `<div class="q" data-qid="${q.id}"><h2>${esc(q.title)}</h2>${help ? `<p class="sub">${esc(help)}</p>` : ''}${body}<p class="msg" role="status"></p></div>`;
}

// Taps inside a question (pills and unit buttons) update the draft immediately.
export function questionClick(q, p, b) {
  p.about ||= {};
  if (b.dataset.units) { p.units = b.dataset.units; return 'redraw'; }
  if (b.dataset.q !== undefined) { p.about[q.key] = b.dataset.q; return 'redraw'; }
  if (b.dataset.qm !== undefined) {
    const cur = new Set(p.about[q.key] || []);
    cur.has(b.dataset.qm) ? cur.delete(b.dataset.qm) : cur.add(b.dataset.qm);
    p.about[q.key] = [...cur];
    return 'redraw';
  }
  return null;
}

// Reads typed fields into the draft. Returns an error message, or '' when fine.
export function questionRead(q, p, root) {
  const a = p.about ||= {};
  const v = s => root.querySelector(s)?.value.trim() ?? '';
  if (q.type === 'units') { const tz = v('#q-tz'); p.tz = validTZ(tz) ? tz : deviceTZ(); p.units ||= 'imperial'; }
  if (q.type === 'body') {
    const hi = toIn(v('#q-h'), p), lb = toLb(v('#q-w'), p);
    if (!q.onlyWeight && v('#q-h') && (hi === null || hi < 36 || hi > 96)) return `That height doesn't look right. Use ${lengthUnit(p)}.`;
    if (v('#q-w') && (lb === null || lb < 40 || lb > 600)) return `That weight doesn't look right. Use ${weightUnit(p)}.`;
    if (!q.onlyWeight && v('#q-h')) a.heightIn = round(hi, 2);
    if (v('#q-w')) { a.weightLb = round(lb, 1); a.weightAt = Date.now(); }
  }
  if (q.type === 'number' && v('#q-n')) {
    const n = +v('#q-n');
    if (!isFinite(n) || n < q.min || n > val(q.max, p)) return 'Enter a number between ' + q.min + ' and ' + val(q.max, p) + '.';
    a[q.key] = n;
  }
  if (q.type === 'text') a[q.key] = v('#q-t').slice(0, 300);
  if (q.type === 'date') a[q.key] = v('#q-d');
  if (q.other) a[q.other] = v('#q-other').slice(0, 80);
  return '';
}

export function markAsked(q, p) { p.coach ||= {}; (p.coach.asked ||= {})[q.id] = todayOf(p); }

// A labeled progress bar for multi-screen flows.
export const progress = (i, n, title) => `<span class="prog" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${i + 1}"
  aria-label="Step ${i + 1} of ${n}"><i style="width:${Math.round((i + 1) / n * 100)}%"></i></span><span>${esc(title || '')}</span>`;

// ---------- Daily follow-ups ----------
// Up to two a day. Missing essentials come first, then follow-ups whose conditions hold.
export function nextQuestion(p, ctx) {
  const today = todayOf(p);
  const c = p.coach || {};
  if (!p.tz || !c.asked) return null; // never set up: Home offers the full setup instead
  if (c.daily?.day === today && c.daily.n >= 2) return null;
  // Just finished the full setup: follow-ups start tomorrow.
  if (!missingEssentials(p).length && Object.values(c.asked).filter(d => d === today).length >= 3 && !c.daily) return null;
  const last = id => c.asked?.[id] ? daysBetween(c.asked[id], today) : Infinity;
  for (const q of QUESTIONS) {
    if (!forKind(q, p)) continue;
    if (q.essential && (answered(q, p) || last(q.id) < 30)) continue;
    if (!q.essential) {
      if (q.when && !q.when(p, ctx)) continue;
      if (q.repeat ? last(q.id) < q.repeat : answered(q, p) || last(q.id) < 14) continue;
      if (last(q.id) === 0) continue;
    }
    return q;
  }
  return null;
}
export function countAnswerToday(p) {
  const today = todayOf(p);
  p.coach ||= {};
  p.coach.daily = p.coach.daily?.day === today ? { day: today, n: p.coach.daily.n + 1 } : { day: today, n: 1 };
}

// The Home card. onDone(question, answer-or-null) saves and redraws.
export function coachCard(p, ctx) {
  if (!p.tz || !p.coach?.asked) return `<section class="card coach"><p class="lbl">Your coach</p>
    <h2>Make Goku yours</h2><p class="sub">A few questions so your plan and fuel ranges fit you, not everyone. About 3 minutes.</p>
    <button class="cta" id="coachSetup" style="margin-top:12px">Start</button></section>`;
  const q = nextQuestion(p, ctx);
  if (!q) return '';
  return `<section class="card coach"><p class="lbl">Coach question</p>${questionHTML(q, structuredClone(p))}
    <div class="row" style="margin-top:12px"><button class="cta2" id="coachSkip">Not now</button><button class="cta" id="coachSave" style="width:auto;padding:0 20px">Save</button></div></section>`;
}

// Wires the Home card. save(p) persists the profile and redraws.
export function bindCoach(root, p, ctx, save) {
  const card = root.querySelector('.coach'); if (!card) return;
  if (card.querySelector('#coachSetup')) { card.querySelector('#coachSetup').onclick = () => setupFlow(p, save); return; }
  const q = nextQuestion(p, ctx); if (!q) return;
  const draft = structuredClone(p);
  card.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'coachSkip') { markAsked(q, p); countAnswerToday(p); return save(p); }
    if (b.id === 'coachSave') {
      const err = questionRead(q, draft, card);
      if (err) { card.querySelector('.msg').textContent = err; return; }
      if (q.type === 'multi') draft.about[q.key] ||= [];
      Object.assign(p, { about: draft.about, units: draft.units, tz: draft.tz });
      if (q.id === 'feel') p.coach = { ...p.coach, feel: { day: todayOf(p), v: draft.about._feel, g: p.settings.gravity || 50 } };
      delete p.about._feel;
      const changed = draft.about._schedule === 'yes'; delete p.about._schedule;
      markAsked(q, p); countAnswerToday(p);
      await save(p);
      if (changed) window.goku.go('week');
      else toast('Saved');
      return;
    }
    if (questionClick(q, draft, b) === 'redraw') {
      questionRead(q, draft, card); // keep anything typed before the redraw
      card.querySelector('.q').outerHTML = questionHTML(q, draft);
    }
  });
}

// The full set of essentials, one per screen. Used at first setup (inside onboarding) and
// from the Home card for profiles made before 1.3.
export function setupFlow(p, save, { only = null } = {}) {
  const screens = setupScreens(p, only);
  const draft = structuredClone(p);
  draft.about ||= {};
  let i = 0;
  const { el, close } = overlay(`<div class="row"><p class="lbl" id="qs-n" style="margin:0"></p><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="qs"></div>
    <button class="cta" id="qs-next"></button><button class="cta2" id="qs-skip" style="width:100%;margin-top:8px">Skip</button>`, { label: 'Your coach' });
  const $ = s => el.querySelector(s);
  const draw = () => {
    const [title, qs] = screens[i];
    $('#qs-n').innerHTML = screens.length > 1 ? progress(i, screens.length, title) : 'Your coach';
    $('#qs').innerHTML = screenHTML(qs, draft);
    $('#qs-next').textContent = i === screens.length - 1 ? 'Done' : 'Next';
    $('#qs-skip').hidden = qs.some(q => q.type === 'units');
  };
  const finish = async () => {
    Object.assign(p, { about: draft.about, units: draft.units || 'imperial', tz: draft.tz || p.tz });
    p.coach = { ...(p.coach || {}), asked: { ...(p.coach?.asked || {}), ...(draft.coach?.asked || {}) } };
    close(); await save(p);
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const qs = screens[i][1];
    if (b.id === 'x') return finish(); // keep whatever was answered so far
    if (b.id === 'qs-next' || b.id === 'qs-skip') {
      if (b.id === 'qs-next' && !screenRead(qs, draft, el)) return;
      if (b.id === 'qs-skip') qs.forEach(q => markAsked(q, draft));
      if (i < screens.length - 1) { i++; draw(); $('#qs').scrollTop = 0; } else await finish();
      return;
    }
    if (screenClick(qs, draft, b, el)) draw();
  });
  draw();
}
