'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../ui/button';
import { TextAreaField, TextField } from '../ui/form';
import { normalizeApiError } from '../../lib/api-client';
import {
  completeBrief,
  getBrief,
  updateBrief,
  type BriefAggregate,
  type BriefContentOrigin,
  type BriefFormPayload
} from '../../lib/brief-api';
import { startBriefGeneration, waitForGeneration } from '../../lib/generation-api';

const languageSchema = z.object({
  id: z.string().optional(),
  languageCode: z.string().min(1, 'Language tag is required.'),
  displayName: z.string().min(1, 'Display name is required.'),
  isPrimary: z.boolean().default(false),
  origin: z.enum(['AI', 'USER', 'IMPORTED']).default('USER')
});

const namedItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required.'),
  description: z.string().optional(),
  origin: z.enum(['AI', 'USER', 'IMPORTED']).default('USER')
});

const marketSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Market is required.'),
  region: z.string().optional(),
  origin: z.enum(['AI', 'USER', 'IMPORTED']).default('USER')
});

const textItemSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, 'Text is required.'),
  origin: z.enum(['AI', 'USER', 'IMPORTED']).default('USER')
});

const briefFormSchema = z.object({
  lockVersion: z.number().min(1),
  industry: z.string().optional(),
  positioning: z.string().optional(),
  businessDescription: z.string().optional(),
  locale: z.string().default('en'),
  languages: z.array(languageSchema),
  audiences: z.array(namedItemSchema),
  markets: z.array(marketSchema),
  offerings: z.array(namedItemSchema),
  preferences: z.array(textItemSchema),
  constraints: z.array(textItemSchema)
});

type BriefFormValues = z.infer<typeof briefFormSchema>;

type BriefEditorProps = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  initialBusinessDescription?: string | null;
  autoBuild?: boolean;
  onCompleted?: () => void;
};

