// Library helpers (1.8): the "?" explanation for any exercise, and a searchable picker that
// adds catalog exercises to the person's circuit library.
import { MOVES, GROUPS, EQUIP, LEVELS, moveById, searchMoves, suggestMoves } from './moves.js';
import { figureSVG } from './figure.js';
import { artOf, muscleMap, muscleLine } from './muscles.js';
import { profile, saveEntry } from './state.js';
import { esc, overlay, guard, toast, sources } from './ui.js';

// Circuit groups for each catalog group.
const SLOT = { push: 'push', pull: 'pull', legs: 'legs', core: 'core', power: 'power', cardio: 'power', mobility: 'joints' };
// The starter library's names, so its exercises get a "?" too.
const ALIAS = { 'perfect pushup': 'pushup', 'trx row': 'trx-row', 'db goblet squat': 'goblet-squat', 'hanging leg raise': 'hanging-leg-raise',
  'db push press': 'db-push-press', 'playset pull-up': 'pullup', 'trx chest press': 'trx-chest-press', 'db row': 'db-row',
  'db reverse lunge': 'reverse-lunge', 'pike pushup': 'pike-pushup', 'prone y-t-w raise': 'ytw', 'bodyweight squat': 'bw-squat',
  'split squat': 'split-squat', 'dead bug': 'dead-bug', 'broad jump': 'broad-jump', 'copenhagen plank': 'copenhagen' };
export const moveFor = ex => moveById(ex?.moveId) || moveById(ALIAS[String(ex?.name || '').trim().toLowerCase()])
  || MOVES.find(m => m.name.toLowerCase() === String(ex?.name || '').trim().toLowerCase()) || null;

const equipName = k => EQUIP.find(e => e[0] === k)?.[1] || k;
const groupName = k => GROUPS.find(g => g[0] === k)?.[1] || k;
export const howBtn = (id, name) => `<button class="how" data-how="${esc(id)}" aria-label="How to do ${esc(name)}">?</button>`;

