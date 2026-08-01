export enum UserAccountStatus {
  PendingVerification = 'PENDING_VERIFICATION',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
  Deleted = 'DELETED'
}

export enum AuthIdentityProvider {
  Google = 'GOOGLE',
  Github = 'GITHUB',
  Microsoft = 'MICROSOFT',
  Oidc = 'OIDC'
}

export enum AuthRefreshTokenStatus {
  Active = 'ACTIVE',
  Rotated = 'ROTATED',
  Revoked = 'REVOKED',
  Expired = 'EXPIRED'
}

export enum WorkspaceStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED'
}

export enum WorkspaceRole {
  Owner = 'OWNER',
  Editor = 'EDITOR',
  Reviewer = 'REVIEWER',
  Viewer = 'VIEWER'
}

export enum MembershipStatus {
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED'
}

export enum InvitationStatus {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  Revoked = 'REVOKED',
  Expired = 'EXPIRED'
}
