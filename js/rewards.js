// The real-prize list (2.33, review 48) for Lennon's wish and Alice's encore. Plain data, so a rewards page can
// replace this file later: each prize is an id, a name and a kind (treat, together, outing or other).
// Each child's profile starts from this list and keeps its own copy, which a grown-up edits behind the passcode.
import { overlay, esc, toast } from './ui.js';

export const KINDS = ['treat', 'together', 'outing', 'other'];
export const PRIZE_LIST = [
  { id: 'culvers', name: "Ice cream from Culver's", kind: 'treat' },
  { id: 'flan', name: 'Flan from Publix', kind: 'treat' },
  { id: 'game-night', name: 'Game night with Dad', kind: 'together' },
  { id: 'breakfast', name: 'Breakfast out with Dad', kind: 'together' },
  { id: 'movie', name: 'A movie night', kind: 'together' },
  { id: 'park', name: 'A trip to the park', kind: 'outing' },
  { id: 'library', name: 'A trip to the library', kind: 'outing' },
  { id: 'mini-golf', name: 'Mini golf', kind: 'outing' },
  { id: 'screen', name: '30 minutes of extra screen time', kind: 'other' },
  { id: 'late', name: 'Stay up 30 minutes late', kind: 'other' },
  { id: 'toy', name: 'A small toy', kind: 'other' },
];
export const MAX_PRIZES = 30, MAX_NAME = 60;

export const prizesOf = p => p.prizes || PRIZE_LIST;
export const prizeName = (p, id) => prizesOf(p).find(x => x.id === id)?.name || '';
// "Ice cream from Culver's" reads "ice cream from Culver's" mid-sentence; names that start with a capitalised word stay as they are.
export const inSentence = s => /^[A-Z][a-z]/.test(s) && !/^[A-Z][a-z]+'s\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

// Lennon and Alice get their own copy once. Lennon's 2.32 picks carry over: the old "a game with a grown-up" becomes
// game night, and a prize a grown-up typed joins the list.
export function ensurePrizes(p) {
  if (!['lennon', 'alice'].includes(p?.who) || p.prizes) return false;
  p.prizes = PRIZE_LIST.map(x => ({ ...x }));
  const old = p.kid?.prize;
  if (old?.own) { const id = newId(p); p.prizes.push({ id, name: old.own.slice(0, MAX_NAME), kind: 'other' }); p.kid.prize = { pick: id }; }
  else if (old?.pick === 'game') p.kid.prize = { pick: 'game-night' };
  if (p.who === 'alice' && !p.encore) p.encore = { ok: [], claimed: null };
  return true;
}
const newId = p => { let n = 1; while (prizesOf(p).some(x => x.id === 'own-' + n)) n++; return 'own-' + n; };

// The editor (review 48: one row per prize). Resolves true when saved.
export function editPrizes(p, save) {
  return new Promise(resolve => {
    let rows = prizesOf(p).map(x => ({ ...x }));
    const { el, close } = overlay('', { label: 'Prize list', id: 'prizeedit' });
    const inner = el.querySelector('.inner');
    const draw = focus => {
      inner.innerHTML = `<h1>Prize list</h1><p class="sub">Change any name, remove one with ✕, or add a new one.</p>
        ${rows.map((r, i) => `<div class="ed"><input data-row="${i}" maxlength="${MAX_NAME}" value="${esc(r.name)}" aria-label="Prize ${i + 1}">
          <button class="cta2 x" data-del="${i}" aria-label="Remove ${esc(r.name)}">✕</button></div>`).join('')}
        ${rows.length < MAX_PRIZES ? `<div class="ed"><input id="pzNew" maxlength="${MAX_NAME}" placeholder="Add a prize" aria-label="Add a prize"><button class="cta2 x" id="pzAdd">Add</button></div>` : ''}
        <button class="cta" id="pzSave" style="margin-top:12px">Save</button>
        <p style="text-align:center"><button class="link" data-close>Cancel</button></p>`;
      if (focus) inner.querySelector(focus)?.focus();
    };
    const add = () => {
      const v = inner.querySelector('#pzNew')?.value.trim(); if (!v) return;
      rows.push({ id: '', name: v.slice(0, MAX_NAME), kind: 'other' }); draw('#pzNew');
    };
    draw();
    el.addEventListener('input', e => { const i = e.target.dataset.row; if (i !== undefined) rows[+i].name = e.target.value; });
    el.addEventListener('keydown', e => { if (e.target.id === 'pzNew' && e.key === 'Enter') { e.preventDefault(); add(); } });
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { close(); return resolve(false); }
      if (b.dataset.del !== undefined) { rows.splice(+b.dataset.del, 1); return draw(rows.length ? '[data-del]' : '#pzNew'); }
      if (b.id === 'pzAdd') return add();
      if (b.id === 'pzSave') {
        const typed = inner.querySelector('#pzNew')?.value.trim();
        if (typed) rows.push({ id: '', name: typed.slice(0, MAX_NAME), kind: 'other' });
        const kept = rows.map(r => ({ ...r, name: r.name.trim().slice(0, MAX_NAME) })).filter(r => r.name);
        if (!kept.length) return toast('Keep at least one prize.');
        p.prizes = [];
        for (const r of kept) p.prizes.push({ id: r.id || newId(p), name: r.name, kind: KINDS.includes(r.kind) ? r.kind : 'other' });
        await save(); close(); resolve(true);
      }
    });
  });
}
