// "Density Engine" profile: gravity-chamber circuits, rep counter, gut log.
import { profile, saveProfile, entries, saveEntry, deleteEntry, today, on } from './state.js';
import * as db from './db.js';
import { esc, toast, ask, overlay, stepper, unlockAudio, beep, buzz, soundReady, awake, keepAwake, round, guard, announce, dayPicker } from './ui.js';
import { clock, prettyDay, weekStart, addDays, dayKey } from './time.js';
import { weight, weightUnit, toLb, length, lengthUnit, lengthStep, volume, volumeUnit, volumeSteps } from './units.js';
import { coachCard, bindCoach, isMinor } from './coach.js';
import { fuelCard, fuelRanges, timingCard } from './fuel.js';
import { logActivity, minutesOf, activityRows, editActivityById } from './activity.js';
import { loggedEntries, recovery, records, recordFor, progression, GROUPS } from './insights.js';
import { streakCard, recapCard, bindShared } from './homecards.js';
import { trendCard } from './trend.js';
import { milestones, ballsCard, newBallsCard, bindBalls } from './milestones.js';
import { whyBtn } from './why.js';

export const tabs = p => [['home', 'Home'], ['library', 'Library'], ...(on(p, 'gut') ? [['gut', 'Gut']] : []), ['history', 'History'], ['settings', 'Settings']];

// gravity: [rounds, rest seconds, time cap minutes, drop stages used]
export const GRAVITY = { 10: [3, 90, 14, 1], 20: [4, 75, 16, 2], 50: [4, 45, 20, 99], 100: [5, 30, 24, 99] };
const SLOTS = ['push', 'pull', 'legs', 'core'];
const STALE_MS = 3 * 3600000; // an untouched workout older than this asks before resuming

// [name, group, drop chain, module, equipment]. bw = bodyweight only. A new profile's library
// keeps only what its equipment answer allows, so every group still has an option.
const SEED = [
  ['Perfect Pushup', 'push', ['deficit', 'flat', 'knees'], null, 'bw'],
  ['TRX row', 'pull', ['steep', 'mid', 'shallow'], null, 'trx'],
  ['DB goblet squat', 'legs', ['heavy', 'medium', 'bodyweight'], null, 'db'],
  ['Hanging leg raise', 'core', ['straight legs', 'bent knees'], null, 'bar'],
  ['DB push press', 'push', ['heavy', 'medium', 'light'], null, 'db'],
  ['Playset pull-up', 'pull', ['strict', 'jumping', 'slow negatives'], null, 'bar'],
  ['TRX pistol', 'legs', ['low assist', 'high assist'], null, 'trx'],
  ['TRX knee tuck', 'core', ['pike', 'knee tuck'], null, 'trx'],
  ['TRX chest press', 'push', ['steep', 'mid', 'shallow'], null, 'trx'],
  ['DB row', 'pull', ['heavy', 'medium', 'light'], null, 'db'],
  ['DB reverse lunge', 'legs', ['heavy', 'light', 'bodyweight'], null, 'db'],
  ['Pike pushup', 'push', ['feet raised', 'floor', 'kneeling'], null, 'bw'],
  ['Prone Y-T-W raise', 'pull', ['slow 3-second hold', 'standard'], null, 'bw'],
  ['Bodyweight squat', 'legs', ['jump squat', 'tempo squat', 'squat'], null, 'bw'],
  ['Split squat', 'legs', ['rear foot raised', 'split squat', 'hand-assisted'], null, 'bw'],
  ['Dead bug', 'core', ['straight legs', 'bent knees'], null, 'bw'],
  ['Broad jump', 'power', ['quality reps only'], 'soccer', 'bw'],
  ['Copenhagen plank', 'joints', ['long lever', 'short lever'], 'soccer', 'bw'],
];

const byOrder = (a, b) => (a.data.order ?? 999) - (b.data.order ?? 999) || a.data.name.localeCompare(b.data.name);

export async function library() {
  let lib = await entries('exercise');
  if (!lib.length && !(await db.getMeta('seeded:' + profile().id))) {
    const eq = profile().about?.equipment; // unanswered: everything
    const keep = SEED.filter(x => !eq || x[4] === 'bw' || eq.includes(x[4]));
    for (const [i, [name, slot, stages, mod]] of keep.entries())
      await saveEntry('exercise', { name, slot, module: mod || null, order: i, stages: stages.map(label => ({ label, load: null })) }, { day: '1970-01-01' });
    await db.setMeta('seeded:' + profile().id, true);
    lib = await entries('exercise');
  }
  return lib.sort(byOrder);
}

export async function todaysCircuit() {
  const p = profile();
  const lib = await library();
  const seed = p.settings.shuffleSeed || 0;
  const picks = [];
  SLOTS.forEach(slot => {
    const opts = lib.filter(e => e.data.slot === slot);
    if (opts.length) picks.push(opts[seed % opts.length]);
  });
  if (on(p, 'soccer')) {
    const extra = lib.filter(e => e.data.module === 'soccer');
    if (extra.length) picks.push(extra[seed % extra.length]);
  }
  return picks;
}

// Sessions in training-day order, so moving a session's date in History moves it here too.
const byDay = (a, b) => a.day.localeCompare(b.day) || a.ts - b.ts;
async function sessionsInOrder() { return (await entries('session')).sort(byDay); }
// The ghost is your latest session at the same gravity, so a ×10 day never races a ×100 day.
const ghostFor = (sessions, g) => sessions.filter(s => s.data.gravity === g).pop() || null;

const sessionTotal = s => s.data.sets.reduce((a, set) => a + set.stages.reduce((b, st) => b + st.reps, 0), 0);
const minutes = s => Math.max(1, (s.data.endedAt - s.data.startedAt) / 60000);

// Sleep: the last 7 nights imported from Health if there are any, else the coach answer.
async function recentSleep(p) {
  const nights = (await entries('sleep')).filter(e => e.day >= addDays(today(), -6) && e.data.hours > 0);
  return nights.length ? round(nights.reduce((a, e) => a + e.data.hours, 0) / nights.length, 1) : p.about?.sleepH || null;
}

