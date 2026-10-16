// SQL Drills: the Waffles palette reaches the components as CSS variables (var(--wf-w-navy)) so they follow
// dark mode. Code that computes with a colour gets the real value for a theme from here.
import palette from '../../../tokens/palette.js';

const varName = /^var\((--wf-w-[a-z0-9-]+)\)$/;

const resolveColor = (color: string, theme: 'light' | 'dark' = 'light'): string => {
  const m = varName.exec(String(color).trim());
  if (!m) return color;
  const value = (palette as Record<string, Record<string, string>>)[theme][m[1]];
  if (!value) throw new Error(`Unknown palette colour ${color}`);
  return value;
};

export const isPaletteVar = (color: string): boolean => varName.test(String(color).trim());

export default resolveColor;
