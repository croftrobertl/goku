// Saga map (2.2): training as story arcs. Each arc lasts 4 weeks and has a "boss": a goal
// the person sets themselves (Goku never prescribes one). Beat it, and the arc is cleared.
import { w, W, skinOf } from './skins.js';
import { entries, saveEntry, deleteEntry, today, profile } from './state.js';
import { stagesFor } from './skills.js';
import { esc, overlay, guard, toast, ask } from './ui.js';
import { addDays, daysBetween, prettyDay } from './time.js';
import { isMinor } from './coach.js';
import { weightTrend, trendOn, weightOn } from './weight.js';
import { weight, weightUnit, toLb } from './units.js';

const WEEKS = 4;
// Name ideas follow the skin (2.8.2): "Gravity training" and "Skill saga" are Dragon Ball's.
const NAMES = () => skinOf(profile()) === 'dbz' ? ['Foundations', 'Gravity training', 'Speed and power', 'Iron core', 'Endurance', 'Skill saga', 'Comeback']
  : ['Foundations', `${W('chamber')} weeks`, 'Speed and power', 'Iron core', 'Endurance', `Skill ${w('arc').toLowerCase()}`, 'Comeback'];
// Goal ideas for each kind of profile (2.8.1); Custom profiles see both lists.
const BOSSES = {
  engine: ['20 strict push-ups in one set', 'A 60-second plank', '5 pull-ups', 'Squat my bodyweight', 'Protein goal 5 days a week', 'Train 4 days every week'],
  perf: ['Land my round-off back handspring', 'Full splits', 'A 60-second plank', 'Protein goal 5 days a week', 'Train 4 days every week'],
};
// A Custom profile gets ideas from the sports it picked (2.8.2, lists approved by Rob in review 3).
// "Something else" falls back to general fitness.
const SPORT_IDEAS = {
  strength: BOSSES.engine, gymnastics: BOSSES.perf,
  run: ['Run 5 km (3.1 mi) without stopping', 'Run 30 minutes without stopping', 'Run 3 times a week for 4 weeks', 'Take a minute off my 5 km time'],
  soccer: ['Juggle 50 in a row', '10 passes in a row off a wall with my weaker foot', 'Practice ball skills 3 days a week', 'Sprint the length of the field without slowing'],
  bike: ['Ride 20 miles (32 km) in one ride', 'Ride 3 times a week for 4 weeks', 'Climb my local hill without stopping'],
  dance: ['Learn one full routine from start to finish', 'Hold a balance on one foot for 30 seconds', 'Full splits', 'Practice 4 days a week'],
  martial: ['Pass my next belt test', '100 clean kicks a side in one session', 'Train 3 days every week'],
  team: ['Make 50 free throws or shots in a session', 'Train 4 days every week', 'Sprint drills twice a week for 4 weeks'],
  yoga: ['Touch my toes with straight legs', 'Hold a 60-second plank', 'Full splits', 'Stretch 10 minutes a day for 4 weeks'],
  swim: ['Swim 2 lengths without stopping', 'Swim once or twice a week for 4 weeks', 'Float on my back for 30 seconds', 'Try one new stroke'],
  fitness: ['Walk 8,000 steps a day for 4 weeks', '20 push-ups in one set', 'A 60-second plank', 'Train 3 days every week'],
};
// Weight goals (2.8.2, picked by Rob in review 4): adults only, at the CDC's steady pace of about 1 to 2 lb a week.
const WEIGHT_IDEAS = ['Lose 4 lb (2 kg) in 4 weeks', 'Lose about 1 lb (0.5 kg) a week for 4 weeks', 'Reach my calorie target 5 days a week'];
const WEIGHT_SOURCE = 'Weight ideas follow the CDC’s steady pace: people who lose about 1 to 2 pounds a week are more likely to keep it off (CDC, Steps for Losing Weight, updated January 17, 2025).';
const sportIdeas = p => {
  if (!p.custom) return BOSSES[p.kind];
  const list = [...new Set((p.custom.sports || []).flatMap(k => SPORT_IDEAS[k] || []))];
  return list.length ? list : SPORT_IDEAS.fitness;
};
const bossIdeas = p => isMinor(p) ? sportIdeas(p) : [...sportIdeas(p), ...WEIGHT_IDEAS];

