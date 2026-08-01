import { DomainError } from '../common/domain-error';
import { GenerationJobStatus } from '../database/entities';

const allowedTransitions: Record<GenerationJobStatus, GenerationJobStatus[]> = {
  [GenerationJobStatus.Queued]: [
    GenerationJobStatus.Running,
    GenerationJobStatus.CancelRequested,
    GenerationJobStatus.Cancelled,
    GenerationJobStatus.Stalled,
    GenerationJobStatus.Failed
  ],
  [GenerationJobStatus.Running]: [
    GenerationJobStatus.Succeeded,
    GenerationJobStatus.Failed,
    GenerationJobStatus.CancelRequested,
    GenerationJobStatus.Stalled
  ],
  [GenerationJobStatus.Stalled]: [
    GenerationJobStatus.Queued,
    GenerationJobStatus.Running,
    GenerationJobStatus.Failed,
    GenerationJobStatus.CancelRequested
  ],
  [GenerationJobStatus.CancelRequested]: [GenerationJobStatus.Cancelled, GenerationJobStatus.Succeeded, GenerationJobStatus.Failed],
  [GenerationJobStatus.Succeeded]: [],
  [GenerationJobStatus.Failed]: [],
  [GenerationJobStatus.Cancelled]: []
};

export const terminalGenerationStatuses = new Set<GenerationJobStatus>([
  GenerationJobStatus.Succeeded,
  GenerationJobStatus.Failed,
  GenerationJobStatus.Cancelled
]);

export function assertGenerationTransition(from: GenerationJobStatus, to: GenerationJobStatus): void {
  if (from === to) {
    return;
  }

  if (!allowedTransitions[from].includes(to)) {
    throw new DomainError('GENERATION_INVALID_STATE_TRANSITION', `Cannot move generation job from ${from} to ${to}.`, 409);
  }
}