// ---------- Home ----------
export async function home() {
  const p = profile();
  const g = p.settings.gravity || 50;
  const [rounds, rest, cap, depth] = GRAVITY[g];
  const circuit = await todaysCircuit();
  // One read of the log feeds every card below.
  const all = (await loggedEntries(p)).sort((a, b) => a.ts - b.ts);
  const sessions = all.filter(e => e.type === 'session').sort(byDay);
  const last = sessions[sessions.length - 1];
  const ghost = ghostFor(sessions, g);
  const gut = on(p, 'gut') ? await db.get('entries', p.id + ':gut:' + today()) : null;
  const len = 2 * Math.PI * 80;
  const pct = { 10: .25, 20: .45, 50: .75, 100: 1 }[g];
  const wk = weekStart(today());
  const sets = {};
  for (const s of sessions.filter(s => s.day >= wk)) for (const set of s.data.sets) sets[set.slot] = (sets[set.slot] || 0) + 1;
  const weekCount = sessions.filter(s => s.day >= wk).length;
  const ctx = { sessionsThisWeek: sessions.filter(s => s.day >= addDays(today(), -6)).length };
  // Coach notes from the person's own answers.
  const feel = p.coach?.feel, levels = [10, 20, 50, 100];
  const fresh = feel && feel.day >= addDays(today(), -7);
  const asked = fresh && (feel.g ?? g) === g; // one answer suggests one step, not a run through every level
  const nudge = asked && feel.v === 'easy' && g < 100 ? levels[levels.indexOf(g) + 1] : asked && feel.v === 'hard' && g > 10 ? levels[levels.indexOf(g) - 1] : null;
  const sleepMin = isMinor(p) ? 8 : 7;
  const sleepH = await recentSleep(p);
  const lowSleep = sleepH && sleepH < sleepMin;
  const t = today();
  const allActs = all.filter(e => e.type === 'activity');
  const todayActs = allActs.filter(e => e.day === t);
  const map = recovery(sessions.filter(s => s.day >= addDays(t, -6)), allActs.filter(a => a.day >= addDays(t, -6)), t);
  const prog = progression(sessions, g);
  const showProg = prog && p.coach?.progSeen !== prog.latest.id && !(fresh && feel.v === 'hard');
  const nextG = levels[levels.indexOf(g) + 1];

  return {
    cta: circuit.length ? ['Enter chamber', () => startRun(circuit)] : null,
    html: `<div class="cols"><div>
    ${newBallsCard(p, milestones(p, all, t))}
    ${recapCard(p, all, t)}
    ${coachCard(p, ctx)}
    ${showProg ? `<section class="card coachnote"><div class="row"><p class="lbl" style="margin:0">Level up</p>${whyBtn('progress', JSON.stringify(prog.reps))}</div>
      <p>You beat your ghost twice in a row at ×${g}: ${prog.reps.join(' → ')} reps.</p>
      <div class="row" style="margin-top:8px;justify-content:flex-start;gap:8px">${nextG ? `<button class="cta2" data-g="${nextG}" data-prog="${esc(prog.latest.id)}">Move to ×${nextG}</button>` : ''}
      <button class="cta2" id="addLoad" data-prog="${esc(prog.latest.id)}">Add load to an exercise</button>
      <button class="link" data-prog="${esc(prog.latest.id)}" id="progLater">Stay here</button></div></section>` : ''}
    ${nudge && !showProg ? `<section class="card"><p class="lbl">Coach</p><p>Last week felt ${feel.v === 'easy' ? 'too easy' : 'too hard'}. Try ×${nudge} gravity${feel.v === 'easy' ? ' to keep progressing' : ' while you recover'}.</p>
      <button class="cta2" data-g="${nudge}" style="margin-top:8px">Switch to ×${nudge}</button></section>` : ''}
    <section class="card" aria-labelledby="h-today">
      <p class="lbl">Gravity chamber · today</p>
      <h1 id="h-today">${p.settings.shuffleSeed ? 'Shuffled circuit' : 'Density circuit'}</h1>
      <p class="sub">${rounds} rounds · ${rest}s rest · ${cap}-min cap · ${depth === 1 ? 'one stage per set' : depth === 2 ? 'to failure, one drop' : 'to failure, then drop'}</p>
      ${p.about?.days ? `<p class="sub">This week: <b class="num">${weekCount}</b> of ${esc(p.about.days)} sessions${weekCount >= +p.about.days ? ' · goal met' : ''} ${whyBtn('weekgoal')}</p>` : ''}
      <div class="dial" aria-hidden="true">
        <svg viewBox="0 0 190 190"><circle cx="95" cy="95" r="80" fill="none" stroke="var(--s2)" stroke-width="14"/>
        <circle cx="95" cy="95" r="80" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round"
          stroke-dasharray="${len * pct} ${len}" transform="rotate(-90 95 95)"/></svg>
        <div style="text-align:center"><div class="v num">×${g}</div><div class="lbl">gravity</div></div>
      </div>
      <div class="seg grav" role="group" aria-label="Gravity level">
        ${Object.keys(GRAVITY).map(x => `<button data-g="${x}" aria-pressed="${+x === g}">×${x}</button>`).join('')}
      </div>
      ${ghost ? `<div class="ghost">Ghost: your last ×${g} session (${prettyDay(ghost.day)}) · <b class="num">${sessionTotal(ghost)}</b> reps in ${round(minutes(ghost))} min. Beat it.</div>`
        : `<div class="ghost">Your first ×${g} session becomes your ghost. Next time at ×${g}, you race it live.</div>`}
    </section>
    <section class="card">
      <div class="row"><h2>Circuit</h2>${on(p, 'shuffle') ? '<button class="cta2" id="shuffle">Shuffle</button>' : ''}</div>
      ${circuit.length ? `<ul class="list">${circuit.map(e => `<li><span>${esc(e.data.name)}<br>
        <span class="chain">${e.data.stages.slice(0, depth).map(s => esc(s.label)).join(' → ')}</span></span></li>`).join('')}</ul>`
        : '<div class="empty"><h2>Your library is empty</h2><p>Add exercises in the Library tab to build circuits.</p></div>'}
      ${p.about?.limits ? `<p class="note">Your notes: ${esc(p.about.limits)}. Swap or skip anything that hurts.</p>` : ''}
    </section>
  </div><div>
    ${streakCard(p, all, t)}
    <section class="card"><div class="row"><p class="lbl" style="margin:0">Other training today</p><button class="cta2" id="logAct">Log activity</button></div>
      ${todayActs.length ? `<ul class="list">${activityRows(todayActs)}</ul>` : '<p class="sub">Soccer, runs, games or anything else. It feeds your fuel ranges and recovery map.</p>'}</section>
    <section class="card"><p class="lbl">Senzu map · recovery</p>
      <div class="senzu">${map.map(m => `<div class="sz ${m.days === null ? 'never' : m.days <= 0 ? 'd0' : m.days === 1 ? 'd1' : m.days === 2 ? 'd2' : 'd3'}">
        <span class="szdot" aria-hidden="true"></span><b>${esc(m.name)}</b><span class="sub">${m.days === null ? 'not this week' : m.days <= 0 ? 'trained today' : m.days === 1 ? '1 day ago' : m.days + ' days ago'}</span></div>`).join('')}</div>
      <p class="szkey sub" aria-hidden="true"><span class="sz d0"><span class="szdot"></span></span>today <span class="sz d1"><span class="szdot"></span></span>1 day <span class="sz d2"><span class="szdot"></span></span>2 days <span class="sz d3"><span class="szdot"></span></span>3+ days rested</p>
      <p class="note">From your circuits and other training in the last 7 days. If a group still feels sore, swap or skip it.</p></section>
    ${trendCard(p, all, t)}
    <div class="grid">
      <section class="card"><p class="lbl">Last session</p>
        <p class="big num">${last ? round(sessionTotal(last) / minutes(last), 1) : '—'}</p><p class="sub">reps per minute</p></section>
      ${on(p, 'gut') ? `<section class="card"><p class="lbl">Gut today</p>
        <p class="big num">${gut?.data.bloat ?? '—'}<span class="sub">/10</span></p><p class="sub">${gut ? 'Logged' : 'Not logged yet'}</p></section>` : ''}
    </div>
    ${lowSleep ? `<section class="card"><p class="lbl">Recovery</p><p>You sleep about ${esc(sleepH)} hours. ${sleepMin === 8 ? 'Teens are advised to get 8–10' : 'Adults are advised to get 7 or more'}, and muscle grows during recovery.</p>
      <p class="note">Sleep: American Academy of Sleep Medicine ${sleepMin === 8 ? 'pediatric consensus, 2016' : 'and Sleep Research Society adult consensus, 2015'}.</p></section>` : ''}
    ${on(p, 'fuel') ? fuelCard(p, cap + minutesOf(todayActs)) + timingCard(p, cap + minutesOf(todayActs)) : ''}
    ${on(p, 'hypertrophy') ? `<section class="card">
      <p class="lbl">Hard sets this week</p>
      ${GROUPS.filter(([id]) => SLOTS.includes(id) || sets[id]).map(([id, name]) => `<div class="row" style="margin-top:8px"><span>${name}</span><span class="num sub">${sets[id] || 0}</span></div>`).join('')}
      <p class="note">Each set taken to failure counts once, drops included.</p>
    </section>` : ''}
  </div></div>`,
    bind(root) {
      bindCoach(root, p, ctx, async x => { await saveProfile(x); window.goku.render(); });
      bindShared(root, p, t); bindBalls(root, p);
      root.addEventListener('click', guard(async e => {
        const b = e.target.closest('button'); if (!b || b.closest('.coach')) return;
        if (b.dataset.prog) { p.coach = { ...(p.coach || {}), progSeen: b.dataset.prog }; if (!b.dataset.g) await saveProfile(p); }
        if (b.id === 'addLoad') return window.goku.go('library');
        if (b.id === 'progLater') return window.goku.render();
        if (b.id === 'logAct') return logActivity();
        if (b.dataset.act) return editActivityById(b.dataset.act);
        if (b.dataset.g) { p.settings.gravity = +b.dataset.g; await saveProfile(p); window.goku.render(); }
        if (b.id === 'shuffle') { p.settings.shuffleSeed = (p.settings.shuffleSeed || 0) + 1; await saveProfile(p); window.goku.render(); }
      }));
    },
  };
}