// Poster boss (2.3): an arc can link its boss to an exercise (best reps at one stage, from
// sessions inside the arc) or to a skill (reaching a stage), so the boss's HP drops on its own.
// link = { type: 'ex', id, stage, target } or { type: 'skill', id, target }, or (2.10) { type: 'weight', target }:
// pounds to lose, measured on the weight trend from the arc's start.
export function arcProgress(a, { sessions = [], skills = [], weighs = [] } = {}) {
  const l = a.data.link; if (!l) return null;
  if (l.type === 'weight') {
    const pts = weightTrend(weighs); if (!pts.length) return { have: 0, need: l.target, label: 'Weigh in to track it', pct: 0 };
    const lost = Math.max(0, Math.round((trendOn(pts, a.data.start) - pts.at(-1).trend) * 10) / 10), p = profile();
    return { have: lost, need: l.target, label: `${weight(lost, p)} of ${weight(l.target, p)} ${weightUnit(p)} on the trend`, pct: Math.min(1, lost / l.target) };
  }
  if (l.type === 'ex') {
    let have = 0;
    for (const s of sessions) if (s.day >= a.data.start) for (const set of s.data.sets || []) if (set.exId === l.id)
      for (const st of set.stages || []) if (st.label === l.stage && st.reps > have) have = st.reps;
    return { have, need: l.target, label: `${have} of ${l.target} reps`, pct: Math.min(1, have / l.target) };
  }
  const sk = skills.find(x => x.id === l.id); if (!sk) return null;
  const st = stagesFor(sk.data.event), have = Math.min(sk.data.stage, l.target);
  return { have, need: l.target, label: `${st[sk.data.stage] || ''} · goal: ${st[l.target] || ''}`, pct: l.target ? have / l.target : 1 };
}

export const arcsOf = async p => (await entries('arc', p)).sort((a, b) => a.data.start.localeCompare(b.data.start) || a.ts - b.ts);