// The "?" popup (2.4): the drawings first, then the muscles it works, then the steps.
// Details (level, equipment, the drawings' credits) sit last, in small print.
export function showMove(id, { onAdd = null, added = false } = {}) {
  const m = moveById(id); if (!m) return;
  const art = artOf(m.id);
  const pic = (src, alt) => `<img src="${src}" alt="${esc(alt)}" loading="lazy">`;
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">${esc(m.name)}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll">
      <div class="figs${art ? ' art' : ''}">
        <figure>${art ? pic(art.start, `${m.name}: start position`) : figureSVG(m.start)}<figcaption>1 · Start</figcaption></figure>
        <figure>${art ? pic(art.end, `${m.name}: finish position`) : figureSVG(m.end)}<figcaption>2 · Finish</figcaption></figure></div>
      ${art?.note ? `<p class="note" style="text-align:center">${esc(art.note)}</p>` : ''}
      <div class="musmap" id="musmap"></div>
      ${muscleLine(m.id)}
      <ol class="steps">${m.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="tipline"><b>Tip:</b> ${esc(m.tip)}</p>
      ${m.mode === 'hold' ? '<p class="note">Held for time, not counted in reps.</p>' : ''}
      <p class="note">${esc(LEVELS[m.level])} · ${esc(equipName(m.equip))}. Start light and slow. Sore muscles are normal; sharp pain means stop.</p>
      ${sources([...(art ? ['Drawings: <a href="https://github.com/everkinetic/data" target="_blank" rel="noopener">Everkinetic</a>, CC BY-SA 4.0.'] : []),
        'Muscle map: OpenStax, T. Kebert and umimeto.org, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>, recolored.'])}
    </div>
    ${onAdd ? `<button class="cta" id="addMove" ${added ? 'disabled' : ''}>${added ? 'In your library' : 'Add to my library'}</button>` : ''}`, { label: m.name });
  muscleMap(m.id).then(svg => { const box = el.querySelector('#musmap'); if (box) box.innerHTML = svg; });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') close();
    if (b.id === 'addMove') { await onAdd(m); close(); }
  }));
}

export async function addMove(m) {
  await saveEntry('exercise', { name: m.name.slice(0, 40), slot: SLOT[m.group] || 'core', module: null, order: 999, mode: m.mode,
    moveId: m.id, stages: m.chain.map(label => ({ label, load: null })) }, { day: '1970-01-01' });
  // Circuits draw from push, pull, legs and core; the rest are warm-up and cool-down moves.
  toast(['push', 'pull', 'legs', 'core'].includes(m.group) ? `${m.name} added to your library` : `${m.name} added. Circuits use push, pull, legs and core, so use it to warm up or cool down.`, 4000);
}

// The picker: a search box, group and equipment drop-downs, and results grouped into
// collapsible sections until you type.
export function pickMove({ onCustom, have = [] } = {}) {
  const p = profile();
  const owned = ['bw', 'wall', 'bench', ...(p.about?.equipment || [])];
  const f = { q: '', group: '', equip: '' };
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Add exercise</h1><button class="cta2" id="x" data-close>Close</button></div>
    <label class="f"><span>Search</span><input id="q" type="search" placeholder="e.g. squat, chest, band" autocomplete="off" enterkeyhint="search"></label>
    <div class="pills sugg" id="sugg" aria-label="Suggestions"></div>
    <div class="row" style="gap:8px;margin-top:8px">
      <label class="f" style="flex:1;margin:0"><span>Group</span><select id="grp"><option value="">All groups</option>${GROUPS.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
      <label class="f" style="flex:1;margin:0"><span>Equipment</span><select id="eq"><option value="">Any</option>${p.about?.equipment ? '<option value="have">What I have (from setup)</option>' : ''}${EQUIP.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
    </div>
    <p class="sub" id="count" role="status" style="margin-top:8px"></p>
    <div class="scroll" id="res"></div>
    <button class="cta2" id="custom" style="width:100%;margin-top:8px">Create your own exercise</button>`, { label: 'Add exercise' });
  const row = m => `<li><span><b>${esc(m.name)}</b><br><span class="chain">${esc(LEVELS[m.level])} · ${esc(equipName(m.equip))}${have.includes(m.id) ? ' · in your library' : ''}</span></span>
    <span class="row" style="gap:6px">${howBtn(m.id, m.name)}<button class="cta2" data-add="${m.id}" ${have.includes(m.id) ? 'disabled' : ''} aria-label="Add ${esc(m.name)}">${have.includes(m.id) ? 'Added' : 'Add'}</button></span></li>`;
  const draw = () => {
    const list = searchMoves({ q: f.q, group: f.group, equip: f.equip === 'have' ? '' : f.equip, have: f.equip === 'have' ? owned : null });
    if (!f.q.trim()) list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)); // typed searches keep best-match order
    el.querySelector('#sugg').innerHTML = suggestMoves(f.q).map(s => `<button data-sugg="${esc(s)}">${esc(s)}</button>`).join('');
    el.querySelector('#count').textContent = (list.fixed ? `Showing results for “${list.fixed}” · ` : '') + `${list.length} of ${MOVES.length} exercises`;
    el.querySelector('#res').innerHTML = !list.length ? '<div class="empty"><p>Nothing matches. Try another word or set Equipment to Any.</p></div>'
      : f.q || f.group ? `<ul class="list">${list.map(row).join('')}</ul>`
      : GROUPS.map(([k, n]) => { const g = list.filter(m => m.group === k); return g.length ? `<details class="card fold grp"><summary class="lbl">${esc(n)} · ${g.length}</summary><ul class="list">${g.map(row).join('')}</ul></details>` : ''; }).join('');
  };
  el.addEventListener('input', e => { if (e.target.id === 'q') { f.q = e.target.value; draw(); } });
  el.addEventListener('change', e => { if (e.target.id === 'grp') f.group = e.target.value; if (e.target.id === 'eq') f.equip = e.target.value; draw(); });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') { close(); return window.goku.render(); }
    if (b.id === 'custom') { close(); return onCustom?.(); }
    if (b.dataset.sugg) { f.q = b.dataset.sugg + ' '; const i = el.querySelector('#q'); i.value = f.q; i.focus(); return draw(); }
    if (b.dataset.how) return showMove(b.dataset.how, { added: have.includes(b.dataset.how), onAdd: async m => { await addMove(m); have.push(m.id); draw(); el.querySelector(`[data-how="${m.id}"]`)?.focus(); } });
    if (b.dataset.add && !have.includes(b.dataset.add)) { await addMove(moveById(b.dataset.add)); have.push(b.dataset.add); draw(); el.querySelector(`[data-how="${b.dataset.add}"]`)?.focus(); }
  }));
  draw();
  return { close };
}

export { groupName };
