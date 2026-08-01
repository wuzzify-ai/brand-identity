'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { normalizeApiError } from '../../lib/api-client';
import { startStrategyGeneration, waitForGeneration } from '../../lib/generation-api';
import {
  completeStrategy,
  getStrategy,
  updateStrategy,
  type StrategyAggregate,
  type StrategyContentOrigin,
  type StrategyPayload
} from '../../lib/strategy-api';
import { Button } from '../ui/button';
import { TextAreaField, TextField } from '../ui/form';

const originSchema = z.enum(['AI', 'USER', 'IMPORTED']).default('USER');
const textItemSchema = z.object({ id: z.string().optional(), text: z.string().min(1), origin: originSchema });
const personaSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  segment: z.string().optional(),
  needsText: z.string().optional(),
  painsText: z.string().optional(),
  origin: originSchema
});
const pillarSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  proofPointsText: z.string().optional(),
  origin: originSchema
});
const taglineSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  languageCode: z.string().default('en'),
  isSelected: z.boolean().default(false),
  legalReviewRequired: z.boolean().default(true),
  origin: originSchema
});
const ruleSchema = textItemSchema.extend({ legalReviewRequired: z.boolean().default(false) });

const strategyFormSchema = z.object({
  lockVersion: z.number().min(1),
  positioning: z.string().optional(),
  valueProposition: z.string().optional(),
  mission: z.string().optional(),
  vision: z.string().optional(),
  essence: z.string().optional(),
  promise: z.string().optional(),
  generationInstructions: z.string().optional(),
  values: z.array(textItemSchema),
  personas: z.array(personaSchema),
  messagingPillars: z.array(pillarSchema),
  taglines: z.array(taglineSchema),
  rules: z.array(ruleSchema)
});

type StrategyFormValues = z.infer<typeof strategyFormSchema>;
type SectionProps = Pick<ReturnType<typeof useForm<StrategyFormValues>>, 'control' | 'register'>;

type StrategyEditorProps = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  onCompleted?: () => void;
};

export function StrategyEditor({ accessToken, workspaceId, projectId, versionId, onCompleted }: StrategyEditorProps) {
  const [strategy, setStrategy] = useState<StrategyAggregate | null>(null);
  const [status, setStatus] = useState('Loading strategy…');
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<StrategyFormValues>({
    resolver: zodResolver(strategyFormSchema),
    defaultValues: emptyValues()
  });

  useEffect(() => {
    void reload();
  }, [accessToken, workspaceId, projectId, versionId]);

  async function reload() {
    try {
      const next = await getStrategy(accessToken, workspaceId, projectId, versionId);
      setStrategy(next);
      form.reset(toFormValues(next));
      setStatus('Strategy loaded.');
      setConflict(false);
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function save(values: StrategyFormValues, section?: string) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const next = await updateStrategy(accessToken, workspaceId, projectId, versionId, toPayload(values, section));
      setStrategy(next);
      form.reset(toFormValues(next));
      setStatus(section ? `${section} saved.` : 'Strategy saved.');
      setConflict(false);
    } catch (caught) {
      const error = normalizeApiError(caught);
      setStatus(error.message);
      setConflict(error.status === 409 || error.code === 'STRATEGY_UPDATE_CONFLICT');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runAi(mode: 'full' | 'section', section?: string) {
    try {
      setAiStatus(mode === 'full' ? 'AI strategy job queued.' : `AI regeneration queued for ${section}.`);
      const generation = await startStrategyGeneration(accessToken, {
        workspaceId,
        identityVersionId: versionId,
        mode,
        ...(section ? { section } : {}),
        userInstructions: form.getValues('generationInstructions') ?? ''
      });
      await waitForGeneration(accessToken, generation.job.id, (state) => {
        setAiStatus(state.job.progress_message ?? `AI generation is ${state.job.status.toLowerCase()}.`);
      });
      await reload();
      setAiStatus(mode === 'full' ? 'AI strategy generated and applied.' : `${section} regenerated and applied.`);
    } catch (caught) {
      setAiStatus(normalizeApiError(caught).message);
    }
  }

  async function completeCurrentStrategy() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const next = await completeStrategy(accessToken, workspaceId, projectId, versionId, form.getValues('lockVersion'));
      setStrategy(next);
      form.reset(toFormValues(next));
      setStatus('Strategy completed. Visuals are unlocked.');
      onCompleted?.();
    } catch (caught) {
      const error = normalizeApiError(caught);
      setStatus(error.message);
      setConflict(error.status === 409 || error.code === 'STRATEGY_UPDATE_CONFLICT');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!strategy) {
    return <section className="panel panel-pad"><p className="section-copy">{status}</p></section>;
  }

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 className="section-title">Strategy</h2>
          <p className="section-copy">
            {strategy.strategy.completion_percent}% complete · {strategy.strategy.confirmed_at ? 'Confirmed' : 'Draft'}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void runAi('full')}>Generate strategy</Button>
      </div>

      <form onSubmit={form.handleSubmit((values) => save(values))} style={{ display: 'grid', gap: 18, marginTop: 18 }}>
        <input type="hidden" {...form.register('lockVersion', { valueAsNumber: true })} />
        <TextAreaField id="generationInstructions" label="AI regeneration instructions" {...form.register('generationInstructions')} />

        <details open className="panel panel-pad">
          <summary>Positioning and foundation</summary>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <TextAreaField id="strategy-positioning" label="Positioning" {...form.register('positioning')} />
            <TextAreaField id="value-proposition" label="Value proposition" {...form.register('valueProposition')} />
            <TextAreaField id="mission" label="Mission" {...form.register('mission')} />
            <TextAreaField id="vision" label="Vision" {...form.register('vision')} />
            <TextField id="essence" label="Essence" {...form.register('essence')} />
            <TextField id="promise" label="Promise" {...form.register('promise')} />
            <Button type="button" variant="secondary" onClick={() => void runAi('section', 'root')}>Regenerate foundation</Button>
          </div>
        </details>

        <TextSection title="Values" name="values" control={form.control} register={form.register} />
        <PersonaSection control={form.control} register={form.register} />
        <PillarSection control={form.control} register={form.register} />
        <TaglineSection control={form.control} register={form.register} />
        <RuleSection control={form.control} register={form.register} />

        <aside className="panel panel-pad" aria-live="polite">
          <h3 style={{ marginTop: 0 }}>Strategy checklist</h3>
          {strategy.strategy.completion_reasons.length ? (
            <ul>{strategy.strategy.completion_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          ) : (
            <p className="section-copy">All required strategy fields are present.</p>
          )}
          <p className="section-copy">{status}</p>
          {aiStatus ? <p className="section-copy">{aiStatus}</p> : null}
          {conflict ? <Button type="button" variant="secondary" onClick={() => void reload()}>Reload server version</Button> : null}
        </aside>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button type="submit" disabled={isSubmitting}>Save strategy</Button>
          <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => void completeCurrentStrategy()}>
            Complete strategy
          </Button>
        </div>
      </form>
    </section>
  );
}

