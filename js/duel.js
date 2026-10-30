// Duels: a friendly weekly race between profiles on this phone, by training days.
// Only profiles that turned Duels on take part, and only the day count is shared.
import * as db from './db.js';
import { S } from './state.js';
import { esc } from './ui.js';
import { addDays, weekStart } from './time.js';
import { avatarHTML } from './avatar.js';

const TRAINING = ['session', 'activity'];
async function trainingDays(p, from, to) {
  const list = await db.byIndexRange('entries', 'profileDay', [p.id, from], [p.id, to]);
  return new Set(list.filter(e => TRAINING.includes(e.type)).map(e => e.day)).size;
}

export async function duelCard(p, today) {
  if (p.settings.duel !== true) return '';
  const rivals = S.profiles.filter(o => o.id !== p.id && o.settings?.duel === true);
  if (!rivals.length) return `<section class="card"><p class="lbl">Duel</p>
    <p class="sub">You're in. The duel starts when another profile on this phone turns Duels on in Settings.</p></section>`;
  const ws = weekStart(today), lws = addDays(ws, -7), lwe = addDays(ws, -1);
  const rows = await Promise.all([p, ...rivals].map(async o => ({ o, now: await trainingDays(o, ws, today), last: await trainingDays(o, lws, lwe) })));
  const top = Math.max(...rows.map(r => r.now)), lastTop = Math.max(...rows.map(r => r.last));
  const lastWinners = rows.filter(r => r.last === lastTop && lastTop > 0).map(r => r.o.id === p.id ? 'you' : esc(r.o.name));
  return `<section class="card duel"><p class="lbl">Duel · training days this week</p>
    <ul class="list">${rows.map(r => `<li><span class="row" style="gap:10px;justify-content:flex-start">${avatarHTML(r.o, 28)}<span>${r.o.id === p.id ? 'You' : esc(r.o.name)}</span></span>
      <b class="num">${r.now}${r.now === top && top > 0 && rows.filter(x => x.now === top).length === 1 ? ' <span class="sub">leading</span>' : ''}</b></li>`).join('')}</ul>
    <p class="note">${lastWinners.length ? `Last week: ${lastWinners.join(' and ')} ${lastWinners.length > 1 ? 'tied' : 'won'} with ${lastTop}. ` : ''}A day counts when a session or other training is logged.</p></section>`;
}
