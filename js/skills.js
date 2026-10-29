// Skill tree (gymnastics): each skill climbs Learning → With spot → Solo → Competition-ready.
// The athlete moves a skill up when their coach says it's ready; Goku only keeps the record.
import { entries, saveEntry, deleteEntry, today } from './state.js';
import { esc, ask, overlay, guard, toast } from './ui.js';
import { prettyDay } from './time.js';

export const EVENTS = [['vault', 'Vault'], ['floor', 'Floor'], ['beam', 'Beam'], ['bars', 'Bars'], ['other', 'Other']];
export const STAGES = ['Learning', 'With spot', 'Solo', 'Competition-ready'];
// Quick picks only; any name can be typed.
const SUGGEST = {
  vault: ['Handspring vault', 'Squat on', 'Round-off entry'], floor: ['Round-off', 'Back walkover', 'Back handspring'],
  beam: ['Cartwheel', 'Split leap', 'Handstand'], bars: ['Pullover', 'Back hip circle', 'Kip'], other: [],
};
const eventName = k => EVENTS.find(e => e[0] === k)?.[1] || 'Other';

export const skillList = async () => entries('skill');

const pips = stage => `<span class="pips" aria-hidden="true">${STAGES.map((_, i) => `<span class="pip ${i <= stage ? 'on' : ''}"></span>`).join('')}</span>`;

export function skillSummary(skills) {
  if (!skills.length) return `<section class="card"><p class="lbl">Skill tree</p><p class="sub">Track each skill from learning to competition-ready.</p>
    <button class="cta2" data-tab="skills" style="margin-top:8px;width:100%">Add your first skill</button></section>`;
  const counts = STAGES.map((_, i) => skills.filter(s => s.data.stage === i).length);
  return `<section class="card"><div class="row"><p class="lbl" style="margin:0">Skill tree</p><button class="cta2" data-tab="skills">Open</button></div>
    <ul class="list" style="margin-top:6px">${STAGES.map((n, i) => counts[i] ? `<li><span>${pips(i)} ${esc(n)}</span><b class="num">${counts[i]}</b></li>` : '').join('')}</ul></section>`;
}

export async function skillsView() {
  const skills = await skillList();
  const branches = EVENTS.map(([k, n]) => [k, n, skills.filter(s => s.data.event === k).sort((a, b) => b.data.stage - a.data.stage || a.data.name.localeCompare(b.data.name))])
    .filter(([, , list]) => list.length);
  return {
    cta: ['Add a skill', () => editSkill()],
    html: `<h1>Skill tree</h1>
      <p class="sub" style="margin:4px 0 12px">Move a skill up when your coach says it's ready.</p>
      ${branches.length ? branches.map(([k, n, list]) => `<section class="card branch"><p class="lbl">${esc(n)}</p>
        <ul class="tree">${list.map(s => `<li class="node s${s.data.stage}">
          <button class="skill" data-skill="${esc(s.id)}" aria-label="${esc(s.data.name)}, ${STAGES[s.data.stage]}. Edit">
            <b>${esc(s.data.name)}</b><span class="sub">${pips(s.data.stage)} ${STAGES[s.data.stage]}</span></button>
          ${s.data.stage < 3 ? `<button class="cta2" data-up="${esc(s.id)}" aria-label="Move ${esc(s.data.name)} up to ${STAGES[s.data.stage + 1]}">Move up</button>` : '<span class="done" aria-hidden="true">★</span>'}
        </li>`).join('')}</ul></section>`).join('')
        : `<section class="card"><div class="empty"><h2>No skills yet</h2><p>Add the skills you're working on. Each one climbs four stages: ${STAGES.join(' → ')}.</p></div></section>`}`,
    bind(root) {
      root.addEventListener('click', guard(async e => {
        const b = e.target.closest('button'); if (!b) return;
        const s = skills.find(x => x.id === (b.dataset.skill || b.dataset.up)); if (!s) return;
        if (b.dataset.skill) return editSkill(s);
        const next = s.data.stage + 1;
        if (next === 3 && !await ask(`${s.data.name}: competition-ready?`, 'Only when your coach agrees it is.', [{ label: 'Yes, competition-ready', value: true }])) return;
        await setStage(s, next); toast(`${s.data.name}: ${STAGES[next]}`); window.goku.render();
      }));
    },
  };
}

async function setStage(s, stage) {
  const d = { ...s.data, stage, log: [...(s.data.log || []), { stage, day: today() }].slice(-40) };
  await saveEntry('skill', d, { id: s.id, day: s.day, ts: s.ts });
}

export function editSkill(existing = null) {
  const d = existing ? structuredClone(existing.data) : { name: '', event: 'vault', stage: 0, log: [] };
  const { el, close } = overlay(`<div class="row"><h1>${existing ? 'Edit skill' : 'Add a skill'}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="f"></div>
    <button class="cta" id="save">Save</button>
    ${existing ? '<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete skill</button>' : ''}`, { label: existing ? 'Edit skill' : 'Add a skill' });
  const draw = () => {
    el.querySelector('#f').innerHTML = `<p class="lbl" style="margin-top:8px">Event</p>
      <div class="pills">${EVENTS.map(([k, n]) => `<button data-ev="${k}" aria-pressed="${d.event === k}">${esc(n)}</button>`).join('')}</div>
      <label class="f" style="margin-top:16px"><span>Skill name</span><input id="nm" maxlength="40" value="${esc(d.name)}" autocomplete="off" placeholder="Type or dictate"></label>
      ${SUGGEST[d.event].length ? `<div class="pills" style="margin-top:8px">${SUGGEST[d.event].map(n => `<button data-sug="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <p class="lbl" style="margin-top:16px">Stage</p>
      <div class="pills">${STAGES.map((n, i) => `<button data-st="${i}" aria-pressed="${d.stage === i}">${esc(n)}</button>`).join('')}</div>
      ${d.log?.length ? `<p class="lbl" style="margin-top:16px">History</p><ul class="list">${d.log.slice().reverse().map(l => `<li><span>${STAGES[l.stage]}</span><span class="sub">${prettyDay(l.day)}</span></li>`).join('')}</ul>` : ''}`;
  };
  el.addEventListener('input', e => { if (e.target.id === 'nm') d.name = e.target.value; });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.ev) { d.event = b.dataset.ev; return draw(); }
    if (b.dataset.sug) { d.name = b.dataset.sug; return draw(); }
    if (b.dataset.st) { d.stage = +b.dataset.st; return draw(); }
    if (b.id === 'save') {
      d.name = d.name.trim().slice(0, 40);
      if (!d.name) return toast('Enter the skill name');
      if (d.stage === 3 && (existing?.data.stage ?? -1) < 3 && !await ask(`${d.name}: competition-ready?`, 'Only when your coach agrees it is.', [{ label: 'Yes, competition-ready', value: true }])) return;
      if (!existing || existing.data.stage !== d.stage) d.log = [...(d.log || []), { stage: d.stage, day: today() }].slice(-40);
      await saveEntry('skill', d, existing ? { id: existing.id, day: existing.day, ts: existing.ts } : {});
      close(); toast(existing ? 'Skill saved' : 'Skill added'); window.goku.render();
    }
    if (b.id === 'del' && await ask(`Delete ${existing.data.name}?`, 'Its stage history goes too.', [{ label: 'Delete', value: true, danger: true }])) {
      await deleteEntry(existing.id); close(); window.goku.render();
    }
  }));
  draw();
}