// ---------- Runner (survives reloads: state lives in IndexedDB) ----------
const runKey = () => 'run:' + profile().id;
let starting = false;

async function startRun(circuit) {
  if (starting || window.goku.busy || document.getElementById('runner')) return;
  starting = true;
  try {
    unlockAudio();
    const p = profile();
    const g = p.settings.gravity || 50;
    const [rounds, rest, cap, depth] = GRAVITY[g];
    const ghost = ghostFor(await sessionsInOrder(), g);
    const run = {
      startedAt: Date.now(), gravity: g, rounds, rest, cap, round: 1, ex: 0, stage: 0, phase: 'set', restUntil: 0,
      plan: circuit.map(e => ({ id: e.id, name: e.data.name, slot: e.data.slot, stages: e.data.stages.slice(0, depth) })),
      best: Object.fromEntries(Object.entries(records(await sessionsInOrder())).map(([k, v]) => [k, v.reps])),
      sets: [], cur: null, repTimes: [], ghost: ghost?.data.repTimes || null,
    };
    await db.setMeta(runKey(), run);
    openRunner(run);
  } finally { starting = false; }
}

const lastActivity = run => run.startedAt + (run.repTimes.length ? run.repTimes[run.repTimes.length - 1] * 1000 : 0);

export async function resumeRun() {
  const run = await db.getMeta(runKey());
  if (!run || document.getElementById('runner')) return;
  const idle = Date.now() - lastActivity(run);
  if (idle > STALE_MS) {
    const when = new Date(run.startedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: profile().tz || 'America/New_York' });
    const choice = await ask('Unfinished workout', `You started a workout on ${esc(when)} and didn't finish it.`,
      [{ label: 'Save it as it was', value: 'save' }, { label: 'Keep going', value: 'resume' }, { label: 'Discard it', value: 'discard' }]);
    if (choice === 'save') return saveRun(run, lastActivity(run));
    if (choice === 'discard') { await db.setMeta(runKey(), null); return; }
    if (choice !== 'resume') return;
  }
  openRunner(run);
}

