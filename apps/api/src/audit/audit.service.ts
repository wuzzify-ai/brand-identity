import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type AuditEventInput = {
  workspaceId?: string | null;
  projectId?: string | null;
  versionId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly dataSource: DataSource) {}

  list(workspaceId: string, projectId: string, limit = 50) {
    return this.dataSource.query(
      `SELECT * FROM audit_logs
       WHERE workspace_id = $1 AND identity_project_id = $2
       ORDER BY created_at DESC, id DESC
       LIMIT $3`,
      [workspaceId, projectId, Math.min(Math.max(limit, 1), 100)]
    );
  }

  static insertSql(input: AuditEventInput) {
    return {
      sql: `INSERT INTO audit_logs (
        workspace_id, identity_project_id, identity_version_id, actor_user_id, action,
        resource_type, resource_id, before_json, after_json, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)`,
      params: [
        input.workspaceId ?? null,
        input.projectId ?? null,
        input.versionId ?? null,
        input.actorUserId ?? null,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        input.before ? JSON.stringify(redact(input.before)) : null,
        input.after ? JSON.stringify(redact(input.after)) : null,
        JSON.stringify(redact(input.metadata ?? {}))
      ]
    };
  }
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        /password|secret|token|hash|prompt/i.test(key) ? '[REDACTED]' : redact(child)
      ])
    );
  }
  return value;
}
