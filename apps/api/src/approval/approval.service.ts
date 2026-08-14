import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BrandContextService } from '../brand-context/brand-context.service';
import { AuditService } from '../audit/audit.service';
import { DomainError } from '../common/domain-error';
import { IdentityVersionStatus } from '../database/entities';
import type { ApprovalReasonDto } from './dto/approval.dto';

type VersionRow = {
  id: string;
  identity_project_id: string;
  status: IdentityVersionStatus;
};

@Injectable()
export class ApprovalService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly brandContext: BrandContextService
  ) {}

  async history(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.dataSource.query(
      `SELECT * FROM approval_decisions WHERE identity_version_id = $1 ORDER BY created_at DESC, id DESC`,
      [versionId]
    );
  }

  async submit(workspaceId: string, projectId: string, versionId: string, userId: string, dto: ApprovalReasonDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    await this.assertFinalPrerequisites(versionId);
    return this.transition(workspaceId, projectId, versionId, userId, [IdentityVersionStatus.Draft, IdentityVersionStatus.ChangesRequested], IdentityVersionStatus.InReview, 'SUBMITTED', dto);
  }

  async approve(workspaceId: string, projectId: string, versionId: string, userId: string, dto: ApprovalReasonDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    await this.assertFinalPrerequisites(versionId);
    return this.transition(workspaceId, projectId, versionId, userId, [IdentityVersionStatus.InReview], IdentityVersionStatus.Approved, 'APPROVED', dto);
  }

  async reject(workspaceId: string, projectId: string, versionId: string, userId: string, dto: ApprovalReasonDto) {
    if (!dto.reason?.trim()) throw new DomainError('APPROVAL_REJECTION_REASON_REQUIRED', 'Rejection reason is required.', 400);
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.transition(workspaceId, projectId, versionId, userId, [IdentityVersionStatus.InReview], IdentityVersionStatus.ChangesRequested, 'REJECTED', dto);
  }

  async activate(workspaceId: string, projectId: string, versionId: string, userId: string, dto: ApprovalReasonDto) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    await this.assertFinalPrerequisites(versionId);

    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT id FROM identity_projects WHERE id = $1 AND workspace_id = $2 FOR UPDATE`, [projectId, workspaceId]);
      const rows = await manager.query<VersionRow[]>(`SELECT * FROM identity_versions WHERE id = $1 AND identity_project_id = $2 FOR UPDATE`, [
        versionId,
        projectId
      ]);
      const version = rows[0];
      if (!version) throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
      if (version.status !== IdentityVersionStatus.Approved) {
        throw new DomainError('INVALID_APPROVAL_TRANSITION', 'Only approved versions can be activated.', 409);
      }

      await manager.query(
        `UPDATE identity_versions
         SET status = 'SUPERSEDED', superseded_at = now(), updated_at = now()
         WHERE identity_project_id = $1 AND status = 'ACTIVE' AND id <> $2`,
        [projectId, versionId]
      );
      await manager.query(
        `UPDATE identity_versions
         SET status = 'ACTIVE', activated_at = now(), updated_at = now()
         WHERE id = $1`,
        [versionId]
      );
      await manager.query(`UPDATE identity_projects SET active_version_id = $1, updated_at = now() WHERE id = $2`, [versionId, projectId]);
      const contextPackage = await this.brandContext.publishForActivation(manager, workspaceId, projectId, versionId, userId);
      await this.insertDecision(manager, versionId, userId, 'ACTIVATED', version.status, IdentityVersionStatus.Active, dto);
      await this.insertAudit(manager, {
        workspaceId,
        projectId,
        versionId,
        actorUserId: userId,
        action: 'identity_version.activated',
        resourceType: 'identity_version',
        resourceId: versionId,
        before: { status: version.status },
        after: {
          status: IdentityVersionStatus.Active,
          activeContextPackageId: contextPackage.packageId,
          activeContextPackageChecksumSha256: contextPackage.checksum
        }
      });
      await manager.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, schema_version, payload, idempotency_key)
         VALUES ('identity_version', $1, 'identity.version.activated', 1, $2::jsonb, $3)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          versionId,
          JSON.stringify({
            workspaceId,
            projectId,
            versionId,
            activatedByUserId: userId,
            brandContextPackageId: contextPackage.packageId,
            brandContextPackageChecksumSha256: contextPackage.checksum
          }),
          `identity.version.activated:${versionId}`
        ]
      );
      return {
        ok: true,
        activeVersionId: versionId,
        activeContextPackageId: contextPackage.packageId,
        activeContextPackageChecksumSha256: contextPackage.checksum
      };
    });
  }

  private async transition(
    workspaceId: string,
    projectId: string,
    versionId: string,
    userId: string,
    allowedFrom: IdentityVersionStatus[],
    toStatus: IdentityVersionStatus,
    decision: string,
    dto: ApprovalReasonDto
  ) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<VersionRow[]>(`SELECT * FROM identity_versions WHERE id = $1 FOR UPDATE`, [versionId]);
      const version = rows[0];
      if (!version) throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
      if (!allowedFrom.includes(version.status)) {
        throw new DomainError('INVALID_APPROVAL_TRANSITION', `Cannot move version from ${version.status} to ${toStatus}.`, 409);
      }

      await manager.query(
        `UPDATE identity_versions
         SET status = $2, submitted_at = CASE WHEN $2 = 'IN_REVIEW' THEN now() ELSE submitted_at END,
             approved_at = CASE WHEN $2 = 'APPROVED' THEN now() ELSE approved_at END,
             updated_at = now()
         WHERE id = $1`,
        [versionId, toStatus]
      );
      await this.insertDecision(manager, versionId, userId, decision, version.status, toStatus, dto);
      await this.insertAudit(manager, {
        workspaceId,
        projectId,
        versionId,
        actorUserId: userId,
        action: `identity_version.${decision.toLowerCase()}`,
        resourceType: 'identity_version',
        resourceId: versionId,
        before: { status: version.status },
        after: { status: toStatus },
        metadata: { reason: dto.reason ?? null }
      });
      return { ok: true, status: toStatus };
    });
  }

  private async insertDecision(
    manager: Pick<DataSource['manager'], 'query'>,
    versionId: string,
    userId: string,
    decision: string,
    fromStatus: IdentityVersionStatus,
    toStatus: IdentityVersionStatus,
    dto: ApprovalReasonDto
  ) {
    await manager.query(
      `INSERT INTO approval_decisions (
        identity_version_id, decided_by_user_id, decision, from_status, to_status, reason, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [versionId, userId, decision, fromStatus, toStatus, normalizeText(dto.reason), JSON.stringify(dto.metadata ?? {})]
    );
  }

  private async insertAudit(manager: Pick<DataSource['manager'], 'query'>, input: Parameters<typeof AuditService.insertSql>[0]) {
    const audit = AuditService.insertSql(input);
    await manager.query(audit.sql, audit.params);
  }

  private async assertFinalPrerequisites(versionId: string) {
    const rows = await this.dataSource.query<Array<{ key: string; ok: boolean }>>(
      `SELECT 'visual_direction' AS key, EXISTS(SELECT 1 FROM visual_directions WHERE identity_version_id = $1 AND is_selected AND status = 'ACTIVE') AS ok
       UNION ALL SELECT 'logo_concept', EXISTS(SELECT 1 FROM logo_concepts WHERE identity_version_id = $1 AND status = 'SELECTED')
       UNION ALL SELECT 'design_tokens', EXISTS(SELECT 1 FROM design_token_sets WHERE identity_version_id = $1 AND format = 'JSON' AND is_current)
       UNION ALL SELECT 'brand_book', EXISTS(SELECT 1 FROM brand_books WHERE identity_version_id = $1 AND is_current AND status = 'READY')`,
      [versionId]
    );
    const missing = rows.filter((row) => !row.ok).map((row) => row.key);
    if (missing.length) {
      throw new DomainError('FINAL_PREREQUISITES_MISSING', 'Identity version is missing final prerequisites.', 409, { missing });
    }
  }

  private async assertVersionAccess(workspaceId: string, projectId: string, versionId: string) {
    const rows = await this.dataSource.query(
      `SELECT identity_versions.id
       FROM identity_versions
       JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
       WHERE identity_versions.id = $1 AND identity_projects.id = $2 AND identity_projects.workspace_id = $3 AND identity_projects.status = 'ACTIVE'`,
      [versionId, projectId, workspaceId]
    );
    if (!rows[0]) throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
  }
}

function normalizeText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
