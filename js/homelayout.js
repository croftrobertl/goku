// Edit Home: each profile can reorder and hide its Home cards (Settings → Home cards).
// Cards that only appear when relevant (a recap, a level-up) keep their place in the order.
import { saveProfile } from './state.js';
import { esc, overlay, guard } from './ui.js';

// [id, name, can hide?] in the default order.
export const CARDS = {
  engine: [['risk', 'Streak at risk', true], ['balls', 'Dragon Ball news', true], ['wish', "Shenron's wish", true], ['recap', 'Arc recap', true], ['coach', 'Coach questions', true], ['levelup', 'Level up', true],
    ['nudge', 'Coach nudge', true], ['chamber', 'Gravity chamber', false], ['circuit', 'Circuit', true], ['fuelnow', 'Fuel now', true], ['scouter', 'Scouter', true], ['duel', 'Duel', true], ['streak', 'Streak', true],
    ['activity', 'Other training', true], ['senzu', 'Body map', true], ['trend', 'Training trend', true], ['stats', 'Last session and food', true],
    ['sleep', 'Sleep note', true], ['fuel', 'Fuel ranges', true], ['timing', 'Fuel timing', true], ['saga', 'Saga map', true], ['hardsets', 'Hard sets', true]],
  perf: [['risk', 'Streak at risk', true], ['ready', 'Scouter and readiness', false], ['balls', 'Dragon Ball news', true], ['wish', "Shenron's wish", true], ['recap', 'Arc recap', true], ['coach', 'Coach questions', true],
    ['comp', 'Competition countdown', true], ['care', 'Care check', false], ['fuelnow', 'Fuel now', true], ['week', 'This week', true], ['duel', 'Duel', true], ['streak', 'Streak', true],
    ['today', 'Today', true], ['skills', 'Skill tree', true], ['trend', 'Training trend', true], ['fuel', 'Fuel ranges', true],
    ['timing', 'Fuel timing', true], ['saga', 'Saga map', true], ['longday', 'Long day tip', true]],
};

const order = p => {
  const ids = CARDS[p.kind].map(c => c[0]), saved = (p.settings.homeOrder || []).filter(id => ids.includes(id));
  // A card added in a later version slots in after its neighbor in the default order.
  const out = [...saved];
  ids.forEach((id, i) => { if (out.includes(id)) return;
    const prev = ids.slice(0, i).reverse().find(x => out.includes(x)); out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, id); });
  return out;
};
const hidden = p => new Set((p.settings.homeHidden || []).filter(id => CARDS[p.kind].find(c => c[0] === id)?.[2]));

// Home (2.5) starts simple: a Today / Stats switch, with the game cards on their own Saga screen.
// Within each, the person's order holds. Cards not listed here are Today cards.
const STATS = ['week', 'recap', 'streak', 'senzu', 'trend', 'hardsets', 'stats', 'skills', 'timing'];
const SAGA = ['saga', 'balls', 'wish', 'duel', 'scouter'];
const sectionOf = id => SAGA.includes(id) ? 'saga' : STATS.includes(id) ? 'stats' : 'today';
let view = 'today'; // which Home section is on screen: today, stats, or saga (the Saga screen)
export const setHomeView = v => { view = v; };
export const homeView = () => view;

// cards: [[id, html]]; strip: the one-line status shown above Today.
// Returns the markup for the current section, in the person's order, without hidden cards.
export function homeLayout(p, cards, { strip = '' } = {}) {
  const html = Object.fromEntries(cards), off = hidden(p);
  const ids = order(p).filter(id => !off.has(id) && html[id]?.trim() && sectionOf(id) === view);
  const body = ids.length ? `<div class="homecards">${ids.map(id => html[id]).join('\n')}</div>`
    : `<p class="sub" style="text-align:center;margin-top:16px">${view === 'stats' ? 'Your stats show up here once you log a few days.' : 'Nothing here yet.'}</p>`;
  if (view === 'saga') return body;
  return `<div class="seg hview" role="group" aria-label="Home view"><button data-hview="today" aria-pressed="${view === 'today'}">Today</button><button data-hview="stats" aria-pressed="${view === 'stats'}">Stats</button></div>
    ${view === 'today' ? strip : ''}${body}`;
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
