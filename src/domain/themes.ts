export type Palette = {
  readonly label: string;
  readonly isDark: boolean;
  readonly background: string;
  readonly surface: string;
  readonly foreground: string;
  readonly muted: string;
  readonly cursor: string;
  readonly selection: string;
  readonly accent: string;
  readonly accentAlt: string;
  readonly highlight: string;
  readonly warning: string;
  readonly danger: string;
  readonly success: string;
  readonly ansi: readonly string[];
};

const NEON: Palette = {
  label: "Néon",
  isDark: true,
  background: "#07060d",
  surface: "#0f0c1d",
  foreground: "#d6f7ff",
  muted: "#68639a",
  cursor: "#05d9e8",
  selection: "#ff2a6d55",
  accent: "#05d9e8",
  accentAlt: "#ff2a6d",
  highlight: "#d300c5",
  warning: "#f9f002",
  danger: "#ff2a6d",
  success: "#00ff9f",
  ansi: [
    "#1a1830", "#ff2a6d", "#00ff9f", "#f9f002", "#3d7bff", "#d300c5", "#05d9e8", "#c8d3f5",
    "#5a5680", "#ff5c8a", "#5cffbe", "#fff75e", "#6f9dff", "#ff4dff", "#6ff6ff", "#ffffff",
  ],
};

const SYNTHWAVE: Palette = {
  label: "Synthwave",
  isDark: true,
  background: "#1a1028",
  surface: "#241736",
  foreground: "#f4e9ff",
  muted: "#6e5a8a",
  cursor: "#ff8ae2",
  selection: "#ff8ae255",
  accent: "#ff8ae2",
  accentAlt: "#36f9f6",
  highlight: "#fede5d",
  warning: "#fede5d",
  danger: "#fe4450",
  success: "#72f1b8",
  ansi: [
    "#2a1b3d", "#fe4450", "#72f1b8", "#fede5d", "#6d77ff", "#ff7edb", "#36f9f6", "#e6dcf5",
    "#6e5a8a", "#ff6b74", "#9bffd3", "#fff09a", "#959cff", "#ffa5e8", "#8afffd", "#ffffff",
  ],
};

const NEON_DAY: Palette = {
  label: "Néon jour (clair)",
  isDark: false,
  background: "#f4f1ff",
  surface: "#e8e3fb",
  foreground: "#1d1835",
  muted: "#7d77a0",
  cursor: "#d4005f",
  selection: "#00a8b855",
  accent: "#0090a0",
  accentAlt: "#d4005f",
  highlight: "#9a00a0",
  warning: "#a07a00",
  danger: "#d4005f",
  success: "#00875a",
  ansi: [
    "#1d1835", "#d4005f", "#00875a", "#8a6900", "#2d5bd8", "#9a00a0", "#007a88", "#625c88",
    "#5a5680", "#c4005a", "#007a52", "#7a5d00", "#2348b8", "#850090", "#006a76", "#3a3458",
  ],
};

const MATRIX: Palette = {
  label: "Matrix · vert",
  isDark: true,
  background: "#020a04",
  surface: "#071a0c",
  foreground: "#b8f7c8",
  muted: "#4f8a5f",
  cursor: "#39ff6a",
  selection: "#39ff6a44",
  accent: "#39ff6a",
  accentAlt: "#b6ff3b",
  highlight: "#00e5a0",
  warning: "#e6ff5c",
  danger: "#ff4d5e",
  success: "#39ff6a",
  ansi: [
    "#0d2214", "#ff4d5e", "#39ff6a", "#d4ff3b", "#2fd3a6", "#7dffb0", "#6bffd9", "#b8f7c8",
    "#4f8a5f", "#ff7a86", "#7dff9b", "#e9ff8a", "#66ebc6", "#a8ffcb", "#a3ffe8", "#eafff0",
  ],
};

