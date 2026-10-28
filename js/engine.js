// "Density Engine" profile: gravity-chamber circuits, rep counter, gut log.
import { profile, saveProfile, entries, saveEntry, deleteEntry, today } from './state.js';
import * as db from './db.js';
import { esc, toast, ask, overlay, stepper, unlockAudio, beep, keepAwake, round } from './ui.js';
import { clock, prettyDay, weekStart } from './time.js';

export const TABS = [['home', 'Home'], ['library', 'Library'], ['gut', 'Gut'], ['history', 'History'], ['settings', 'Settings']];

// gravity: [rounds, rest seconds, time cap minutes, drop stages used]
export const GRAVITY = { 10: [3, 90, 14, 1], 20: [4, 75, 16, 2], 50: [4, 45, 20, 99], 100: [5, 30, 24, 99] };
const SLOTS = ['push', 'pull', 'legs', 'core'];

const SEED = [
  ['Perfect Pushup', 'push', ['deficit', 'flat', 'knees']],
  ['DB push press', 'push', ['heavy', 'medium', 'light']],
  ['TRX chest press', 'push', ['steep', 'mid', 'shallow']],
  ['TRX row', 'pull', ['steep', 'mid', 'shallow']],
  ['Playset pull-up', 'pull', ['strict', 'jumping', 'slow negatives']],
  ['DB row', 'pull', ['heavy', 'medium', 'light']],
  ['DB goblet squat', 'legs', ['heavy', 'medium', 'bodyweight']],
  ['TRX pistol', 'legs', ['low assist', 'high assist']],
  ['DB reverse lunge', 'legs', ['heavy', 'light', 'bodyweight']],
  ['Hanging leg raise', 'core', ['straight legs', 'bent knees']],
  ['TRX knee tuck', 'core', ['pike', 'knee tuck']],
  ['Broad jump', 'power', ['quality reps only'], 'soccer'],
  ['Copenhagen plank', 'joints', ['long lever', 'short lever'], 'soccer'],
];

export async function library() {
  let lib = await entries('exercise');
  if (!lib.length && !(await db.getMeta('seeded:' + profile().id))) {
    for (const [name, slot, stages, mod] of SEED)
      await saveEntry('exercise', { name, slot, module: mod || null, stages: stages.map(label => ({ label, load: null })) }, { day: '1970-01-01' });
    await db.setMeta('seeded:' + profile().id, true);
    lib = await entries('exercise');
  }
  return lib;
}

export async function todaysCircuit() {
  const p = profile();
  const lib = await library();
  const seed = p.settings.shuffleSeed || 0;
  const picks = [];
  SLOTS.forEach((slot, i) => {
    const opts = lib.filter(e => e.data.slot === slot);
    if (opts.length) picks.push(opts[(seed + i) % opts.length]);
  });
  if (p.modules.soccer) {
    const extra = lib.filter(e => e.data.module === 'soccer');
    if (extra.length) picks.push(extra[seed % extra.length]);
  }
  return picks;
}

const sessionTotal = s => s.data.sets.reduce((a, set) => a + set.stages.reduce((b, st) => b + st.reps, 0), 0);
const minutes = s => Math.max(1, (s.data.endedAt - s.data.startedAt) / 60000);