export function sagaCard(arcs, t, ctx = {}) {
  const open = arcs.filter(a => !a.data.done);
  const cur = open.find(a => a.data.start <= t) || null, next = open.find(a => a !== cur) || null;
  const cleared = arcs.filter(a => a.data.done);
  const n = a => arcs.indexOf(a) + 1;
  if (!arcs.length) return `<section class="card saga"><p class="lbl">Your ${esc(w('saga').toLowerCase())}</p>
    <p class="sub" style="text-align:center">Turn your next 4 weeks into ${/^[aeiou]/i.test(w('arc')) ? 'an' : 'a'} ${esc(w('arc').toLowerCase())} with a ${esc(w('boss').toLowerCase())} to beat: a goal you pick, like 20 push-ups or a 60-second plank.</p>
    <button class="cta2" id="arcNew" style="width:100%;margin-top:10px">Start your first ${esc(w('arc').toLowerCase())}</button></section>`;
  const arcHTML = a => {
    const day = Math.max(0, daysBetween(a.data.start, t)), len = (a.data.weeks || WEEKS) * 7, wk = Math.min(a.data.weeks || WEEKS, Math.floor(day / 7) + 1);
    const over = day >= len, pr = arcProgress(a, ctx), won = pr && pr.have >= pr.need;
    const hp = pr ? Math.round((1 - pr.pct) * 100) : null;
    return `<div class="arc now"><div class="row"><span class="pill">${esc(W('arc'))} ${n(a)} · ${over ? 'time is up' : `week ${wk} of ${a.data.weeks || WEEKS}`}</span><button class="link" data-arcedit="${esc(a.id)}">Edit</button></div>
      <h2 data-raw>${esc(a.data.name)}</h2>
      <div class="poster${won ? ' won' : ''}"><span class="wanted">${esc(W('boss'))}</span><b>${esc(a.data.boss)}</b>
        ${pr ? `<div class="hp" role="img" aria-label="${esc(W('boss'))} HP ${hp} percent"><i style="width:${hp}%"></i></div><span class="sub">${won ? 'Target reached. Mark it beaten below.' : `${esc(W('boss'))} HP ${hp}% · ${esc(pr.label)}`}</span>`
          : '<span class="sub">Link it to an exercise or skill in Edit and its HP drops as you train.</span>'}</div>
      <div class="arcbar" role="img" aria-label="${Math.min(100, Math.round(day / len * 100))} percent of the ${esc(w('arc').toLowerCase())} done"><i style="width:${Math.min(100, day / len * 100)}%"></i></div>
      <div class="row" style="gap:8px;margin-top:10px"><button class="${won ? 'cta' : 'cta2'}" data-arcwin="${esc(a.id)}" style="flex:1">${won ? `Mark the ${esc(w('boss').toLowerCase())} beaten` : `${esc(W('boss'))} beaten`}</button>
        ${over ? `<button class="cta2" data-arcmore="${esc(a.id)}" style="flex:1">2 more weeks</button>` : ''}</div></div>`;
  };
  return `<section class="card saga"><div class="row"><p class="lbl" style="margin:0">Your ${esc(w('saga').toLowerCase())}</p><span class="sub">${cleared.length} cleared</span></div>
    ${cur ? arcHTML(cur) : `<p class="sub" style="text-align:center">${next ? `Next ${esc(w('arc').toLowerCase())} starts ${esc(prettyDay(next.data.start))}.` : `No ${esc(w('arc').toLowerCase())} running.`}</p>`}
    ${next && cur ? `<div class="arc next"><span class="pill">${esc(W('arc'))} ${n(next)} · next</span><h2 data-raw>${esc(next.data.name)}</h2><p><b>${esc(W('boss'))}:</b> ${esc(next.data.boss)}</p></div>` : ''}
    ${!next ? `<button class="cta2" id="arcNew" style="width:100%;margin-top:10px">Plan the next ${esc(w('arc').toLowerCase())}</button>` : ''}
    ${cleared.length ? `<details class="fold"><summary class="sub">Cleared ${esc(w('arc').toLowerCase())}s</summary><ul class="list">${cleared.slice().reverse().map(a => `<li><span><b>${esc(a.data.name)}</b><br><span class="chain">Beat: ${esc(a.data.boss)}</span></span><span class="sub">${esc(prettyDay(a.data.done))}</span></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

export function bindSaga(root, arcs) {
  root.querySelectorAll('#arcNew').forEach(b => b.addEventListener('click', () => editArc(null, arcs)));
  root.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = arcs.find(x => x.id === (b.dataset.arcedit || b.dataset.arcwin || b.dataset.arcmore)); if (!a) return;
    if (b.dataset.arcedit) return editArc(a, arcs);
    if (b.dataset.arcmore) { await saveEntry('arc', { ...a.data, weeks: (a.data.weeks || WEEKS) + 2 }, { id: a.id, day: a.day, ts: a.ts }); return window.goku.render(); }
    if (b.dataset.arcwin && await ask(`${esc(W('boss'))} beaten?`, `${esc(a.data.boss)}. Clear "${esc(a.data.name)}" and start the next ${esc(w('arc').toLowerCase())} when you're ready.`, [{ label: 'Yes, clear it', value: true }])) {
      await saveEntry('arc', { ...a.data, done: today() }, { id: a.id, day: a.day, ts: a.ts });
      window.goku.render(); cleared(a, arcs);
    }
  }));
}