const ABYSS: Palette = {
  label: "Abysse · bleu",
  isDark: true,
  background: "#02060f",
  surface: "#081329",
  foreground: "#cfe3ff",
  muted: "#506a96",
  cursor: "#3d9bff",
  selection: "#3d9bff44",
  accent: "#3d9bff",
  accentAlt: "#00e1ff",
  highlight: "#7a6bff",
  warning: "#ffd23d",
  danger: "#ff4f6d",
  success: "#3dffb4",
  ansi: [
    "#0f1d36", "#ff4f6d", "#3dffb4", "#ffd23d", "#3d9bff", "#8a7dff", "#00e1ff", "#cfe3ff",
    "#506a96", "#ff7d93", "#7dffcf", "#ffe27a", "#7ab9ff", "#a499ff", "#66ecff", "#f2f8ff",
  ],
};

const SANGUINE: Palette = {
  label: "Sanguine · rouge",
  isDark: true,
  background: "#0d0204",
  surface: "#1f070b",
  foreground: "#ffd9dd",
  muted: "#94505a",
  cursor: "#ff2e4c",
  selection: "#ff2e4c44",
  accent: "#ff2e4c",
  accentAlt: "#ff8a3d",
  highlight: "#ff3d8b",
  warning: "#ffc43d",
  danger: "#ff2e4c",
  success: "#7dff8a",
  ansi: [
    "#2a0d12", "#ff2e4c", "#7dff8a", "#ffc43d", "#9a8dff", "#ff3d8b", "#ff8a3d", "#ffd9dd",
    "#94505a", "#ff6b80", "#a8ffb1", "#ffd77a", "#b8b0ff", "#ff78ae", "#ffad78", "#fff0f2",
  ],
};

const AMBER: Palette = {
  label: "Ambre · jaune",
  isDark: true,
  background: "#0c0902",
  surface: "#1d1606",
  foreground: "#ffeec2",
  muted: "#8f7a45",
  cursor: "#ffc21a",
  selection: "#ffc21a44",
  accent: "#ffc21a",
  accentAlt: "#ff7a1a",
  highlight: "#ffe45c",
  warning: "#ffe45c",
  danger: "#ff4d3d",
  success: "#b8ff3d",
  ansi: [
    "#2a210b", "#ff4d3d", "#b8ff3d", "#ffc21a", "#7aa7ff", "#ff7a1a", "#ffe45c", "#ffeec2",
    "#8f7a45", "#ff7a6e", "#d1ff7a", "#ffd65c", "#a3c4ff", "#ffa35c", "#fff09a", "#fffaf0",
  ],
};

const ULTRAVIOLET: Palette = {
  label: "Ultraviolet · violet",
  isDark: true,
  background: "#07030f",
  surface: "#140a29",
  foreground: "#e6dbff",
  muted: "#6e5a9e",
  cursor: "#a855ff",
  selection: "#a855ff44",
  accent: "#a855ff",
  accentAlt: "#ff4dd2",
  highlight: "#6b7bff",
  warning: "#ffd84d",
  danger: "#ff4d7a",
  success: "#4dffb8",
  ansi: [
    "#1b1036", "#ff4d7a", "#4dffb8", "#ffd84d", "#7a8aff", "#ff4dd2", "#b56bff", "#e6dbff",
    "#6e5a9e", "#ff7a9d", "#85ffcf", "#ffe585", "#a3adff", "#ff85e0", "#c58aff", "#f7f2ff",
  ],
};

const SAKURA: Palette = {
  label: "Sakura · rose",
  isDark: true,
  background: "#0f0409",
  surface: "#230b17",
  foreground: "#ffe0ef",
  muted: "#965876",
  cursor: "#ff5cad",
  selection: "#ff5cad44",
  accent: "#ff5cad",
  accentAlt: "#5ce1ff",
  highlight: "#c45cff",
  warning: "#ffd36b",
  danger: "#ff4d6d",
  success: "#6bffc4",
  ansi: [
    "#2b1020", "#ff4d6d", "#6bffc4", "#ffd36b", "#8c9bff", "#c45cff", "#ff5cad", "#ffe0ef",
    "#965876", "#ff7a8f", "#9effd8", "#ffe19a", "#b3bdff", "#d68aff", "#ff8ac4", "#fff3f9",
  ],
};

