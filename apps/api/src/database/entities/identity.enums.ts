export enum IdentityProjectStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED'
}

export enum IdentityVersionStatus {
  Draft = 'DRAFT',
  InReview = 'IN_REVIEW',
  ChangesRequested = 'CHANGES_REQUESTED',
  Approved = 'APPROVED',
  Active = 'ACTIVE',
  Superseded = 'SUPERSEDED',
  Archived = 'ARCHIVED'
}

export enum WorkflowStageKey {
  Brief = 'BRIEF',
  Strategy = 'STRATEGY',
  Visuals = 'VISUALS',
  Assets = 'ASSETS',
  Finalize = 'FINALIZE'
}

export enum WorkflowStageStatus {
  Locked = 'LOCKED',
  NotStarted = 'NOT_STARTED',
  Generating = 'GENERATING',
  NeedsInput = 'NEEDS_INPUT',
  Ready = 'READY',
  Completed = 'COMPLETED',
  Stale = 'STALE',
  Failed = 'FAILED'
}
