import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import postgres from 'postgres'

export type AnalyticsEvent = 'page_view' | 'time_spent' | 'preview_available' | 'preview_unavailable' | 'checkout_started' | 'purchase'

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL
const sql = databaseUrl ? postgres(databaseUrl, { ssl: 'require', max: 3, idle_timeout: 20 }) : null
let schemaReady: Promise<void> | null = null

function ensureSchema() {
  if (!sql) return Promise.resolve()
  if (!schemaReady) schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS autoscope_events (
      id BIGSERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      order_id TEXT,
      amount NUMERIC(10,2),
      currency TEXT,
      country TEXT,
      path TEXT,
      referrer TEXT,
      user_agent TEXT,
      duration_seconds INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS autoscope_events_created_idx ON autoscope_events(created_at DESC)`
    await sql`CREATE INDEX IF NOT EXISTS autoscope_events_type_idx ON autoscope_events(event_type, created_at DESC)`
    await sql`CREATE INDEX IF NOT EXISTS autoscope_events_order_idx ON autoscope_events(order_id)`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS autoscope_events_funnel_unique_idx ON autoscope_events(event_type, order_id)
      WHERE order_id IS NOT NULL AND event_type IN ('checkout_started','purchase')`
    await sql`
      CREATE TABLE IF NOT EXISTS autoscope_report_quotes (
        quote_id UUID PRIMARY KEY,
        vin TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        sections JSONB NOT NULL,
        record_count INTEGER NOT NULL,
        source_count INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS autoscope_report_quotes_expiry_idx ON autoscope_report_quotes(expires_at)`
    await sql`
      CREATE TABLE IF NOT EXISTS autoscope_contact_messages (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        visitor_id TEXT,
        country TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS autoscope_contact_messages_created_idx ON autoscope_contact_messages(created_at DESC)`
  })()
  return schemaReady
}

export async function saveContactMessage(request: Request, email: string, message: string) {
  if (!sql) return false
  await ensureSchema()
  await sql`
    INSERT INTO autoscope_contact_messages (email, message, visitor_id, country)
    VALUES (${email}, ${message}, ${visitorIdFromRequest(request)}, ${countryFromRequest(request)})
  `
  return true
}

export async function saveReportQuote(details: {
  vin: string
  price: string
  sections: unknown
  recordCount: number
  sourceCount: number
}) {
  if (!sql) return null
  await ensureSchema()
  const quoteId = randomUUID()
  await sql`
    INSERT INTO autoscope_report_quotes
      (quote_id, vin, price, sections, record_count, source_count, expires_at)
    VALUES
      (${quoteId}, ${details.vin}, ${Number(details.price)}, ${sql.json(details.sections as any)},
       ${details.recordCount}, ${details.sourceCount}, NOW() + INTERVAL '24 hours')
  `
  return quoteId
}

export async function getReportQuote(quoteId: string, vin: string, maxAgeMinutes: number) {
  if (!sql || !/^[0-9a-f-]{36}$/i.test(quoteId)) return null
  await ensureSchema()
  const rows = await sql`
    SELECT quote_id, vin, price::text, sections, record_count, source_count, created_at
    FROM autoscope_report_quotes
    WHERE quote_id = ${quoteId}
      AND vin = ${vin}
      AND expires_at > NOW()
      AND created_at >= NOW() - (${Math.max(1, Math.min(1440, maxAgeMinutes))} * INTERVAL '1 minute')
    LIMIT 1
  `
  return rows[0] || null
}

export function visitorIdFromRequest(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)autoscope_visitor=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : randomUUID()
}

export function analyticsCookie(visitorId: string) {
  return { name: 'autoscope_visitor', value: visitorId, options: { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 31536000 } }
}

export function countryFromRequest(request: Request) {
  return (request.headers.get('x-vercel-ip-country') || 'Unknown').slice(0, 64)
}

export async function recordEvent(request: Request, event: AnalyticsEvent, details: {
  visitorId?: string; orderId?: string | null; amount?: string | number | null; currency?: string | null;
  path?: string | null; referrer?: string | null; durationSeconds?: number | null; metadata?: Record<string, unknown>
} = {}) {
  if (!sql) return
  await ensureSchema()
  const visitorId = details.visitorId || visitorIdFromRequest(request)
  const amount = details.amount == null ? null : Number(details.amount)
  await sql`
    INSERT INTO autoscope_events
      (event_type, visitor_id, order_id, amount, currency, country, path, referrer, user_agent, duration_seconds, metadata)
    VALUES
      (${event}, ${visitorId}, ${details.orderId || null}, ${amount}, ${details.currency || null},
       ${countryFromRequest(request)}, ${details.path || null}, ${details.referrer || null},
       ${(request.headers.get('user-agent') || '').slice(0, 500)}, ${details.durationSeconds || null},
       ${sql.json((details.metadata || {}) as any)})
    ON CONFLICT DO NOTHING
  `
}

export function adminToken(password: string) {
  return createHash('sha256').update(`autoscope-admin:${password}`).digest('hex')
}