export function BriefEditor({
  accessToken,
  workspaceId,
  projectId,
  versionId,
  initialBusinessDescription,
  autoBuild = false,
  onCompleted
}: BriefEditorProps) {
  const [brief, setBrief] = useState<BriefAggregate | null>(null);
  const [status, setStatus] = useState<string>('Loading brief…');
  const [conflict, setConflict] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [autoBuildStarted, setAutoBuildStarted] = useState(false);
  const form = useForm<BriefFormValues>({
    resolver: zodResolver(briefFormSchema),
    defaultValues: emptyValues()
  });
  const completionReasons = brief?.brief.completion_reasons ?? [];
  const direction = useMemo(() => (form.watch('locale').toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'), [form]);

  useEffect(() => {
    void reload();
  }, [accessToken, workspaceId, projectId, versionId]);

  useEffect(() => {
    if (!autoBuild || autoBuildStarted || !brief) return;

    const businessDescription = form.getValues('businessDescription')?.trim();
    if (!businessDescription) return;

    setAutoBuildStarted(true);
    void runAi('full');
  }, [autoBuild, autoBuildStarted, brief, form]);

  async function reload(businessDescriptionOverride?: string | null) {
    try {
      const next = await getBrief(accessToken, workspaceId, projectId, versionId);
      setBrief(next);
      form.reset(
        toFormValues(
          next,
          preferredBusinessDescription(
            businessDescriptionOverride ?? form.getValues('businessDescription'),
            initialBusinessDescription
          )
        )
      );
      setStatus('Brief loaded.');
      setConflict(false);
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function save(values: BriefFormValues, selectedFields?: string[]) {
    try {
      const payload = toPayload(values, selectedFields);
      const next = await updateBrief(accessToken, workspaceId, projectId, versionId, payload);
      setBrief(next);
      form.reset(toFormValues(next, values.businessDescription));
      setStatus('Saved.');
      setConflict(false);
    } catch (caught) {
      const error = normalizeApiError(caught);
      setStatus(error.message);
      setConflict(error.status === 409 || error.code === 'BRIEF_UPDATE_CONFLICT');
    }
  }

  async function runAi(mode: 'full' | 'empty-fields' | 'selected-fields') {
    const values = form.getValues();
    const selectedFields = mode === 'selected-fields' ? selectedAiFields(values) : [];
    const businessDescription = values.businessDescription?.trim() ?? '';

    if (!businessDescription) {
      setAiStatus('Add a business description before generating AI brief content.');
      return;
    }

    try {
      setAiStatus('AI brief job queued. Manual editing stays available.');
      const generation = await startBriefGeneration(accessToken, {
        workspaceId,
        identityVersionId: versionId,
        businessDescription,
        mode,
        selectedFields,
        locale: values.locale,
        constraints: values.constraints.map((item) => item.text).filter(Boolean)
      });
      await waitForGeneration(accessToken, generation.job.id, (state) => {
        setAiStatus(state.job.progress_message ?? `AI generation is ${state.job.status.toLowerCase()}.`);
      });
      await reload(businessDescription);
      setAiStatus('AI suggestions were applied to the brief.');
    } catch (caught) {
      setAiStatus(normalizeApiError(caught).message);
    }
  }

  async function completeCurrentBrief() {
    try {
      const next = await completeBrief(accessToken, workspaceId, projectId, versionId, form.getValues('lockVersion'));
      setBrief(next);
      form.reset(toFormValues(next, form.getValues('businessDescription')));
      setStatus('Brief completed. Strategy is unlocked.');
      onCompleted?.();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  if (!brief) {
    return <div className="panel panel-pad"><p className="section-copy">{status}</p></div>;
  }

  return (
    <section className="panel panel-pad" dir={direction}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 className="section-title">Brief</h2>
          <p className="section-copy">
            {brief.brief.completion_percent}% complete · {brief.brief.confirmed_at ? 'Confirmed' : 'Draft'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={() => void runAi('full')}>Build with AI</Button>
          <Button type="button" variant="secondary" onClick={() => void runAi('empty-fields')}>Fill empty fields</Button>
          <Button type="button" variant="secondary" onClick={() => void runAi('selected-fields')}>Regenerate selected</Button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit((values) => save(values))} style={{ display: 'grid', gap: 18, marginTop: 18 }}>
        <input type="hidden" {...form.register('lockVersion', { valueAsNumber: true })} />
        <TextAreaField
          id="businessDescription"
          label="Business description for AI"
          placeholder="Describe the business, audience, market, constraints, and style preferences…"
          {...form.register('businessDescription')}
        />
        <TextField id="locale" label="Locale" placeholder="en or ar-EG" {...form.register('locale')} />
        <TextField id="industry" label="Industry" {...form.register('industry')} />
        <TextAreaField id="positioning" label="Positioning" {...form.register('positioning')} />

        <LanguageSection control={form.control} register={form.register} />
        <NamedSection title="Audiences" name="audiences" control={form.control} register={form.register} />
        <MarketSection control={form.control} register={form.register} />
        <NamedSection title="Products / services" name="offerings" control={form.control} register={form.register} />
        <TextListSection title="Preferences (optional)" name="preferences" control={form.control} register={form.register} />
        <TextListSection title="Constraints (optional)" name="constraints" control={form.control} register={form.register} />

        <aside className="panel panel-pad" aria-live="polite">
          <h3 style={{ marginTop: 0 }}>Completion checklist</h3>
          {completionReasons.length ? (
            <ul className="brief-completion-checklist">
              {completionReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="section-copy">All required brief fields are present.</p>
          )}
          <p className="section-copy">{status}</p>
          {aiStatus ? <p className="section-copy">{aiStatus}</p> : null}
          {conflict ? (
            <Button type="button" variant="secondary" onClick={() => void reload()}>Reload server version</Button>
          ) : null}
        </aside>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button type="submit">Save brief</Button>
          <Button type="button" variant="secondary" onClick={() => void completeCurrentBrief()}>Complete brief</Button>
        </div>
      </form>
    </section>
  );
}

function LanguageSection({ control, register }: SectionProps) {
  const { fields, append, remove, swap } = useFieldArray({ control, name: 'languages' });

  return (
    <RepeatableSection title="Languages" onAdd={() => append({ languageCode: '', displayName: '', isPrimary: fields.length === 0, origin: 'USER' })}>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as BriefContentOrigin} />
          <TextField id={`language-${index}-code`} label="Language tag" {...register(`languages.${index}.languageCode`)} />
          <TextField id={`language-${index}-name`} label="Display name" {...register(`languages.${index}.displayName`)} />
          <label><input type="checkbox" {...register(`languages.${index}.isPrimary`)} /> Primary language</label>
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </RepeatableSection>
  );
}

function NamedSection({ title, name, control, register }: SectionProps & { title: string; name: 'audiences' | 'offerings' }) {
  const { fields, append, remove, swap } = useFieldArray({ control, name });

  return (
    <RepeatableSection title={title} onAdd={() => append({ name: '', description: '', origin: 'USER' })}>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as BriefContentOrigin} />
          <TextField id={`${name}-${index}-name`} label="Name" {...register(`${name}.${index}.name`)} />
          <TextAreaField id={`${name}-${index}-description`} label="Description" {...register(`${name}.${index}.description`)} />
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </RepeatableSection>
  );
}

function MarketSection({ control, register }: SectionProps) {
  const { fields, append, remove, swap } = useFieldArray({ control, name: 'markets' });

  return (
    <RepeatableSection title="Markets" onAdd={() => append({ name: '', region: '', origin: 'USER' })}>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as BriefContentOrigin} />
          <TextField id={`market-${index}-name`} label="Market" {...register(`markets.${index}.name`)} />
          <TextField id={`market-${index}-region`} label="Region" {...register(`markets.${index}.region`)} />
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </RepeatableSection>
  );
}

function TextListSection({ title, name, control, register }: SectionProps & { title: string; name: 'preferences' | 'constraints' }) {
  const { fields, append, remove, swap } = useFieldArray({ control, name });

  return (
    <RepeatableSection title={title} onAdd={() => append({ text: '', origin: 'USER' })}>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as BriefContentOrigin} />
          <TextAreaField id={`${name}-${index}-text`} label={title.slice(0, -1)} {...register(`${name}.${index}.text`)} />
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </RepeatableSection>
  );
}

type SectionProps = Pick<ReturnType<typeof useForm<BriefFormValues>>, 'control' | 'register'>;

function RepeatableSection({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <Button type="button" variant="secondary" onClick={onAdd}>Add</Button>
      </div>
      {children}
    </section>
  );
}

function RowControls(props: { index: number; count: number; onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button type="button" variant="secondary" disabled={props.index === 0} onClick={props.onUp}>Move up</Button>
      <Button type="button" variant="secondary" disabled={props.index === props.count - 1} onClick={props.onDown}>Move down</Button>
      <Button type="button" variant="secondary" onClick={props.onRemove}>Remove</Button>
    </div>
  );
}

function Provenance({ origin }: { origin: BriefContentOrigin }) {
  const label = origin === 'AI' ? 'AI suggestion' : origin === 'IMPORTED' ? 'Imported' : 'User edited';
  return <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>{label}</span>;
}

function emptyValues(): BriefFormValues {
  return {
    lockVersion: 1,
    industry: '',
    positioning: '',
    businessDescription: '',
    locale: 'en',
    languages: [],
    audiences: [],
    markets: [],
    offerings: [],
    preferences: [],
    constraints: []
  };
}

function toFormValues(aggregate: BriefAggregate, businessDescription?: string | null): BriefFormValues {
  return {
    lockVersion: aggregate.brief.lock_version,
    industry: aggregate.brief.industry ?? '',
    positioning: aggregate.brief.positioning ?? '',
    businessDescription: businessDescription ?? '',
    locale: aggregate.languages[0]?.language_code ?? 'en',
    languages: aggregate.languages.map((item) => ({
      id: item.id,
      languageCode: item.language_code,
      displayName: item.display_name,
      isPrimary: item.is_primary,
      origin: item.origin
    })),
    audiences: aggregate.audiences.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      origin: item.origin
    })),
    markets: aggregate.markets.map((item) => ({
      id: item.id,
      name: item.name,
      region: item.region ?? '',
      origin: item.origin
    })),
    offerings: aggregate.offerings.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      origin: item.origin
    })),
    preferences: aggregate.preferences.map((item) => ({ id: item.id, text: item.text, origin: item.origin })),
    constraints: aggregate.constraints.map((item) => ({ id: item.id, text: item.text, origin: item.origin }))
  };
}