async function saveRun(run, endedAt) {
  if (run.cur && run.cur.stages.some(s => s.reps)) run.sets.push(run.cur);
  run.cur = null;
  if (run.sets.length) {
    await saveEntry('session', { gravity: run.gravity, startedAt: run.startedAt, endedAt, sets: run.sets, repTimes: run.repTimes },
      { ts: run.startedAt, day: dayKey(run.startedAt, profile().dayEndsAt, profile().tz) });
  }
  await db.setMeta(runKey(), null);
  const reps = run.sets.reduce((a, s) => a + s.stages.reduce((b, x) => b + x.reps, 0), 0);
  toast(run.sets.length ? `Saved · ${reps} reps in ${Math.max(1, round((endedAt - run.startedAt) / 60000))} min` : 'Nothing logged, so nothing saved');
  window.goku.render();
}

function openRunner(run) {
  window.goku.busy = true;
  keepAwake(true);
  const { el, close } = overlay(`
    <div class="row">
      <button class="cta2" id="undo" aria-label="Undo">Undo</button>
      <span class="num sub" id="clock">00:00</span>
      <button class="cta2" id="end">Finish</button>
    </div>
    <p class="sub" id="where" style="text-align:center;margin-top:8px"></p>
    <p class="devstat" id="dev" aria-live="polite"></p>
    <button class="tap" id="tap"><span>
      <span class="lbl" id="stage"></span>
      <span class="reps num" id="reps" aria-live="polite">0</span>
      <span class="sub" id="ex"></span></span></button>
    <div class="ghost" id="ghost"></div>
    <button class="cta" id="next" style="margin-top:12px"></button>`, { label: 'Session in progress', id: 'runner' });
  const $ = s => el.querySelector(s);

  // Every change is written straight away; a failed write is retried once and reported.
  let saving = Promise.resolve();
  const save = () => {
    const snap = structuredClone(run);
    saving = saving.then(() => db.setMeta(runKey(), snap)).catch(() =>
      db.setMeta(runKey(), snap).catch(() => toast("Couldn't save your last reps. Keep the app open and finish the set.")));
    return saving;
  };

  // Undo walks back through reps, stage drops and finished sets alike.
  const history = [];
  const remember = () => { history.push(structuredClone({ sets: run.sets, cur: run.cur, round: run.round, ex: run.ex, stage: run.stage, phase: run.phase, restUntil: run.restUntil, reps: run.repTimes.length })); if (history.length > 60) history.shift(); };
  const undo = () => {
    const h = history.pop(); if (!h) return;
    Object.assign(run, { sets: h.sets, cur: h.cur, round: h.round, ex: h.ex, stage: h.stage, phase: h.phase, restUntil: h.restUntil });
    run.repTimes.length = h.reps;
    bookRestCue(); save(); draw();
  };

  const curEx = () => run.plan[run.ex];
  function ensureSet() {
    if (!run.cur) run.cur = { exId: curEx().id, name: curEx().name, slot: curEx().slot, round: run.round,
      stages: curEx().stages.map(s => ({ label: s.label, load: s.load, reps: 0 })) };
  }
  const total = () => run.sets.reduce((a, s) => a + s.stages.reduce((b, x) => b + x.reps, 0), 0) +
    (run.cur ? run.cur.stages.reduce((b, x) => b + x.reps, 0) : 0);

  let restBeeped = false, said10 = false, capBeeped = false;
  // The rest-over cue is booked on the audio clock when rest starts; cancel it if rest ends early.
  let cancelCue = null;
  const bookRestCue = () => {
    cancelCue?.(); cancelCue = null;
    const left = run.restUntil - Date.now();
    if (run.phase === 'rest' && left > 0) { unlockAudio(); if (soundReady()) cancelCue = beep(988, 180, 2, left / 1000); }
  };
  const p = profile();
  let lastDev = '';
  function devStatus() {
    const screen = !('wakeLock' in navigator) ? 'Screen may sleep (not supported here)' : awake() ? 'Screen stays on' : 'Screen may sleep';
    const sound = p.settings.sound === false ? 'Sound off in Settings' : soundReady() ? 'Sound on' : 'Tap once to turn sound on';
    const txt = screen + ' · ' + sound;
    if (txt !== lastDev) {
      lastDev = txt;
      $('#dev').textContent = txt;
      $('#dev').classList.toggle('warn', !awake() || (p.settings.sound !== false && !soundReady()));
    }
  }
  function draw() {
    devStatus();
    const t = Date.now() - run.startedAt;
    const capLeft = run.cap * 60000 - t;
    if (capLeft <= 0 && !capBeeped) { capBeeped = true; beep(660, 260, 2); announce('Time cap reached. Finish when you are ready.'); }
    $('#clock').textContent = clock(t) + (capLeft > 0 ? ' · cap ' + clock(capLeft) : ' · cap reached');
    $('#where').textContent = `Round ${run.round} of ${run.rounds} · exercise ${run.ex + 1} of ${run.plan.length}`;
    if (run.ghost) {
      const g = run.ghost.filter(x => x <= t / 1000).length;
      const diff = total() - g;
      $('#ghost').innerHTML = diff >= 0 ? `Ghost: you're <b class="num">${diff}</b> reps ahead` : `Ghost: <b class="num">${-diff}</b> reps behind`;
    } else $('#ghost').textContent = `No ×${run.gravity} ghost yet. This session sets the pace for next time.`;
    $('#undo').disabled = !history.length;

    if (run.phase === 'rest') {
      const left = run.restUntil - Date.now();
      $('#reps').setAttribute('aria-live', 'off');
      $('#stage').textContent = 'Rest · next: ' + curEx().name;
      $('#reps').textContent = clock(left);
      $('#ex').textContent = 'Breathe. Rest ends on its own.';
      $('#tap').setAttribute('aria-label', `Resting, ${Math.ceil(left / 1000)} seconds left`);
      $('#tap').classList.add('resting');
      $('#next').textContent = 'Skip rest';
      if (left <= 10000 && left > 0 && !said10) { said10 = true; announce('10 seconds of rest left'); }
      if (left <= 0) {
        if (!restBeeped) {
          const late = Date.now() - run.restUntil > 1000; // the booked cue may be stuck in suspended audio
          if (late) { cancelCue?.(); cancelCue = null; }
          if (!cancelCue) beep(988, 180, 2);
          cancelCue = null; restBeeped = true; announce('Rest over. ' + curEx().name);
        }
        run.phase = 'set'; save();
      }
      return;
    }
    restBeeped = false; said10 = false;
    ensureSet();
    const st = run.cur.stages[run.stage];
    $('#tap').classList.remove('resting');
    $('#reps').setAttribute('aria-live', 'polite');
    $('#stage').textContent = run.cur.stages.length > 1 ? `Stage ${run.stage + 1} of ${run.cur.stages.length} · ${st.label}` : st.label;
    $('#reps').textContent = st.reps;
    $('#ex').textContent = curEx().name + (st.load ? ` · ${weight(st.load, p)} ${weightUnit(p)}` : '');
    $('#tap').setAttribute('aria-label', `Add one rep. ${st.reps} so far`);
    $('#next').textContent = run.stage < run.cur.stages.length - 1 ? 'Drop to ' + run.cur.stages[run.stage + 1].label : 'Set done';
  }

  function endSet() {
    run.sets.push(run.cur); run.cur = null; run.stage = 0;
    run.ex++;
    if (run.ex >= run.plan.length) { run.ex = 0; run.round++; }
    if (run.round > run.rounds) return finish();
    run.phase = 'rest'; run.restUntil = Date.now() + run.rest * 1000;
    bookRestCue(); save(); draw();
  }

  let closed = false;
  async function finish(discard = false) {
    if (closed) return;
    closed = true;
    clearInterval(tick);
    document.removeEventListener('visibilitychange', onVisible);
    cancelCue?.();
    await saving;
    keepAwake(false); window.goku.busy = false;
    close();
    if (discard) { await db.setMeta(runKey(), null); window.goku.render(); }
    else await saveRun(run, run.repTimes.length ? lastActivity(run) : Date.now());
    window.goku.idle?.();
  }

  let lastNext = 0;
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b || closed) return;
    unlockAudio();
    if (b.id === 'tap') {
      if (run.phase === 'rest') return; // a stray rep-tap never skips rest
      remember(); ensureSet();
      run.cur.stages[run.stage].reps++;
      const key = run.cur.exId + '|' + run.cur.stages[run.stage].label, prev = run.best?.[key] || 0;
      if (prev && run.cur.stages[run.stage].reps === prev + 1) { toast(`⚡ New power level record: ${run.cur.stages[run.stage].reps} reps`); beep(1320, 120, 1); }
      if (run.best && run.cur.stages[run.stage].reps > prev) run.best[key] = run.cur.stages[run.stage].reps; // later rounds race the new record
      run.repTimes.push(Math.round((Date.now() - run.startedAt) / 100) / 10);
      buzz();
      b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 120);
      draw(); save();
    } else if (b.id === 'undo') undo();
    else if (b.id === 'next') {
      if (Date.now() - lastNext < 600) return; // double-tap protection
      lastNext = Date.now();
      remember();
      if (run.phase === 'rest') { run.phase = 'set'; cancelCue?.(); cancelCue = null; save(); draw(); return; }
      if (run.stage < run.cur.stages.length - 1) { run.stage++; save(); draw(); } else endSet();
    } else if (b.id === 'end') {
      const r = await ask('Finish session?', 'Everything logged so far is saved.', [{ label: 'Finish and save', value: 'save' }, { label: 'Discard session', value: 'discard' }]);
      if (r === 'save') finish();
      else if (r === 'discard' && await ask('Discard this session?', 'The reps you logged in it will be deleted.', [{ label: 'Discard', value: true, danger: true }])) finish(true);
    }
  });
  const tick = setInterval(draw, 250);
  const onVisible = () => { if (document.visibilityState === 'visible') bookRestCue(); };
  document.addEventListener('visibilitychange', onVisible);
  bookRestCue();
  draw();
}

