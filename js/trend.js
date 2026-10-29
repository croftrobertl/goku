// Training load trend: the last 8 Sunday-to-Saturday weeks as bars. Gymnastics counts load
// (minutes × effort, the session-RPE method); strength counts training minutes, because
// circuits don't ask for an effort score. Trend only: no zones, no risk score.
import { esc } from './ui.js';
import { addDays, weekStart, prettyDay } from './time.js';
import { whyBtn } from './why.js';

const WEEKS = 8;
const circuitMinutes = s => Math.max(0, (s.data.endedAt - s.data.startedAt) / 60000);

export function weeklyLoad(p, all, today) {
  const first = addDays(weekStart(today), -7 * (WEEKS - 1));
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({ from: addDays(first, 7 * i), value: 0 }));
  for (const e of all) {
    if (e.day < first || e.day > today) continue;
    const w = weeks[Math.floor((new Date(e.day + 'T00:00:00Z') - new Date(first + 'T00:00:00Z')) / 6048e5)];
    if (!w) continue;
    if (e.type === 'activity') w.value += p.kind === 'perf' ? e.data.minutes * e.data.effort : e.data.minutes;
    else if (e.type === 'session') w.value += 'kind' in e.data ? (p.kind === 'perf' ? e.data.minutes * e.data.effort : e.data.minutes) : circuitMinutes(e);
  }
  weeks.forEach(w => { w.value = Math.round(w.value); });
  return weeks;
}

export function trendCard(p, all, today) {
  const weeks = weeklyLoad(p, all, today);
  if (!weeks.some(w => w.value)) return '';
  const unit = p.kind === 'perf' ? 'load' : 'min';
  const now = weeks[WEEKS - 1], past = weeks.slice(WEEKS - 5, WEEKS - 1);
  const avg = Math.round(past.reduce((a, w) => a + w.value, 0) / past.length);
  const max = Math.max(...weeks.map(w => w.value), 1);
  const W = 320, H = 120, gap = 8, bw = (W - gap * (WEEKS - 1)) / WEEKS;
  const bars = weeks.map((w, i) => {
    const h = w.value ? Math.max(3, w.value / max * (H - 18)) : 0, x = i * (bw + gap);
    return `<rect x="${x}" y="${H - h}" width="${bw}" height="${h}" rx="4" class="${i === WEEKS - 1 ? 'tb now' : 'tb'}"/>`;
  }).join('');
  const avgY = H - avg / max * (H - 18);
  // Pace: where an average week would be by today, so a Monday bar isn't judged against full weeks.
  const elapsed = Math.round((new Date(today + 'T00:00:00Z') - new Date(now.from + 'T00:00:00Z')) / 864e5) + 1;
  const pace = Math.round(avg * elapsed / 7), paceY = H - pace / max * (H - 18), px = (WEEKS - 1) * (bw + gap);
  const label = `${p.kind === 'perf' ? 'Training load' : 'Training minutes'} for the last ${WEEKS} weeks: ` + weeks.map(w => `week of ${prettyDay(w.from)} ${w.value}`).join(', ');
  return `<section class="card trend"><div class="row"><p class="lbl" style="margin:0">${p.kind === 'perf' ? 'Training load' : 'Training minutes'} · ${WEEKS} weeks</p>${whyBtn('load')}</div>
    <svg viewBox="0 0 ${W} ${H + 2}" role="img" aria-label="${esc(label)}" style="width:100%;height:auto;margin-top:10px">${bars}
      ${avg ? `<line x1="0" x2="${W}" y1="${avgY}" y2="${avgY}" class="avgline"/>` : ''}
      ${avg && elapsed < 7 ? `<line x1="${px}" x2="${px + bw}" y1="${paceY}" y2="${paceY}" class="paceline"/>` : ''}</svg>
    <div class="row" style="margin-top:6px"><span class="sub">${prettyDay(weeks[0].from)}</span><span class="sub">this week</span></div>
    <ul class="list" style="margin-top:6px"><li><span>This week so far</span><b class="num">${now.value} ${unit}</b></li>
      ${avg && elapsed < 7 ? `<li><span>Usual by today <span class="sub">(short line)</span></span><b class="num">${pace} ${unit}</b></li>` : ''}
      <li><span>4-week average <span class="sub">(dashed)</span></span><b class="num">${avg} ${unit}</b></li></ul></section>`;
}
