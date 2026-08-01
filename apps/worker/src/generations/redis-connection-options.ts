export function redisConnectionOptions(redisUrl: string) {
  const parsed = new URL(redisUrl);
  const db = parsed.pathname ? Number(parsed.pathname.slice(1)) : 0;

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isNaN(db) ? 0 : db,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null
  };
}
