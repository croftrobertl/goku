// Avatars. No official artwork is used or shipped: a character avatar is an original glossy
// orb in that character's signature colors with their initial, labeled with their name.
// A photo the person picks is resized here and stored only on this phone.
import { esc, contrast } from './ui.js';

// [id, name, orb color, ring color, accent the app switches to]
export const CHARACTERS = [
  ['goku', 'Goku', '#ff8a2a', '#1d4fa8', '#ff8a3d'], ['vegeta', 'Vegeta', '#2c5fd6', '#e9edf5', '#5ea4ff'],
  ['gohan', 'Gohan', '#7b3fb5', '#d9332b', '#b18cff'], ['piccolo', 'Piccolo', '#3fae49', '#6a2c91', '#7ee081'],
  ['krillin', 'Krillin', '#f07c22', '#ffd166', '#ff8a3d'], ['trunks', 'Trunks', '#6f5bd6', '#2b2f3a', '#b18cff'],
  ['roshi', 'Master Roshi', '#e8742a', '#f2c14e', '#f2c14e'], ['bulma', 'Bulma', '#2bb3b3', '#e84d8a', '#4fd1c5'],
  ['tien', 'Tien', '#2a9d8f', '#f2c14e', '#4fd1c5'], ['yamcha', 'Yamcha', '#e8742a', '#2a9d8f', '#ff8a3d'],
  ['frieza', 'Frieza', '#ece6f5', '#8a3fb5', '#b18cff'], ['cell', 'Cell', '#3d8f3d', '#1f1f1f', '#7ee081'],
  ['buu', 'Majin Buu', '#ff7ab8', '#f5f5f5', '#ff7ab8'], ['android18', 'Android 18', '#2c5fd6', '#f5d76e', '#5ea4ff'],
  ['broly', 'Broly', '#3fae49', '#f2c14e', '#7ee081'], ['beerus', 'Beerus', '#8a5bd6', '#d4a017', '#b18cff'],
  ['whis', 'Whis', '#6fa8dc', '#2b2f6b', '#5ea4ff'], ['jiren', 'Jiren', '#d9332b', '#1f1f1f', '#ff7ab8'],
];
const initialOf = name => /\d/.test(name) ? name.replace(/\D/g, '').slice(0, 2) : name.slice(0, 1).toUpperCase();

// [id, name, aura color]: the person's own initial wrapped in a power-up glow.
export const AURAS = [
  ['saiyan', 'Saiyan gold', '#f5c542'], ['blue', 'Divine blue', '#4fb3ff'], ['namek', 'Namekian green', '#3fd18f'],
  ['majin', 'Majin pink', '#ff6fb0'], ['destroyer', 'Destroyer purple', '#a86bff'], ['kaio', 'Crimson', '#ff5a4a'],
];

let gid = 0;
function orb(fill, ring, text, px) {
  const id = 'og' + (++gid);
  const ink = contrast(fill, '#111111') >= contrast(fill, '#ffffff') ? '#111111' : '#ffffff';
  return `<svg viewBox="0 0 40 40" width="${px}" height="${px}" aria-hidden="true">
    <defs><radialGradient id="${id}" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/>
    <stop offset=".22" stop-color="${fill}"/><stop offset="1" stop-color="${fill}" stop-opacity=".78"/></radialGradient></defs>
    <circle cx="20" cy="20" r="18" fill="url(#${id})" stroke="${ring}" stroke-width="2.5"/>
    <text x="20" y="${text.length > 1 ? 25 : 26.5}" text-anchor="middle" font-size="${text.length > 1 ? 13 : 17}" font-weight="700"
      font-family="-apple-system, system-ui, sans-serif" fill="${ink}">${esc(text)}</text></svg>`;
}

