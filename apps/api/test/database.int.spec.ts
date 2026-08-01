import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { updateBriefCompletionSql } from '../src/briefs/briefs.service';

interface DatabaseClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

interface PgModule {
  Client: new (options: { connectionString: string }) => DatabaseClient;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as PgModule;

function loadNearestEnvFile(): void {
  let currentDir = process.cwd();

  while (dirname(currentDir) !== currentDir) {
    const envPath = resolve(currentDir, '.env');

    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8');

      for (const rawLine of envContent.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (!line || line.startsWith('#')) {
          continue;
        }

        const separatorIndex = line.indexOf('=');

        if (separatorIndex === -1) {
          continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

        if (key) {
          process.env[key] = value;
        }
      }

      return;
    }

    currentDir = dirname(currentDir);
  }
}

loadNearestEnvFile();

const describeDbIntegration = process.env.RUN_DB_INTEGRATION === '1' ? describe : describe.skip;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for integration tests.');
  }

  return databaseUrl;
}

describeDbIntegration('database migrations', () => {
  let client: DatabaseClient;

  beforeAll(async () => {
    client = new Client({ connectionString: getDatabaseUrl() });
    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('connects to postgres and exposes the migrated brand identity schema', async () => {
    const migrationRows = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM migrations');

    expect(Number(migrationRows.rows[0]?.count)).toBeGreaterThanOrEqual(14);

    const tableRows = await client.query<{ table_name: string }>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1)
        ORDER BY table_name
      `,
      [
        [
          'users',
          'identity_projects',
          'brand_assets',
          'anonymous_upload_grants',
          'logo_concepts',
          'design_token_sets',
          'brand_books',
          'approval_decisions',
          'audit_logs',
          'outbox_events'
        ]
      ]
    );

    expect(tableRows.rows.map((row) => row.table_name)).toEqual([
      'anonymous_upload_grants',
      'approval_decisions',
      'audit_logs',
      'brand_assets',
      'brand_books',
      'design_token_sets',
      'identity_projects',
      'logo_concepts',
      'outbox_events',
      'users'
    ]);
  });

  it('binds brief completion percentage consistently as a smallint', async () => {
    await expect(client.query(updateBriefCompletionSql, [89, JSON.stringify(['constraints are required']), randomUUID()])).resolves.toEqual(
      expect.objectContaining({ rows: [] })
    );
  });
});