// ---------- Home ----------
export async function home() {
  const p = profile();
  const g = p.settings.gravity || 50;
  const [rounds, rest, cap, depth] = GRAVITY[g];
  const circuit = await todaysCircuit();
  const sessions = await entries('session');
  const last = sessions[sessions.length - 1];
  const gut = await db.get('entries', p.id + ':gut:' + today());
  const len = 2 * Math.PI * 80;
  const pct = { 10: .25, 20: .45, 50: .75, 100: 1 }[g];
  const wk = weekStart(today());
  const sets = {};
  for (const s of sessions.filter(s => s.day >= wk)) for (const set of s.data.sets) sets[set.slot] = (sets[set.slot] || 0) + 1;

  return {
    cta: circuit.length ? ['Enter chamber', () => startRun(circuit)] : null,
    html: `<div class="cols"><div>
    <section class="card" aria-labelledby="h-today">
      <p class="lbl">Gravity chamber · today</p>
      <h1 id="h-today">${p.settings.shuffleSeed ? 'Shuffled circuit' : 'Density circuit'}</h1>
      <p class="sub">${rounds} rounds · ${rest}s rest · ${cap}-min cap · ${depth === 1 ? 'one stage per set' : depth === 2 ? 'to failure, one drop' : 'to failure, then drop'}</p>
      <div class="dial" aria-hidden="true">
        <svg viewBox="0 0 190 190"><circle cx="95" cy="95" r="80" fill="none" stroke="var(--s2)" stroke-width="14"/>
        <circle cx="95" cy="95" r="80" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round"
          stroke-dasharray="${len * pct} ${len}" transform="rotate(-90 95 95)"/></svg>
        <div style="text-align:center"><div class="v num">×${g}</div><div class="lbl">gravity</div></div>
      </div>
      <div class="seg" role="group" aria-label="Gravity level">
        ${Object.keys(GRAVITY).map(x => `<button data-g="${x}" aria-pressed="${+x === g}">×${x}</button>`).join('')}
      </div>
      ${last ? `<div class="ghost">Ghost: your last session (${prettyDay(last.day)}) · <b class="num">${sessionTotal(last)}</b> reps in ${round(minutes(last))} min. Beat it.</div>`
        : '<div class="ghost">Your first session becomes your ghost. Next time, you race it live.</div>'}
    </section>
    <section class="card">
      <div class="row"><h2>Circuit</h2>${p.modules.shuffle ? '<button class="cta2" id="shuffle">Shuffle</button>' : ''}</div>
      ${circuit.length ? `<ul class="list">${circuit.map(e => `<li><span>${esc(e.data.name)}<br>
        <span class="chain">${e.data.stages.slice(0, depth).map(s => esc(s.label)).join(' → ')}</span></span></li>`).join('')}</ul>`
        : '<div class="empty"><h2>Your library is empty</h2><p>Add exercises in the Library tab to build circuits.</p></div>'}
    </section>
  </div><div>
    <div class="grid">
      <section class="card"><p class="lbl">Last session</p>
        <p class="big num">${last ? round(sessionTotal(last) / minutes(last), 1) : '—'}</p><p class="sub">reps per minute</p></section>
      ${p.modules.gut ? `<section class="card"><p class="lbl">Gut today</p>
        <p class="big num">${gut?.data.bloat ?? '—'}<span class="sub">/10</span></p><p class="sub">${gut ? 'Logged' : 'Not logged yet'}</p></section>` : ''}
    </div>
    ${p.modules.hypertrophy ? `<section class="card">
      <p class="lbl">Hard sets this week</p>
      ${SLOTS.map(s => `<div class="row" style="margin-top:8px"><span>${s[0].toUpperCase() + s.slice(1)}</span><span class="num sub">${sets[s] || 0}</span></div>`).join('')}
      <p class="note">Each set taken to failure counts once, drops included. Growth ranges and charts arrive in M2.</p>
    </section>` : ''}
  </div></div>`,
    bind(root) {
      root.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.g) { p.settings.gravity = +b.dataset.g; await saveProfile(p); window.goku.render(); }
        if (b.id === 'shuffle') { p.settings.shuffleSeed = (p.settings.shuffleSeed || 0) + 1; await saveProfile(p); window.goku.render(); }
      });
    },
  };
}

// ---------- Runner (survives reloads: state lives in IndexedDB) ----------
const runKey = () => 'run:' + profile().id;

async function startRun(circuit) {
  unlockAudio();
  const p = profile();
  const g = p.settings.gravity || 50;
  const [rounds, rest, cap, depth] = GRAVITY[g];
  const sessions = await entries('session');
  const last = sessions[sessions.length - 1];
  const run = {
    startedAt: Date.now(), gravity: g, rounds, rest, cap, round: 1, ex: 0, stage: 0, phase: 'set', restUntil: 0,
    plan: circuit.map(e => ({ id: e.id, name: e.data.name, slot: e.data.slot, stages: e.data.stages.slice(0, depth) })),
    sets: [], cur: null, repTimes: [], ghost: last?.data.repTimes || null,
  };
  await db.setMeta(runKey(), run);
  openRunner(run);
}

export async function resumeRun() {
  const run = await db.getMeta(runKey());
  if (run) openRunner(run);
}