// ---------- Library ----------
export async function libraryView() {
  const p = profile();
  const lib = await library();
  const best = records(await sessionsInOrder());
  const groups = {};
  for (const e of lib) (groups[e.data.slot] ||= []).push(e);
  const pr = e => e.data.stages.map(st => [st.label, recordFor(best, e.id, st.label)]).filter(([, r]) => r);
  return {
    cta: ['Add exercise', () => editExercise()],
    html: `<h1>Library</h1><p class="sub">Each exercise has a drop chain, hardest first. Circuits pick one per group. ⚡ marks your power level record: the most reps in one set.</p>
      ${Object.entries(groups).map(([slot, list]) => `<section class="card" style="margin-top:12px">
        <p class="lbl">${esc(slot)}</p><ul class="list">${list.map(e => `<li><span>${esc(e.data.name)}<br>
        <span class="chain">${e.data.stages.map(s => esc(s.label) + (s.load ? ` (${esc(weight(s.load, p))} ${weightUnit(p)})` : '')).join(' → ')}</span>
        ${pr(e).length ? `<br><span class="chain pr">⚡ ${pr(e).map(([l, r]) => `${esc(l)} ${r}`).join(' · ')}</span>` : ''}</span>
        <button class="cta2" data-edit="${esc(e.id)}">Edit</button></li>`).join('')}</ul></section>`).join('')}`,
    bind(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-edit]');
        if (b) editExercise(lib.find(x => x.id === b.dataset.edit));
      });
    },
  };
}

