/**
 * aarvak-export — the Central AARVAK Dashboard endpoint.
 *
 *   GET  /functions/v1/aarvak-export?since=<iso8601>
 *   POST /functions/v1/aarvak-export   { "since": "<iso8601>" }
 *
 * Two callers are accepted, and they authenticate differently:
 *
 *   1. Central, with `Authorization: Bearer <AARVAK_EXPORT_TOKEN>`. That token
 *      lives in Supabase secrets and never reaches the frontend bundle.
 *   2. A signed-in lead, using their own Supabase JWT. This is what the in-app
 *      preview at /booth/export uses, so the preview and the real export are
 *      produced by one code path and cannot drift apart.
 *
 * Anything else gets a 401 with no detail in the body.
 *
 * The service_role key is read from the Deno environment. It exists only here,
 * on the server. Nothing in src/ can see it.
 */

const CONTRACT_VERSION = '1.0'
const TEAM_SLUG = 'echo'
const RATE_LIMIT = 30 // calls per window, per caller
const RATE_WINDOW_MS = 60_000

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EXPORT_TOKEN = Deno.env.get('AARVAK_EXPORT_TOKEN') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

/** In-memory rate limit. Resets when the function cold-starts, which is fine
 *  for its purpose: stopping a runaway loop, not defending against an attacker
 *  who already holds the token. */
const hits = new Map<string, number[]>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > RATE_LIMIT
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

/** Returns the caller identity, or null if the credential is no good. */
async function authenticate(header: string | null): Promise<{ kind: string; id: string | null } | null> {
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null

  // 1. The static central token. Constant-time-ish compare on equal lengths.
  if (EXPORT_TOKEN && token.length === EXPORT_TOKEN.length) {
    let diff = 0
    for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ EXPORT_TOKEN.charCodeAt(i)
    if (diff === 0) return { kind: 'central', id: null }
  }

  // 2. A lead's own session, for the in-app preview.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  })
  if (!userRes.ok) return null
  const user = await userRes.json()
  if (!user?.id) return null

  const roleRes = await rest(`user_roles?user_id=eq.${user.id}&select=role`)
  if (!roleRes.ok) return null
  const roles = await roleRes.json()
  if (roles?.[0]?.role !== 'lead') return null

  return { kind: 'preview', id: user.id }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const caller = await authenticate(req.headers.get('Authorization'))
  if (!caller) return json({ error: 'unauthorised' }, 401)

  if (rateLimited(caller.id ?? caller.kind)) {
    return json({ error: 'too many requests' }, 429)
  }

  // ?since= on a GET, { since } on a POST. Both mean the same thing.
  let since: string | null = new URL(req.url).searchParams.get('since')
  if (!since && req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    since = typeof body?.since === 'string' ? body.since : null
  }
  if (since && Number.isNaN(Date.parse(since))) {
    return json({ error: 'since must be an ISO 8601 timestamp' }, 400)
  }

  const generatedAt = new Date().toISOString()

  const teamRes = await rest(`teams?slug=eq.${TEAM_SLUG}&select=slug,name`)
  const team = (await teamRes.json())?.[0] ?? { slug: TEAM_SLUG, name: TEAM_SLUG.toUpperCase() }

  const select = [
    'id',
    'occurred_on',
    'status',
    'awarded_points',
    'penalty_points',
    'net_points',
    'decided_at',
    'decided_by',
    'profiles!submissions_member_id_fkey(full_name,department,enrollment_no)',
    'activity_catalog(code,label,level,scope)',
    'submission_proofs(id)',
  ].join(',')

  let query = `submissions?select=${encodeURIComponent(select)}` +
    `&status=in.(verified,revoked)&order=decided_at.asc`
  if (since) query += `&decided_at=gt.${encodeURIComponent(since)}`

  const rowsRes = await rest(query)
  if (!rowsRes.ok) {
    return json({ error: 'export query failed', detail: await rowsRes.text() }, 500)
  }
  const rows = await rowsRes.json()

  // Resolve reviewer names in one pass rather than per record.
  const reviewerIds = [...new Set(rows.map((r: any) => r.decided_by).filter(Boolean))]
  const names = new Map<string, string>()
  if (reviewerIds.length) {
    const revRes = await rest(`profiles?id=in.(${reviewerIds.join(',')})&select=id,full_name`)
    if (revRes.ok) for (const p of await revRes.json()) names.set(p.id, p.full_name)
  }

  const records = rows.map((r: any) => ({
    external_id: r.id,
    member: {
      name: r.profiles?.full_name ?? null,
      department: r.profiles?.department ?? null,
      enrollment_no: r.profiles?.enrollment_no ?? null,
    },
    activity_code: r.activity_catalog?.code ?? null,
    activity_label: r.activity_catalog?.level
      ? `${r.activity_catalog.label} — ${r.activity_catalog.level}`
      : r.activity_catalog?.label ?? null,
    scope: r.activity_catalog?.scope ?? null,
    occurred_on: r.occurred_on,
    status: r.status,
    awarded_points: r.awarded_points,
    penalty_points: r.penalty_points,
    net_points: r.net_points,
    verified_by: r.decided_by ? names.get(r.decided_by) ?? null : null,
    verified_at: r.decided_at,
    proof_count: r.submission_proofs?.length ?? 0,
  }))

  // The cursor is the newest decided_at in this batch, so the next call can
  // pass it straight back as ?since= and receive only what came after.
  const cursor = records.length ? records[records.length - 1].verified_at ?? generatedAt : since ?? generatedAt

  await rest('audit_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      actor_id: caller.id,
      action: `export:${caller.kind}`,
      entity: 'export',
      after: { since, cursor, record_count: records.length, contract_version: CONTRACT_VERSION },
    }),
  })

  return json({
    contract_version: CONTRACT_VERSION,
    team: { slug: team.slug, name: team.name },
    generated_at: generatedAt,
    cursor,
    records,
  })
})