function TextSection({ title, name, control, register }: SectionProps & { title: string; name: 'values' }) {
  const { fields, append, remove, swap } = useFieldArray({ control, name });
  return (
    <ListShell title={title} onAdd={() => append({ text: '', origin: 'USER' })}>
      <Button type="button" variant="secondary" onClick={() => void 0}>Compare history</Button>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as StrategyContentOrigin} />
          <TextField id={`value-${index}`} label="Value" {...register(`values.${index}.text`)} />
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </ListShell>
  );
}

function PersonaSection({ control, register }: SectionProps) {
  const { fields, append, remove, swap } = useFieldArray({ control, name: 'personas' });
  return (
    <ListShell title="Personas" onAdd={() => append({ name: '', segment: '', needsText: '', painsText: '', origin: 'USER' })}>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as StrategyContentOrigin} />
          <TextField id={`persona-${index}-name`} label="Name" {...register(`personas.${index}.name`)} />
          <TextField id={`persona-${index}-segment`} label="Segment" {...register(`personas.${index}.segment`)} />
          <TextAreaField id={`persona-${index}-needs`} label="Needs, one per line" {...register(`personas.${index}.needsText`)} />
          <TextAreaField id={`persona-${index}-pains`} label="Pains, one per line" {...register(`personas.${index}.painsText`)} />
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </ListShell>
  );
}

function PillarSection({ control, register }: SectionProps) {
  const { fields, append, remove, swap } = useFieldArray({ control, name: 'messagingPillars' });
  return (
    <ListShell title="Messaging pillars" onAdd={() => append({ title: '', message: '', proofPointsText: '', origin: 'USER' })}>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as StrategyContentOrigin} />
          <TextField id={`pillar-${index}-title`} label="Title" {...register(`messagingPillars.${index}.title`)} />
          <TextAreaField id={`pillar-${index}-message`} label="Message" {...register(`messagingPillars.${index}.message`)} />
          <TextAreaField id={`pillar-${index}-proof`} label="Proof points, one per line" {...register(`messagingPillars.${index}.proofPointsText`)} />
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </ListShell>
  );
}

function TaglineSection({ control, register }: SectionProps) {
  const { fields, append, remove, swap } = useFieldArray({ control, name: 'taglines' });
  return (
    <ListShell title="Taglines" onAdd={() => append({ text: '', languageCode: 'en', isSelected: false, legalReviewRequired: true, origin: 'USER' })}>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as StrategyContentOrigin} />
          <TextField id={`tagline-${index}-text`} label="Tagline" {...register(`taglines.${index}.text`)} />
          <TextField id={`tagline-${index}-language`} label="Language" {...register(`taglines.${index}.languageCode`)} />
          <label><input type="checkbox" {...register(`taglines.${index}.isSelected`)} /> Selected for this language</label>
          <label><input type="checkbox" {...register(`taglines.${index}.legalReviewRequired`)} /> Needs legal/trademark review</label>
          <p className="section-copy">Trademark clearance is not automated; selected taglines should be reviewed before activation.</p>
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </ListShell>
  );
}

