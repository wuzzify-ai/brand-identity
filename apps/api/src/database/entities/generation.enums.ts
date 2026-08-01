export enum GenerationJobStatus {
  Queued = 'QUEUED',
  Running = 'RUNNING',
  Succeeded = 'SUCCEEDED',
  Failed = 'FAILED',
  CancelRequested = 'CANCEL_REQUESTED',
  Cancelled = 'CANCELLED',
  Stalled = 'STALLED'
}

export enum GenerationArtifactKind {
  Json = 'JSON',
  Image = 'IMAGE',
  File = 'FILE',
  BrandBook = 'BRAND_BOOK'
}

export enum GenerationTask {
  BriefExtract = 'BRIEF_EXTRACT',
  BriefImprove = 'BRIEF_IMPROVE',
  StrategyGenerate = 'STRATEGY_GENERATE',
  StrategySectionRegenerate = 'STRATEGY_SECTION_REGENERATE',
  VisualDirectionsGenerate = 'VISUAL_DIRECTIONS_GENERATE',
  VisualVariationGenerate = 'VISUAL_VARIATION_GENERATE',
  LogoConceptsGenerate = 'LOGO_CONCEPTS_GENERATE',
  BrandBookNarrativeGenerate = 'BRAND_BOOK_NARRATIVE_GENERATE',
  QualityReview = 'QUALITY_REVIEW'
}

export enum AiGenerationTier {
  Fast = 'FAST',
  Balanced = 'BALANCED',
  Premium = 'PREMIUM'
}
