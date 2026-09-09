/**
 * /booth/export — the Central AARVAK preview. Lead only.
 *
 * This calls the aarvak-export edge function with the lead's own session, so the
 * payload shown here is produced by the same code that answers central. There is
 * no second implementation to drift.
 *
 * The AARVAK_EXPORT_TOKEN is not in this file, not in any VITE_ variable, and
 * not in the built bundle. It lives in Supabase secrets and is only ever read
 * server side. The endpoint shown below is real; the token beside it is masked
 * placeholder text, not a value fetched from anywhere.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { BoardLayout } from '../components/layout/BoardLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { SignLabel } from '../components/board/SignLabel'
import { Seam } from '../components/primitives/Seam'
import { Button } from '../components/primitives/Button'
import { Skeleton } from '../components/primitives/Skeleton'
import { EmptyState, ErrorState } from '../components/feedback/EmptyState'
import { Field, Input } from '../components/primitives/Field'
import { TextButton } from '../components/primitives/Controls'

type ExportRecord = {
  external_id: string
  member: { name: string | null; department: string | null; enrollment_no: string | null }
  activity_code: string | null
  activity_label: string | null
  scope: string | null
  occurred_on: string
  status: string
  awarded_points: number | null
  penalty_points: number
  net_points: number | null
  verified_by: string | null
  verified_at: string | null
  proof_count: number
}

type ExportPayload = {
  contract_version: string
  team: { slug: string; name: string }
  generated_at: string
  cursor: string
  records: ExportRecord[]
}

const CSV_COLUMNS: [string, (r: ExportRecord) => string | number | null][] = [
  ['external_id', r => r.external_id],
  ['member.name', r => r.member?.name ?? ''],
  ['member.department', r => r.member?.department ?? ''],
  ['member.enrollment_no', r => r.member?.enrollment_no ?? ''],
  ['activity_code', r => r.activity_code ?? ''],
  ['activity_label', r => r.activity_label ?? ''],
  ['scope', r => r.scope ?? ''],
  ['occurred_on', r => r.occurred_on],
  ['status', r => r.status],
  ['awarded_points', r => r.awarded_points ?? ''],
  ['penalty_points', r => r.penalty_points],
  ['net_points', r => r.net_points ?? ''],
  ['verified_by', r => r.verified_by ?? ''],
  ['verified_at', r => r.verified_at ?? ''],
  ['proof_count', r => r.proof_count],
]

function toCsv(records: ExportRecord[]): string {
  const escape = (v: string | number | null) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = CSV_COLUMNS.map(([name]) => name).join(',')
  const rows = records.map(r => CSV_COLUMNS.map(([, get]) => escape(get(r))).join(','))
  return [header, ...rows].join('\n')
}

export function Export() {
  const navigate = useNavigate()
  const [since, setSince] = useState('')
  const [applied, setApplied] = useState('')
  const [copied, setCopied] = useState(false)

  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aarvak-export`

  const payloadQuery = useQuery({
    queryKey: ['aarvak-export', applied],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<ExportPayload>('aarvak-export', {
        body: applied ? { since: applied } : {},
      })
      if (error) throw error
      return data as ExportPayload
    },
  })

  const payload = payloadQuery.data ?? null
  const pretty = useMemo(() => (payload ? JSON.stringify(payload, null, 2) : ''), [payload])

  async function copyPayload() {
    await navigator.clipboard.writeText(pretty)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  function downloadCsv() {
    if (!payload) return
    const blob = new Blob([toCsv(payload.records)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aarvak-echo-${payload.generated_at.slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const topbar = (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-display font-bold text-xl text-chalk tracking-sign uppercase">ECHO</span>
        <span className="text-sm text-chalk/60 truncate">Central export</span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <TextButton
          onClick={() => navigate('/review')}
        >
          The Booth
        </TextButton>
        <TextButton
          onClick={() => navigate('/')}
        >
          Back to the board
        </TextButton>
      </div>
    </div>
  )

  return (
    <BoardLayout topbar={topbar}>
      <BoardPanel>
        <div className="flex flex-col gap-4">
          <SignLabel>What this is</SignLabel>
          <p className="text-base text-chalk/80 max-w-[62ch]">
            The Central AARVAK Dashboard does not exist yet, so we published the contract it
            will be held to, built the endpoint that satisfies it, and put this preview here.
            Whoever builds central can develop against a live endpoint today. Everything below
            is the real response from that endpoint, fetched with your own session.
          </p>

          <Seam />

          <div className="flex flex-col gap-2">
            <SignLabel>Endpoint</SignLabel>
            <code className="text-sm text-chalk break-all bg-recess border-hair border-seam rounded-slot px-3 py-2">
              GET {endpoint}
            </code>
            <code className="text-sm text-chalk/60 break-all bg-recess border-hair border-seam rounded-slot px-3 py-2">
              Authorization: Bearer ••••••••••••••••••••••••
            </code>
            <p className="text-xs text-chalk/60">
              The token is a Supabase secret named AARVAK_EXPORT_TOKEN. It is never sent to a
              browser, so this screen cannot show it to you and neither can the built bundle.
              To rotate it, set a new value in Supabase and hand it to central.
            </p>
          </div>
        </div>
      </BoardPanel>

      <BoardPanel>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <Field
              label="Incremental sync from"
              htmlFor="since"
              help="Leave empty for a full sync. Central passes back the cursor from its last response."
            >
              <Input
                id="since"
                placeholder="2026-09-11T09:58:12.000Z"
                value={since}
                onChange={e => setSince(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setApplied(since.trim())} loading={payloadQuery.isFetching}>
              Fetch payload
            </Button>
            {applied && (
              <Button variant="secondary" onClick={() => { setSince(''); setApplied('') }}>
                Full sync
              </Button>
            )}
          </div>
        </div>
      </BoardPanel>

      <BoardPanel padded={false}>
        <div className="px-panel pt-panel pb-2 flex flex-wrap items-center justify-between gap-3">
          <SignLabel>Live payload</SignLabel>
          {payload && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-chalk/60 tabular-nums">
                {payload.records.length} records
              </span>
              <Button variant="secondary" onClick={copyPayload}>
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>
              <Button variant="secondary" onClick={downloadCsv}>Download CSV</Button>
            </div>
          )}
        </div>
        <Seam />

        {payloadQuery.isLoading ? (
          <div className="p-panel"><Skeleton variant="card" /></div>
        ) : payloadQuery.isError ? (
          <div className="px-panel py-8">
            <ErrorState
              headline="The export endpoint did not answer"
              body="Deploy the aarvak-export function and set AARVAK_EXPORT_TOKEN in Supabase secrets. A 401 here means the function is deployed but did not accept your session as a lead."
              retry={() => payloadQuery.refetch()}
            />
          </div>
        ) : !payload || payload.records.length === 0 ? (
          <EmptyState
            headline="Nothing to send yet."
            body="Only verified and revoked submissions are exported. Post something in the Booth and it appears here."
          />
        ) : (
          <pre className="p-panel max-h-[60vh] overflow-auto text-xs text-chalk/80 whitespace-pre font-mono">
            {pretty}
          </pre>
        )}
      </BoardPanel>
    </BoardLayout>
  )
}
