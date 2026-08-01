'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { normalizeApiError } from '../../lib/api-client';
import { startVisualDirectionGeneration, waitForGeneration } from '../../lib/generation-api';
import {
  archiveVisualDirection,
  createVisualDirection,
  getVisualDirection,
  listVisualDirections,
  selectVisualDirection,
  updateVisualDirection,
  type VisualDirection,
  type VisualDirectionAggregate,
  type VisualDirectionPayload
} from '../../lib/visual-directions-api';
import { Button } from '../ui/button';
import { TextAreaField, TextField } from '../ui/form';

type Props = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  onSelected?: () => void;
};

type VisualColorPayload = NonNullable<VisualDirectionPayload['colors']>;
type VisualFontPayload = NonNullable<VisualDirectionPayload['fonts']>;

export function VisualDirectionsEditor({ accessToken, workspaceId, projectId, versionId, onSelected }: Props) {
  const [directions, setDirections] = useState<VisualDirection[]>([]);
  const [selected, setSelected] = useState<VisualDirectionAggregate | null>(null);
  const [status, setStatus] = useState('Loading visual directions...');
  const [instructions, setInstructions] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    void reload();
    // reload intentionally closes over stable props and should run when route/auth context changes.
  }, [accessToken, workspaceId, projectId, versionId]);

  async function reload() {
    try {
      const list = await listVisualDirections(accessToken, workspaceId, projectId, versionId);
      setDirections(list);
      setStatus(list.length ? 'Visual directions loaded.' : 'No visual directions yet.');

      const first = list.find((item) => item.is_selected) ?? list[0];
      if (first) {
        await openDirection(first.id);
      }
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function openDirection(directionId: string) {
    try {
      setSelected(await getVisualDirection(accessToken, workspaceId, projectId, versionId, directionId));
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function createManualDirection() {
    try {
      const created = await createVisualDirection(accessToken, workspaceId, projectId, versionId, {
        identityVersionId: versionId,
        name: 'New visual direction',
        rationale: '',
        moodKeywords: [],
        imagery: [],
        layoutNotes: [],
        colors: [{ tokenName: 'brand-primary', name: 'Primary', hex: '#0F766E', usage: 'Primary brand color' }],
        fonts: [
          {
            role: 'heading',
            family: 'Inter',
            fallback: 'sans-serif',
            weights: [400, 700],
            supportedScripts: ['latin'],
            source: 'GOOGLE',
            licenseStatus: 'OPEN'
          }
        ]
      });

      await reload();
      setSelected(created);
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function runAi(mode: 'batch' | 'variation') {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const generation = await startVisualDirectionGeneration(accessToken, {
        workspaceId,
        identityVersionId: versionId,
        mode,
        ...(mode === 'variation' && selected ? { parentDirectionId: selected.direction.id } : {}),
        userInstructions: instructions
      });
      setStatus(mode === 'batch' ? 'AI visual direction batch queued.' : 'AI visual variation queued.');
      await waitForGeneration(accessToken, generation.job.id, (state) => {
        setStatus(state.job.progress_message ?? `AI visual generation is ${state.job.status.toLowerCase()}.`);
      }, 300_000);
      await reload();
      setStatus(mode === 'batch' ? 'AI visual directions generated.' : 'AI visual variation generated.');
      onSelected?.();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    } finally {
      setAiBusy(false);
    }
  }

  async function saveSelected(formData: FormData) {
    if (!selected || saveBusy) {
      return;
    }

    setSaveBusy(true);
    try {
      const payload = formToPayload(formData, versionId, selected);
      const updated = await updateVisualDirection(accessToken, workspaceId, projectId, versionId, selected.direction.id, payload);
      setSelected(updated);
      await reload();
      setStatus('Visual direction saved.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    } finally {
      setSaveBusy(false);
    }
  }

  function submitSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveSelected(new FormData(event.currentTarget));
  }

  async function selectCurrent() {
    if (!selected) {
      return;
    }
    if (!window.confirm('Select this visual direction? Existing downstream assets may become stale.')) {
      return;
    }

    try {
      const updated = await selectVisualDirection(accessToken, workspaceId, projectId, versionId, selected.direction.id, selected.direction.lock_version);
      setSelected(updated);
      await reload();
      setStatus('Visual direction selected. Assets are unlocked.');
      onSelected?.();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function archiveCurrent() {
    if (!selected) {
      return;
    }
    if (!window.confirm('Archive this direction? Existing generated data is preserved but hidden from the active gallery.')) {
      return;
    }

    try {
      await archiveVisualDirection(accessToken, workspaceId, projectId, versionId, selected.direction.id, selected.direction.lock_version);
      setSelected(null);
      await reload();
      setStatus('Visual direction archived.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 className="section-title">Visual directions</h2>
          <p className="section-copy">{status}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" disabled={aiBusy} onClick={() => void runAi('batch')}>
            Generate directions
          </Button>
          <Button type="button" variant="secondary" onClick={() => void createManualDirection()}>
            Add manually
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <TextAreaField
          id="visual-ai-instructions"
          label="AI visual instructions"
          value={instructions}
          onChange={(event) => setInstructions(event.currentTarget.value)}
          placeholder="Optional: describe visual preferences, references, markets, or constraints."
        />
      </div>

      <div className="two-column" style={{ marginTop: 18 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {directions.map((direction) => (
            <button
              key={direction.id}
              type="button"
              className="panel panel-pad"
              onClick={() => void openDirection(direction.id)}
              style={{ textAlign: 'left', cursor: 'pointer', borderColor: direction.is_selected ? 'var(--color-signal)' : undefined }}
              aria-pressed={selected?.direction.id === direction.id}
            >
              <strong>{direction.name}</strong>
              <p className="section-copy">
                {direction.is_selected ? 'Selected - ' : ''}
                {direction.origin === 'AI' ? 'AI suggestion' : 'User edited'}
              </p>
            </button>
          ))}
        </div>

        {selected ? (
          <form onSubmit={submitSelected} className="panel panel-pad" style={{ display: 'grid', gap: 14 }}>
            <input type="hidden" name="lockVersion" value={selected.direction.lock_version} />
            <TextField id="visual-name" name="name" label="Name" defaultValue={selected.direction.name} />
            <TextAreaField id="visual-rationale" name="rationale" label="Rationale" defaultValue={selected.direction.rationale ?? ''} />
            <TextAreaField id="visual-mood" name="moodKeywords" label="Mood keywords, one per line" defaultValue={(selected.direction.mood_keywords ?? []).join('\n')} />
            <TextAreaField id="visual-imagery" name="imagery" label="Imagery / iconography, one per line" defaultValue={(selected.direction.imagery ?? []).join('\n')} />
            <TextAreaField id="visual-layout" name="layoutNotes" label="Layout / accessibility notes, one per line" defaultValue={(selected.direction.layout_notes ?? []).join('\n')} />

            <PalettePreview aggregate={selected} />
            <FontPreview aggregate={selected} />

            <details className="panel panel-pad">
              <summary>Edit palette JSON</summary>
              <TextAreaField id="visual-colors-json" name="colorsJson" label="Colors JSON" defaultValue={JSON.stringify(selected.colors, null, 2)} />
            </details>
            <details className="panel panel-pad">
              <summary>Edit fonts JSON</summary>
              <TextAreaField id="visual-fonts-json" name="fontsJson" label="Fonts JSON" defaultValue={JSON.stringify(selected.fonts, null, 2)} />
            </details>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button type="submit" disabled={saveBusy}>Save direction</Button>
              <Button type="button" variant="secondary" disabled={aiBusy} onClick={() => void runAi('variation')}>
                Generate variation
              </Button>
              <Button type="button" variant="secondary" onClick={() => void selectCurrent()}>
                Select direction
              </Button>
              <Button type="button" variant="secondary" onClick={() => void archiveCurrent()}>
                Archive
              </Button>
            </div>
          </form>
        ) : (
          <div className="panel panel-pad">
            <p className="section-copy">Choose a direction to inspect colors, fonts, and guidance.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PalettePreview({ aggregate }: { aggregate: VisualDirectionAggregate }) {
  return (
    <section>
      <h3>Palette</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {aggregate.colors.map((color) => (
          <div key={color.id} className="panel panel-pad" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
            <span aria-label={`${color.name} swatch`} style={{ minHeight: 64, borderRadius: 8, background: color.hex, border: '1px solid var(--color-border)' }} />
            <div>
              <strong>{color.name}</strong>
              <p className="section-copy">
                {color.hex} - RGB {color.rgb.r}/{color.rgb.g}/{color.rgb.b} - HSL {color.hsl.h}/{color.hsl.s}/{color.hsl.l}
              </p>
              <p className="section-copy">
                Contrast: white {color.contrast_on_white} - black {color.contrast_on_black}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FontPreview({ aggregate }: { aggregate: VisualDirectionAggregate }) {
  return (
    <section>
      <h3>Typography</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {aggregate.fonts.map((font) => (
          <div key={font.id} className="panel panel-pad">
            <strong>
              {font.role}: {font.family}
            </strong>
            <p className="section-copy">
              Source {font.source} - License {font.license_status} - Scripts {font.supported_scripts.join(', ') || 'unknown'}
            </p>
            <p style={{ fontFamily: `${font.family}, ${font.fallback}`, fontSize: 22, margin: '10px 0 0' }}>Brand specimen - Sample visual identity</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formToPayload(formData: FormData, versionId: string, selected: VisualDirectionAggregate): VisualDirectionPayload & { lockVersion: number } {
  return {
    identityVersionId: versionId,
    lockVersion: Number(formData.get('lockVersion')),
    name: String(formData.get('name') ?? ''),
    rationale: String(formData.get('rationale') ?? ''),
    moodKeywords: splitLines(String(formData.get('moodKeywords') ?? '')),
    imagery: splitLines(String(formData.get('imagery') ?? '')),
    layoutNotes: splitLines(String(formData.get('layoutNotes') ?? '')),
    colors: parseColors(String(formData.get('colorsJson') ?? '[]'), selected),
    fonts: parseFonts(String(formData.get('fontsJson') ?? '[]'), selected)
  };
}

function parseColors(json: string, selected: VisualDirectionAggregate): VisualColorPayload {
  const rows = JSON.parse(json) as Array<{ id?: string; token_name?: string; tokenName?: string; name: string; hex: string; usage?: string | null }>;
  return rows.map((row, index) => ({
    ...(row.id ? { id: row.id } : {}),
    tokenName: row.tokenName ?? row.token_name ?? selected.colors[index]?.token_name ?? `color-${index + 1}`,
    name: row.name,
    hex: row.hex,
    usage: row.usage ?? '',
    sortOrder: index
  }));
}

function parseFonts(json: string, selected: VisualDirectionAggregate): VisualFontPayload {
  const rows = JSON.parse(json) as Array<{
    id?: string;
    role: string;
    family: string;
    fallback: string;
    weights?: number[];
    supported_scripts?: string[];
    supportedScripts?: string[];
    source?: string;
    license_status?: string;
    licenseStatus?: string;
  }>;
  return rows.map((row, index) => ({
    ...(row.id ? { id: row.id } : {}),
    role: row.role,
    family: row.family,
    fallback: row.fallback,
    weights: row.weights ?? selected.fonts[index]?.weights ?? [400],
    supportedScripts: row.supportedScripts ?? row.supported_scripts ?? [],
    source: row.source ?? 'SYSTEM',
    licenseStatus: row.licenseStatus ?? row.license_status ?? 'UNKNOWN',
    sortOrder: index
  }));
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
