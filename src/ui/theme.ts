import type { ITheme } from "@xterm/xterm";
import { type Palette, withOpacity } from "../domain/themes";

const ANSI_KEYS = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

export function xtermTheme(palette: Palette, opacity: number): ITheme {
  const ansi = Object.fromEntries(ANSI_KEYS.map((key, index) => [key, palette.ansi[index]]));
  return {
    ...ansi,
    background: withOpacity(palette.background, opacity),
    foreground: palette.foreground,
    cursor: palette.cursor,
    cursorAccent: palette.background,
    selectionBackground: palette.selection,
    scrollbarSliderBackground: withOpacity(palette.accent, 0.2),
    scrollbarSliderHoverBackground: withOpacity(palette.accent, 0.35),
    scrollbarSliderActiveBackground: withOpacity(palette.accent, 0.5),
  };
}

export function applyChromeTheme(palette: Palette, opacity: number, fontFamily: string): void {
  const variables: Readonly<Record<string, string>> = {
    "--bg": palette.background,
    "--bg-translucent": withOpacity(palette.background, opacity),
    "--surface": palette.surface,
    "--fg": palette.foreground,
    "--muted": palette.muted,
    "--accent": palette.accent,
    "--accent-alt": palette.accentAlt,
    "--highlight": palette.highlight,
    "--warning": palette.warning,
    "--danger": palette.danger,
    "--success": palette.success,
    "--tab-red": palette.ansi[1],
    "--tab-green": palette.ansi[2],
    "--tab-yellow": palette.ansi[3],
    "--tab-blue": palette.ansi[4],
    "--tab-magenta": palette.ansi[5],
    "--tab-cyan": palette.ansi[6],
    "--hud-font": `"${fontFamily}", "Kode Mono Variable", "Noto Color Emoji", monospace`,
  };
  const root = document.documentElement;
  for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
  root.dataset.scheme = palette.isDark ? "dark" : "light";
}