function openRunner(run) {
  window.goku.busy = true;
  keepAwake(true);
  const { el, close } = overlay(`
    <div class="row">
      <button class="cta2" id="undo" aria-label="Undo last rep">Undo</button>
      <span class="num sub" id="clock">00:00</span>
      <button class="cta2" id="end">Finish</button>
    </div>
    <p class="sub" id="where" style="text-align:center;margin-top:8px"></p>
    <button class="tap" id="tap"><span>
      <span class="lbl" id="stage"></span>
      <span class="reps num" id="reps" aria-live="polite">0</span>
      <span class="sub" id="ex"></span></span></button>
    <div class="ghost" id="ghost"></div>
    <button class="cta" id="next" style="margin-top:12px"></button>`, { label: 'Session in progress' });
  const $ = s => el.querySelector(s);
  const save = () => db.setMeta(runKey(), run);

  const curEx = () => run.plan[run.ex];
  function ensureSet() {
    if (!run.cur) run.cur = { exId: curEx().id, name: curEx().name, slot: curEx().slot, round: run.round,
      stages: curEx().stages.map(s => ({ label: s.label, load: s.load, reps: 0 })) };
  }
  const total = () => run.sets.reduce((a, s) => a + s.stages.reduce((b, x) => b + x.reps, 0), 0) +
    (run.cur ? run.cur.stages.reduce((b, x) => b + x.reps, 0) : 0);

  let lastRestBeep = false;
  function draw() {
    const t = Date.now() - run.startedAt;
    const capLeft = run.cap * 60000 - t;
    $('#clock').textContent = clock(t) + (capLeft > 0 ? ' · cap ' + clock(capLeft) : ' · cap reached');
    $('#where').textContent = `Round ${run.round} of ${run.rounds} · exercise ${run.ex + 1} of ${run.plan.length}`;
    if (run.ghost) {
      const g = run.ghost.filter(x => x <= t / 1000).length;
      const diff = total() - g;
      $('#ghost').innerHTML = diff >= 0 ? `Ghost: you're <b class="num">${diff}</b> reps ahead` : `Ghost: <b class="num">${-diff}</b> reps behind`;
    } else $('#ghost').textContent = 'No ghost yet. This session sets the pace for next time.';

    if (run.phase === 'rest') {
      const left = run.restUntil - Date.now();
      $('#stage').textContent = 'Rest · next: ' + curEx().name;
      $('#reps').textContent = clock(left);
      $('#ex').textContent = 'Tap to skip rest';
      $('#tap').setAttribute('aria-label', 'Skip rest');
      $('#next').textContent = 'Skip rest';
      $('#undo').style.visibility = 'hidden';
      if (left <= 0) { if (!lastRestBeep) { beep(988, 180, 2); lastRestBeep = true; } run.phase = 'set'; save(); }
      return;
    }
    lastRestBeep = false;
    ensureSet();
    const st = run.cur.stages[run.stage];
    $('#undo').style.visibility = '';
    $('#stage').textContent = run.cur.stages.length > 1 ? `Stage ${run.stage + 1} of ${run.cur.stages.length} · ${st.label}` : st.label;
    $('#reps').textContent = st.reps;
    $('#ex').textContent = curEx().name;
    $('#tap').setAttribute('aria-label', `Add one rep. ${st.reps} so far`);
    $('#next').textContent = run.stage < run.cur.stages.length - 1 ? 'Drop to ' + run.cur.stages[run.stage + 1].label : 'Set done';
  }

  async function endSet() {
    run.sets.push(run.cur); run.cur = null; run.stage = 0;
    run.ex++;
    if (run.ex >= run.plan.length) { run.ex = 0; run.round++; }
    if (run.round > run.rounds) return finish();
    run.phase = 'rest'; run.restUntil = Date.now() + run.rest * 1000;
    await save(); draw();
  }

  async function finish() {
    clearInterval(tick);
    if (run.cur && run.cur.stages.some(s => s.reps)) run.sets.push(run.cur);
    const endedAt = Date.now();
    if (run.sets.length) {
      await saveEntry('session', { gravity: run.gravity, startedAt: run.startedAt, endedAt, sets: run.sets, repTimes: run.repTimes },
        { ts: run.startedAt });
    }
    await db.setMeta(runKey(), null);
    keepAwake(false); window.goku.busy = false;
    close();
    const reps = run.sets.reduce((a, s) => a + s.stages.reduce((b, x) => b + x.reps, 0), 0);
    toast(run.sets.length ? `Saved · ${reps} reps in ${Math.max(1, round((endedAt - run.startedAt) / 60000))} min` : 'Nothing logged, so nothing saved');
    window.goku.render();
  }

  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'tap') {
      if (run.phase === 'rest') { run.phase = 'set'; await save(); draw(); return; }
      ensureSet();
      run.cur.stages[run.stage].reps++;
      run.repTimes.push(Math.round((Date.now() - run.startedAt) / 100) / 10);
      b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 120);
      draw(); save();
    } else if (b.id === 'undo') {
      if (run.cur && run.cur.stages[run.stage].reps > 0) { run.cur.stages[run.stage].reps--; run.repTimes.pop(); draw(); save(); }
    } else if (b.id === 'next') {
      if (run.phase === 'rest') { run.phase = 'set'; await save(); draw(); return; }
      if (run.stage < run.cur.stages.length - 1) { run.stage++; await save(); draw(); } else endSet();
    } else if (b.id === 'end') {
      const r = await ask('Finish session?', 'Everything logged so far is saved.', [{ label: 'Finish and save', value: 'save' }, { label: 'Discard session', value: 'discard' }]);
      if (r === 'save') finish();
      else if (r === 'discard') {
        const sure = await ask('Discard this session?', 'The reps you logged in it will be deleted.', [{ label: 'Discard', value: true }]);
        if (sure) { clearInterval(tick); run.sets = []; run.cur = null; await db.setMeta(runKey(), null); keepAwake(false); window.goku.busy = false; close(); window.goku.render(); }
      }
    }
  });
  const tick = setInterval(draw, 250);
  draw();
}

