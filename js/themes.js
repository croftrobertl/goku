// Themes: each has a dark and a light palette plus a default accent. Every text color is
// checked for at least 4.5:1 contrast on its surfaces by tools/check-themes.mjs.
export const THEMES = {
  capsule: { name: 'Capsule', desc: 'Deep navy and sky blue', accent: '#5ea4ff',
    dark: { bg: '#0b0f1a', s1: '#121a2e', s2: '#18223a', line: '#24304f', tx: '#e6ecff', tx2: '#9aaad0', tx3: '#8494bb', ok: '#4fd1a5', warn: '#f2c14e', care: '#ff8f8f' },
    light: { bg: '#f2f4fa', s1: '#ffffff', s2: '#e8ecf6', line: '#d3d9e8', tx: '#0d1424', tx2: '#4a5878', tx3: '#56627e', ok: '#11795a', warn: '#8a5a00', care: '#b3261e' } },
  kame: { name: 'Kame House', desc: 'Warm sand and island orange', accent: '#ff8a3d',
    dark: { bg: '#15100c', s1: '#201811', s2: '#2a2017', line: '#3c2e21', tx: '#fbeee0', tx2: '#d2b9a0', tx3: '#b89e86', ok: '#6fd3a8', warn: '#f2c14e', care: '#ff9a8a' },
    light: { bg: '#fbf4ea', s1: '#ffffff', s2: '#f3e7d6', line: '#e3d2bb', tx: '#24170c', tx2: '#6a4f37', tx3: '#7a5d42', ok: '#0e6c50', warn: '#8a5a00', care: '#b3261e' } },
  namek: { name: 'Namek', desc: 'Green skies and teal water', accent: '#3fd18f',
    dark: { bg: '#07130f', s1: '#0e1f19', s2: '#142a22', line: '#1f3d32', tx: '#e2fbef', tx2: '#9fcfb8', tx3: '#86b6a0', ok: '#6fe0b0', warn: '#f2c14e', care: '#ff8f8f' },
    light: { bg: '#eef8f3', s1: '#ffffff', s2: '#e0f1e8', line: '#c6e2d4', tx: '#0b2018', tx2: '#3e6455', tx3: '#4a6c5e', ok: '#0f7a52', warn: '#8a5a00', care: '#b3261e' } },
  saiyan: { name: 'Super Saiyan', desc: 'Black and gold', accent: '#f5c542',
    dark: { bg: '#0c0b08', s1: '#17150f', s2: '#201d14', line: '#332e1f', tx: '#fff6dc', tx2: '#d6c79c', tx3: '#b9aa80', ok: '#6fd3a8', warn: '#ffd166', care: '#ff8f8f' },
    light: { bg: '#fbf7ea', s1: '#ffffff', s2: '#f3ecd3', line: '#e2d7b3', tx: '#1d1806', tx2: '#5f5330', tx3: '#6b5e37', ok: '#11795a', warn: '#7d5200', care: '#b3261e' } },
  destroyer: { name: 'Destroyer', desc: 'Royal purple and night', accent: '#b18cff',
    dark: { bg: '#0e0a17', s1: '#181127', s2: '#211833', line: '#33264b', tx: '#f0e9ff', tx2: '#b9a8dc', tx3: '#a08fc4', ok: '#6fd3a8', warn: '#f2c14e', care: '#ff8f8f' },
    light: { bg: '#f5f1fc', s1: '#ffffff', s2: '#ece5f8', line: '#d9cdee', tx: '#1a1030', tx2: '#55467a', tx3: '#5f5084', ok: '#0e6c50', warn: '#8a5a00', care: '#b3261e' } },
  chamber: { name: 'Time Chamber', desc: 'Quiet white and graphite', accent: '#8b93a7',
    dark: { bg: '#0d0e10', s1: '#17181b', s2: '#1f2125', line: '#2e3137', tx: '#f2f3f5', tx2: '#b4b8c1', tx3: '#9a9fa9', ok: '#6fd3a8', warn: '#f2c14e', care: '#ff8f8f' },
    light: { bg: '#f6f6f7', s1: '#ffffff', s2: '#ececef', line: '#d9dadf', tx: '#131418', tx2: '#4c4f58', tx3: '#5a5d66', ok: '#11795a', warn: '#8a5a00', care: '#b3261e' } },
};
export const MODES = [['auto', 'Match phone'], ['dark', 'Dark'], ['light', 'Light']];
