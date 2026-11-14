// Super Saiyan aura forms (2.20, review 19): the streak powers up the avatar's aura, drawn as flames
// behind it. Dragon Ball skin only; Encore and Plain keep the plain gold and blue rings.
// [streak days, name, inner, middle, edge, flame height, lightning color, Ultra Instinct wisps]
export const FORMS = [
  [7, 'Super Saiyan', '#fff3a0', '#ffd21f', '#f0a800', 16],
  [14, 'Super Saiyan 2', '#fff3a0', '#ffd21f', '#f0a800', 18, '#7fe8ff'],
  [21, 'Super Saiyan 3', '#fff3a0', '#ffc81f', '#e89a00', 26, '#7fe8ff'],
  [30, 'Super Saiyan God', '#ffd0c8', '#ff5a4a', '#c9201a', 17],
  [60, 'Super Saiyan Blue', '#e4fbff', '#4fd8ff', '#1f8fe0', 18],
  [100, 'Ultra Instinct', '#ffffff', '#cfd8ea', '#8fa0c6', 20, null, true],
];
export const formFor = days => FORMS.filter(f => days >= f[0]).pop() || null;

// Flame tongues around a circle of radius 28 centered at (60, 66), longest at the top.
function flame(amp, seed) {
  const pts = [], n = 22;
  for (let i = 0; i <= n * 2; i++) {
    const t = i / (n * 2) * Math.PI * 2, up = Math.max(0, -Math.sin(t)), side = Math.abs(Math.cos(t));
    const r = i % 2 ? 30 + amp * (0.25 + up + side * .25) * (0.8 + .4 * Math.abs(Math.sin(i * 1.7 + seed))) : 28;
    pts.push([60 + r * Math.cos(t), 66 + r * Math.sin(t) - (i % 2 ? amp * .35 * (1 - up) : 0)]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) { const [x, y] = pts[i], [px, py] = pts[i - 1]; d += ` Q${((x + px) / 2).toFixed(1)} ${(Math.min(y, py) - 2).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; }
  return d + 'z';
}

// The aura for an avatar of `px` pixels. The flames are kept a little shorter than the review drawing so
// they stay inside the header.
export function auraSVG(form, px) {
  const [, , c0, c1, c2, amp0, bolt, ui] = form, amp = amp0 * .7, size = Math.round(px * 120 / 56), k = FORMS.indexOf(form);
  return `<svg class="saura" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" style="margin:${-(size - px) / 2 - px * .1}px 0 0 ${-(size - px) / 2}px">
    <defs><radialGradient id="sag${k}" cx=".5" cy=".58" r=".6"><stop offset=".45" stop-color="${c0}"/><stop offset=".75" stop-color="${c1}"/><stop offset="1" stop-color="${c2}" stop-opacity=".85"/></radialGradient></defs>
    <path d="${flame(amp + 4, k)}" fill="${c1}" opacity=".35"/><path class="sflame" d="${flame(amp, k + 1)}" fill="url(#sag${k})" stroke="${c2}" stroke-width="1.2" stroke-linejoin="round"/>
    ${ui ? '<path d="M40 30c4 6 2 10-2 14M82 26c-3 7 0 11 4 15M60 18c-2 6 1 9 3 12" fill="none" stroke="#6f86c9" stroke-width="2" stroke-linecap="round" opacity=".8"/>' : ''}
    ${bolt ? `<path d="M30 40l6 7-4 2 6 8M88 34l-5 8 4 1-6 9M92 84l-7 4 3 3-8 3" fill="none" stroke="${bolt}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</svg>`;
}
