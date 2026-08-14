import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
loadEnvFile(resolve(process.cwd(), '.env'));

if (args.help) {
  printHelp();
  process.exit(0);
}

const apiBaseUrl = normalizeBaseUrl(
  args.apiBaseUrl ??
    process.env.SMOKE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_PUBLIC_URL ??
    'http://localhost:4000/v1'
);
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const email = args.email ?? process.env.SMOKE_EMAIL ?? `smoke+${stamp}@example.test`;
const password = args.password ?? process.env.SMOKE_PASSWORD ?? 'SmokePass123456!';
const displayName = args.displayName ?? process.env.SMOKE_DISPLAY_NAME ?? 'Wuzzify Smoke Tester';
const workspaceName = args.workspaceName ?? process.env.SMOKE_WORKSPACE_NAME ?? `Smoke Workspace ${stamp}`;
const workspaceSlug = slugify(args.workspaceSlug ?? process.env.SMOKE_WORKSPACE_SLUG ?? `smoke-${stamp}`);
const projectName = args.projectName ?? process.env.SMOKE_PROJECT_NAME ?? `Smoke Brand ${stamp}`;
const projectSlug = slugify(args.projectSlug ?? process.env.SMOKE_PROJECT_SLUG ?? `smoke-brand-${stamp}`);
const skipRegister = Boolean(args.skipRegister);
const completeBrief = !args.skipCompleteBrief;
const advanceAfterBrief = Boolean(args.advanceAfterBrief);

try {
  await main();
} catch (error) {
  console.error(`[identity-smoke] FAILED: ${formatError(error)}`);
  process.exit(1);
}

async function main() {
  log(`API base: ${apiBaseUrl}`);
  await request('/health/live');
  await request('/health/ready');
  log('Health checks passed.');

  if (!skipRegister) {
    const registered = await tryRegister();
    log(registered ? 'Smoke user registered.' : 'Smoke user already exists; continuing with login.');
  }

  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: {
      email,
      password,
      deviceName: 'identity-smoke-script'
    }
  });
  const accessToken = expectString(loginResponse.accessToken, 'login.accessToken');
  log('Login passed.');

  const workspaces = await request('/workspaces', { accessToken });
  const existingWorkspace = Array.isArray(workspaces)
    ? workspaces.find((workspace) => workspace.slug === workspaceSlug) ?? workspaces[0]
    : null;
  const workspaceId =
    existingWorkspace?.id ??
    (await request('/workspaces', {
      method: 'POST',
      accessToken,
      body: {
        name: workspaceName,
        slug: workspaceSlug
      }
    })).id;
  expectString(workspaceId, 'workspace.id');
  log(`Workspace resolved: ${workspaceId}`);

  const created = await request(`/workspaces/${workspaceId}/brand-identities`, {
    method: 'POST',
    accessToken,
    body: {
      name: projectName,
      slug: projectSlug,
      initialDescription:
        'A smoke-test brand for a small-business automation platform that helps owners replace repetitive admin work with reliable workflows.'
    }
  });
  const projectId = expectString(created.project?.id, 'project.id');
  const versionId = expectString(created.version?.id, 'version.id');
  log(`Identity project created: ${projectId}`);

  await request(`/workspaces/${workspaceId}/brand-identities/${projectId}`, { accessToken });
  const versions = await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions`, { accessToken });
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error('Expected at least one identity version.');
  }
  log('Project and versions endpoints passed.');

  const readiness = await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/readiness`, {
    accessToken
  });
  if (!Array.isArray(readiness) || readiness.length < 5) {
    throw new Error('Expected readiness for all workflow stages.');
  }
  log('Readiness endpoint passed.');

  await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/activity`, { accessToken });
  await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/handoffs`, { accessToken });
  log('Activity and handoff endpoints passed.');

  const autopilot = await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/autopilot/advance`, {
    method: 'POST',
    accessToken
  });
  expectString(autopilot.message, 'autopilot.message');
  log(`Autopilot advance passed: ${autopilot.status ?? 'UNKNOWN'} - ${autopilot.message}`);

  await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/autopilot/history?limit=5`, {
    accessToken
  });
  log('Autopilot history endpoint passed.');

  if (completeBrief) {
    await fillAndCompleteBrief(accessToken, workspaceId, projectId, versionId);
    log('Brief update and completion passed.');

    const refreshedVersions = await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions`, { accessToken });
    const refreshed = Array.isArray(refreshedVersions) ? refreshedVersions.find((version) => version.id === versionId) : null;
    const briefStage = refreshed?.stages?.find((stage) => stage.stage_key === 'BRIEF');
    const strategyStage = refreshed?.stages?.find((stage) => stage.stage_key === 'STRATEGY');

    if (briefStage?.status !== 'COMPLETED') {
      throw new Error(`Expected BRIEF stage to be COMPLETED, got ${briefStage?.status ?? 'missing'}.`);
    }
    if (!strategyStage || strategyStage.status === 'LOCKED') {
      throw new Error(`Expected STRATEGY stage to be unlocked, got ${strategyStage?.status ?? 'missing'}.`);
    }
    log(`Workflow unlock passed: BRIEF=${briefStage.status}, STRATEGY=${strategyStage.status}.`);

    const refreshedReadiness = await request(
      `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/readiness`,
      { accessToken }
    );
    const strategyReadiness = Array.isArray(refreshedReadiness)
      ? refreshedReadiness.find((item) => item.stage_key === 'STRATEGY')
      : null;
    if (!strategyReadiness || strategyReadiness.status === 'BLOCKED') {
      throw new Error(`Expected Strategy readiness to be actionable, got ${strategyReadiness?.status ?? 'missing'}.`);
    }
    log(`Strategy readiness passed: ${strategyReadiness.status} - ${strategyReadiness.summary}`);

    if (advanceAfterBrief) {
      const advanced = await request(
        `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/autopilot/advance`,
        {
          method: 'POST',
          accessToken
        }
      );
      expectString(advanced.message, 'autopilotAfterBrief.message');
      log(`Autopilot after Brief passed: ${advanced.status ?? 'UNKNOWN'} - ${advanced.message}`);

      if (advanced.generationJobId) {
        await request(`/generations/${advanced.generationJobId}/cancel`, {
          method: 'POST',
          accessToken
        });
        log(`Queued generation job cancelled: ${advanced.generationJobId}`);
      }

      if (advanced.run?.id && ['RUNNING', 'PAUSED'].includes(String(advanced.run.status))) {
        await request(
          `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/autopilot/runs/${advanced.run.id}/cancel`,
          {
            method: 'POST',
            accessToken,
            body: {
              reason: 'Smoke test completed after verifying post-Brief Autopilot advance.'
            }
          }
        );
        log(`Autopilot run cancelled after verification: ${advanced.run.id}`);
      }
    }
  }

  log('Smoke identity flow passed.');
}

async function fillAndCompleteBrief(accessToken, workspaceId, projectId, versionId) {
  const aggregate = await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brief`, {
    accessToken
  });
  const lockVersion = expectNumber(aggregate.brief?.lock_version, 'brief.lock_version');

  const updated = await request(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brief`, {
    method: 'PUT',
    accessToken,
    body: {
      lockVersion,
      industry: 'Small business automation software',
      positioning:
        'A practical automation platform for small business operators who need reliable workflows without an IT team.',
      languages: [
        {
          languageCode: 'en',
          displayName: 'English',
          isPrimary: true,
          sortOrder: 0
        }
      ],
      audiences: [
        {
          name: 'Small business owners',
          description: 'Owners and operators who spend too much time on repetitive admin and coordination work.',
          sortOrder: 0
        }
      ],
      markets: [
        {
          name: 'SMB automation',
          region: 'Global English-speaking markets',
          sortOrder: 0
        }
      ],
      offerings: [
        {
          name: 'Workflow automation platform',
          description: 'No-code automations for operations, customer follow-up, reporting, and internal task handoffs.',
          sortOrder: 0
        }
      ],
      preferences: [
        {
          text: 'Modern, trustworthy, clean, and slightly energetic.',
          sortOrder: 0
        }
      ],
      constraints: [
        {
          text: 'Avoid looking like generic enterprise software.',
          sortOrder: 0
        }
      ]
    }
  });

  if (updated.brief?.completion_percent !== 100) {
    throw new Error(
      `Expected updated brief completion_percent to be 100, got ${updated.brief?.completion_percent ?? 'missing'}: ${
        Array.isArray(updated.brief?.completion_reasons) ? updated.brief.completion_reasons.join(', ') : 'no reasons'
      }`
    );
  }

  const completeLockVersion = expectNumber(updated.brief?.lock_version, 'updated.brief.lock_version');
  const completed = await request(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brief/complete`,
    {
      method: 'POST',
      accessToken,
      body: {
        lockVersion: completeLockVersion
      }
    }
  );

  if (!completed.brief?.confirmed_at) {
    throw new Error('Expected completed brief to have confirmed_at.');
  }
}