function preferredBusinessDescription(current?: string | null, fallback?: string | null): string {
  const currentText = current?.trim();
  if (currentText) return currentText;
  return fallback?.trim() ?? '';
}

function toPayload(values: BriefFormValues, selectedFields?: string[]): BriefFormPayload {
  const include = (field: string) => !selectedFields || selectedFields.includes(field);
  const payload: BriefFormPayload = {
    lockVersion: values.lockVersion
  };

  if (include('industry')) payload.industry = values.industry ?? '';
  if (include('positioning')) payload.positioning = values.positioning ?? '';
  if (include('languages')) {
    payload.languages = values.languages.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      languageCode: item.languageCode,
      displayName: item.displayName,
      isPrimary: item.isPrimary,
      origin: item.origin,
      sortOrder: index
    }));
  }
  if (include('audiences')) {
    payload.audiences = values.audiences.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      name: item.name,
      ...(item.description !== undefined ? { description: item.description } : {}),
      origin: item.origin,
      sortOrder: index
    }));
  }
  if (include('markets')) {
    payload.markets = values.markets.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      name: item.name,
      ...(item.region !== undefined ? { region: item.region } : {}),
      origin: item.origin,
      sortOrder: index
    }));
  }
  if (include('offerings')) {
    payload.offerings = values.offerings.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      name: item.name,
      ...(item.description !== undefined ? { description: item.description } : {}),
      origin: item.origin,
      sortOrder: index
    }));
  }
  if (include('preferences')) {
    payload.preferences = values.preferences.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      text: item.text,
      origin: item.origin,
      sortOrder: index
    }));
  }
  if (include('constraints')) {
    payload.constraints = values.constraints.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      text: item.text,
      origin: item.origin,
      sortOrder: index
    }));
  }

  return payload;
}

function selectedAiFields(values: BriefFormValues): string[] {
  const fields = ['industry', 'positioning'];

  if (values.languages.length === 0) fields.push('languages');
  if (values.audiences.length === 0) fields.push('audiences');
  if (values.markets.length === 0) fields.push('markets');
  if (values.offerings.length === 0) fields.push('offerings');
  if (values.preferences.length === 0) fields.push('preferences');
  if (values.constraints.length === 0) fields.push('constraints');

  return fields;
}
