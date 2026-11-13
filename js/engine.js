// "Density Engine" profile: gravity-chamber circuits, rep counter, exercise library.
import { w, W } from './skins.js';
import { profile, saveProfile, entries, saveEntry, deleteEntry, today, on } from './state.js';
import * as db from './db.js';
import { discardGuard, esc, toast, ask, overlay, stepper, unlockAudio, beep, soundReady, awake, keepAwake, round, guard, announce, dayPicker } from './ui.js';
import { clock, prettyDay, weekStart, addDays, dayKey } from './time.js';
import { metric, weight, weightUnit, toLb, length, lengthUnit, lengthStep, volume, volumeUnit, volumeSteps } from './units.js';
import { coachCard, bindCoach, isMinor } from './coach.js';
import { fuelCard, fuelRanges, timingCard, fuelNowCard } from './fuel.js';
import { logActivity, minutesOf, activityRows, editActivityById } from './activity.js';
import { loggedEntries, records, recordFor, progression, GROUPS, liftHistory } from './insights.js';
import { openNutritionDay, nutritionDays, dayTotals } from './nutrition.js';
import { streakCard, recapCard, bindShared, riskCard, kiGauge } from './homecards.js';
import { trendCard } from './trend.js';
import { weightCard, bindWeight, syncWeigh, weightOn } from './weight.js';
import { scouterCard } from './scouter.js';
import { sagaCard, bindSaga, arcsOf } from './saga.js';
import { homeLayout, bindRows } from './homelayout.js';
import { pickMove, showMove, howBtn, moveFor, addMove, moveData } from './movepicker.js';
import { GROUPS as MOVE_GROUPS } from './moves.js';
import { figureSVG } from './figure.js';
import { planId, onHold, trainOff, starterOn, starterSets, moveGoal, holdCard, moveCard, starterCard, starterReady, comebackNote, MOVE_TARGET, MOVE_STEP } from './plan.js';
import { artOf, miniMap, musclesReady, bodyWork, bodyMapCard, bindBodyMap } from './muscles.js';
import { calendarCard, bindCalendar } from './calendar.js';
import { duelCard } from './duel.js';
import { milestones, ballsCard, newBallsCard, bindBalls, wishCard, bindWish } from './milestones.js';
import { whyBtn } from './why.js';
import { compareCard, feelGrid } from './compare.js';

export const tabs = p => [['home', 'Home'], ...(trainOff(p) ? [] : [['library', 'Library']]), // no Library on Food Only, or while workouts wait for a doctor's OK (2.18)
  ...(on(p, 'nutrition') ? [['nutrition', 'Nutrition']] : []), ['history', 'History'], ['settings', 'Settings'], ['saga', W('saga'), 'hidden']];

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
  ['Playset pull-up', 'pull', ['strict', 'slow negatives', 'jumping'], null, 'bar'],
  ['TRX pistol', 'legs', ['low assist', 'high assist'], null, 'trx'],
  ['TRX knee tuck', 'core', ['pike', 'knee tuck'], null, 'trx'],
  ['TRX chest press', 'push', ['steep', 'mid', 'shallow'], null, 'trx'],
  ['DB row', 'pull', ['heavy', 'medium', 'light'], null, 'db'],
  ['DB reverse lunge', 'legs', ['heavy', 'light', 'bodyweight'], null, 'db'],
  ['Pike pushup', 'push', ['feet raised', 'floor', 'kneeling'], null, 'bw'],
  ['Prone Y-T-W raise', 'pull', ['slow 3-second hold', 'standard'], null, 'bw'],
  ['Bodyweight squat', 'legs', ['tempo squat', 'squat', 'chair squat'], null, 'bw'],
  ['Split squat', 'legs', ['rear foot raised', 'split squat', 'hand-assisted'], null, 'bw'],
  ['Dead bug', 'core', ['straight legs', 'bent knees'], null, 'bw'],
  ['Broad jump', 'power', ['quality reps only'], 'soccer', 'bw'],
  ['Copenhagen plank', 'joints', ['long lever', 'short lever'], 'soccer', 'bw'],
  // 2.8: gym starters, kept only for people who have the machines
  ['Machine chest press', 'push', ['heavy', 'medium', 'light'], null, 'machine'],
  ['Lat pulldown', 'pull', ['heavy', 'medium', 'light'], null, 'cable'],
  ['Seated cable row', 'pull', ['heavy', 'medium', 'light'], null, 'cable'],
  ['Leg press', 'legs', ['heavy', 'medium', 'light'], null, 'machine'],
  ['Cable crunch', 'core', ['heavy', 'medium', 'light'], null, 'cable'],
];

const byOrder = (a, b) => (a.data.order ?? 999) - (b.data.order ?? 999) || a.data.name.localeCompare(b.data.name);