// Dumbbell steps in the person's own units; the stored step snaps to the nearest one shown.
const stepOptions = p => weightUnit(p) === 'kg' ? [1, 2, 2.5, 5] : [2.5, 5, 10];
const stepShown = p => { const v = weight(p.settings.dbStep || 5, p); return stepOptions(p).reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a); };

function editExercise(ex) {
  const p = profile();
  const d = ex ? structuredClone(ex.data) : { name: '', slot: 'push', module: null, order: 999, stages: [{ label: '', load: null }] };
  const { el, close } = overlay(`<div class="row"><h1>${ex ? 'Edit exercise' : 'New exercise'}</h1><button class="cta2" id="x" data-close>Close</button></div>
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
        <input data-i="${i}" data-k="load" value="${esc(weight(s.load, p))}" inputmode="decimal" placeholder="${weightUnit(p)}" aria-label="Stage ${i + 1} load in ${weightUnit(p) === 'kg' ? 'kilograms' : 'pounds'}" style="width:80px">
        <button class="cta2" data-rm="${i}" aria-label="Remove stage ${i + 1}">−</button></div>`).join('')}
      <button class="cta2" id="add" style="margin-top:8px">Add stage</button>
      ${d.stages.some(s => s.load) ? `<div class="card" style="margin-top:14px"><p class="lbl">Dumbbell math</p>
        <p class="sub">Loads are per dumbbell. A pair of ${esc(weight(d.stages.find(s => s.load).load, p))} ${weightUnit(p)} is ${esc(weight(d.stages.find(s => s.load).load * 2, p))} ${weightUnit(p)} in total.</p>
        <label class="f"><span>Your dumbbells go up in steps of</span><select id="dbstep">${stepOptions(p).map(v =>
          `<option value="${v}" ${v === stepShown(p) ? 'selected' : ''}>${v} ${weightUnit(p)}</option>`).join('')}</select></label>
        <button class="cta2" id="stepUp" style="margin-top:8px">Add one step to every loaded stage</button></div>` : ''}`;
  }
  el.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'nm') d.name = t.value;
    if (t.dataset.k === 'label') d.stages[+t.dataset.i].label = t.value;
    if (t.dataset.k === 'load') d.stages[+t.dataset.i].load = toLb(t.value, p);
  });
  el.addEventListener('change', async e => {
    if (e.target.id === 'slot') d.slot = e.target.value;
    if (e.target.id === 'dbstep') { p.settings.dbStep = toLb(e.target.value, p); await saveProfile(p); }
  });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') close();
    if (b.id === 'add') { d.stages.push({ label: '', load: null }); draw(); }
    if (b.id === 'stepUp') { const step = toLb(stepShown(p), p); d.stages.forEach(s => { if (s.load) s.load = round(s.load + step, 3); }); draw(); toast('Loads raised. Tap Save to keep them.'); }
    if (b.dataset.rm) { if (d.stages.length > 1) { d.stages.splice(+b.dataset.rm, 1); draw(); } }
    if (b.id === 'save') {
      d.stages = d.stages.filter(s => s.label.trim());
      if (!d.name.trim() || !d.stages.length) { $('#m').textContent = 'Add a name and at least one stage.'; return; }
      await saveEntry('exercise', d, ex ? { id: ex.id, day: ex.day, ts: ex.ts } : { day: '1970-01-01' });
      close(); window.goku.render();
    }
    if (b.id === 'del' && await ask('Delete this exercise?', 'Past sessions that used it keep their records.', [{ label: 'Delete', value: true, danger: true }])) {
      await deleteEntry(ex.id); close(); window.goku.render();
    }
  }));
  draw();
}

// ---------- Gut log (any day in the last 60) ----------
let gutDay = null, editPantry = false;
export const openGutDay = day => { gutDay = day; window.goku.go('gut'); };

export async function gutView() {
  const p = profile();
  const t = today();
  if (!gutDay || gutDay > t) gutDay = t;
  const day = gutDay;
  const id = p.id + ':gut:' + day;
  const saved = (await db.get('entries', id))?.data;
  const cur = saved || { amWaist: null, pmWaist: null, bloat: null, foods: [], fluidsOz: 0, supplements: [], protein: [] };
  const all = await entries('gut');
  const lastWaist = [...all].reverse().map(e => e.data.amWaist ?? e.data.pmWaist).find(v => v != null) ?? 34;
  const newestFirst = [...all].sort((a, b) => b.day.localeCompare(a.day));
  const recentFoods = [...new Set(newestFirst.flatMap(e => e.data.foods))].slice(0, 12);
  const recentSupps = [...new Set(newestFirst.flatMap(e => e.data.supplements))].slice(0, 8);
  const proteinTotal = cur.protein.reduce((a, b) => a + b, 0);
  const target = p.settings.proteinTarget;
  const save = () => saveEntry('gut', cur, { id, day });
  const tags = (key, recent) => `<div class="pills" style="margin-top:8px">${[...new Set([...recent, ...cur[key]])].map(tg =>
    `<button data-tag="${key}" data-v="${esc(tg)}" aria-pressed="${cur[key].includes(tg)}">${esc(tg)}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input data-new="${key}" placeholder="${key === 'foods' ? 'Add a food' : 'Add a capsule or supplement'}" aria-label="${key === 'foods' ? 'Add a food' : 'Add a capsule or supplement'}"><button class="cta2" data-add="${key}">Add</button></div>`;
  const perMeal = target && p.settings.proteinPer === 'meal';
  const range = fuelRanges(p, 0);
  const goal = target || range?.protein[0] || null; // one number: your own target, else the bottom of the coach range
  const pantry = p.settings.pantry || [];

  return {
    html: `<div class="row"><h1>Gut log</h1>${dayPicker(day, t, 'Gut log day')}</div>
    <div class="cols"><div>
      <section class="card" style="margin-top:12px"><p class="lbl">Bloating (0 = none, 10 = worst)</p>
        ${stepper('bloat', cur.bloat ?? 'none', 'bloating')}</section>
      <section class="card"><p class="lbl">Waist (${lengthUnit(p) === 'cm' ? 'centimeters' : 'inches'})</p>
        <div class="row"><span>Morning</span>${stepper('amWaist', length(cur.amWaist, p) ?? 'none', 'morning waist')}</div>
        <div class="row" style="margin-top:8px"><span>Evening</span>${stepper('pmWaist', length(cur.pmWaist, p) ?? 'none', 'evening waist')}</div>
        <p class="note">Steps of ${lengthUnit(p) === 'cm' ? '½ cm' : '¼ inch'}. Measure at the same spot each time.</p></section>
      <section class="card"><p class="lbl">Fluids</p>
        <div class="row"><span class="num big">${esc(volume(cur.fluidsOz, p))} <span class="sub">${volumeUnit(p)}</span></span>
        <span>${volumeSteps(p).map(([label, oz]) => `<button class="cta2" data-fl="${oz}">${label > 0 ? '+' : '−'}${Math.abs(label)}</button>`).join(' ')}</span></div></section>
    </div><div>
      <section class="card"><p class="lbl">Protein</p>
        <p class="big num">${esc(proteinTotal)} g${goal ? ` <span class="sub">${perMeal ? `target ${esc(target)} g per meal` : `of ${esc(goal)} g`}</span>` : ''}</p>
        ${goal && !perMeal ? `<div class="bar"><i style="width:${Math.min(100, proteinTotal / goal * 100)}%"></i></div>` : ''}
        ${range ? `<p class="sub" style="margin-top:6px">Coach range ${range.protein[0]}–${range.protein[1]} g${target && !perMeal
          ? (target < range.protein[0] ? ' · your target is below it' : target > range.protein[1] ? ' · your target is above it' : ' · your target sits inside it') : ''} ${whyBtn('protein', '0')}</p>` : ''}
        ${cur.protein.length ? `<p class="sub" style="margin-top:6px">Meals: ${cur.protein.map(g => esc(g) + ' g' + (perMeal ? (g >= target ? ' ✓' : '') : '')).join(' · ')}</p>` : ''}
        <div class="seg">${[10, 20, 30, 40, 50].map(g => `<button data-pr="${g}">+${g}</button>`).join('')}</div>
        ${cur.protein.length ? '<button class="link" id="prUndo">Undo last</button>' : ''}
        <p class="lbl" style="margin-top:14px">Capsule pantry · one tap</p>
        ${pantry.length ? `<div class="pantry">${pantry.map((f, i) => `<button class="cta2" data-pan="${i}" aria-label="${editPantry ? 'Remove' : 'Add'} ${esc(f.n)}, ${esc(f.g)} grams of protein">${editPantry ? '✕ ' : ''}${esc(f.n)} · ${esc(f.g)} g</button>`).join('')}</div>
          <button class="link" id="panEdit">${editPantry ? 'Done removing' : 'Remove foods'}</button>`
          : '<p class="sub">Save foods you eat often with their protein. Then one tap logs both.</p>'}
        <div class="row" style="margin-top:8px;gap:6px"><input id="panName" placeholder="Food, e.g. Greek yogurt" maxlength="40" aria-label="Food name">
          <input id="panG" inputmode="numeric" placeholder="g" aria-label="Protein grams" style="width:70px"><button class="cta2" id="panAdd">Save</button></div>
        ${!target && !range ? '<p class="note">Add your weight in Settings → About you for a protein range.</p>' : ''}</section>
      <section class="card"><p class="lbl">Foods</p>${tags('foods', recentFoods)}<p class="voice">🎤 Tap the mic on your keyboard to say a food instead of typing.</p></section>
      <section class="card"><p class="lbl">Capsules and supplements</p>${tags('supplements', recentSupps)}</section>
      <section class="card"><p class="lbl">Pattern, not proof</p>
        <p class="sub">After 14 days of logs, this panel lists which foods and supplements show up most often on your high-bloating days. It's coming in a later update. You have ${all.length} day${all.length === 1 ? '' : 's'} logged.</p></section>
    </div></div>`,
    bind(root) {
      root.addEventListener('click', guard(async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.dayshift) { gutDay = addDays(day, +b.dataset.dayshift); if (gutDay < addDays(t, -60)) gutDay = addDays(t, -60); return window.goku.render(); }
        const st = b.closest('[data-step]');
        if (st && b.dataset.d) {
          const k = st.dataset.step, d = +b.dataset.d;
          if (k === 'bloat') cur.bloat = Math.min(10, Math.max(0, (cur.bloat ?? (d > 0 ? -1 : 1)) + d));
          else cur[k] = Math.max(15, round((cur[k] ?? (k === 'pmWaist' && cur.amWaist ? cur.amWaist : lastWaist)) + d * lengthStep(p), 3));
        } else if (b.dataset.fl) cur.fluidsOz = Math.max(0, round(cur.fluidsOz + +b.dataset.fl, 2));
        else if (b.dataset.pr) cur.protein.push(+b.dataset.pr);
        else if (b.dataset.pan !== undefined) {
          const f = pantry[+b.dataset.pan];
          if (editPantry) { pantry.splice(+b.dataset.pan, 1); p.settings.pantry = pantry; await saveProfile(p); return window.goku.render(); }
          if (f.g) cur.protein.push(f.g);
          const name = f.n.toLowerCase(); if (!cur.foods.includes(name)) cur.foods.push(name);
          toast(`${f.n} · ${f.g} g logged`);
        } else if (b.id === 'panEdit') { editPantry = !editPantry; return window.goku.render(); }
        else if (b.id === 'panAdd') {
          const n = root.querySelector('#panName').value.trim().slice(0, 40), g = Math.round(+root.querySelector('#panG').value.replace(/[^\d.]/g, ''));
          if (!n || !(g >= 0 && g <= 300)) return toast('Add a food name and its grams of protein');
          p.settings.pantry = [...pantry.filter(x => x.n.toLowerCase() !== n.toLowerCase()), { n, g }].slice(-40);
          await saveProfile(p); toast('Saved to your pantry'); return window.goku.render();
        }
        else if (b.id === 'prUndo') cur.protein.pop();
        else if (b.dataset.tag) {
          const k = b.dataset.tag, v = b.dataset.v;
          cur[k] = cur[k].includes(v) ? cur[k].filter(x => x !== v) : [...cur[k], v];
        } else if (b.dataset.add) {
          const inp = root.querySelector(`[data-new="${b.dataset.add}"]`);
          const v = inp.value.trim().toLowerCase().slice(0, 40);
          if (!v) return;
          if (!cur[b.dataset.add].includes(v)) cur[b.dataset.add].push(v);
        } else return;
        await save(); window.goku.render();
      }));
      root.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.dataset.new) root.querySelector(`[data-add="${e.target.dataset.new}"]`).click();
      });
    },
  };
}

