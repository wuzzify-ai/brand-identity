import { apiFetch } from './api-client';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type GenerationState = {
  job: {
    id: string;
    status: string;
    progress_percent: number;
    progress_message: string | null;
    error_message: string | null;
  };
};

function createClientRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getGeneration(accessToken: string, jobId: string) {
  return apiFetch<GenerationState>(`/generations/${jobId}`, {
    headers: authHeaders(accessToken)
  });
}

export async function waitForGeneration(
  accessToken: string,
  jobId: string,
  onUpdate?: (state: GenerationState) => void,
  timeoutMs = 120_000
) {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const state = await getGeneration(accessToken, jobId);
    onUpdate?.(state);

    if (state.job.status === 'SUCCEEDED') {
      return state;
    }

    if (state.job.status === 'FAILED' || state.job.status === 'CANCELLED') {
      throw new Error(state.job.error_message ?? `Generation ${state.job.status.toLowerCase()}.`);
    }

    if (Date.now() >= deadline) {
      throw new Error('Generation is still running. Refresh the page to check its latest status.');
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

export function startBriefGeneration(
  accessToken: string,
  input: {
    workspaceId: string;
    identityVersionId: string;
    businessDescription: string;
    mode: 'full' | 'empty-fields' | 'selected-fields';
    selectedFields?: string[];
    locale?: string;
    constraints?: string[];
  }
) {
  return apiFetch<GenerationState>('/generations', {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Idempotency-Key': `brief-${input.identityVersionId}-${input.mode}-${createClientRequestId()}`
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      identityVersionId: input.identityVersionId,
      workflowStageKey: 'BRIEF',
      task: input.mode === 'full' ? 'BRIEF_EXTRACT' : 'BRIEF_IMPROVE',
      tier: 'BALANCED',
      input: {
        businessDescription: input.businessDescription,
        mode: input.mode,
        selectedFields: input.selectedFields ?? [],
        locale: input.locale ?? 'en',
        constraints: input.constraints ?? []
      }
    })
  });
}

export function startStrategyGeneration(
  accessToken: string,
  input: {
    workspaceId: string;
    identityVersionId: string;
    mode: 'full' | 'section';
    section?: string;
    userInstructions?: string;
  }
) {
  return apiFetch<GenerationState>('/generations', {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Idempotency-Key': `strategy-${input.identityVersionId}-${input.mode}-${input.section ?? 'all'}-${createClientRequestId()}`
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      identityVersionId: input.identityVersionId,
      workflowStageKey: 'STRATEGY',
      task: input.mode === 'section' ? 'STRATEGY_SECTION_REGENERATE' : 'STRATEGY_GENERATE',
      tier: 'BALANCED',
      input: {
        mode: input.mode,
        section: input.section,
        userInstructions: input.userInstructions ?? ''
      }
    })
  });
}

export function startVisualDirectionGeneration(
  accessToken: string,
  input: {
    workspaceId: string;
    identityVersionId: string;
    mode: 'batch' | 'variation';
    parentDirectionId?: string;
    userInstructions?: string;
  }
) {
  return apiFetch<GenerationState>('/generations', {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Idempotency-Key': `visual-${input.identityVersionId}-${input.mode}-${input.parentDirectionId ?? 'new'}-${createClientRequestId()}`
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      identityVersionId: input.identityVersionId,
      workflowStageKey: 'VISUALS',
      task: input.mode === 'variation' ? 'VISUAL_VARIATION_GENERATE' : 'VISUAL_DIRECTIONS_GENERATE',
      tier: 'BALANCED',
      input: {
        mode: input.mode,
        parentDirectionId: input.parentDirectionId,
        userInstructions: input.userInstructions ?? ''
      }
    })
  });
}

export function startLogoConceptGeneration(
  accessToken: string,
  input: {
    workspaceId: string;
    identityVersionId: string;
    count?: number;
    languageCodes?: string[];
    useCase?: string;
    userInstructions?: string;
  }
) {
  return apiFetch<GenerationState>('/generations', {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Idempotency-Key': `logo-${input.identityVersionId}-${createClientRequestId()}`
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      identityVersionId: input.identityVersionId,
      workflowStageKey: 'ASSETS',
      task: 'LOGO_CONCEPTS_GENERATE',
      tier: 'BALANCED',
      input: {
        count: input.count ?? 3,
        languageCodes: input.languageCodes ?? [],
        useCase: input.useCase ?? 'primary brand identity',
        userInstructions: input.userInstructions ?? ''
      }
    })
  });
}
