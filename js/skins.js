// Skins (2.8): the same app under different "shells". A skin changes the words for Goku's game ideas,
// suggests a theme, and picks the avatar set, setup mascot and card style. Features never change.
// Each profile has its own skin (p.settings.skin). Every skin's art is original; Encore is a pop-tour
// feel inspired by the Eras: original drawings, era names and motifs; no real person, lyrics, photos or album art.

export const SKINS = {
  dbz: { name: 'Dragon Ball', desc: 'Sagas, Senzu beans, Dragon Balls and the gravity chamber', theme: null, avatars: 'fighters', mascot: 'star', art: 'img', dots: ['#0b0f1a', '#5aa2ff', '#f39a1e'],
    words: { ki: 'Progress', kiMenu: 'Quick Add', power: 'Power level', saga: 'Saga', sagaMap: 'Saga map', arc: 'Arc', boss: 'Boss', bean: 'Senzu bean', beans: 'Senzu beans',
      beanSave: 'Senzu save', savedBy: 'saved by a Senzu bean', chamber: 'Gravity chamber', enter: 'Enter the chamber', scouter: 'Scouter', readiness: 'Scouter and readiness',
      gravity: 'gravity', news: 'Dragon Ball news', master: 'Dragon Ball master', ball: 'Dragon Ball', balls: 'Dragon Balls', wisher: 'Shenron', pickAvatar: 'Choose your fighter',
      bossBeat: 'Boss defeated', energyQ: 'How much ki do you have today?' } },
  encore: { name: 'Eras Tour', desc: 'Buzz the tour cat, friendship bracelets and stage nights', theme: 'tour', avatars: 'eras', mascot: 'star', art: 'img/eras', dots: ['#f7f0ff', '#ff8fb1', '#b9a6ff'],
    forms: ['Gold sparkle', 'Pink sparkle', 'Confetti', 'Ruby glitter', 'Midnight stars', 'Iridescent'],
    words: { ki: 'Spotlight', kiMenu: 'Spotlight menu', power: 'Crowd', saga: 'Tour', sagaMap: 'Tour map', arc: 'Chapter', boss: 'Showstopper', bean: 'rain check', beans: 'rain checks',
      beanSave: 'Rain check', savedBy: 'saved by a rain check', chamber: 'Rehearsal', enter: 'Take the stage', scouter: 'Soundcheck', readiness: 'Soundcheck and readiness',
      gravity: 'intensity', news: 'Tour news', master: 'Headliner', ball: 'bracelet', balls: 'bracelets', wisher: 'The finale', pickAvatar: 'Pick your look',
      bossBeat: 'Showstopper nailed', energyQ: 'How much energy do you have today?' } },
  // 2.34 (review 50): Erica's iRob look. Weezy the cat and iRob's painted icons (Rob's own art from iRob), gold hearts.
  weezy: { name: 'Weezy', desc: 'Weezy the cat, warm gold and gold hearts', theme: 'irob', avatars: 'weezy', mascot: 'star', art: 'img/weezy', auras: false, dots: ['#1d1b19', '#d9a22b', '#ece6dd'],
    words: { ki: 'Progress', kiMenu: 'Quick Add', power: 'Energy', saga: 'Journey', sagaMap: 'Journey map', arc: 'Chapter', boss: 'Goal', bean: 'cozy day', beans: 'cozy days',
      beanSave: 'Cozy day', savedBy: 'saved by a cozy day', chamber: 'Workout', enter: 'Start workout', scouter: 'Check-in', readiness: 'Check-in and readiness',
      gravity: 'intensity', news: 'Heart news', master: "Weezy's favorite", ball: 'gold heart', balls: 'gold hearts', wisher: 'Weezy', pickAvatar: 'Pick your look',
      bossBeat: 'Goal reached', energyQ: 'How much energy do you have today?' } },
  plain: { name: 'Plain', desc: 'Plain words, no theme', theme: null, avatars: 'plain', mascot: 'none', dots: ['#ffffff', '#5c6370', '#141414'],
    words: { ki: 'Progress', kiMenu: 'Quick menu', power: 'Score', saga: 'Goals', sagaMap: 'Goal plan', arc: 'Block', boss: 'Goal', bean: 'streak saver', beans: 'streak savers',
      beanSave: 'Streak save', savedBy: 'saved by a streak saver', chamber: 'Workout', enter: 'Start workout', scouter: 'Readiness', readiness: 'Readiness',
      gravity: 'intensity', news: 'News', master: 'All-star', ball: 'badge', balls: 'badges', wisher: 'A reward', pickAvatar: 'Pick an avatar',
      bossBeat: 'Goal reached', energyQ: 'How much energy do you have today?' } },
};

