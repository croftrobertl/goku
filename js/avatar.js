// Avatars. No official artwork is used or shipped: a character avatar is an original inked
// emblem in that character's signature color with a kanji that fits them, labeled with their
// name. A fighter is only the avatar; the app's colors come from the theme.
// A photo the person picks is resized here and stored only on this phone.
import { esc } from './ui.js';

// [id, name, emblem color, kanji]
export const CHARACTERS = [
  ['goku', 'Goku', '#ff8a2a', '悟'], ['vegeta', 'Vegeta', '#2c5fd6', '王'], ['gohan', 'Gohan', '#7b3fb5', '学'],
  ['piccolo', 'Piccolo', '#3fae49', '魔'], ['krillin', 'Krillin', '#f07c22', '友'], ['trunks', 'Trunks', '#6f5bd6', '未'],
  ['roshi', 'Master Roshi', '#e8742a', '亀'], ['bulma', 'Bulma', '#2bb3b3', '才'], ['tien', 'Tien', '#2a9d8f', '天'],
  ['yamcha', 'Yamcha', '#e8742a', '狼'], ['frieza', 'Frieza', '#ece6f5', '冷'], ['cell', 'Cell', '#3d8f3d', '完'],
  ['buu', 'Majin Buu', '#ff7ab8', '甘'], ['android18', 'Android 18', '#2c5fd6', '機'], ['broly', 'Broly', '#3fae49', '伝'],
  ['beerus', 'Beerus', '#8a5bd6', '破'], ['whis', 'Whis', '#6fa8dc', '使'], ['jiren', 'Jiren', '#d9332b', '力'],
];

// [id, name, aura color]: the person's own initial wrapped in a power-up glow.
export const AURAS = [
  ['saiyan', 'Saiyan gold', '#f5c542'], ['blue', 'Divine blue', '#4fb3ff'], ['namek', 'Namekian green', '#3fd18f'],
  ['majin', 'Majin pink', '#ff6fb0'], ['destroyer', 'Destroyer purple', '#a86bff'], ['kaio', 'Crimson', '#ff5a4a'],
];

// An inked emblem: a colored ring, a white center and the kanji.
const emblem = (fill, kanji, px) => `<svg viewBox="0 0 40 40" width="${px}" height="${px}" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="${fill}" stroke="#141414" stroke-width="2.5"/><circle cx="20" cy="20" r="11.5" fill="#fff" stroke="#141414" stroke-width="1.5"/>
    <text x="20" y="24.6" text-anchor="middle" font-size="13" font-weight="700" fill="#141414"
      font-family="'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', system-ui, sans-serif">${esc(kanji)}</text></svg>`;

// The avatar for a profile, sized in pixels. Falls back to the plain initial in the accent color.
export function avatarHTML(p, px = 36) {
  const a = p.avatar || {};
  const c = a.type === 'char' && CHARACTERS.find(x => x[0] === a.id);
  if (c) return `<span class="av av-art" style="width:${px}px;height:${px}px" title="${esc(c[1])}">${emblem(c[2], c[3], px)}</span>`;
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
  return `<p class="sub">Pick a fighter, a power-up aura, or your own photo. Character names are labels only; the emblems are original drawings, not official art. Your colors stay with your theme.</p>
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
  delete p.ownAccent; // before 2.6 a fighter also changed the colors; it no longer does
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
