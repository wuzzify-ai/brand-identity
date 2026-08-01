const defaultSensitiveKeys = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'api-key',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'token',
  'password',
  'secret'
]);

export function redactForAiLogs(value: unknown, extraSensitiveFields: string[] = []): unknown {
  const sensitiveKeys = new Set([
    ...defaultSensitiveKeys,
    ...extraSensitiveFields.map((field) => field.toLowerCase())
  ]);

  return redactValue(value, sensitiveKeys);
}

function redactValue(value: unknown, sensitiveKeys: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, sensitiveKeys));
  }

  if (!value || typeof value !== 'object') {
    return redactString(value);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      sensitiveKeys.has(key.toLowerCase()) ? '[REDACTED]' : redactValue(nestedValue, sensitiveKeys)
    ])
  );
}

function redactString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
}
