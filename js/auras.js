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

// Rob's aura renders (2.21): one ring per form. RING gives each ring's empty middle (center and radius, as
// fractions of the picture), measured by tools/review/renders/cut3.py, so the avatar sits right in the hole.
const RING = {"ss1": [0.5125, 0.632, 0.217], "ss2": [0.4994, 0.6279, 0.2066], "ss3": [0.4947, 0.6842, 0.1772], "god": [0.4946, 0.6347, 0.2133], "blue": [0.5107, 0.6393, 0.206], "ui": [0.5015, 0.619, 0.2116]};
const FILE = ['ss1', 'ss2', 'ss3', 'god', 'blue', 'ui'];
export function auraSVG(form, px) {
  const name = FILE[FORMS.indexOf(form)], [cx, cy, r] = RING[name];
  const size = Math.round(px * .44 / r), left = Math.round(px / 2 - cx * size), top = Math.round(px / 2 - cy * size);
  return `<img class="saura" src="img/aura/${name}.png" alt="" aria-hidden="true" width="${size}" height="${size}" style="left:${left}px;top:${top}px">`;
}
