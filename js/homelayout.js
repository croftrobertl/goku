// Edit Home: each profile can reorder and hide its Home cards (Settings → Home cards).
// Cards that only appear when relevant (a recap, a level-up) keep their place in the order.
import { saveProfile } from './state.js';
import { esc, overlay, guard } from './ui.js';
import { W, skinOf } from './skins.js';

// [id, name, can hide?] in the default order.
export const CARDS = {
  engine: [['risk', 'Streak at risk', true], ['balls', 'Dragon Ball news', true], ['wish', "Shenron's wish", true], ['recap', 'Arc recap', true], ['coach', 'Coach questions', true], ['levelup', 'Level up', true],
    ['nudge', 'Coach nudge', true], ['chamber', "Today's workout", false], ['circuit', 'Circuit', true], ['fuelnow', 'Fuel now', true], ['scouter', 'Scouter', true], ['duel', 'Duel', true], ['streak', 'Streak', true],
    ['activity', 'Other training', true], ['senzu', 'Body map', true], ['trend', 'Training trend', true], ['weight', 'Weight trend', true], ['stats', 'Last session and food', true],
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
const STATS = ['week', 'recap', 'streak', 'senzu', 'trend', 'weight', 'hardsets', 'stats', 'skills', 'timing'];
const SAGA = ['saga', 'balls', 'wish', 'duel', 'scouter'];
const sectionOf = id => SAGA.includes(id) ? 'saga' : STATS.includes(id) ? 'stats' : 'today';
let view = 'today'; // which Home section is on screen: today, stats, or saga (the Saga screen)
export const setHomeView = v => { view = v; };
export const homeView = () => view;

// Today rows (2.6): every Today card but the workout folds into a one-line row that opens
// in place. Which rows are open survives a redraw, so logging inside one doesn't close it.
const openRows = new Set();
const text = html => (html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] || '').replace(/<[^>]+>/g, '').trim();
const row = (id, html, [label, summary]) => `<details class="hrow" data-row="${id}"${openRows.has(id) ? ' open' : ''}>
  <summary><b>${esc(label)}</b><span>${esc(summary ?? text(html))}</span></summary><div class="hrowbody">${html}</div></details>`;
export function bindRows(root) {
  root.querySelectorAll('details.hrow').forEach(d => d.addEventListener('toggle', () => { if (d.open) openRows.add(d.dataset.row); else openRows.delete(d.dataset.row); }));
}

// cards: [[id, html]]; strip: the Ki gauge; rows: {id: [label, summary?]} for the cards shown
// as one-line rows on Today (summary defaults to the card's heading).
// Returns the markup for the current section, in the person's order, without hidden cards.
// On desktop, Today is the panel and rows on the left and the Ki gauge as a scouter column.
export function homeLayout(p, cards, { strip = '', rows = {} } = {}) {
  const html = Object.fromEntries(cards), off = hidden(p);
  let ids = order(p).filter(id => !off.has(id) && html[id]?.trim() && sectionOf(id) === view);
  if (view === 'today') ids = [...ids.filter(id => !rows[id]), ...ids.filter(id => rows[id])]; // panels first, then the rows
  const item = id => view === 'today' && rows[id] ? row(id, html[id], rows[id]) : html[id];
  const body = ids.length ? `<div class="homecards">${ids.map(item).join('\n')}</div>`
    : `<p class="sub" style="text-align:center;margin-top:16px">${view === 'stats' ? 'Your stats show up here once you log a few days.' : 'Nothing here yet.'}</p>`;
  if (view === 'saga') return body;
  return `<div class="seg hview" role="group" aria-label="Home view"><button data-hview="today" aria-pressed="${view === 'today'}">Today</button><button data-hview="stats" aria-pressed="${view === 'stats'}">Stats</button></div>
    ${view === 'today' ? `<div class="today"><aside class="tside">${strip}</aside><div class="tmain">${body}</div></div>` : body}`;
}

export function editHome(p, onDone = () => window.goku.render()) {
  const ids = order(p), off = hidden(p);
  const { el, close } = overlay(`<div class="row"><h1>Home cards</h1><button class="cta2" id="x" data-close>Close</button></div>
    <p class="sub">Move cards up or down, or hide the ones you don't use. Some only show when there's something to say.</p>
    <div class="scroll" id="f"></div>
    <button class="cta2" id="reset" style="width:100%;margin-top:8px">Back to the default order</button>`, { label: 'Home cards' });
  // Card names follow the skin (2.8): "Saga map" is "Tour map" under Encore.
  const SKINNED = { balls: () => `${W('ball')} news`, wish: () => `${W('wisher')}${skinOf(p) === 'dbz' ? "'s" : ''} wish`, chamber: () => "Today's workout",
    scouter: () => W('scouter'), ready: () => W('readiness'), saga: () => W('sagaMap'), recap: () => `${W('arc')} recap` };
  const name = id => { const c = CARDS[p.kind].find(x => x[0] === id); return SKINNED[id] ? [c[0], SKINNED[id](), c[2]] : c; };
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