// The avatar for a profile, sized in pixels. Falls back to the plain initial in the accent color.
export function avatarHTML(p, px = 36) {
  const a = p.avatar || {};
  const c = a.type === 'char' && CHARACTERS.find(x => x[0] === a.id);
  if (c) return `<span class="av av-art" style="width:${px}px;height:${px}px" title="${esc(c[1])}">${orb(c[2], c[3], initialOf(c[1]), px)}</span>`;
  if (a.type === 'photo' && /^data:image\/(jpeg|png|webp);base64,/.test(a.img || ''))
    return `<span class="av av-art" style="width:${px}px;height:${px}px"><img src="${a.img}" alt="" width="${px}" height="${px}"></span>`;
  const aura = a.type === 'aura' && AURAS.find(x => x[0] === a.id);
  const style = `width:${px}px;height:${px}px;font-size:${Math.round(px * .42)}px` +
    (aura ? `;background:var(--s1);color:var(--tx);box-shadow:0 0 0 2px ${aura[2]},0 0 ${Math.round(px / 3)}px ${Math.round(px / 10)}px ${aura[2]}` : '');
  return `<span class="av" style="${style}" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</span>`;
}

export const avatarName = p => {
  const a = p.avatar || {};
  if (a.type === 'char') return CHARACTERS.find(x => x[0] === a.id)?.[1] || '';
  if (a.type === 'aura') return AURAS.find(x => x[0] === a.id)?.[1] || '';
  return a.type === 'photo' ? 'Your photo' : 'Your initial';
};

// The picker, shared by setup and Settings. Buttons carry data-avatar="type:id".
export function avatarPicker(p) {
  const cur = p.avatar || { type: 'initial' };
  const on = (t, id) => cur.type === t && (id === undefined || cur.id === id);
  const self = { ...p, avatar: null };
  return `<p class="sub">Pick a fighter, a power-up aura, or your own photo. Character names are used as labels only; the orbs are original art.</p>
    <p class="lbl" style="margin-top:12px">Fighters</p>
    <div class="avgrid">${CHARACTERS.map(([id, name]) => `<button data-avatar="char:${id}" aria-pressed="${on('char', id)}">
      ${avatarHTML({ ...p, avatar: { type: 'char', id } }, 44)}<span>${esc(name)}</span></button>`).join('')}</div>
    <p class="lbl" style="margin-top:12px">Auras</p>
    <div class="avgrid">
      <button data-avatar="initial:" aria-pressed="${on('initial')}">${avatarHTML(self, 44)}<span>Plain</span></button>
      ${AURAS.map(([id, name]) => `<button data-avatar="aura:${id}" aria-pressed="${on('aura', id)}">
      ${avatarHTML({ ...p, avatar: { type: 'aura', id } }, 44)}<span>${esc(name)}</span></button>`).join('')}</div>
    <p class="lbl" style="margin-top:12px">Your photo</p>
    <div class="row" style="justify-content:flex-start;gap:12px">
      ${cur.type === 'photo' ? avatarHTML(p, 44) : ''}
      <label class="cta2 filebtn">${cur.type === 'photo' ? 'Change photo' : 'Choose a photo'}<input type="file" accept="image/*" data-avatar-photo hidden></label></div>
    <p class="note">A photo stays on this phone and in your backups only.</p>`;
}

// Applies a picker tap to a profile. Returns true if something changed.
export function pickAvatar(p, value) {
  const [type, id] = value.split(':');
  if (type === 'char') { if (p.avatar?.type !== 'char') p.ownAccent = p.accent; p.accent = CHARACTERS.find(x => x[0] === id)?.[4] || p.accent; }
  else if (p.avatar?.type === 'char' && p.ownAccent) { p.accent = p.ownAccent; delete p.ownAccent; }
  p.avatar = type === 'initial' ? null : { type, id };
  return true;
}

// Center-crops and shrinks a picked image to 192 px so it stays small in storage and backups.
export async function photoToAvatar(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const side = Math.min(img.width, img.height), out = 192;
  const c = Object.assign(document.createElement('canvas'), { width: out, height: out });
  c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out);
  img.close?.();
  return { type: 'photo', img: c.toDataURL('image/jpeg', 0.82) };
}