// ---------- Library ----------
export async function libraryView() {
  const lib = await library();
  const groups = {};
  for (const e of lib) (groups[e.data.slot] ||= []).push(e);
  return {
    cta: ['Add exercise', () => editExercise()],
    html: `<h1>Library</h1><p class="sub">Each exercise has a drop chain, hardest first. Circuits pick one per group.</p>
      ${Object.entries(groups).map(([slot, list]) => `<section class="card" style="margin-top:12px">
        <p class="lbl">${esc(slot)}</p><ul class="list">${list.map(e => `<li><span>${esc(e.data.name)}<br>
        <span class="chain">${e.data.stages.map(s => esc(s.label) + (s.load ? ` (${s.load} lb)` : '')).join(' → ')}</span></span>
        <button class="cta2" data-edit="${e.id}">Edit</button></li>`).join('')}</ul></section>`).join('')}`,
    bind(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-edit]');
        if (b) editExercise(lib.find(x => x.id === b.dataset.edit));
      });
    },
  };
}

function editExercise(ex) {
  const d = ex ? structuredClone(ex.data) : { name: '', slot: 'push', module: null, stages: [{ label: '', load: null }] };
  const { el, close } = overlay(`<div class="row"><h1>${ex ? 'Edit exercise' : 'New exercise'}</h1><button class="cta2" id="x">Close</button></div>
    <div class="scroll" id="f"></div>
    <p class="msg" id="m" role="status"></p>
    <button class="cta" id="save">Save</button>
    ${ex ? '<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete exercise</button>' : ''}`, { label: 'Edit exercise' });
  const $ = s => el.querySelector(s);
  function draw() {
    $('#f').innerHTML = `<label class="f"><span>Name</span><input id="nm" value="${esc(d.name)}" maxlength="40"></label>
      <label class="f"><span>Group</span><select id="slot">${[...SLOTS, 'power', 'joints'].map(s => `<option ${s === d.slot ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <p class="lbl" style="margin-top:16px">Drop chain, hardest first</p>
      ${d.stages.map((s, i) => `<div class="row" style="margin-top:8px">
        <input data-i="${i}" data-k="label" value="${esc(s.label)}" placeholder="Stage ${i + 1}" aria-label="Stage ${i + 1} name">
        <input data-i="${i}" data-k="load" value="${s.load ?? ''}" inputmode="decimal" placeholder="lb" aria-label="Stage ${i + 1} load in pounds" style="width:80px">
        <button class="cta2" data-rm="${i}" aria-label="Remove stage ${i + 1}">−</button></div>`).join('')}
      <button class="cta2" id="add" style="margin-top:8px">Add stage</button>`;
  }
  el.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'nm') d.name = t.value;
    if (t.dataset.k === 'label') d.stages[+t.dataset.i].label = t.value;
    if (t.dataset.k === 'load') d.stages[+t.dataset.i].load = t.value ? +t.value : null;
  });
  el.addEventListener('change', e => { if (e.target.id === 'slot') d.slot = e.target.value; });
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') close();
    if (b.id === 'add') { d.stages.push({ label: '', load: null }); draw(); }
    if (b.dataset.rm) { if (d.stages.length > 1) { d.stages.splice(+b.dataset.rm, 1); draw(); } }
    if (b.id === 'save') {
      d.stages = d.stages.filter(s => s.label.trim());
      if (!d.name.trim() || !d.stages.length) { $('#m').textContent = 'Add a name and at least one stage.'; return; }
      await saveEntry('exercise', d, ex ? { id: ex.id, day: ex.day, ts: ex.ts } : { day: '1970-01-01' });
      close(); window.goku.render();
    }
    if (b.id === 'del' && await ask('Delete this exercise?', 'Past sessions that used it keep their records.', [{ label: 'Delete', value: true }])) {
      await deleteEntry(ex.id); close(); window.goku.render();
    }
  });
  draw();
}

// ---------- Gut log ----------
export async function gutView() {
  const p = profile();
  const id = p.id + ':gut:' + today();
  const cur = (await db.get('entries', id))?.data ||
    { amWaist: null, pmWaist: null, bloat: null, foods: [], fluidsOz: 0, supplements: [], protein: [] };
  const all = await entries('gut');
  const recentFoods = [...new Set(all.flatMap(e => e.data.foods))].slice(-12);
  const recentSupps = [...new Set(all.flatMap(e => e.data.supplements))].slice(-8);
  const lastWaist = [...all].reverse().map(e => e.data.amWaist ?? e.data.pmWaist).find(v => v != null) ?? 34;
  const proteinTotal = cur.protein.reduce((a, b) => a + b, 0);
  const target = p.settings.proteinTarget;
  const save = () => saveEntry('gut', cur, { id, day: today() });
  const tags = (key, recent) => `<div class="pills" style="margin-top:8px">${[...new Set([...recent, ...cur[key]])].map(t =>
    `<button data-tag="${key}" data-v="${esc(t)}" aria-pressed="${cur[key].includes(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input data-new="${key}" placeholder="${key === 'foods' ? 'Add a food' : 'Add a capsule or supplement'}" aria-label="Add"><button class="cta2" data-add="${key}">Add</button></div>`;

  return {
    html: `<h1>Gut log</h1><p class="sub">${prettyDay(today())}</p>
    <div class="cols"><div>
      <section class="card" style="margin-top:12px"><p class="lbl">Bloating (0 = none, 10 = worst)</p>
        ${stepper('bloat', cur.bloat ?? 'none', 'bloating')}</section>
      <section class="card"><p class="lbl">Waist (inches)</p>
        <div class="row"><span>Morning</span>${stepper('amWaist', cur.amWaist ?? 'none', 'morning waist')}</div>
        <div class="row" style="margin-top:8px"><span>Evening</span>${stepper('pmWaist', cur.pmWaist ?? 'none', 'evening waist')}</div>
        <p class="note">Steps of ¼ inch. Measure at the same spot each time.</p></section>
      <section class="card"><p class="lbl">Fluids</p>
        <div class="row"><span class="num big">${cur.fluidsOz} <span class="sub">oz</span></span>
        <span><button class="cta2" data-fl="-8">−8</button> <button class="cta2" data-fl="8">+8</button> <button class="cta2" data-fl="16">+16</button></span></div></section>
    </div><div>
      <section class="card"><p class="lbl">Protein</p>
        <p class="big num">${proteinTotal} g${target ? ` <span class="sub">of ${target} g ${p.settings.proteinPer === 'meal' ? 'per meal' : 'today'}</span>` : ''}</p>
        ${target && p.settings.proteinPer === 'day' ? `<div class="bar"><i style="width:${Math.min(100, proteinTotal / target * 100)}%"></i></div>` : ''}
        ${cur.protein.length ? `<p class="sub" style="margin-top:6px">Meals: ${cur.protein.map(g => g + ' g').join(' · ')}</p>` : ''}
        <div class="seg">${[10, 20, 30, 40, 50].map(g => `<button data-pr="${g}">+${g}</button>`).join('')}</div>
        ${cur.protein.length ? '<button class="link" id="prUndo">Undo last</button>' : ''}
        ${!target ? '<p class="note">Add your target in Settings.</p>' : ''}</section>
      <section class="card"><p class="lbl">Foods</p>${tags('foods', recentFoods)}</section>
      <section class="card"><p class="lbl">Capsules and supplements</p>${tags('supplements', recentSupps)}</section>
      <section class="card"><p class="lbl">Pattern, not proof</p>
        <p class="sub">After 14 days of logs, this panel lists which foods and supplements show up most often on your high-bloating days. It arrives in M2. You have ${all.length} day${all.length === 1 ? '' : 's'} logged.</p></section>
    </div></div>`,
    bind(root) {
      root.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        const st = b.closest('[data-step]');
        if (st && b.dataset.d) {
          const k = st.dataset.step, d = +b.dataset.d;
          if (k === 'bloat') cur.bloat = Math.min(10, Math.max(0, (cur.bloat ?? (d > 0 ? -1 : 1)) + d));
          else cur[k] = Math.max(15, round((cur[k] ?? (k === 'pmWaist' && cur.amWaist ? cur.amWaist : lastWaist)) + d * 0.25, 2));
        } else if (b.dataset.fl) cur.fluidsOz = Math.max(0, cur.fluidsOz + +b.dataset.fl);
        else if (b.dataset.pr) cur.protein.push(+b.dataset.pr);
        else if (b.id === 'prUndo') cur.protein.pop();
        else if (b.dataset.tag) {
          const k = b.dataset.tag, v = b.dataset.v;
          cur[k] = cur[k].includes(v) ? cur[k].filter(x => x !== v) : [...cur[k], v];
        } else if (b.dataset.add) {
          const inp = root.querySelector(`[data-new="${b.dataset.add}"]`);
          const v = inp.value.trim().toLowerCase();
          if (!v) return;
          if (!cur[b.dataset.add].includes(v)) cur[b.dataset.add].push(v);
        } else return;
        await save(); window.goku.render();
      });
      root.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.dataset.new) root.querySelector(`[data-add="${e.target.dataset.new}"]`).click();
      });
    },
  };
}

