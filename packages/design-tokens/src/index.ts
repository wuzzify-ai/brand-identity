import { createHash } from 'crypto';

export type DtcgToken = {
  $type: 'color' | 'fontFamily' | 'fontWeight' | 'dimension';
  $value: string | number;
  $description?: string;
};

export interface DtcgTokenGroup {
  [key: string]: DtcgToken | DtcgTokenGroup;
}

export type CanonicalTokenSet = {
  $schema: 'https://design-tokens.github.io/community-group/format/';
  name: string;
  versionId: string;
  generatedAt: string;
  tokens: DtcgTokenGroup;
  assets: {
    selectedLogoConceptId: string | null;
    logoAssetIds: string[];
  };
};

export type TokenCompilerInput = {
  versionId: string;
  name: string;
  generatedAt?: string;
  colors: Array<{ tokenName: string; name: string; hex: string; usage?: string | null }>;
  fonts: Array<{ role: string; family: string; fallback: string; weights: number[]; licenseStatus: string }>;
  selectedLogoConceptId?: string | null;
  logoAssetIds?: string[];
};

export type CompiledTokenSet = {
  canonical: CanonicalTokenSet;
  canonicalJson: string;
  checksumSha256: string;
  css: string;
  scss: string;
  tailwind: string;
};

export function compileBrandDesignTokens(input: TokenCompilerInput): CompiledTokenSet {
  validateInput(input);
  const canonical: CanonicalTokenSet = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    name: input.name,
    versionId: input.versionId,
    generatedAt: input.generatedAt ?? '1970-01-01T00:00:00.000Z',
    tokens: {
      color: Object.fromEntries(
        [...input.colors]
          .sort((a, b) => safeTokenName(a.tokenName).localeCompare(safeTokenName(b.tokenName)))
          .map((color) => [
            safeTokenName(color.tokenName),
            {
              $type: 'color',
              $value: normalizeHex(color.hex),
              $description: color.usage ?? color.name
            } satisfies DtcgToken
          ])
      ),
      font: Object.fromEntries(
        [...input.fonts]
          .sort((a, b) => safeTokenName(a.role).localeCompare(safeTokenName(b.role)))
          .flatMap((font) => {
            const role = safeTokenName(font.role);
            const family = `${font.family}, ${font.fallback}`;
            return [
              [
                `${role}-family`,
                {
                  $type: 'fontFamily',
                  $value: safeCssString(family),
                  $description: `License: ${font.licenseStatus}`
                } satisfies DtcgToken
              ],
              [
                `${role}-weight`,
                {
                  $type: 'fontWeight',
                  $value: font.weights[font.weights.length - 1] ?? 400
                } satisfies DtcgToken
              ]
            ];
          })
      ),
      spacing: {
        sm: { $type: 'dimension', $value: '8px' },
        md: { $type: 'dimension', $value: '16px' },
        lg: { $type: 'dimension', $value: '24px' }
      },
      radius: {
        sm: { $type: 'dimension', $value: '4px' },
        md: { $type: 'dimension', $value: '8px' },
        lg: { $type: 'dimension', $value: '16px' }
      }
    },
    assets: {
      selectedLogoConceptId: input.selectedLogoConceptId ?? null,
      logoAssetIds: [...(input.logoAssetIds ?? [])].sort()
    }
  };
  const canonicalJson = stableStringify(canonical);

  return {
    canonical,
    canonicalJson,
    checksumSha256: createHash('sha256').update(canonicalJson).digest('hex'),
    css: exportCss(canonical),
    scss: exportScss(canonical),
    tailwind: exportTailwind(canonical)
  };
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

export function exportCss(canonical: CanonicalTokenSet): string {
  const declarations = flattenTokens(canonical.tokens).map(([name, token]) => `  --brand-${escapeIdentifier(name)}: ${escapeCssValue(token.$value)};`);
  return `:root {\n${declarations.join('\n')}\n}\n`;
}

export function exportScss(canonical: CanonicalTokenSet): string {
  return flattenTokens(canonical.tokens)
    .map(([name, token]) => `$brand-${escapeIdentifier(name)}: ${escapeCssValue(token.$value)};`)
    .join('\n')
    .concat('\n');
}

export function exportTailwind(canonical: CanonicalTokenSet): string {
  const colors = Object.fromEntries(
    Object.entries((canonical.tokens.color ?? {}) as Record<string, DtcgToken>).map(([name, token]) => [escapeObjectKey(name), token.$value])
  );
  const fontFamily = Object.fromEntries(
    Object.entries((canonical.tokens.font ?? {}) as Record<string, DtcgToken>)
      .filter(([name]) => name.endsWith('-family'))
      .map(([name, token]) => [escapeObjectKey(name.replace(/-family$/, '')), String(token.$value).split(',').map((item) => item.trim())])
  );

  return stableStringify({
    theme: {
      extend: {
        colors,
        fontFamily
      }
    }
  });
}

function validateInput(input: TokenCompilerInput): void {
  if (!input.colors.length) throw new Error('At least one color token is required.');
  if (!input.fonts.length) throw new Error('At least one font token is required.');

  const colorNames = new Set<string>();
  for (const color of input.colors) {
    const tokenName = safeTokenName(color.tokenName);
    if (colorNames.has(tokenName)) throw new Error(`Duplicate color token: ${tokenName}`);
    colorNames.add(tokenName);
    normalizeHex(color.hex);
  }

  const fontRoles = new Set<string>();
  for (const font of input.fonts) {
    const role = safeTokenName(font.role);
    if (fontRoles.has(role)) throw new Error(`Duplicate font role: ${role}`);
    if (!font.family.trim() || !font.fallback.trim()) throw new Error(`Font ${role} requires family and fallback.`);
    if (!font.weights.length) throw new Error(`Font ${role} requires at least one weight.`);
    fontRoles.add(role);
  }
}

function flattenTokens(group: DtcgTokenGroup, prefix = ''): Array<[string, DtcgToken]> {
  return Object.entries(group).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}-${key}` : key;
    if (isToken(value)) return [[name, value]];
    return flattenTokens(value, name);
  });
}

function isToken(value: DtcgToken | DtcgTokenGroup): value is DtcgToken {
  return '$type' in value && '$value' in value;
}

function normalizeHex(hex: string): `#${string}` {
  const normalized = hex.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) throw new Error(`Invalid hex color: ${hex}`);
  return normalized as `#${string}`;
}

function safeTokenName(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!safe || !/^[a-z]/.test(safe)) throw new Error(`Invalid token name: ${value}`);
  return safe;
}

function safeCssString(value: string): string {
  return value.replace(/[:;"{}]/g, '').trim();
}

function escapeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function escapeObjectKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function escapeCssValue(value: string | number): string {
  if (typeof value === 'number') return String(value);
  return value.replace(/[;\n\r{}]/g, '');
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortDeep(child)])
    );
  }
  return value;
}
