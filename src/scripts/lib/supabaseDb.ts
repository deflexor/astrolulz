import type { Client } from 'pg';

/**
 * Optional direct-Postgres transport for the content pipeline scripts.
 *
 * The primary path is the Supabase REST API (NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY, lazily imported in each script). When no
 * service-role API key is configured, the scripts fall back to a direct
 * database connection (SUPABASE_DB_URL or NEXT_PUBLIC_SUPABASE_CONNSTR — the
 * pooler URL from the Supabase dashboard). Both credentials are server-side
 * secrets of equivalent privilege; this module must never be imported from
 * application code, only from `src/scripts/**`.
 */

export type SnakeRow = Record<string, unknown>;

export function resolveSupabaseDbUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.SUPABASE_DB_URL ?? env.NEXT_PUBLIC_SUPABASE_CONNSTR ?? null;
}

/** True when neither the REST credentials nor a direct DB URL is available. */
export function hasNoSupabaseCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    !resolveSupabaseDbUrl(env) && !(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export async function withDbClient<T>(
  dbUrl: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const { default: pg } = await import('pg');
  const noVerify = dbUrl.includes('sslmode=no-verify');
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: noVerify ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
    // Bound queries too, so a silently-dropped connection surfaces as an
    // error (and can be retried) instead of hanging forever.
    statement_timeout: 20_000,
    query_timeout: 20_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Runs `fn` on a fresh connection with retries. Some networks (TLS-inspecting
 * proxies) reset pooled/bulky Postgres connections non-deterministically;
 * short-lived connections plus a retry make the CLI transports reliable.
 */
async function withDbRetry<T>(dbUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return await withDbClient(dbUrl, fn);
    } catch (error) {
      lastError = error;
      if (attempt < 6) await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  throw lastError;
}

/**
 * Idempotent bulk upsert, semantically identical to the REST path
 * (`upsert … onConflict: 'id', ignoreDuplicates: true`): existing ids are
 * skipped, new rows inserted, and the count of inserted rows returned.
 *
 * Chunks are deliberately small (6 rows ≈ single-digit KB): some networks
 * (TLS-inspecting proxies) silently drop very large Postgres messages, and
 * a fresh connection per chunk bounds the blast radius of any drop.
 */
export async function upsertContentBlocksDb(
  dbUrl: string,
  rows: readonly SnakeRow[],
): Promise<number> {
  // Every row comes from the same toRow() mapping, so key order is identical.
  const cols = Object.keys(rows[0]);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 6) {
    const chunk = rows.slice(i, i + 6);
    inserted += await withDbRetry(dbUrl, async (client) => {
      const params: unknown[] = [];
      const tuples = chunk.map(
        (row, j) =>
          `(${cols
            .map((col, k) => {
              params.push(row[col]);
              return `$${j * cols.length + k + 1}`;
            })
            .join(', ')})`,
      );
      const result = await client.query(
        `insert into public.content_blocks (${cols.map((c) => `"${c}"`).join(', ')})
         values ${tuples.join(', ')}
         on conflict (id) do nothing
         returning id`,
        params,
      );
      return result.rowCount ?? 0;
    });
  }
  return inserted;
}

/** Reads all content_blocks rows (snake_case, same shape as the REST client). */
export async function fetchContentBlocksDb(
  dbUrl: string,
  where: { locale?: string } = {},
): Promise<SnakeRow[]> {
  // Keyset pagination keeps every network message small (see upsert note).
  const all: SnakeRow[] = [];
  let cursor = '';
  for (;;) {
    const page = await withDbRetry(dbUrl, async (client) => {
      const params: unknown[] = [cursor];
      let sql = 'select * from public.content_blocks where id > $1';
      if (where.locale) {
        params.push(where.locale);
        sql += ' and locale = $2';
      }
      sql += ' order by id limit 16';
      const result = await client.query(sql, params);
      // pg parses timestamptz columns into Date objects; the REST transport
      // returns ISO strings. Normalize so both transports yield identical rows.
      return (result.rows as SnakeRow[]).map((row) => {
        for (const key of Object.keys(row)) {
          const value = row[key];
          if (value instanceof Date) row[key] = value.toISOString();
        }
        return row;
      });
    });
    if (page.length === 0) return all;
    all.push(...page);
    cursor = String(page[page.length - 1].id);
    if (page.length < 16) return all;
  }
}