// ---------- History ----------
export async function historyView() {
  const sessions = (await entries('session')).reverse();
  const guts = (await entries('gut')).reverse();
  return {
    html: `<h1>History</h1>
      <section class="card" style="margin-top:12px"><p class="lbl">Sessions</p>
      ${sessions.length ? `<ul class="list">${sessions.map(s => `<li><span>${prettyDay(s.day)} · ×${s.data.gravity}<br>
        <span class="chain">${s.data.sets.length} sets · ${round(minutes(s))} min</span></span>
        <span class="row" style="gap:8px"><span class="num">${sessionTotal(s)} reps</span>
        <button class="cta2" data-del="${s.id}" aria-label="Delete session">Delete</button></span></li>`).join('')}</ul>`
        : '<div class="empty"><h2>No sessions yet</h2><p>Enter the chamber from Home. Each finished session lands here and becomes your next ghost.</p></div>'}
      </section>
      <section class="card"><p class="lbl">Gut log days</p>
      ${guts.length ? `<ul class="list">${guts.map(g => `<li><span>${prettyDay(g.day)}</span>
        <span class="num sub">bloat ${g.data.bloat ?? '—'} · ${g.data.protein.reduce((a, b) => a + b, 0)} g protein</span></li>`).join('')}</ul>`
        : '<div class="empty"><p>Log bloating, waist and food in the Gut tab.</p></div>'}</section>
      <p class="note">Charts, PRs and the power-level score arrive in M2.</p>`,
    bind(root) {
      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-del]'); if (!b) return;
        if (await ask('Delete this session?', 'It will be removed from history and from your ghost.', [{ label: 'Delete', value: true }])) {
          await deleteEntry(b.dataset.del); window.goku.render();
        }
      });
    },
  };
}