async function tryRegister() {
  try {
    await request('/auth/register', {
      method: 'POST',
      body: {
        email,
        displayName,
        password,
        workspaceName,
        workspaceSlug
      }
    });
    return true;
  } catch (error) {
    if (error.status === 409) return false;
    throw error;
  }
}

async function request(path, options = {}) {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
    'x-request-id': crypto.randomUUID()
  });
  if (options.accessToken) headers.set('authorization', `Bearer ${options.accessToken}`);

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch (error) {
    throw new Error(`${options.method ?? 'GET'} ${path} could not reach ${apiBaseUrl}. Is the API running? ${formatError(error)}`);
  }
  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    const error = new Error(
      `${options.method ?? 'GET'} ${path} failed with ${response.status}: ${payload?.error?.message ?? payload?.message ?? text}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function expectString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected ${label} to be a non-empty string.`);
  }
  return value;
}

function expectNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected ${label} to be a finite number.`);
  }
  return value;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--help' || item === '-h') {
      parsed.help = true;
      continue;
    }
    if (item === '--skip-register') {
      parsed.skipRegister = true;
      continue;
    }
    if (!item.startsWith('--')) continue;
    const key = toCamelCase(item.slice(2));
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function normalizeBaseUrl(value) {
  return value.replace(/\/$/, '');
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function log(message) {
  console.log(`[identity-smoke] ${message}`);
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function printHelp() {
  console.log(`Usage:
  pnpm smoke:identity
  pnpm smoke:identity -- --api-base-url https://app.cryphero.com/v1
  pnpm smoke:identity -- --email test@example.com --password 'StrongPassword123!' --skip-register
  pnpm smoke:identity -- --skip-complete-brief
  pnpm smoke:identity -- --advance-after-brief

Environment overrides:
  SMOKE_API_BASE_URL, SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_WORKSPACE_NAME,
  SMOKE_WORKSPACE_SLUG, SMOKE_PROJECT_NAME, SMOKE_PROJECT_SLUG
`);
}