let cur = 'dbz';
export const skinOf = p => SKINS[p?.settings?.skin] ? p.settings.skin : 'dbz';
export function setSkin(id) { cur = SKINS[id] ? id : 'dbz'; document.documentElement.dataset.skin = cur; if (cur === 'encore' || cur === 'weezy') warm(cur); }
export const skin = () => SKINS[cur];
export const skinId = () => cur;
// Drawn art (2.28): Dragon Ball's in img/, the Eras look's in img/eras/ with the same file names. Plain has none.
export const hasArt = p => !!SKINS[p ? skinOf(p) : cur].art;
export const art = path => `${SKINS[cur].art || 'img'}/${path}`;
// Only people who use the Eras look download its art (2.28): the first time it shows, every picture is
// fetched once so it works offline; the offline worker keeps them with the other drawings.
const ERAS_FILES = [...['wave', 'coach', 'cheer', 'think', 'letstrain', 'yougotthis', 'protips', 'recharge', 'restday', 'scouter', 'senzu', 'shenron'].map(n => `pose/${n}`),
  ...[1, 2, 3, 4, 5, 6, 7].flatMap(n => [`balls/lit-${n}`, `balls/dim-${n}`]), ...['ss1', 'ss2', 'ss3', 'god', 'blue', 'ui'].map(n => `aura/${n}`),
  ...['buzz', 'buzz-sleep', 'debut', 'fearless', 'speaknow', 'red', '1989', 'reputation', 'lover', 'folklore', 'evermore', 'midnights', 'ttpd', 'showgirl', 'cat-grey', 'cat-ragdoll', 'mic', 'bracelet', 'thirteen'].map(n => `char/${n}`),
  ...['home', 'workout', 'week', 'food', 'water', 'protein', 'calories', 'checkin', 'history', 'library', 'rest', 'settings', 'skills', 'sport', 'supplements', 'weigh', 'you'].map(n => `ic/${n}`)];
const WEEZY_FILES = [...['wave', 'coach', 'cheer', 'think', 'letstrain', 'yougotthis', 'protips', 'recharge', 'restday', 'scouter', 'senzu', 'shenron'].map(n => `pose/${n}`),
  ...[1, 2, 3, 4, 5, 6, 7].flatMap(n => [`balls/lit-${n}`, `balls/dim-${n}`]), 'char/weezy', 'char/weezy-sleep',
  ...['home', 'workout', 'week', 'food', 'water', 'protein', 'calories', 'checkin', 'history', 'library', 'rest', 'settings', 'skills', 'sport', 'supplements', 'weigh', 'you'].map(n => `ic/${n}`)];
const warmed = new Set();
function warm(id) {
  if (warmed.has(id) || !('caches' in self) || !navigator.serviceWorker?.controller) return;
  warmed.add(id);
  setTimeout(() => (id === 'weezy' ? WEEZY_FILES : ERAS_FILES).forEach(f => fetch(`${SKINS[id].art}/${f}.png`).catch(() => {})), 3000);
}
// The current skin's word for an idea; Cap() for the start of a sentence.
export const w = key => SKINS[cur].words[key] ?? SKINS.dbz.words[key];
// Theme names (2.8.2): Dragon Ball places only in the Dragon Ball skin; the colors are the same.
const PLAIN_THEMES = { capsule: 'Navy', kame: 'Beach', namek: 'Green', saiyan: 'Gold', destroyer: 'Night', chamber: 'Graphite', eternal: 'Emerald', turtle: 'Orange' };
export const themeName = (id, t) => cur === 'dbz' ? t.name : PLAIN_THEMES[id] || t.name;
export const W = key => { const s = w(key); return s[0].toUpperCase() + s.slice(1); };