export async function library() {
  let lib = await entries('exercise');
  if (!lib.length && !(await db.getMeta('seeded:' + profile().id))) {
    const eq = profile().about?.equipment; // unanswered: everything
    const keep = SEED.filter(x => eq ? x[4] === 'bw' || eq.includes(x[4]) : !['machine', 'cable'].includes(x[4])); // unanswered: everything a home might have
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
const ghostFor = (sessions, g) => sessions.filter(s => s.data.gravity === g && !s.data.starter).pop() || null; // a Starter workout has no clock, so it's never a ghost

const sessionTotal = s => s.data.sets.reduce((a, set) => a + set.stages.reduce((b, st) => b + st.reps, 0), 0);
const minutes = s => Math.max(1, (s.data.endedAt - s.data.startedAt) / 60000);

// Sleep: the last 7 nights imported from Health if there are any, else the coach answer.
async function recentSleep(p) {
  const nights = (await entries('sleep')).filter(e => e.day >= addDays(today(), -6) && e.data.hours > 0);
  return nights.length ? round(nights.reduce((a, e) => a + e.data.hours, 0) / nights.length, 1) : p.about?.sleepH || null;
}

// ---------- Home ----------
// The tab bar's center button on screens without their own action: start today's circuit.
export async function mainAction() {
  const p = profile();
  if (trainOff(p)) return null;
  const circuit = await todaysCircuit();
  if (starterOn(p)) return circuit.length ? ['Train', () => startRun(circuit, { starter: true })] : null;
  return circuit.length ? ['Train', () => trainByFeel(circuit)] : null;
}

// Today's Workout (2.9, review 5): the level in plain words, then Start Workout. The ki question is gone.
// Levels map one-to-one to the old gravity numbers, so saved sessions, ghosts and records keep working.
export const LEVEL = { 10: 'Easy', 20: 'Medium', 50: 'Hard', 100: 'Max' };
export const lvl = g => LEVEL[g] || LEVEL[50];
const depthText = d => d === 1 ? 'one stage per set' : d === 2 ? 'each set to failure, one drop' : 'each set to failure, then drops';
const capText = (rounds, rest, cap) => `${rounds} rounds · ${rest} s rest · <span class="nw">up to ${cap} min</span>`;
export async function trainByFeel(circuit) {
  const p = profile(), levels = [10, 20, 50, 100];
  const sessions = await sessionsInOrder(), last = lastOf(sessions);
  let g = p.settings.gravity || 50;
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Today's workout</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="tf"></div>
    <button class="cta" id="go">Start workout</button>`, { label: "Today's workout" });
  const draw = () => {
    const [rounds, rest, cap, depth] = GRAVITY[g], ghost = ghostFor(sessions, g);
    // 2.16 (review 10): the level on top with one line about it, then the moves with last time's reps, so you know what you're about to do and what to beat.
    const moveRow = e => { const st = e.data.stages.slice(0, depth), got = st.map(x => last[e.id + '|' + x.label]?.reps).filter(Boolean);
      return `<li><span><b data-raw>${esc(e.data.name)}</b><br><span class="chain" data-raw>${got.length ? `Last time ${got.join(', ')} · beat ${got[0]}` : esc(st.map(x => x.label).join(' → ')) || 'New for you'}</span></span></li>`; };
    el.querySelector('#tf').innerHTML = `<div class="seg grav" role="group" aria-label="Level" style="margin-top:8px">${levels.map(x => `<button data-lv="${x}" aria-pressed="${x === g}">${lvl(x)}</button>`).join('')}</div>
      <p class="sub" style="text-align:center;margin-top:8px" data-raw>${lvl(g)}: ${capText(rounds, rest, cap)} · ${depthText(depth)}</p>
      <section class="card" style="margin-top:10px"><p class="lbl">${p.settings.shuffleSeed ? 'Shuffled circuit' : 'Density circuit'} <span class="sub" data-raw>· ${circuit.length} move${circuit.length === 1 ? '' : 's'}</span></p>
        <ul class="list">${circuit.map(moveRow).join('')}</ul></section>
      <p class="sub" style="text-align:center;margin-top:10px" data-raw>${ghost ? `Ghost to beat: ${sessionTotal(ghost)} reps in ${Math.round(minutes(ghost))} min on ${prettyDay(ghost.day)}.` : `Your first ${lvl(g)} workout sets the reps to beat.`}</p>`;
  };
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.lv) { g = +b.dataset.lv; return draw(); }
    if (b.id === 'go') { if (g !== p.settings.gravity) { p.settings.gravity = g; await saveProfile(p); } close(); await startRun(circuit); }
  }));
  draw();
}

export async function home() {
  const p = profile();
  const g = p.settings.gravity || 50;
  const [rounds, rest, cap, depth] = GRAVITY[g];
  const circuit = await todaysCircuit();
  // The circuit cards and body map draw from the muscle drawing. Home no longer waits for it (2.15): if it isn't loaded yet, it loads in the background and Home redraws once.
  if (!document.getElementById('musbody')) musclesReady().then(() => { if (!window.goku.busy && !document.querySelector('.overlay')) window.goku.render(); }).catch(() => {});
  // One read of the log feeds every card below.
  const all = (await loggedEntries(p)).sort((a, b) => a.ts - b.ts);
  await syncWeigh(p, await entries('weigh', p)); // a weight from setup or the coach becomes a weigh-in
  const weighs = weightOn(p) ? await entries('weigh', p) : [];
  const sessions = all.filter(e => e.type === 'session').sort(byDay);
  const last = sessions[sessions.length - 1];
  // Same As Last Time (2.8.2): the last session's moves in their order, those still in the Library.
  const libNow = await library(), lastIds = last ? [...new Set((last.data.sets || []).map(x => x.exId))] : [];
  const lastCircuit = lastIds.map(id => libNow.find(e => e.id === id)).filter(Boolean);
  const ghost = ghostFor(sessions, g);
  const eaten = on(p, 'nutrition') ? await dayTotals(p, today()) : null;
  // Small trend lines in the Stats tiles (2.10, review 7): the last 8 workouts' pace, and the last 7 days' calories.
  const paces = sessions.slice(-8).map(s => round(sessionTotal(s) / Math.max(minutes(s), 0.1), 1));
  const week = eaten ? await Promise.all([6, 5, 4, 3, 2, 1, 0].map(n => dayTotals(p, addDays(today(), -n)))) : [];
  const done = week.slice(0, 6).filter(d => d.n), kcalAvg = done.length ? Math.round(done.reduce((a, d) => a + d.kcal, 0) / done.length) : null;
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
  // Minutes actually trained today: finished circuits plus other training.
  const duel = await duelCard(p, t);
  const arcs = await arcsOf(p);
  // Today's circuits as actually trained; before the first one, the planned circuit stands in.
  const sessMin = Math.round(sessions.filter(s => s.day === t).reduce((a, s) => a + minutes(s), 0));
  const trainedToday = Math.round(sessions.filter(s => s.day === t).reduce((a, s) => a + minutes(s), 0) + minutesOf(todayActs));
  const libAll = await library(), exMove = Object.fromEntries(libAll.map(e => [e.id, moveFor(e.data)?.id || null]));
  const body = bodyWork(sessions.filter(s => s.day >= addDays(t, -6)), allActs.filter(a => a.day >= addDays(t, -6)), id => exMove[id] || null, t, weekStart(t));
  const prog = progression(sessions, g);
  const showProg = prog && p.coach?.progSeen !== prog.latest.id && !(fresh && feel.v === 'hard');
  const nextG = levels[levels.indexOf(g) + 1];
  const coachHTML = coachCard(p, ctx);
  const weekMin = sessions.filter(s => s.day >= wk).reduce((a, s) => a + minutes(s), 0) + minutesOf(allActs.filter(a => a.day >= wk)); // Move More counts workouts and anything logged
  // This week at a glance (2.16, review 10): Sunday to Saturday. Trained, rest, today, still to come. A tap opens History.
  const trainedDays = new Set(all.filter(e => e.type === 'session' || e.type === 'activity').map(e => e.day)), restDays = new Set(all.filter(e => e.type === 'rest').map(e => e.day));
  const weekRow = `<button class="wkrow" data-go="history" aria-label="This week: ${[0, 1, 2, 3, 4, 5, 6].filter(i => trainedDays.has(addDays(wk, i))).length} training days so far. Open History">${[0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(wk, i);
    return `<span>${'SMTWTFS'[i]}<i class="${trainedDays.has(d) ? 'done' : restDays.has(d) ? 'rest' : ''}${d === t ? ' now' : ''}"></i></span>`; }).join('')}</button>`;

  return {
    cta: circuit.length ? [W('enter'), () => trainByFeel(circuit)] : null, ctaShown: true, // Enter the chamber is on the page already
    html: homeLayout(p, [
      ['balls', `${newBallsCard(p, milestones(p, all, t))}`],
      ['wish', wishCard(p, milestones(p, all, t))],
      ['recap', `${recapCard(p, all, t)}`],
      ['coach', coachHTML],
      ['levelup', `${showProg ? `<section class="card coachnote"><div class="row"><p class="lbl" style="margin:0">Level up</p>${whyBtn('progress', JSON.stringify(prog.reps))}</div>
      <p>You beat your ghost twice in a row at ${lvl(g)}: ${prog.reps.join(' → ')} reps.</p>
      <div class="row" style="margin-top:8px;justify-content:flex-start;gap:8px">${nextG ? `<button class="cta2" data-g="${nextG}" data-prog="${esc(prog.latest.id)}">Move up to ${lvl(nextG)}</button>` : ''}
      <button class="cta2" id="addLoad" data-prog="${esc(prog.latest.id)}">Add load to an exercise</button>
      <button class="link" data-prog="${esc(prog.latest.id)}" id="progLater">Stay here</button></div></section>` : ''}`],
      ['nudge', `${nudge && !showProg ? `<section class="card coach"><p class="lbl">Coach</p><p>Last week felt ${feel.v === 'easy' ? 'too easy' : 'too hard'}. Try ${lvl(nudge)}${feel.v === 'easy' ? ' to keep progressing' : ' while you recover'}.</p>
      <button class="cta2" data-g="${nudge}" style="margin-top:8px">Switch to ${lvl(nudge)}</button></section>` : ''}`],
      ['chamber', trainOff(p) ? (onHold(p) ? holdCard() : '') : (planId(p) === 'move' ? moveCard(p, weekMin) : '') + (starterOn(p) ? starterCard(p, circuit, sessions, weekCount) : `<section class="card chamber" aria-labelledby="h-today">
      <p class="lbl">Today's workout</p>
      <h1 id="h-today">${p.settings.shuffleSeed ? 'Shuffled circuit' : 'Density circuit'}</h1>
      <p class="sub">${lvl(g)} · ${circuit.length} move${circuit.length === 1 ? '' : 's'} · ${capText(rounds, rest, cap)}</p>
      ${p.about?.days ? `<p class="sub">This week: <b class="num">${weekCount}</b> of ${esc(p.about.days)} sessions${weekCount >= +p.about.days ? ' · goal met' : ''} ${whyBtn('weekgoal')}</p>` : ''}
      ${circuit.length ? `<button class="cta" id="enterChamber" style="margin-top:12px">${esc(W('enter'))}</button>` : ''}
      ${lastCircuit.length ? '<button class="cta2" id="sameLast" style="width:100%;margin-top:8px">Same As Last Time</button>' : ''}
      ${ghost ? `<div class="ghost">Ghost: your last ${lvl(g)} workout (${prettyDay(ghost.day)}) · <b class="num">${sessionTotal(ghost)}</b> reps in ${round(minutes(ghost))} min. Beat it.</div>`
        : `<div class="ghost">Your first ${lvl(g)} workout becomes your ghost. Next ${lvl(g)} workout, you race it live.</div>`}
      ${comebackNote(p, sessions, t)}
    </section>`)],
      ['circuit', trainOff(p) ? '' : `<section class="card">
      <div class="row"><h2>Circuit</h2>${on(p, 'shuffle') ? '<button class="cta2" id="shuffle">Shuffle</button>' : ''}</div>
      ${circuit.length ? `<ol class="fan" aria-label="Today's circuit, ${circuit.length} exercises">${circuit.map((e, i) => { const m = moveFor(e.data);
        // Fanned cards (2.3): a hand of exercise cards, each with its drawing and a "?" for how-to.
        return `<li class="fcard" style="--i:${i};--n:${circuit.length}"><span class="fnum num">${i + 1}</span>
          ${m ? `<span class="ffig${artOf(m.id) ? ' art' : ' mus'}" aria-hidden="true">${artOf(m.id) ? `<img src="${artOf(m.id).end}" alt="" loading="lazy">` : miniMap(m.id) || figureSVG(m.start)}</span>` : '<span class="ffig blank" aria-hidden="true"></span>'}
          <b>${esc(e.data.name)}</b><span class="chain">${e.data.stages.slice(0, depth).map(s => esc(s.label)).join(' → ')}</span>
          ${m ? howBtn(m.id, e.data.name) : ''}</li>`; }).join('')}</ol>`
        : '<div class="empty"><h2>Your library is empty</h2><p>Add exercises in the Library tab to build circuits.</p></div>'}
      ${p.about?.limits ? `<p class="note">Your notes: ${esc(p.about.limits)}. Swap or skip anything that hurts.</p>` : ''}
    </section>`],
      ['scouter', scouterCard(p, all, t)],
      ['duel', duel],
      ['streak', `${streakCard(p, all, t)}`],
      ['activity', `<section class="card"><div class="row"><p class="lbl" style="margin:0">Other training today</p><button class="cta2" id="logAct">Log activity</button></div>
      ${todayActs.length ? `<ul class="list">${activityRows(todayActs)}</ul>` : '<p class="sub">Soccer, runs, games or anything else. It feeds your fuel ranges and body map.</p>'}</section>`],
      ['senzu', bodyMapCard(body)],
      ['trend', `${trendCard(p, all, t)}`],
      ['compare', compareCard(p, all, weighs, t)],
      ['weight', weightCard(p, weighs, t)],
      ['feelgrid', on(p, 'nutrition') && on(p, 'gut') ? feelGrid(all.filter(e => e.type === 'gut'), t) : ''],
      ['stats', `<div class="grid">
      <section class="card"><p class="lbl">Last session</p>
        ${last ? `<p class="big num">${round(sessionTotal(last) / minutes(last), 1)}</p><p class="sub">reps per minute</p>` : '<p class="sub" style="margin-top:8px">No sessions yet</p>'}
        ${paces.length >= 2 ? `${spark(paces, 'Reps per minute, last ' + paces.length + ' workouts')}<p class="sub sparknote">Last ${paces.length} · ${paces.at(-1) === paces[0] ? 'steady' : (paces.at(-1) > paces[0] ? 'up ' : 'down ') + round(Math.abs(paces.at(-1) - paces[0]), 1)}</p>` : ''}</section>
      ${eaten ? `<section class="card"><p class="lbl">Food today</p>
        <p class="big num">${eaten.kcal}<span class="sub"> cal</span></p><p class="sub">${eaten.n ? `${eaten.p} g protein` : 'Nothing logged yet'}</p>
        ${week.filter(d => d.n).length >= 2 ? `${spark(week.map(d => d.n ? d.kcal : null), 'Calories, last 7 days')}<p class="sub sparknote">7 days${kcalAvg ? ` · avg ${kcalAvg.toLocaleString('en-US')}` : ''}</p>` : ''}</section>` : ''}
    </div>`],
      ['sleep', `${lowSleep ? `<section class="card"><p class="lbl">Recovery</p><p>You sleep about ${esc(sleepH)} hours. ${sleepMin === 8 ? 'Teens are advised to get 8–10' : 'Adults are advised to get 7 or more'}, and muscle grows during recovery.</p>
      <p class="note">Sleep: American Academy of Sleep Medicine ${sleepMin === 8 ? 'pediatric consensus, 2016' : 'and Sleep Research Society adult consensus, 2015'}.</p></section>` : ''}`],
      ['fuel', `${on(p, 'fuel') ? fuelCard(p, (sessMin || cap) + minutesOf(todayActs), { planned: sessMin ? 0 : cap }) : ''}`],
      ['timing', `${on(p, 'fuel') ? timingCard(p, trainedToday || cap, { open: trainedToday > 0 }) : ''}`],
      ['risk', riskCard(p, all, t)],
      ['fuelnow', on(p, 'fuel') ? fuelNowCard(p, { lastEnd: Math.max(0, ...[...sessions.filter(s => s.day === t), ...todayActs].map(e => e.ts)) }) : ''],
      ['saga', sagaCard(arcs, t, { sessions, weighs })],
      ['hardsets', `${on(p, 'hypertrophy') ? `<section class="card">
      <p class="lbl">Hard sets this week</p>
      ${GROUPS.filter(([id]) => SLOTS.includes(id) || sets[id]).map(([id, name]) => `<div class="row" style="margin-top:8px"><span>${name}</span><span class="num sub">${sets[id] || 0}</span></div>`).join('')}
      <p class="note">Each set taken to failure counts once, drops included.</p>
    </section>` : ''}`]
    ], { strip: kiGauge(p, all, t) + weekRow, rows: {
      coach: ['Coach', /coachSetup/.test(coachHTML) ? 'Make Goku yours · about 3 minutes' : 'One quick question'],
      circuit: ['Circuit', circuit.length ? circuit.map(e => e.data.name).join(' · ') : 'Your library is empty'],
      activity: ['Also today', todayActs.length ? `${Math.round(minutesOf(todayActs))} min logged` : 'Soccer, runs, games'],
      fuelnow: ['Fuel now'], fuel: ['Fuel', 'Ranges for today'] } }),
    bind(root) {
      bindRows(root);
      bindCoach(root, p, ctx, async x => { await saveProfile(x); window.goku.render(); });
      bindShared(root, p, t); bindBalls(root, p); bindSaga(root, arcs); bindWish(root, p); bindBodyMap(root); bindWeight(root, p, weighs);
      root.addEventListener('click', guard(async e => {
        const b = e.target.closest('button'); if (!b || b.closest('.coach')) return;
        if (b.dataset.prog) { p.coach = { ...(p.coach || {}), progSeen: b.dataset.prog }; if (!b.dataset.g) await saveProfile(p); }
        if (b.dataset.how) return showMove(b.dataset.how);
        if (b.dataset.nday) return openNutritionDay(b.dataset.nday); // the check-in grid on Stats
        if (b.id === 'enterChamber') return trainByFeel(circuit);
        // Starting points (2.18)
        if (b.id === 'startStarter') return startRun(circuit, { starter: true });
        if (b.id === 'logMove') return logActivity();
        if (b.id === 'cleared') { if (await ask('Cleared by your doctor?', 'Workouts turn on. Start gently, and stop if anything feels wrong.', [{ label: 'Yes, turn workouts on', value: true }])) { p.plan = { ...p.plan, hold: false }; await saveProfile(p); window.goku.render(); } return; }
        if (b.id === 'raiseMove') { p.plan = { ...p.plan, minGoal: Math.min(MOVE_TARGET, moveGoal(p) + MOVE_STEP) }; await saveProfile(p); toast(`Goal: ${moveGoal(p)} minutes a week`); return window.goku.render(); }
        if (b.id === 'moreSets') { if (starterSets(p) < 3) { p.plan = { ...p.plan, sets: starterSets(p) + 1 }; toast(`${starterSets(p)} sets from now on`); }
          else { p.plan = { ...p.plan, id: planId(p) === 'move' ? 'move' : 'comeback', workouts: 'circuit' }; p.settings.gravity = 10; toast('Timed circuits at Easy from now on'); }
          await saveProfile(p); return window.goku.render(); }
        if (b.id === 'stepUp') { p.settings.gravity = 20; p.plan = { ...p.plan, id: 'strength' }; await saveProfile(p); toast('Medium from now on'); return window.goku.render(); }
        if (b.id === 'sameLast') return trainByFeel(lastCircuit);
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
// A small trend line for a Stats tile; empty values (days with nothing logged) are skipped.
function spark(vals, label, w = 130, h = 34) {
  const pts = vals.map((v, i) => [i, v]).filter(([, v]) => v != null), ys = pts.map(([, v]) => v);
  const lo = Math.min(...ys), hi = Math.max(...ys), X = i => 4 + i * (w - 8) / Math.max(1, vals.length - 1), Y = v => h - 4 - (h - 8) * (hi === lo ? .5 : (v - lo) / (hi - lo));
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" role="img" aria-label="${esc(label)}"><polyline points="${pts.map(([i, v]) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/></svg>`;
}
// What you did last time (2.10, review 6): per exercise and stage, the best set of the most recent session that had it.
function lastOf(sessions) {
  const out = {};
  for (const s of sessions) {
    const seen = {};
    for (const set of s.data.sets || []) for (const st of set.stages || []) {
      const k = set.exId + '|' + st.label;
      if (st.reps > 0 && (!seen[k] || st.reps > seen[k].reps)) seen[k] = { reps: st.reps, load: st.load || null };
    }
    Object.assign(out, seen);
  }
  return out;
}
let starting = false;

async function startRun(circuit, { starter = false } = {}) {
  if (starting || window.goku.busy || document.getElementById('runner')) return;
  starting = true;
  try {
    unlockAudio();
    const p = profile();
    const g = starter ? 10 : p.settings.gravity || 50;
    const [rounds, rest, cap, depth] = starter ? [starterSets(p), 0, 0, 1] : GRAVITY[g];
    const past = await sessionsInOrder(), ghost = starter ? null : ghostFor(past, g);
    const run = {
      ...(starter ? { starter: true } : {}),
      startedAt: Date.now(), gravity: g, rounds, rest, cap, round: 1, ex: 0, stage: 0, phase: 'set', restUntil: 0,
      // A Starter workout uses each move's easiest version (the last stage of its chain: knees, chair squat), not the hardest.
      plan: circuit.map(e => ({ id: e.id, name: e.data.name, slot: e.data.slot, moveId: e.data.moveId, stages: starter ? e.data.stages.slice(-1) : e.data.stages.slice(0, depth), ...(e.data.rest ? { rest: e.data.rest } : {}) })),
      best: Object.fromEntries(Object.entries(records(await sessionsInOrder())).map(([k, v]) => [k, v.reps])),
      sets: [], cur: null, repTimes: [], ghost: ghost?.data.repTimes || null, last: lastOf(past),
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
    await saveEntry('session', { gravity: run.gravity, startedAt: run.startedAt, endedAt, sets: run.sets, repTimes: run.repTimes, ...(run.starter ? { starter: true } : {}) },
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
      <span class="endwrap"><button class="cta2 kame" id="end" aria-label="Finish: hold to finish"><span>Finish</span></button><small class="endhint" aria-hidden="true">Hold to finish</small></span>
    </div>
    <div class="rdots" id="rdots" aria-hidden="true"></div>
    <p class="sub" id="where" style="text-align:center;margin:0"></p>
    <p class="devstat" id="dev" aria-live="polite"></p>
    <button class="tap" id="tap"><span>
      <span class="exname" id="ex" data-raw></span>
      <span class="sub" id="stage" data-raw></span>
      <span class="reps num" id="reps" aria-live="polite">0</span>
      <span class="sub lastline" id="last" data-raw></span></span></button>
    <div class="wrow" id="wrow" role="group" aria-label="Weight for this stage">
      <button class="cta2" id="wDown" aria-label="Less weight">−</button><b class="num" id="wval"></b><button class="cta2" id="wUp" aria-label="More weight">+</button></div>
    <p class="sub plates" id="plates" data-raw></p>
    <div class="ghost" id="ghost"><div class="row grace" id="grace"><span><b>You</b> <span class="num" id="gyou">0</span></span><span>Ghost <span class="num" id="gghost">0</span></span></div>
      <div class="gbar" id="gbar" aria-hidden="true"><i id="gfill"></i><i class="gmark" id="gmark"></i></div><span id="gnote" data-raw></span></div>
    <div class="row runfoot"><button class="cta2" id="howEx" data-raw hidden>? How</button><button class="cta" id="next" data-raw></button></div>`, { label: 'Session in progress', id: 'runner' });
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
    if (h.load) { // a weight change is undone in the plan and the Library too, not only in this set
      const planned = run.plan.find(x => x.id === h.load.exId)?.stages.find(x => x.label === h.load.label); if (planned) planned.load = h.load.load;
      entries('exercise').then(list => { const ex = list.find(x => x.id === h.load.exId), own = ex?.data.stages.find(x => x.label === h.load.label);
        if (own) { own.load = h.load.load; return saveEntry('exercise', ex.data, { id: ex.id, day: ex.day, ts: ex.ts }); } }).catch(() => {});
    }
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
  // The screen redraws four times a second for the clock, so each line is written only when its text changes (2.16).
  const put = (sel, v) => { const n = $(sel); if (n.textContent !== v) n.textContent = v; };
  const attr = (sel, k, v) => { const n = $(sel); if (n.getAttribute(k) !== v) n.setAttribute(k, v); };
  let dotsFor = '';
  function draw() {
    devStatus();
    const t = Date.now() - run.startedAt;
    const capLeft = run.cap * 60000 - t;
    if (!run.starter && capLeft <= 0 && !capBeeped) { capBeeped = true; beep(660, 260, 2); announce('Time cap reached. Finish when you are ready.'); }
    put('#clock', run.starter ? clock(t) : clock(t) + (capLeft > 0 ? ' · cap ' + clock(capLeft) : ' · cap reached')); // a Starter workout has no time cap
    put('#where', run.starter ? `Set ${run.round} of ${run.rounds} · move ${run.ex + 1} of ${run.plan.length}` : `Round ${run.round} of ${run.rounds} · exercise ${run.ex + 1} of ${run.plan.length}`);
    const dk = run.round + '/' + run.rounds;
    if (dotsFor !== dk) { dotsFor = dk; $('#rdots').innerHTML = Array.from({ length: run.rounds }, (_, i) => `<i class="${i + 1 < run.round ? 'done' : i + 1 === run.round ? 'now' : ''}"></i>`).join(''); }
    // You against the ghost as a race bar (2.16, review 10): your reps fill it, a mark shows where the ghost was at this minute.
    if (run.starter) { if (!$('#ghost').hidden) $('#ghost').hidden = true; }
    else if (run.ghost) {
      const g = run.ghost.filter(x => x <= t / 1000).length, me = total(), most = Math.max(run.ghost.length, me, 1);
      put('#gyou', String(me)); put('#gghost', String(g)); put('#gnote', '');
      const fw = Math.round(me / most * 1000) / 10 + '%', gw = Math.round(g / most * 1000) / 10 + '%';
      if ($('#gfill').style.width !== fw) $('#gfill').style.width = fw;
      if ($('#gmark').style.left !== gw) $('#gmark').style.left = gw;
      attr('#ghost', 'aria-label', me >= g ? `You are ${me - g} reps ahead of your ghost` : `You are ${g - me} reps behind your ghost`);
    } else { $('#grace').hidden = true; $('#gbar').hidden = true; put('#gnote', `No ${lvl(run.gravity)} ghost yet. This workout sets the pace for next time.`); }
    $('#undo').disabled = !history.length;

    if (run.phase === 'rest') {
      const left = run.restUntil - Date.now();
      attr('#reps', 'aria-live', 'off');
      put('#ex', 'Rest'); put('#stage', 'Next: ' + curEx().name);
      put('#reps', String(clock(left)));
      $('#wrow').hidden = true; put('#last', run.recNote ? run.recNote + '. Rest ends on its own.' : 'Breathe. Rest ends on its own.'); put('#plates', '');
      { const how = moveFor(curEx()); $('#howEx').hidden = !how; if (how) attr('#howEx', 'aria-label', `How to do the next exercise, ${curEx().name}`); }
      attr('#tap', 'aria-label', `Resting, ${Math.ceil(left / 1000)} seconds left`);
      $('#tap').classList.add('resting');
      put('#next', String('Skip Rest'));
      if (left <= 10000 && left > 0 && !said10) { said10 = true; announce('10 seconds of rest left'); }
      if (left <= 0) {
        if (!restBeeped) {
          const late = Date.now() - run.restUntil > 1000; // the booked cue may be stuck in suspended audio
          if (late) { cancelCue?.(); cancelCue = null; }
          if (!cancelCue) beep(988, 180, 2);
          cancelCue = null; restBeeped = true; announce('Rest over. ' + curEx().name);
        }
        run.phase = 'set'; run.recNote = ''; save();
      }
      return;
    }
    restBeeped = false; said10 = false;
    ensureSet();
    const st = run.cur.stages[run.stage];
    $('#tap').classList.remove('resting');
    attr('#reps', 'aria-live', 'polite');
    put('#stage', String(run.cur.stages.length > 1 ? `Stage ${run.stage + 1} of ${run.cur.stages.length} · ${st.label}` : st.label));
    put('#reps', String(st.reps));
    put('#ex', String(curEx().name));
    $('#wrow').hidden = false;
    put('#wval', String(st.load ? `${weight(st.load, p)} ${weightUnit(p)}` : 'Bodyweight'));
    $('#wDown').disabled = !st.load;
    const prev = run.last?.[curEx().id + '|' + st.label];
    if (run.starter) put('#last', st.reps >= 12 ? 'That\'s 12. Set done when you are.' : st.reps >= 8 ? 'In the 8 to 12 range. Stop when another rep would be hard.' : '8 to 12 reps. Stop when another rep would be hard.');
    else put('#last', prev ? `Last time ${prev.reps}${prev.load ? ` at ${weight(prev.load, p)} ${weightUnit(p)}` : ''} · beat it with ${prev.reps + 1}` : st.reps ? '' : 'Tap anywhere to count');
    put('#plates', String(st.load && isBarbell(curEx()) ? plateText(st.load, p) : ''));
    const how = moveFor(curEx()); // the catalog drawing and steps, when this exercise has them
    $('#howEx').hidden = !how; if (how) attr('#howEx', 'aria-label', `How to do ${curEx().name}`);
    attr('#tap', 'aria-label', `Add one rep. ${st.reps} so far`);
    put('#next', String(run.stage < run.cur.stages.length - 1 ? 'Drop to ' + run.cur.stages[run.stage + 1].label : 'Set Done'));
  }

  function endSet() {
    const rec = run.cur.rec; delete run.cur.rec; delete run.cur.base;
    run.recNote = rec ? `New record: ${rec} reps` : '';
    if (rec) { beep(1320, 120, 1); announce(run.recNote); }
    const restS = curEx().rest || run.rest; // an exercise can set its own rest (2.8.2)
    run.sets.push(run.cur); run.cur = null; run.stage = 0;
    run.ex++;
    if (run.ex >= run.plan.length) { run.ex = 0; run.round++; }
    if (run.round > run.rounds) { if (run.recNote) toast(run.recNote); return finish(); }
    if (run.starter) { run.phase = 'set'; save(); return draw(); } // Starter: rest as long as you need, no clock
    run.phase = 'rest'; run.restUntil = Date.now() + restS * 1000;
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
    if (b.id === 'howEx') { const m = moveFor(curEx()); if (m) showMove(m.id); return; }
    if (b.id === 'tap') {
      if (run.phase === 'rest') return; // a stray rep-tap never skips rest
      remember(); ensureSet();
      run.cur.stages[run.stage].reps++;
      const key = run.cur.exId + '|' + run.cur.stages[run.stage].label, prev = run.best?.[key] || 0;
      // A new record is noted once per set and shown when the set ends (2.8.2), not on every rep past it.
      // It's measured against the best from before this set began, so a first-ever set never "beats" itself.
      const base = (run.cur.base ||= {})[key] ??= prev, reps = run.cur.stages[run.stage].reps;
      if (base && reps > base) run.cur.rec = Math.max(run.cur.rec || 0, reps);
      if (run.best && run.cur.stages[run.stage].reps > prev) run.best[key] = run.cur.stages[run.stage].reps; // later rounds race the new record
      run.repTimes.push(Math.round((Date.now() - run.startedAt) / 100) / 10);
      b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 120);
      draw(); save();
    } else if (b.id === 'wUp' || b.id === 'wDown') {
      // Weight for this stage (2.8): one dumbbell step at a time. The exercise keeps the new weight,
      // so later rounds and the next session start from it.
      if (run.phase === 'rest') return;
      remember(); ensureSet();
      history.at(-1).load = { exId: run.cur.exId, label: run.cur.stages[run.stage].label, load: run.cur.stages[run.stage].load ?? null }; // Undo puts this weight back everywhere (2.15)
      // Dumbbells use the step from Settings; barbell, machines and the rest go by 5 lb (2.5 kg) (2.8.2).
      const st = run.cur.stages[run.stage], step = isDumbbell(curEx()) ? toLb(stepShown(p), p) : toLb(metric(p) ? 2.5 : 5, p);
      const next = Math.max(0, round((st.load || 0) + (b.id === 'wUp' ? step : -step), 3)) || null;
      st.load = next;
      const planned = curEx().stages.find(x => x.label === st.label); if (planned) planned.load = next;
      const ex = (await entries('exercise')).find(x => x.id === run.cur.exId);
      const own = ex?.data.stages.find(x => x.label === st.label);
      if (own) { own.load = next; await saveEntry('exercise', ex.data, { id: ex.id, day: ex.day, ts: ex.ts }); }
      draw(); save();
    } else if (b.id === 'undo') undo();
    else if (b.id === 'next') {
      if (Date.now() - lastNext < 600) return; // double-tap protection
      lastNext = Date.now();
      remember();
      if (run.phase === 'rest') { run.phase = 'set'; run.recNote = ''; cancelCue?.(); cancelCue = null; save(); draw(); return; }
      if (run.stage < run.cur.stages.length - 1) { run.stage++; save(); draw(); } else endSet();
    } else if (b.id === 'end') {
      // Touch and mouse finish by holding (below); a tap only explains. Keyboards finish at once.
      if (Date.now() - pressedAt < 1500 || asking) return; // a held mouse click lands here after the hold already asked
      await askFinish();
    }
  });
  let asking = false;
  async function askFinish() {
    if (asking) return; // the hold timer and the click can both fire: one dialog (2.8.2)
    asking = true;
    try { await askFinishOnce(); } finally { asking = false; }
  }
  async function askFinishOnce() {
    const r = await ask('Finish session?', 'Everything logged so far is saved.', [{ label: 'Finish and save', value: 'save' }, { label: 'Discard session', value: 'discard' }]);
    if (r === 'save') finish();
    else if (r === 'discard' && await ask('Discard this session?', 'The reps you logged in it will be deleted.', [{ label: 'Discard', value: true, danger: true }])) finish(true);
  }
  // Kamehameha finish (2.2): hold Finish for a moment to charge it, so a stray tap can't end a workout.
  let pressedAt = 0, chargeT = null;
  const endBtn = $('#end');
  // "Hold to finish" sits under the button (2.8.1) in place of a pop-up over the workout.
  const stopCharge = () => { clearTimeout(chargeT); chargeT = null; endBtn.classList.remove('charging'); };
  endBtn.addEventListener('pointerdown', e => {
    pressedAt = Date.now(); endBtn.classList.add('charging'); endBtn.setPointerCapture?.(e.pointerId);
    chargeT = setTimeout(() => { chargeT = null; endBtn.classList.remove('charging'); beep(1046, 90, 1); askFinish(); }, 900);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => endBtn.addEventListener(ev, () => { if (chargeT) stopCharge(false); }));
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
  await musclesReady().catch(() => {}); // the muscle maps on rows without a drawing
  const sessions = await sessionsInOrder(), best = records(sessions);
  // Sections use the move picker's seven groups and names (2.8.2), in its order; cardio no longer sits under Power.
  const groups = {};
  for (const g of MOVE_GROUPS) groups[g[0]] = [];
  for (const e of lib) (groups[groupOf(e.data)] ||= []).push(e);
  const groupLabel = g => MOVE_GROUPS.find(x => x[0] === g)?.[1] || g.slice(0, 1).toUpperCase() + g.slice(1);
  const pr = e => e.data.stages.map(st => [st.label, recordFor(best, e.id, st.label)]).filter(([, r]) => r);
  return {
    cta: ['Add exercise', () => pickMove({ onCustom: () => editExercise(), have: lib.map(e => moveFor(e.data)?.id).filter(Boolean) })],
    html: `<h1>Library</h1><p class="sub">Circuits pick one exercise per group. Tap one to see how it's done or to edit it.</p>
      ${Object.entries(groups).filter(([, list]) => list.length).map(([g, list]) => `<section class="card" style="margin-top:12px">
        <p class="lbl">${esc(groupLabel(g))} <span class="sub" data-raw>· ${list.length} move${list.length === 1 ? '' : 's'}</span></p>
        <ul class="list librows">${list.map(e => { const m = moveFor(e.data), art = m && artOf(m.id);
          // Picture rows (2.7): the exercise drawing, else its muscle map; the whole row opens it.
          const pic = art ? `<img src="${art.end}" alt="" loading="lazy">` : m ? miniMap(m.id) : '';
          return `<li><button class="librow" data-open="${esc(e.id)}"><span class="lthumb${art ? ' art' : ''}" aria-hidden="true">${pic}</span>
          <span class="ltext"><b>${esc(e.data.name)}</b>
          <span class="chain">${e.data.stages.map(s => esc(s.label) + (s.load ? ` (${esc(weight(s.load, p))} ${weightUnit(p)})` : '')).join(' → ')}</span>
          ${pr(e).length ? `<span class="chain pr">Best: ${pr(e).map(([l, r]) => `${esc(l)} ${r}`).join(' · ')}</span>` : ''}</span></button></li>`; }).join('')}</ul></section>`).join('')}`,
    bind(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-open]'); if (!b) return;
        const ex = lib.find(x => x.id === b.dataset.open), m = moveFor(ex.data);
        // Moves from the built-in list open their how-to (with Edit inside); your own exercises open the editor.
        const hist = liftCard(p, liftHistory(sessions, ex.id));
        if (m) showMove(m.id, { onEdit: () => editExercise(ex, hist), extra: hist }); else editExercise(ex, hist);
      });
    },
  };
}

// The history card (2.8.2): a small line of the estimate over time, then the last 3 sessions' heaviest sets.
// Only sets with a weight count. Goku never asks anyone to test a real one-rep max.
export function liftCard(p, hist) {
  if (!hist.length) return '';
  const w1 = v => round(weight(v, p), 0), u = weightUnit(p), pts = hist.slice(-8).map(h => w1(h.e1));
  let chart = '';
  if (pts.length >= 2) {
    const W = 300, H = 110, lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
    const x = i => 14 + i * (W - 28) / (pts.length - 1), y = v => H - 14 - (v - lo) / span * (H - 40);
    chart = `<svg viewBox="0 0 ${W} ${H}" class="liftchart" role="img" aria-label="Estimated one-rep best over your last ${pts.length} sessions, from ${pts[0]} to ${pts.at(-1)} ${u}">
      <line x1="14" y1="${H - 8}" x2="${W - 14}" y2="${H - 8}" class="lc-axis"/>
      <polyline class="lc-line" points="${pts.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ')}"/>
      ${pts.map((v, i) => `<circle class="lc-dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4"/>`).join('')}
      <text x="${W - 14}" y="${(y(pts.at(-1)) - 10).toFixed(1)}" text-anchor="end" class="lc-lab">${pts.at(-1)} ${u}</text></svg>
      <p class="sub" style="text-align:center">Estimated one-rep best, from your heaviest set each session</p>`;
  }
  return `<section class="card"><p class="lbl">Your history</p>${chart}
    <ul class="list">${hist.slice(-3).reverse().map(h => `<li><span>${prettyDay(h.day)}<br><span class="chain">${esc(weight(h.load, p))} ${u} × ${h.reps}</span></span><b class="num">est. ${w1(h.e1)} ${u}</b></li>`).join('')}</ul>
    <p class="note">Estimate: weight × (1 + reps ÷ 30), the Epley formula (Epley B, Boyd Epley Workout, 1985), most accurate up to about 10 reps. It's an estimate; Goku never asks you to test a one-rep max.</p></section>`;
}

// Dumbbell steps in the person's own units; the stored step snaps to the nearest one shown.
const stepOptions = p => weightUnit(p) === 'kg' ? [1, 2, 2.5, 5] : [2.5, 5, 10];
const stepShown = p => { const v = weight(p.settings.dbStep || 5, p); return stepOptions(p).reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a); };

// The editor's groups are the move picker's seven (2.8.1); circuits still draw from the slot each maps to.
const SLOT_OF = { push: 'push', pull: 'pull', legs: 'legs', core: 'core', power: 'power', cardio: 'power', mobility: 'joints' };
const groupOf = d => d.group || moveFor(d)?.group || { joints: 'mobility' }[d.slot] || d.slot;
// Dumbbell math (2.8.1) only for dumbbell exercises: the built-in list's equipment, else a "DB" or "dumbbell" name.
const isDumbbell = d => { const eq = moveFor(d)?.equip || SEED.find(x => x[0] === d.name)?.[4]; return eq ? eq === 'db' : /\b(db|dumbbells?)\b/i.test(d.name); };
const isBarbell = d => { const eq = moveFor(d)?.equip || SEED.find(x => x[0] === d.name)?.[4]; return eq ? eq === 'bb' : /\b(bb|barbell)\b/i.test(d.name); };
// Plate math (2.10, review 6): plates per side for a barbell load. The bar is stored in pounds; the
// plates in the unit they were picked in (plates are sold in round lb or kg). Defaults: a 45 lb (20 kg) bar.
const PLATES = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };
const barOf = p => p.settings.bar ?? (metric(p) ? toLb(20, p) : 45);
const platesOf = p => p.settings.plates?.length && p.settings.platesUnit === weightUnit(p) ? p.settings.plates : PLATES[weightUnit(p)];
export function plateText(load, p) {
  const u = weightUnit(p), bar = weight(barOf(p), p), total = weight(load, p);
  if (!(total > bar)) return total === bar ? `Just the ${bar} ${u} bar` : '';
  let side = round((total - bar) / 2, 3); const out = [];
  for (const pl of [...platesOf(p)].sort((a, b) => b - a)) while (side >= pl - 0.001) { out.push(pl); side = round(side - pl, 3); }
  return out.length ? `Plates each side: ${out.join(' + ')}${side > 0.01 ? ` (${round(side * 2, 2)} ${u} short)` : ''} · on a ${bar} ${u} bar` : '';
}

function editExercise(ex, hist = '') {
  const p = profile();
  const d = ex ? structuredClone(ex.data) : { name: '', slot: 'push', module: null, order: 999, stages: [{ label: '', load: null }] };
  const { el, close } = overlay(`<div class="row"><h1>${ex ? 'Edit exercise' : 'New exercise'}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="f"></div>
    <p class="msg" id="m" role="status"></p>
    <button class="cta" id="save">Save</button>
    ${ex ? '<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete exercise</button>' : ''}`, { label: ex ? 'Edit exercise' : 'New exercise' });
  const $ = s => el.querySelector(s);
  function draw() {
    $('#f').innerHTML = `<label class="f"><span>Name</span><input id="nm" value="${esc(d.name)}" maxlength="40"></label>
      <label class="f"><span>Group</span><select id="slot">${MOVE_GROUPS.map(([g, n]) => `<option value="${g}" ${g === groupOf(d) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <p class="lbl" style="margin-top:16px">Drop chain, hardest first</p>
      ${d.stages.map((s, i) => `<div class="row" style="margin-top:8px">
        <input data-i="${i}" data-k="label" value="${esc(s.label)}" placeholder="Stage ${i + 1}" aria-label="Stage ${i + 1} name">
        <input data-i="${i}" data-k="load" value="${esc(weight(s.load, p))}" inputmode="decimal" placeholder="${weightUnit(p)}" aria-label="Stage ${i + 1} load in ${weightUnit(p) === 'kg' ? 'kilograms' : 'pounds'}" style="width:80px">
        <button class="cta2" data-rm="${i}" aria-label="Remove stage ${i + 1}">−</button></div>`).join('')}
      <button class="cta2" id="add" style="margin-top:8px">Add stage</button>
      <p class="lbl" style="margin-top:16px">Rest after this exercise</p>
      <div class="seg" role="group" aria-label="Rest after this exercise">${[[null, `Circuit (${GRAVITY[p.settings.gravity || 50][1]} s)`], [60, '60 s'], [90, '90 s'], [120, '2 min']]
        .map(([v, l]) => `<button data-rest="${v ?? ''}" aria-pressed="${(d.rest || null) === v}">${l}</button>`).join('')}</div>
      <p class="note">A heavy lift can rest longer; the rest of the circuit keeps its own rest.</p>
      ${d.stages.some(s => s.load) && isDumbbell(d) ? `<div class="card" style="margin-top:14px"><p class="lbl">Dumbbell math</p>
        <p class="sub">Loads are per dumbbell. A pair of ${esc(weight(d.stages.find(s => s.load).load, p))} ${weightUnit(p)} is ${esc(weight(d.stages.find(s => s.load).load * 2, p))} ${weightUnit(p)} in total.</p>
        <label class="f"><span>Your dumbbells go up in steps of</span><select id="dbstep">${stepOptions(p).map(v =>
          `<option value="${v}" ${v === stepShown(p) ? 'selected' : ''}>${v} ${weightUnit(p)}</option>`).join('')}</select></label>
        <button class="cta2" id="stepUp" style="margin-top:8px">Add one step to every loaded stage</button></div>` : ''}
      ${isBarbell(d) ? `<div class="card" style="margin-top:14px"><p class="lbl">Barbell math</p>
        <p class="sub">During a workout Goku shows the plates for each side. Loads include the bar.</p>
        <label class="f"><span>Your bar weighs</span><select id="barw">${(metric(p) ? [20, 15, 10] : [45, 35, 33, 25, 15]).map(v =>
          `<option value="${v}" ${v === weight(barOf(p), p) ? 'selected' : ''}>${v} ${weightUnit(p)}</option>`).join('')}</select></label>
        <p class="lbl" style="margin-top:10px">Plates your gym has</p>
        <div class="pills">${PLATES[weightUnit(p)].map(v => `<button data-plate="${v}" aria-pressed="${platesOf(p).includes(v)}">${v}</button>`).join('')}</div>
        ${d.stages.find(s => s.load) ? `<p class="sub" style="margin-top:8px">${esc(plateText(d.stages.find(s => s.load).load, p))}</p>` : ''}</div>` : ''}
      ${hist}`;
  }
  el.addEventListener('input', e => {
    const t = e.target;
    $('#m').textContent = '';
    if (t.id === 'nm') d.name = t.value;
    if (t.dataset.k === 'label') d.stages[+t.dataset.i].label = t.value;
    if (t.dataset.k === 'load') d.stages[+t.dataset.i].load = toLb(t.value, p);
  });
  el.addEventListener('change', async e => {
    if (e.target.id === 'slot') { d.group = e.target.value; d.slot = SLOT_OF[d.group]; }
    if (e.target.id === 'dbstep') { p.settings.dbStep = toLb(e.target.value, p); await saveProfile(p); }
    if (e.target.id === 'barw') { p.settings.bar = toLb(+e.target.value, p); await saveProfile(p); draw(); }
  });
  const leave = discardGuard(el);
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') { if (await leave.ok()) close(); return; }
    if (b.id !== 'save' && b.id !== 'del') leave.touch(); // any other tap here changes the exercise
    if (b.dataset.plate) { const v = +b.dataset.plate, have = new Set(platesOf(p)); have.has(v) ? have.delete(v) : have.add(v);
      if (!have.size) return toast('Keep at least one plate');
      p.settings.plates = [...have]; p.settings.platesUnit = weightUnit(p); await saveProfile(p); return draw(); }
    if (b.id === 'add') { d.stages.push({ label: '', load: null }); draw(); }
    if (b.dataset.rest !== undefined) { if (b.dataset.rest) d.rest = +b.dataset.rest; else delete d.rest; draw(); }
    if (b.id === 'stepUp') { const step = toLb(stepShown(p), p); d.stages.forEach(s => { if (s.load) s.load = round(s.load + step, 3); }); draw(); toast('Loads raised. Tap Save to keep them.'); }
    if (b.dataset.rm) { if (d.stages.length > 1) { d.stages.splice(+b.dataset.rm, 1); draw(); } }
    if (b.id === 'save') {
      // Blank stages are dropped from what's saved, not from the form, so a failed save leaves the form as typed.
      const stages = d.stages.filter(s => s.label.trim());
      if (!d.name.trim() || !stages.length) { $('#m').textContent = 'Add a name and at least one stage.'; return; }
      if (stages.some(s => s.load != null && !(s.load >= 0 && s.load <= 1500))) { $('#m').textContent = `Loads go from 0 to ${weight(1500, p)} ${weightUnit(p)}.`; return; }
      await saveEntry('exercise', { ...d, stages }, ex ? { id: ex.id, day: ex.day, ts: ex.ts } : { day: '1970-01-01' });
      close(); window.goku.render();
    }
    if (b.id === 'del' && await ask('Delete this exercise?', 'Past sessions that used it keep their records.', [{ label: 'Delete', value: true, danger: true }])) {
      await deleteEntry(ex.id); close(); window.goku.render();
    }
  }));
  draw();
}

// ---------- History ----------
export async function historyView() {
  const sessions = (await sessionsInOrder()).reverse();
  const days = on(profile(), 'nutrition') ? await nutritionDays(profile()) : [];
  const acts = (await entries('activity')).sort((a, b) => b.day.localeCompare(a.day));
  const p = profile(), all = await loggedEntries(p), t = today();
  return {
    html: `<h1>History</h1>
      <div style="margin-top:12px">${calendarCard(p, all, t)}${ballsCard(milestones(p, all, t))}</div>
      <section class="card"><p class="lbl">Sessions</p>
      ${sessions.length ? `<ul class="list">${sessions.map(s => `<li><span>${prettyDay(s.day)} · ${s.data.starter ? 'Starter' : lvl(s.data.gravity)}<br>
        <span class="chain">${s.data.sets.length} set${s.data.sets.length === 1 ? '' : 's'} · ${round(minutes(s))} min</span></span>
        <span class="row" style="gap:8px"><span class="num">${sessionTotal(s)} reps</span>
        <button class="cta2" data-edit="${esc(s.id)}" aria-label="Edit session from ${prettyDay(s.day)}">Edit</button></span></li>`).join('')}</ul>`
        : `<div class="empty"><h2>No sessions yet</h2><p>${esc(W('enter'))} from Home. Each finished session lands here and becomes your next ghost.</p></div>`}
      </section>
      ${on(profile(), 'nutrition') ? `<section class="card"><p class="lbl">Nutrition days</p>
      ${days.length ? `<ul class="list">${days.slice(0, 60).map(d => `<li><span>${prettyDay(d.day)}<br><span class="chain">${d.n ? `${d.kcal} cal · ${d.n} food${d.n === 1 ? '' : 's'}` : 'no foods logged'}${d.bloat != null ? ` · bloating ${esc(d.bloat)}` : ''}</span></span>
        <button class="cta2" data-nday="${esc(d.day)}" aria-label="Open nutrition for ${prettyDay(d.day)}">Open</button></li>`).join('')}</ul>`
        : '<div class="empty"><p>Days you log food or a check-in in Nutrition show up here.</p></div>'}</section>` : ''}
      <section class="card"><p class="lbl">Other training</p>
      ${acts.length ? `<ul class="list">${activityRows(acts.slice(0, 60))}</ul>` : '<div class="empty"><p>Log soccer, runs and other training from Home.</p></div>'}</section>
      <p class="note">Your best for each exercise is in the Library. Your training trend is on Home.</p>`,
    bind(root) {
      bindCalendar(root, p, all, t);
      root.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.edit) editSession(sessions.find(s => s.id === b.dataset.edit));
        if (b.dataset.nday) openNutritionDay(b.dataset.nday);
        if (b.dataset.act) editActivityById(b.dataset.act);
      });
    },
  };
}

function editSession(s) {
  const p = profile();
  const d = structuredClone(s.data);
  let day = s.day;
  const { el, close } = overlay(`<div class="row"><h1>Edit session</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="f"></div>
    <button class="cta" id="save">Save</button>
    <button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete session</button>`, { label: 'Edit session' });
  const draw = () => {
    el.querySelector('#f').innerHTML = `<div class="row" style="margin:8px 0"><span class="lbl" style="margin:0">Date</span>${dayPicker(day, today(), 'Session date')}</div>
      ${d.sets.map((set, i) => `<section class="card"><div class="row"><h2><span data-raw>${esc(set.name)}</span> · round ${esc(set.round)}</h2>
        <button class="cta2" data-rmset="${i}" aria-label="Delete this set">Delete</button></div>
        ${set.stages.map((st, j) => `<div class="row" style="margin-top:6px"><span>${esc(st.label)}</span>${stepper(i + ':' + j, st.reps, 'reps for ' + st.label)}</div>
        <div class="row" style="margin-top:4px"><span class="sub">weight</span><span class="row" style="gap:6px"><input data-wl="${i}:${j}" value="${st.load ? esc(weight(st.load, p)) : ''}" inputmode="decimal" placeholder="none" aria-label="Weight for ${esc(st.label)} in ${weightUnit(p) === 'kg' ? 'kilograms' : 'pounds'}" style="width:80px"><span class="sub">${weightUnit(p)}</span></span></div>`).join('')}</section>`).join('')
        || '<p class="sub">No sets left. Save to keep an empty session, or delete it.</p>'}
      ${d.sets.length ? `<button class="addrow" id="addRound">+ Add a round${names().length === 1 ? ' of ' + esc(names()[0]) : ''}</button>` : ''}
      <button class="addrow" id="addEx">+ Add an exercise</button>`;
  };
  // Adding (2.8.1): another round of an exercise already in the session, or a new exercise from the picker.
  const pending = new Map(); // set index → move to add to the Library on Save
  const names = () => [...new Set(d.sets.map(x => x.name))];
  const addRound = name => {
    const last = d.sets.filter(x => x.name === name).at(-1);
    d.sets.push({ ...structuredClone(last), round: Math.max(...d.sets.filter(x => x.name === name).map(x => x.round)) + 1,
      stages: last.stages.map(st => ({ label: st.label, reps: 0, load: st.load ?? null })) });
    draw();
  };
  el.addEventListener('input', e => {
    if (!e.target.dataset.wl) return;
    const [i, j] = e.target.dataset.wl.split(':').map(Number), v = toLb(e.target.value, p);
    d.sets[i].stages[j].load = v > 0 && v <= 1500 ? round(v, 3) : null; // blank, zero or nonsense means no weight
  });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.dayshift) { const nd = addDays(day, +b.dataset.dayshift); if (nd <= today()) day = nd; return draw(); }
    if (b.dataset.rmset) { // later sets move up one, and so do their pending moves
      const i = +b.dataset.rmset; d.sets.splice(i, 1);
      const moved = [...pending].filter(([k]) => k !== i).map(([k, m]) => [k > i ? k - 1 : k, m]); pending.clear(); moved.forEach(([k, m]) => pending.set(k, m));
      return draw(); }
    if (b.id === 'addRound') {
      const name = names().length === 1 ? names()[0] : await ask('Add a round of…', '', names().map(n => ({ label: n, value: n })));
      if (name) addRound(name);
      return;
    }
    // A move not in the Library joins it only on Save changes (2.8.2); closing without saving leaves the Library as it was.
    if (b.id === 'addEx') return pickMove({ onPick: async m => {
      const lib = await library();
      const ex = lib.find(x => x.data.moveId === m.id || x.data.name === m.name);
      if (ex) d.sets.push({ exId: ex.id, name: ex.data.name, slot: ex.data.slot, round: 1, stages: ex.data.stages.map(st => ({ label: st.label, reps: 0, load: st.load ?? null })) });
      else { const nd = moveData(m); pending.set(d.sets.length, m); d.sets.push({ exId: null, name: nd.name, slot: nd.slot, round: 1, stages: nd.stages.map(st => ({ label: st.label, reps: 0, load: null })) }); }
      draw();
    } });
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
      for (const [i, m] of pending) if (d.sets[i] && !d.sets[i].exId) { // the same set, not removed since
        const lib = await library(), ex = lib.find(x => x.data.moveId === m.id || x.data.name === m.name) || await addMove(m);
        for (const set of d.sets) if (!set.exId && set.name === ex.data.name) set.exId = ex.id; // its added rounds too
      }
      await saveEntry('session', d, { id: s.id, day, ts: s.ts }); close(); toast('Session updated'); window.goku.render(); }
    if (b.id === 'del' && await ask('Delete this session?', 'It will be removed from history and from your ghost.', [{ label: 'Delete', value: true, danger: true }])) {
      await deleteEntry(s.id); close(); window.goku.render();
    }
  }));
  draw();
}
