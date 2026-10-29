// Saga map (2.2): training as story arcs. Each arc lasts 4 weeks and has a "boss": a goal
// the person sets themselves (Goku never prescribes one). Beat it, and the arc is cleared.
import { entries, saveEntry, deleteEntry, today } from './state.js';
import { esc, overlay, guard, toast, ask } from './ui.js';
import { addDays, daysBetween, prettyDay } from './time.js';

const WEEKS = 4;
const NAMES = ['Foundations', 'Gravity training', 'Speed and power', 'Iron core', 'Endurance', 'Skill saga', 'Comeback'];
const BOSSES = ['20 strict push-ups in one set', 'A 60-second plank', '5 pull-ups', 'Squat my bodyweight', 'Protein goal 5 days a week',
  'Train 4 days every week', 'Land my round-off back handspring', 'Full splits'];

export const arcsOf = async p => (await entries('arc', p)).sort((a, b) => a.data.start.localeCompare(b.data.start) || a.ts - b.ts);

export function sagaCard(arcs, t) {
  const open = arcs.filter(a => !a.data.done);
  const cur = open.find(a => a.data.start <= t) || null, next = open.find(a => a !== cur) || null;
  const cleared = arcs.filter(a => a.data.done);
  const n = a => arcs.indexOf(a) + 1;
  if (!arcs.length) return `<section class="card saga"><p class="lbl">Your saga</p>
    <p class="sub" style="text-align:center">Turn your next 4 weeks into an arc with a boss to beat: a goal you pick, like 20 push-ups or a 60-second plank.</p>
    <button class="cta2" id="arcNew" style="width:100%;margin-top:10px">Start your first arc</button></section>`;
  const arcHTML = a => {
    const day = Math.max(0, daysBetween(a.data.start, t)), len = (a.data.weeks || WEEKS) * 7, wk = Math.min(a.data.weeks || WEEKS, Math.floor(day / 7) + 1);
    const over = day >= len;
    return `<div class="arc now"><div class="row"><span class="pill">Arc ${n(a)} · ${over ? 'time is up' : `week ${wk} of ${a.data.weeks || WEEKS}`}</span><button class="link" data-arcedit="${esc(a.id)}">Edit</button></div>
      <h2>${esc(a.data.name)}</h2><p><b>Boss:</b> ${esc(a.data.boss)}</p>
      <div class="arcbar" role="img" aria-label="${Math.min(100, Math.round(day / len * 100))} percent of the arc done"><i style="width:${Math.min(100, day / len * 100)}%"></i></div>
      <div class="row" style="gap:8px;margin-top:10px"><button class="cta2" data-arcwin="${esc(a.id)}" style="flex:1">Boss beaten!</button>
        ${over ? `<button class="cta2" data-arcmore="${esc(a.id)}" style="flex:1">2 more weeks</button>` : ''}</div></div>`;
  };
  return `<section class="card saga"><div class="row"><p class="lbl" style="margin:0">Your saga</p><span class="sub">${cleared.length} cleared</span></div>
    ${cur ? arcHTML(cur) : `<p class="sub" style="text-align:center">${next ? `Next arc starts ${esc(prettyDay(next.data.start))}.` : 'No arc running.'}</p>`}
    ${next && cur ? `<div class="arc next"><span class="pill">Arc ${n(next)} · next</span><h2>${esc(next.data.name)}</h2><p><b>Boss:</b> ${esc(next.data.boss)}</p></div>` : ''}
    ${!next ? '<button class="cta2" id="arcNew" style="width:100%;margin-top:10px">Plan the next arc</button>' : ''}
    ${cleared.length ? `<details class="fold"><summary class="sub">Cleared arcs</summary><ul class="list">${cleared.slice().reverse().map(a => `<li><span><b>${esc(a.data.name)}</b><br><span class="chain">Beat: ${esc(a.data.boss)}</span></span><span class="sub">${esc(prettyDay(a.data.done))}</span></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

export function bindSaga(root, arcs) {
  root.querySelectorAll('#arcNew').forEach(b => b.addEventListener('click', () => editArc(null, arcs)));
  root.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = arcs.find(x => x.id === (b.dataset.arcedit || b.dataset.arcwin || b.dataset.arcmore)); if (!a) return;
    if (b.dataset.arcedit) return editArc(a, arcs);
    if (b.dataset.arcmore) { await saveEntry('arc', { ...a.data, weeks: (a.data.weeks || WEEKS) + 2 }, { id: a.id, day: a.day, ts: a.ts }); return window.goku.render(); }
    if (b.dataset.arcwin && await ask('Boss beaten?', `${esc(a.data.boss)}. Clear "${esc(a.data.name)}" and start the next arc when you're ready.`, [{ label: 'Yes, cleared!', value: true }])) {
      await saveEntry('arc', { ...a.data, done: today() }, { id: a.id, day: a.day, ts: a.ts });
      toast(`Arc cleared: ${a.data.name}. On to the next saga!`, 3500); window.goku.render();
    }
  }));
}

function editArc(a, arcs) {
  const t = today();
  const last = arcs.filter(x => !x.data.done).map(x => addDays(x.data.start, (x.data.weeks || WEEKS) * 7)).sort().pop();
  const d = a ? { ...a.data } : { name: NAMES[arcs.length % NAMES.length], boss: '', start: last && last > t ? last : t, weeks: WEEKS, done: null };
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">${a ? 'Edit arc' : 'New arc'}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll">
      <label class="f"><span>Arc name</span><input id="an" maxlength="40" value="${esc(d.name)}"></label>
      <div class="pills sugg">${NAMES.map(x => `<button data-an="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <label class="f"><span>The boss: one goal to beat in ${WEEKS} weeks</span><input id="ab" maxlength="80" value="${esc(d.boss)}" placeholder="e.g. 20 strict push-ups in one set"></label>
      <div class="pills sugg">${BOSSES.map(x => `<button data-ab="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <label class="f"><span>Starts</span><input id="as" type="date" value="${esc(d.start)}"></label>
      <p class="note">Pick a goal that's a stretch but doable. A coach or the Library's easier versions can help you choose.</p>
    </div>
    <p class="msg" id="am" role="status"></p>
    <button class="cta" id="ok">${a ? 'Save arc' : 'Start arc'}</button>
    ${a ? '<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete arc</button>' : ''}`, { label: a ? 'Edit arc' : 'New arc' });
  const $ = s => el.querySelector(s);
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.an) { $('#an').value = b.dataset.an; return; }
    if (b.dataset.ab) { $('#ab').value = b.dataset.ab; return; }
    if (b.id === 'del' && await ask('Delete this arc?', '', [{ label: 'Delete', value: true, danger: true }])) { await deleteEntry(a.id); close(); return window.goku.render(); }
    if (b.id !== 'ok') return;
    const name = $('#an').value.trim().slice(0, 40), boss = $('#ab').value.trim().slice(0, 80), start = $('#as').value;
    if (!name || !boss) { $('#am').textContent = 'Give the arc a name and a boss to beat.'; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { $('#am').textContent = 'Pick a start date.'; return; }
    await saveEntry('arc', { ...d, name, boss, start }, a ? { id: a.id, day: a.day, ts: a.ts } : { day: start });
    close(); toast(a ? 'Arc saved' : `Arc started: ${name}`); window.goku.render();
  }));
}
