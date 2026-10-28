// All dates are US/Eastern. A "day" runs until the profile's dayEndsAt hour
// (default 3 AM), so a 1 AM entry counts toward the previous day.
export const TZ = 'America/New_York';
const DAY = 86400000;

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

function eastern(ts) {
  const o = {};
  for (const p of parts.formatToParts(new Date(ts))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour };
}

// ISO date string (YYYY-MM-DD) of the training day that ts falls in.
export function dayKey(ts = Date.now(), dayEndsAt = 3) {
  const e = eastern(ts);
  const date = new Date(Date.UTC(e.y, e.m - 1, e.d));
  if (e.h < dayEndsAt) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function addDays(key, n) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekday = key => new Date(key + 'T00:00:00Z').getUTCDay(); // 0 = Sunday

// Sunday that starts the week containing key.
export const weekStart = key => addDays(key, -weekday(key));

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function prettyDay(key) {
  const d = new Date(key + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / DAY);
