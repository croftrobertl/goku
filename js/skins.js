// Skins (2.8): the same app under different "shells". A skin changes the words for Goku's game ideas,
// suggests a theme, and picks the avatar set, setup mascot and card style. Features never change.
// Each profile has its own skin (p.settings.skin). Every skin's art is original; Encore is a pop-tour
// feel, not any real artist: no names, lyrics, photos or album art.

export const SKINS = {
  dbz: { name: 'Dragon Ball', desc: 'Ki, sagas, Senzu beans and the gravity chamber', theme: null, avatars: 'fighters', mascot: 'star', dots: ['#0b0f1a', '#5aa2ff', '#f39a1e'],
    words: { ki: 'Ki', kiMenu: 'Ki menu', power: 'Power level', saga: 'Saga', sagaMap: 'Saga map', arc: 'Arc', boss: 'Boss', bean: 'Senzu bean', beans: 'Senzu beans',
      beanSave: 'Senzu save', savedBy: 'saved by a Senzu bean', chamber: 'Gravity chamber', enter: 'Enter the chamber', scouter: 'Scouter', readiness: 'Scouter and readiness',
      gravity: 'gravity', news: 'Dragon Ball news', master: 'Dragon Ball master', ball: 'Dragon Ball', balls: 'Dragon Balls', wisher: 'Shenron', pickAvatar: 'Choose your fighter',
      bossBeat: 'Boss defeated', energyQ: 'How much ki do you have today?' } },
  encore: { name: 'Encore', desc: 'Spotlight, tours, rain checks and rehearsals', theme: 'tour', avatars: 'bracelets', mascot: 'mic', dots: ['#f7f0ff', '#ff8fb1', '#b9a6ff'],
    words: { ki: 'Spotlight', kiMenu: 'Spotlight menu', power: 'Crowd', saga: 'Tour', sagaMap: 'Tour map', arc: 'Chapter', boss: 'Showstopper', bean: 'rain check', beans: 'rain checks',
      beanSave: 'Rain check', savedBy: 'saved by a rain check', chamber: 'Rehearsal', enter: 'Take the stage', scouter: 'Soundcheck', readiness: 'Soundcheck and readiness',
      gravity: 'intensity', news: 'Tour news', master: 'Headliner', ball: 'charm', balls: 'charms', wisher: 'The encore', pickAvatar: 'Pick your look',
      bossBeat: 'Showstopper nailed', energyQ: 'How much energy do you have today?' } },
  plain: { name: 'Plain', desc: 'Plain words, no theme', theme: null, avatars: 'plain', mascot: 'none', dots: ['#ffffff', '#5c6370', '#141414'],
    words: { ki: 'Progress', kiMenu: 'Quick menu', power: 'Score', saga: 'Goals', sagaMap: 'Goal plan', arc: 'Block', boss: 'Goal', bean: 'streak saver', beans: 'streak savers',
      beanSave: 'Streak save', savedBy: 'saved by a streak saver', chamber: 'Workout', enter: 'Start workout', scouter: 'Readiness', readiness: 'Readiness',
      gravity: 'intensity', news: 'News', master: 'All-star', ball: 'badge', balls: 'badges', wisher: 'A reward', pickAvatar: 'Pick an avatar',
      bossBeat: 'Goal reached', energyQ: 'How much energy do you have today?' } },
};

let cur = 'dbz';
export const skinOf = p => SKINS[p?.settings?.skin] ? p.settings.skin : 'dbz';
export function setSkin(id) { cur = SKINS[id] ? id : 'dbz'; document.documentElement.dataset.skin = cur; }
export const skin = () => SKINS[cur];
export const skinId = () => cur;
// The current skin's word for an idea; Cap() for the start of a sentence.
export const w = key => SKINS[cur].words[key] ?? SKINS.dbz.words[key];
// Theme names (2.8.2): Dragon Ball places only in the Dragon Ball skin; the colors are the same.
const PLAIN_THEMES = { capsule: 'Navy', kame: 'Beach', namek: 'Green', saiyan: 'Gold', destroyer: 'Night', chamber: 'Graphite', eternal: 'Emerald' };
export const themeName = (id, t) => cur === 'dbz' ? t.name : PLAIN_THEMES[id] || t.name;
export const W = key => { const s = w(key); return s[0].toUpperCase() + s.slice(1); };