// ---------- History ----------
export async function historyView() {
  const sessions = (await sessionsInOrder()).reverse();
  const guts = (await entries('gut')).reverse();
  const acts = (await entries('activity')).sort((a, b) => b.day.localeCompare(a.day));
  const p = profile();
  return {
    html: `<h1>History</h1>
      <div style="margin-top:12px">${ballsCard(milestones(p, await loggedEntries(p), today()))}</div>
      <section class="card"><p class="lbl">Sessions</p>
      ${sessions.length ? `<ul class="list">${sessions.map(s => `<li><span>${prettyDay(s.day)} · ×${esc(s.data.gravity)}<br>
        <span class="chain">${s.data.sets.length} sets · ${round(minutes(s))} min</span></span>
        <span class="row" style="gap:8px"><span class="num">${sessionTotal(s)} reps</span>
        <button class="cta2" data-edit="${esc(s.id)}" aria-label="Edit session from ${prettyDay(s.day)}">Edit</button></span></li>`).join('')}</ul>`
        : '<div class="empty"><h2>No sessions yet</h2><p>Enter the chamber from Home. Each finished session lands here and becomes your next ghost.</p></div>'}
      </section>
      ${on(profile(), 'gut') ? `<section class="card"><p class="lbl">Gut log days</p>
      ${guts.length ? `<ul class="list">${guts.map(g => `<li><span>${prettyDay(g.day)}<br><span class="chain">bloat ${esc(g.data.bloat ?? '—')} · ${g.data.protein.reduce((a, b) => a + b, 0)} g protein</span></span>
        <button class="cta2" data-gut="${esc(g.day)}" aria-label="Open gut log for ${prettyDay(g.day)}">Open</button></li>`).join('')}</ul>`
        : '<div class="empty"><p>Log bloating, waist and food in the Gut tab.</p></div>'}</section>` : ''}
      <section class="card"><p class="lbl">Other training</p>
      ${acts.length ? `<ul class="list">${activityRows(acts.slice(0, 60))}</ul>` : '<div class="empty"><p>Log soccer, runs and other training from Home.</p></div>'}</section>
      <p class="note">Power level records are in the Library. Your training trend is on Home.</p>`,
    bind(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.edit) editSession(sessions.find(s => s.id === b.dataset.edit));
        if (b.dataset.gut) openGutDay(b.dataset.gut);
        if (b.dataset.act) editActivityById(b.dataset.act);
      });
    },
  };
}

