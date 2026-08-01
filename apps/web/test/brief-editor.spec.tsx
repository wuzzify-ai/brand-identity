import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BriefEditor } from '../src/components/identity/brief-editor';
import * as briefApi from '../src/lib/brief-api';
import * as generationApi from '../src/lib/generation-api';

vi.mock('../src/lib/brief-api', () => ({
  completeBrief: vi.fn(),
  getBrief: vi.fn(),
  updateBrief: vi.fn()
}));

vi.mock('../src/lib/generation-api', () => ({
  startBriefGeneration: vi.fn(),
  waitForGeneration: vi.fn()
}));

const briefAggregate = {
  brief: {
    id: 'brief-id',
    identity_version_id: 'version-id',
    lock_version: 1,
    industry: null,
    positioning: null,
    completion_percent: 0,
    completion_reasons: ['industry is required'],
    confirmed_at: null
  },
  languages: [],
  audiences: [],
  markets: [],
  offerings: [],
  preferences: [],
  constraints: []
} as briefApi.BriefAggregate;

describe('BriefEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(briefApi.getBrief).mockResolvedValue(briefAggregate);
    vi.mocked(generationApi.startBriefGeneration).mockResolvedValue({
      job: {
        id: 'generation-id',
        status: 'QUEUED',
        progress_percent: 5,
        progress_message: 'Queued for generation.',
        error_message: null
      }
    });
    vi.mocked(generationApi.waitForGeneration).mockResolvedValue({
      job: {
        id: 'generation-id',
        status: 'SUCCEEDED',
        progress_percent: 100,
        progress_message: 'Done.',
        error_message: null
      }
    });
  });

  it('starts brief generation from the saved initial business description', async () => {
    render(
      <BriefEditor
        accessToken="access-token"
        workspaceId="workspace-id"
        projectId="project-id"
        versionId="version-id"
        initialBusinessDescription="A practical automation consultancy for growing teams."
      />
    );

    await screen.findByRole('button', { name: 'Build with AI' });
    fireEvent.click(screen.getByRole('button', { name: 'Build with AI' }));

    await waitFor(() => expect(generationApi.startBriefGeneration).toHaveBeenCalled());
    expect(generationApi.startBriefGeneration).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({
        businessDescription: 'A practical automation consultancy for growing teams.',
        mode: 'full'
      })
    );
  });
});