// Arc cleared (2.3): a full-screen moment in place of a toast.
function cleared(a, arcs) {
  const days = Math.max(1, daysBetween(a.data.start, today()) + 1), num = arcs.filter(x => x.data.done || x === a).length;
  const { el, close } = overlay(`<div class="clr"><div class="burst" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--k:${i}"></i>`).join('')}</div>
    <p class="lbl">${esc(W('arc'))} ${arcs.indexOf(a) + 1} cleared</p><h1 data-raw>${esc(a.data.name)}</h1>
    <p class="beat">${esc(w('bossBeat'))}: <b>${esc(a.data.boss)}</b></p>
    <p class="sub">Cleared in ${days} day${days === 1 ? '' : 's'}. ${num} ${esc(w('arc').toLowerCase())}${num === 1 ? '' : 's'} cleared in your ${esc(w('saga').toLowerCase())}.</p>
    <button class="cta" id="nx">Plan the next ${esc(w('arc').toLowerCase())}</button><button class="cta2" id="x" data-close style="width:100%;margin-top:8px">Later</button></div>`, { label: `${W('arc')} cleared`, id: 'cleared' });
  el.querySelector('#x').addEventListener('click', close);
  el.querySelector('#nx').addEventListener('click', async () => { close(); editArc(null, await arcsOf(profile())); });
}

async function editArc(a, arcs) {
  const p = profile();
  const exs = p.kind === 'engine' ? await entries('exercise', p) : [], sks = p.kind === 'perf' ? await entries('skill', p) : [];
  const t = today(), wOn = weightOn(p);
  const last = arcs.filter(x => !x.data.done).map(x => addDays(x.data.start, (x.data.weeks || WEEKS) * 7)).sort().pop();
  const d = a ? { ...a.data } : { name: NAMES()[arcs.length % NAMES().length], boss: '', start: last && last > t ? last : t, weeks: WEEKS, done: null };
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">${a ? 'Edit ' + esc(w('arc').toLowerCase()) : 'New ' + esc(w('arc').toLowerCase())}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll">
      <label class="f"><span>${esc(W('arc'))} name</span><input id="an" maxlength="40" value="${esc(d.name)}"></label>
      <div class="pills sugg">${NAMES().map(x => `<button data-an="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <label class="f"><span>The ${esc(w('boss').toLowerCase())}: one goal to beat in ${WEEKS} weeks</span><input id="ab" maxlength="80" value="${esc(d.boss)}" placeholder="e.g. 20 strict push-ups in one set"></label>
      <div class="pills sugg">${bossIdeas(p).map(x => `<button data-ab="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      ${isMinor(p) ? '' : `<p class="note">${esc(WEIGHT_SOURCE)} <a href="https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html" target="_blank" rel="noopener">Read it</a></p>`}
      ${exs.length || sks.length || wOn ? `<label class="f"><span>Track the ${esc(w('boss').toLowerCase())} automatically (optional)</span><select id="lk"><option value="">Don't track, I'll say when</option>
        ${wOn ? `<option value="weight|"${d.link?.type === 'weight' ? ' selected' : ''}>Weight trend · ${weightUnit(p)} to lose</option>` : ''}
        ${exs.map(e => e.data.stages.map(st => `<option value="ex|${esc(e.id)}|${esc(st.label)}"${d.link?.type === 'ex' && d.link.id === e.id && d.link.stage === st.label ? ' selected' : ''}>${esc(e.data.name)} · ${esc(st.label)}</option>`).join('')).join('')}
        ${sks.map(k => `<option value="skill|${esc(k.id)}"${d.link?.id === k.id ? ' selected' : ''}>${esc(k.data.name)}</option>`).join('')}</select></label>
      <div id="lkt"></div>` : ''}
      <label class="f"><span>Starts</span><input id="as" type="date" value="${esc(d.start)}"></label>
      <p class="note">Pick a goal that's a stretch but doable. A coach or the Library's easier versions can help you choose.</p>
    </div>
    <p class="msg" id="am" role="status"></p>
    <button class="cta" id="ok">${a ? 'Save' : 'Start'} ${esc(w('arc').toLowerCase())}</button>
    ${a ? `<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete ${esc(w('arc').toLowerCase())}</button>` : ''}`, { label: a ? 'Edit ' + w('arc').toLowerCase() : 'New ' + w('arc').toLowerCase() });
  const $ = s => el.querySelector(s);
  const target = () => { const v = $('#lk')?.value || '', [type, id] = v.split('|');
    if (!type) return $('#lkt') && ($('#lkt').innerHTML = '');
    if (type === 'weight') { $('#lkt').innerHTML = `<label class="f"><span>${weightUnit(p)} to lose on the weight trend</span><input id="lkn" inputmode="decimal" value="${d.link?.type === 'weight' ? esc(weight(d.link.target, p)) : weightUnit(p) === 'kg' ? 2 : 4}"></label>`; return; }
    if (type === 'ex') $('#lkt').innerHTML = `<label class="f"><span>Reps in one set to beat the ${esc(w('boss').toLowerCase())}</span><input id="lkn" type="number" inputmode="numeric" min="1" max="999" value="${d.link?.type === 'ex' ? d.link.target : 20}"></label>`;
    else { const k = sks.find(x => x.id === id), st = stagesFor(k.data.event);
      $('#lkt').innerHTML = `<label class="f"><span>Stage that beats the ${esc(w('boss').toLowerCase())}</span><select id="lkn">${st.map((x, i) => i ? `<option value="${i}"${(d.link?.type === 'skill' ? d.link.target : st.length - 1) === i ? ' selected' : ''}>${esc(x)}</option>` : '').join('')}</select></label>`; }
  };
  target(); $('#lk')?.addEventListener('change', () => { d.link = null; target(); });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.an) { $('#an').value = b.dataset.an; return; }
    if (b.dataset.ab) { $('#ab').value = b.dataset.ab;
      // A weight idea also tracks itself on the weight trend: 4 lb (2 kg) in both ideas.
      if (wOn && /^Lose /.test(b.dataset.ab) && $('#lk')) { d.link = { type: 'weight', target: 4 }; $('#lk').value = 'weight|'; target(); }
      return; }
    if (b.id === 'del' && await ask('Delete this arc?', '', [{ label: 'Delete', value: true, danger: true }])) { await deleteEntry(a.id); close(); return window.goku.render(); }
    if (b.id !== 'ok') return;
    const name = $('#an').value.trim().slice(0, 40), boss = $('#ab').value.trim().slice(0, 80), start = $('#as').value;
    if (!name || !boss) { $('#am').textContent = `Give the ${w('arc').toLowerCase()} a name and a ${w('boss').toLowerCase()} to beat.`; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { $('#am').textContent = 'Pick a start date.'; return; }
    const [lt, lid, lst] = ($('#lk')?.value || '').split('|'), n = lt === 'weight' ? toLb(($('#lkn')?.value || '').replace(',', '.'), p) || 0 : Math.round(+$('#lkn')?.value || 0);
    if (lt && !(n >= (lt === 'weight' ? 0.5 : 1))) { $('#am').textContent = `Set a number for the ${w('boss').toLowerCase()}.`; return; }
    const link = lt === 'weight' ? { type: 'weight', target: Math.round(n * 10) / 10 } : lt === 'ex' ? { type: 'ex', id: lid, stage: lst, target: n } : lt === 'skill' ? { type: 'skill', id: lid, target: n } : null;
    await saveEntry('arc', { ...d, name, boss, start, link }, a ? { id: a.id, day: a.day, ts: a.ts } : { day: start });
    close(); toast(a ? `${W('arc')} saved` : `${W('arc')} started: ${name}`); window.goku.render();
  }));
}
