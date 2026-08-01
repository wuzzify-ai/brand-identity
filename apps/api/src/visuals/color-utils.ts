import { DomainError } from '../common/domain-error';

const hexPattern = /^#[0-9a-f]{6}$/i;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export function normalizeHex(hex: string): string {
  const normalized = hex.trim().toUpperCase();

  if (!hexPattern.test(normalized)) {
    throw new DomainError('VISUAL_COLOR_INVALID_HEX', `Invalid HEX color: ${hex}.`, 422);
  }

  return normalized;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: round(lightness * 100) };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue =
    max === red
      ? (green - blue) / delta + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;

  return { h: Math.round((hue / 6) * 360), s: round(saturation * 100), l: round(lightness * 100) };
}

export function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return round((lighter + 0.05) / (darker + 0.05));
}

export function deriveColorMetrics(hex: string) {
  const normalized = normalizeHex(hex);
  const rgb = hexToRgb(normalized);
  return {
    hex: normalized,
    rgb,
    hsl: rgbToHsl(rgb),
    contrastOnWhite: contrastRatio(rgb, { r: 255, g: 255, b: 255 }),
    contrastOnBlack: contrastRatio(rgb, { r: 0, g: 0, b: 0 })
  };
}

function relativeLuminance({ r, g, b }: RgbColor): number {
  return [r, g, b]
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