export function validAdminToken(token?: string) {
  const password = process.env.ADMIN_PASSWORD
  if (!password || !token) return false
  const expected = adminToken(password)
  return token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export async function analyticsSummary(days = 30, excludedCountries: string[] = []) {
  if (!sql) return null
  await ensureSchema()
  const interval = Math.max(1, Math.min(365, days))
  const excluded = excludedCountries
    .map((country) => country.trim().toUpperCase())
    .filter((country) => /^[A-Z]{2,3}$/.test(country))
  const excludedList = excluded.length ? excluded : ['__NONE__']
  const [totals, daily, countries, sources, recent, visitors, activity, allCountries, contactMessages] = await Promise.all([
    sql`SELECT
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type='page_view')::int AS visitors,
      COUNT(*) FILTER (WHERE event_type='page_view')::int AS views,
      COUNT(*) FILTER (WHERE event_type='preview_available')::int AS previews,
      COUNT(*) FILTER (WHERE event_type='checkout_started')::int AS checkouts,
      COUNT(*) FILTER (WHERE event_type='purchase')::int AS purchases,
      COALESCE(SUM(amount) FILTER (WHERE event_type='purchase'),0)::float AS revenue,
      COALESCE((SELECT AVG(visitor_seconds) FROM (
        SELECT SUM(duration_seconds) AS visitor_seconds FROM autoscope_events
        WHERE event_type='time_spent'
          AND created_at >= NOW() - (${interval} * INTERVAL '1 day')
          AND UPPER(COALESCE(country,'')) NOT IN ${sql(excludedList)}
        GROUP BY visitor_id
      ) visitor_time),0)::float AS avg_seconds
      FROM autoscope_events
      WHERE created_at >= NOW() - (${interval} * INTERVAL '1 day')
        AND UPPER(COALESCE(country,'')) NOT IN ${sql(excludedList)}`,
    sql`SELECT TO_CHAR(DATE_TRUNC('day', created_at),'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE event_type='page_view')::int AS views,
      COUNT(*) FILTER (WHERE event_type='preview_available')::int AS previews,
      COUNT(*) FILTER (WHERE event_type='purchase')::int AS purchases,
      COALESCE(SUM(amount) FILTER (WHERE event_type='purchase'),0)::float AS revenue
      FROM autoscope_events
      WHERE created_at >= NOW() - (${interval} * INTERVAL '1 day')
        AND UPPER(COALESCE(country,'')) NOT IN ${sql(excludedList)}
      GROUP BY 1 ORDER BY 1`,
    sql`SELECT country, COUNT(DISTINCT visitor_id)::int AS visitors, COALESCE(SUM(amount) FILTER (WHERE event_type='purchase'),0)::float AS revenue
      FROM autoscope_events
      WHERE created_at >= NOW() - (${interval} * INTERVAL '1 day')
        AND UPPER(COALESCE(country,'')) NOT IN ${sql(excludedList)}
      GROUP BY country ORDER BY visitors DESC LIMIT 10`,
    sql`SELECT COALESCE(NULLIF(referrer,''),'Direct') AS source, COUNT(*)::int AS visits FROM autoscope_events
      WHERE event_type='page_view'
        AND created_at >= NOW() - (${interval} * INTERVAL '1 day')
        AND UPPER(COALESCE(country,'')) NOT IN ${sql(excludedList)}
      GROUP BY 1 ORDER BY visits DESC LIMIT 10`,
    sql`SELECT event_type, order_id, amount::float, currency, country, created_at FROM autoscope_events
      WHERE event_type IN ('checkout_started','purchase')
        AND UPPER(COALESCE(country,'')) NOT IN ${sql(excludedList)}
      ORDER BY created_at DESC LIMIT 20`,
    sql`SELECT
      visitor_id,
      COALESCE(MAX(NULLIF(country,'')),'Unknown') AS country,
      COALESCE(SUM(duration_seconds) FILTER (WHERE event_type='time_spent'),0)::int AS time_seconds,
      COUNT(*) FILTER (WHERE event_type='page_view')::int AS views,
      COUNT(*) FILTER (WHERE event_type IN ('preview_available','preview_unavailable'))::int AS previews,
      COUNT(*) FILTER (WHERE event_type='checkout_started')::int AS checkouts,
      COUNT(*) FILTER (WHERE event_type='purchase')::int AS purchases,
      COALESCE(SUM(amount) FILTER (WHERE event_type='purchase'),0)::float AS spent,
      (ARRAY_AGG(event_type ORDER BY created_at DESC))[1] AS last_action,
      MAX(created_at) AS last_seen
      FROM autoscope_events
      WHERE created_at >= NOW() - (${interval} * INTERVAL '1 day')
        AND UPPER(COALESCE(country,'')) NOT IN ${sql(excludedList)}
      GROUP BY visitor_id ORDER BY last_seen DESC LIMIT 100`,
    sql`SELECT
      visitor_id, event_type, country, path, order_id, amount::float, currency,
      duration_seconds, metadata, created_at
      FROM autoscope_events
      WHERE created_at >= NOW() - (${interval} * INTERVAL '1 day')
        AND UPPER(COALESCE(country,'')) NOT IN ${sql(excludedList)}
      ORDER BY created_at DESC LIMIT 200`,
    sql`SELECT UPPER(country) AS country, COUNT(DISTINCT visitor_id)::int AS visitors
      FROM autoscope_events
      WHERE country IS NOT NULL AND country <> '' AND country <> 'Unknown'
      GROUP BY 1 ORDER BY visitors DESC, country ASC`,
    sql`SELECT id, email, message, country, created_at
      FROM autoscope_contact_messages
      ORDER BY created_at DESC LIMIT 100`,
  ])
  const row = totals[0] as any
  const abandoned = Math.max(0, Number(row.checkouts) - Number(row.purchases))
  return { totals: { ...row, abandoned }, daily, countries, sources, recent, visitors, activity, allCountries, contactMessages, excludedCountries: excluded }
}