function editSession(s) {
  const d = structuredClone(s.data);
  let day = s.day;
  const { el, close } = overlay(`<div class="row"><h1>Edit session</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="f"></div>
    <button class="cta" id="save">Save changes</button>
    <button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete session</button>`, { label: 'Edit session' });
  const draw = () => {
    el.querySelector('#f').innerHTML = `<div class="row" style="margin:8px 0"><span class="lbl" style="margin:0">Date</span>${dayPicker(day, today(), 'Session date')}</div>
      ${d.sets.map((set, i) => `<section class="card"><div class="row"><h2>${esc(set.name)} · round ${esc(set.round)}</h2>
        <button class="cta2" data-rmset="${i}" aria-label="Remove this set">Remove</button></div>
        ${set.stages.map((st, j) => `<div class="row" style="margin-top:6px"><span>${esc(st.label)}</span>${stepper(i + ':' + j, st.reps, 'reps for ' + st.label)}</div>`).join('')}</section>`).join('')
        || '<p class="sub">No sets left. Save to keep an empty session, or delete it.</p>'}`;
  };
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.dayshift) { const nd = addDays(day, +b.dataset.dayshift); if (nd <= today()) day = nd; return draw(); }
    if (b.dataset.rmset) { d.sets.splice(+b.dataset.rmset, 1); return draw(); }
    if (b.dataset.d) {
      const [i, j] = b.closest('[data-step]').dataset.step.split(':').map(Number);
      d.sets[i].stages[j].reps = Math.max(0, d.sets[i].stages[j].reps + +b.dataset.d);
      b.closest('[data-step]').querySelector('.num').textContent = d.sets[i].stages[j].reps;
      return;
    }
    if (b.id === 'save') {
      const reps = d.sets.reduce((a, set) => a + set.stages.reduce((x, st) => x + st.reps, 0), 0);
      if (reps !== d.repTimes.length) {
        const secs = Math.max(60, (d.endedAt - d.startedAt) / 1000);
        d.repTimes = Array.from({ length: reps }, (_, i) => round((i + 1) * secs / reps, 1));
      }
      await saveEntry('session', d, { id: s.id, day, ts: s.ts }); close(); toast('Session updated'); window.goku.render(); }
    if (b.id === 'del' && await ask('Delete this session?', 'It will be removed from history and from your ghost.', [{ label: 'Delete', value: true, danger: true }])) {
      await deleteEntry(s.id); close(); window.goku.render();
    }
  }));
  draw();
}
