export enum BrandAssetCategory {
  LogoConcept = 'LOGO_CONCEPT',
  LogoFinal = 'LOGO_FINAL',
  Moodboard = 'MOODBOARD',
  VisualReference = 'VISUAL_REFERENCE',
  BrandBook = 'BRAND_BOOK',
  Export = 'EXPORT',
  Other = 'OTHER'
}

export enum BrandAssetSource {
  UserUpload = 'USER_UPLOAD',
  AiGenerated = 'AI_GENERATED',
  Imported = 'IMPORTED'
}

export enum BrandAssetStatus {
  PendingUpload = 'PENDING_UPLOAD',
  Quarantined = 'QUARANTINED',
  Processing = 'PROCESSING',
  Available = 'AVAILABLE',
  Rejected = 'REJECTED',
  Archived = 'ARCHIVED'
}

export enum BrandAssetVisibility {
  Private = 'PRIVATE',
  PublicCdn = 'PUBLIC_CDN'
}

export enum AssetVariantKind {
  Original = 'ORIGINAL',
  Preview = 'PREVIEW',
  Thumbnail = 'THUMBNAIL'
}

export enum AnonymousUploadGrantStatus {
  Issued = 'ISSUED',
  Uploaded = 'UPLOADED',
  Completed = 'COMPLETED',
  Expired = 'EXPIRED',
  Revoked = 'REVOKED'
}