const EMBER: Palette = {
  label: "Braise · orange",
  isDark: true,
  background: "#0d0602",
  surface: "#201006",
  foreground: "#ffe3cc",
  muted: "#94603f",
  cursor: "#ff7a1a",
  selection: "#ff7a1a44",
  accent: "#ff7a1a",
  accentAlt: "#ff3d5c",
  highlight: "#ffb81a",
  warning: "#ffd84d",
  danger: "#ff3d5c",
  success: "#a3ff4d",
  ansi: [
    "#2b160a", "#ff3d5c", "#a3ff4d", "#ffb81a", "#4db8ff", "#ff5c8a", "#ff7a1a", "#ffe3cc",
    "#94603f", "#ff6b84", "#c2ff85", "#ffcf5c", "#85cfff", "#ff8aab", "#ffa35c", "#fff4ea",
  ],
};

const GLACIER: Palette = {
  label: "Glacier · cyan",
  isDark: true,
  background: "#020b0d",
  surface: "#07191d",
  foreground: "#d4fbff",
  muted: "#4b8088",
  cursor: "#4df3ff",
  selection: "#4df3ff44",
  accent: "#4df3ff",
  accentAlt: "#4d9bff",
  highlight: "#b0f0ff",
  warning: "#ffe066",
  danger: "#ff5c7a",
  success: "#5cffb0",
  ansi: [
    "#0c2226", "#ff5c7a", "#5cffb0", "#ffe066", "#5ca5ff", "#9d8cff", "#4df3ff", "#d4fbff",
    "#4b8088", "#ff8aa0", "#8cffc9", "#ffeb99", "#8cc2ff", "#bfb3ff", "#8cf8ff", "#f0feff",
  ],
};

const GHOST: Palette = {
  label: "Fantôme · gris",
  isDark: true,
  background: "#08090b",
  surface: "#121417",
  foreground: "#e6e8eb",
  muted: "#6b717c",
  cursor: "#e6e8eb",
  selection: "#e6e8eb44",
  accent: "#e6e8eb",
  accentAlt: "#9aa3b0",
  highlight: "#c7cdd6",
  warning: "#f0d070",
  danger: "#ff5c5c",
  success: "#7ee0a0",
  ansi: [
    "#1c1f24", "#ff5c5c", "#7ee0a0", "#f0d070", "#8fa8d6", "#b8a0d6", "#a0c8d6", "#e6e8eb",
    "#6b717c", "#ff8585", "#a6ebc0", "#f5dd99", "#b0c3e6", "#cfbde6", "#c0dce6", "#ffffff",
  ],
};

export const THEMES: Readonly<Record<string, Palette>> = {
  neon: NEON,
  synthwave: SYNTHWAVE,
  matrix: MATRIX,
  abyss: ABYSS,
  sanguine: SANGUINE,
  amber: AMBER,
  ultraviolet: ULTRAVIOLET,
  sakura: SAKURA,
  ember: EMBER,
  glacier: GLACIER,
  ghost: GHOST,
  "neon-day": NEON_DAY,
};

export const THEME_NAMES = Object.keys(THEMES);

export function isThemeName(name: string): boolean {
  return Object.hasOwn(THEMES, name);
}

export type ThemePreference = { readonly dark: string; readonly light: string; readonly followSystem: boolean };

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Palette {
  const name = preference.followSystem && !systemPrefersDark ? preference.light : preference.dark;
  return THEMES[name] ?? ABYSS;
}

export function withOpacity(hexColor: string, opacity: number): string {
  if (opacity >= 1) return hexColor;
  const alpha = Math.round(Math.max(0, opacity) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hexColor.slice(0, 7)}${alpha}`;
}
