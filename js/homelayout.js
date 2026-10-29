// Edit Home: each profile can reorder and hide its Home cards (Settings → Home cards).
// Cards that only appear when relevant (a recap, a level-up) keep their place in the order.
import { saveProfile } from './state.js';
import { esc, overlay, guard } from './ui.js';

// [id, name, can hide?] in the default order.
export const CARDS = {
  engine: [['balls', 'Dragon Ball news', true], ['recap', 'Arc recap', true], ['coach', 'Coach questions', true], ['levelup', 'Level up', true],
    ['nudge', 'Coach nudge', true], ['chamber', 'Gravity chamber', false], ['circuit', 'Circuit', true], ['duel', 'Duel', true], ['streak', 'Streak', true],
    ['activity', 'Other training', true], ['senzu', 'Senzu map', true], ['trend', 'Training trend', true], ['stats', 'Last session and gut', true],
    ['sleep', 'Sleep note', true], ['fuel', 'Fuel ranges', true], ['timing', 'Fuel timing', true], ['hardsets', 'Hard sets', true]],
  perf: [['ready', 'Readiness', false], ['balls', 'Dragon Ball news', true], ['recap', 'Arc recap', true], ['coach', 'Coach questions', true],
    ['comp', 'Competition countdown', true], ['care', 'Care check', false], ['week', 'This week', true], ['duel', 'Duel', true], ['streak', 'Streak', true],
    ['today', 'Today', true], ['skills', 'Skill tree', true], ['trend', 'Training trend', true], ['fuel', 'Fuel ranges', true],
    ['timing', 'Fuel timing', true], ['longday', 'Long day tip', true]],
};

const order = p => {
  const ids = CARDS[p.kind].map(c => c[0]), saved = (p.settings.homeOrder || []).filter(id => ids.includes(id));
  return [...saved, ...ids.filter(id => !saved.includes(id))]; // cards added in a later version go last
};
const hidden = p => new Set((p.settings.homeHidden || []).filter(id => CARDS[p.kind].find(c => c[0] === id)?.[2]));

// cards: [[id, html]]. Returns the Home markup in the person's order, without hidden cards.
export function homeLayout(p, cards) {
  const html = Object.fromEntries(cards), off = hidden(p);
  return `<div class="homecards">${order(p).filter(id => !off.has(id) && html[id]?.trim()).map(id => html[id]).join('\n')}</div>`;
}

export function editHome(p, onDone = () => window.goku.render()) {
  const ids = order(p), off = hidden(p);
  const { el, close } = overlay(`<div class="row"><h1>Home cards</h1><button class="cta2" id="x" data-close>Done</button></div>
    <p class="sub">Move cards up or down, or hide the ones you don't use. Some only show when there's something to say.</p>
    <div class="scroll" id="f"></div>
    <button class="cta2" id="reset" style="width:100%;margin-top:8px">Back to the default order</button>`, { label: 'Home cards' });
  const name = id => CARDS[p.kind].find(c => c[0] === id);
  const draw = () => {
    el.querySelector('#f').innerHTML = `<ul class="list editlist">${ids.map((id, i) => `<li>
      <label class="toggle"><input type="checkbox" data-show="${id}" ${off.has(id) ? '' : 'checked'} ${name(id)[2] ? '' : 'disabled'}
        aria-label="Show ${esc(name(id)[1])}"><span>${esc(name(id)[1])}${name(id)[2] ? '' : ' <span class="sub">(always shown)</span>'}</span></label>
      <span class="row" style="gap:4px"><button class="cta2" data-mv="${i}" data-by="-1" ${i ? '' : 'disabled'} aria-label="Move ${esc(name(id)[1])} up">↑</button>
      <button class="cta2" data-mv="${i}" data-by="1" ${i < ids.length - 1 ? '' : 'disabled'} aria-label="Move ${esc(name(id)[1])} down">↓</button></span></li>`).join('')}</ul>`;
  };
  const save = async () => { p.settings.homeOrder = [...ids]; p.settings.homeHidden = [...off]; await saveProfile(p); };
  el.addEventListener('change', guard(async e => {
    const id = e.target.dataset.show; if (!id) return;
    if (e.target.checked) off.delete(id); else off.add(id);
    await save();
  }));
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') { close(); return onDone(); }
    if (b.id === 'reset') { ids.splice(0, ids.length, ...CARDS[p.kind].map(c => c[0])); off.clear(); await save(); return draw(); }
    if (b.dataset.mv) {
      const i = +b.dataset.mv, j = i + +b.dataset.by;
      [ids[i], ids[j]] = [ids[j], ids[i]]; await save(); draw();
      (el.querySelector(`[data-mv="${j}"][data-by="${b.dataset.by}"]:not([disabled])`) || el.querySelector(`[data-mv="${j}"]:not([disabled])`))?.focus();
    }
  }));
  draw();
}