function RuleSection({ control, register }: SectionProps) {
  const { fields, append, remove, swap } = useFieldArray({ control, name: 'rules' });
  return (
    <ListShell title="Brand rules" onAdd={() => append({ text: '', legalReviewRequired: false, origin: 'USER' })}>
      {fields.map((field, index) => (
        <div className="panel panel-pad" key={field.id} style={{ display: 'grid', gap: 10 }}>
          <Provenance origin={field.origin as StrategyContentOrigin} />
          <TextAreaField id={`rule-${index}`} label="Rule" {...register(`rules.${index}.text`)} />
          <label><input type="checkbox" {...register(`rules.${index}.legalReviewRequired`)} /> Needs legal review</label>
          <RowControls index={index} count={fields.length} onUp={() => swap(index, index - 1)} onDown={() => swap(index, index + 1)} onRemove={() => remove(index)} />
        </div>
      ))}
    </ListShell>
  );
}

function ListShell({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <details open className="panel panel-pad">
      <summary>{title}</summary>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <Button type="button" variant="secondary" onClick={onAdd}>Add {title.toLowerCase()}</Button>
        {children}
      </div>
    </details>
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

function Provenance({ origin }: { origin: StrategyContentOrigin }) {
  return <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>{origin === 'AI' ? 'AI suggestion' : origin === 'IMPORTED' ? 'Imported' : 'User edited'}</span>;
}

function emptyValues(): StrategyFormValues {
  return {
    lockVersion: 1,
    positioning: '',
    valueProposition: '',
    mission: '',
    vision: '',
    essence: '',
    promise: '',
    generationInstructions: '',
    values: [],
    personas: [],
    messagingPillars: [],
    taglines: [],
    rules: []
  };
}

function toFormValues(aggregate: StrategyAggregate): StrategyFormValues {
  return {
    lockVersion: aggregate.strategy.lock_version,
    positioning: aggregate.strategy.positioning ?? '',
    valueProposition: aggregate.strategy.value_proposition ?? '',
    mission: aggregate.strategy.mission ?? '',
    vision: aggregate.strategy.vision ?? '',
    essence: aggregate.strategy.essence ?? '',
    promise: aggregate.strategy.promise ?? '',
    generationInstructions: '',
    values: aggregate.values.map((item) => ({ id: item.id, text: item.text, origin: item.origin })),
    personas: aggregate.personas.map((item) => ({
      id: item.id,
      name: item.name,
      segment: item.segment ?? '',
      needsText: item.needs.join('\n'),
      painsText: item.pains.join('\n'),
      origin: item.origin
    })),
    messagingPillars: aggregate.messagingPillars.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      proofPointsText: item.proof_points.join('\n'),
      origin: item.origin
    })),
    taglines: aggregate.taglines.map((item) => ({
      id: item.id,
      text: item.text,
      languageCode: item.language_code,
      isSelected: item.is_selected,
      legalReviewRequired: item.legal_review_required,
      origin: item.origin
    })),
    rules: aggregate.rules.map((item) => ({
      id: item.id,
      text: item.text,
      legalReviewRequired: Boolean(item.legal_review_required),
      origin: item.origin
    }))
  };
}

function toPayload(values: StrategyFormValues, section?: string): StrategyPayload {
  const include = (name: string) => !section || section === name;
  const payload: StrategyPayload = { lockVersion: values.lockVersion };

  if (include('root')) {
    payload.positioning = values.positioning ?? '';
    payload.valueProposition = values.valueProposition ?? '';
    payload.mission = values.mission ?? '';
    payload.vision = values.vision ?? '';
    payload.essence = values.essence ?? '';
    payload.promise = values.promise ?? '';
  }
  if (include('values')) {
    payload.values = values.values.map((item, index) => ({ ...(item.id ? { id: item.id } : {}), text: item.text, origin: item.origin, sortOrder: index }));
  }
  if (include('personas')) {
    payload.personas = values.personas.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      name: item.name,
      segment: item.segment ?? '',
      needs: splitLines(item.needsText),
      pains: splitLines(item.painsText),
      origin: item.origin,
      sortOrder: index
    }));
  }
  if (include('messagingPillars')) {
    payload.messagingPillars = values.messagingPillars.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      title: item.title,
      message: item.message,
      proofPoints: splitLines(item.proofPointsText),
      origin: item.origin,
      sortOrder: index
    }));
  }
  if (include('taglines')) {
    payload.taglines = values.taglines.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      text: item.text,
      languageCode: item.languageCode,
      isSelected: item.isSelected,
      legalReviewRequired: item.legalReviewRequired,
      origin: item.origin,
      sortOrder: index
    }));
  }
  if (include('rules')) {
    payload.rules = values.rules.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      text: item.text,
      legalReviewRequired: item.legalReviewRequired,
      origin: item.origin,
      sortOrder: index
    }));
  }

  return payload;
}

function splitLines(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
