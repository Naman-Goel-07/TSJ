/**
 * /submit — the member write path.
 *
 * Rules enforced here:
 *   - activity_catalog is queried WITHOUT the points column. A member's browser
 *     never receives a point value from this page.
 *   - Files are uploaded first, then submit_achievement() writes the submission
 *     row and its proof rows in one transaction. If the RPC fails, the uploaded
 *     files are deleted. There is no window in which an orphan row can exist.
 *   - status and awarded_points are never sent from the client.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { BoardLayout } from '../components/layout/BoardLayout'
import { BoardPanel } from '../components/board/BoardPanel'
import { SignLabel } from '../components/board/SignLabel'
import { Seam } from '../components/primitives/Seam'
import { Button } from '../components/primitives/Button'
import { Skeleton } from '../components/primitives/Skeleton'
import { ErrorState } from '../components/feedback/EmptyState'
import { Field, Input, Select, Textarea, CharCount, FilePicker, AttachedFile } from '../components/primitives/Field'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,.pdf'

const CATEGORY_HEADINGS: Record<string, string> = {
  team_activity: 'Team activity',
  individual: 'Individual',
  sprint_track: 'Sprint track',
  bonus: 'Bonus',
}
const CATEGORY_ORDER = ['team_activity', 'individual', 'sprint_track', 'bonus']

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const schema = z.object({
  activity_id: z.string().min(1, 'Pick the achievement type from the list.'),
  title: z
    .string()
    .trim()
    .min(3, 'Give it a title of at least 3 characters.')
    .max(120, 'Keep the title under 120 characters.'),
  occurred_on: z
    .string()
    .min(1, 'Pick the date this happened.')
    .refine(v => v <= today(), 'That date is in the future. Pick the day it actually happened.'),
  details: z.string().max(1000, 'Trim the details to 1000 characters or fewer.').optional(),
  external_url: z
    .string()
    .trim()
    .refine(v => v === '' || /^https?:\/\/\S+\.\S+/.test(v), 'Include the full link, starting with https://')
    .optional(),
})

type FormValues = z.infer<typeof schema>

/** Minimal zod resolver so we do not need to add @hookform/resolvers. */
const resolver: Resolver<FormValues> = async values => {
  const result = schema.safeParse(values)
  if (result.success) return { values: result.data, errors: {} }
  const errors: Record<string, { type: string; message: string }> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.')
    if (!errors[key]) errors[key] = { type: 'validation', message: issue.message }
  }
  return { values: {}, errors: errors as never }
}

type Attachment = {
  file: File
  path: string
  state: 'ready' | 'uploading' | 'done' | 'failed'
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}

export function Submit() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const uid = session?.user.id

  const [files, setFiles] = useState<Attachment[]>([])
  const [fileError, setFileError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver,
    defaultValues: { activity_id: '', title: '', occurred_on: today(), details: '', external_url: '' },
  })

  // No points column. Not selected, not received, not renderable.
  const catalogQuery = useQuery({
    queryKey: ['activity-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_catalog')
        .select('id, category, label, level, proof_hint, sort_order')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })

  const selectedId = watch('activity_id')
  const detailsValue = watch('details') ?? ''
  const selected = useMemo(
    () => catalogQuery.data?.find(a => a.id === selectedId) ?? null,
    [catalogQuery.data, selectedId],
  )

  const grouped = useMemo(() => {
    const out: { key: string; heading: string; items: NonNullable<typeof catalogQuery.data> }[] = []
    for (const key of CATEGORY_ORDER) {
      const items = (catalogQuery.data ?? []).filter(a => a.category === key)
      if (items.length) out.push({ key, heading: CATEGORY_HEADINGS[key] ?? key, items })
    }
    return out
  }, [catalogQuery.data])

  function addFiles(incoming: File[]) {
    setFileError('')
    const next = [...files]
    for (const file of incoming) {
      if (next.length >= 3) {
        setFileError('Three files is the maximum. Remove one to add another.')
        break
      }
      if (!ACCEPT.includes(file.type)) {
        setFileError(`${file.name} is not a PNG, JPG, WEBP or PDF. Convert it and try again.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        setFileError(`${file.name} is over 10 MB. Compress it or screenshot the relevant part.`)
        continue
      }
      if (next.some(a => a.file.name === file.name && a.file.size === file.size)) continue
      next.push({ file, path: '', state: 'ready' })
    }
    setFiles(next)
  }

  async function onSubmit(values: FormValues) {
    if (!uid) return
    if (files.length === 0) {
      setFileError('Attach at least one file showing the proof. Core members verify against it.')
      return
    }

    setBusy(true)
    setFormError('')
    setFileError('')

    const submissionId = crypto.randomUUID()
    const uploaded: string[] = []

    const cleanup = async () => {
      if (uploaded.length) await supabase.storage.from('proofs').remove(uploaded)
    }

    try {
      const staged: Attachment[] = files.map(a => ({ ...a, state: 'uploading' as const }))
      setFiles(staged)

      for (let i = 0; i < staged.length; i++) {
        const path = `${uid}/${submissionId}/${crypto.randomUUID()}-${safeName(staged[i].file.name)}`
        const { error } = await supabase.storage
          .from('proofs')
          .upload(path, staged[i].file, { contentType: staged[i].file.type, upsert: false })

        if (error) {
          staged[i] = { ...staged[i], state: 'failed' }
          setFiles([...staged])
          await cleanup()
          setFileError(`${staged[i].file.name} did not upload: ${error.message}. Check your connection and try again.`)
          setBusy(false)
          return
        }

        uploaded.push(path)
        staged[i] = { ...staged[i], path, state: 'done' }
        setFiles([...staged])
      }

      const { error: rpcError } = await supabase.rpc('submit_achievement', {
        p_id: submissionId,
        p_activity_id: values.activity_id,
        p_title: values.title,
        p_occurred_on: values.occurred_on,
        p_details: values.details?.trim() || null,
        p_external_url: values.external_url?.trim() || null,
        p_proofs: staged.map(a => ({
          storage_path: a.path,
          file_name: a.file.name,
          mime_type: a.file.type,
          size_bytes: a.file.size,
        })),
      })

      if (rpcError) {
        await cleanup()
        setFiles(files.map(a => ({ ...a, path: '', state: 'ready' as const })))
        setFormError(`${rpcError.message}. Nothing was saved, so you can fix it and submit again.`)
        setBusy(false)
        return
      }

      queryClient.invalidateQueries({ queryKey: ['my-submissions'] })
      setPosted(selected ? `${selected.label}${selected.level ? `, ${selected.level}` : ''}` : values.title)
    } catch (err) {
      await cleanup()
      setFormError(`${err instanceof Error ? err.message : 'The submission failed'}. Nothing was saved. Try again.`)
    } finally {
      setBusy(false)
    }
  }

  const topbar = (
    <div className="flex items-center justify-between w-full">
      <span className="font-display font-bold text-xl text-chalk tracking-sign uppercase">ECHO</span>
      <button
        className="text-sm text-chalk/60 hover:text-chalk underline focus:outline-none focus:shadow-ring rounded-slot px-1"
        onClick={() => navigate('/')}
      >
        Back to the board
      </button>
    </div>
  )

  if (posted) {
    return (
      <BoardLayout topbar={topbar}>
        <BoardPanel>
          <div className="flex flex-col items-start gap-4 py-4">
            <SignLabel>In the queue</SignLabel>
            <h2 className="text-2xl font-display font-bold text-chalk">{posted} is in the queue.</h2>
            <p className="text-base text-chalk/60 max-w-[50ch]">
              A core member will check your proof and post it to the board. You can follow it under
              Your calls. If they need more evidence, it will come back marked Sent back.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => navigate('/')}>Back to the board</Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Submit another
              </Button>
            </div>
          </div>
        </BoardPanel>
      </BoardLayout>
    )
  }

  return (
    <BoardLayout topbar={topbar}>
      <BoardPanel padded={false}>
        <div className="px-panel pt-panel pb-2">
          <SignLabel>Call one in</SignLabel>
          <h2 className="text-xl font-display font-bold text-chalk mt-2">Submit an achievement</h2>
          <p className="text-sm text-chalk/60 mt-1">
            Everything here goes to a core member for verification before it reaches the board.
          </p>
        </div>
        <Seam />

        {catalogQuery.isLoading ? (
          <div className="p-panel flex flex-col gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} variant="row" />)}
          </div>
        ) : catalogQuery.isError ? (
          <div className="px-panel py-8">
            <ErrorState
              headline="Could not load the achievement list"
              body="The activity catalog failed to load, so there is nothing to pick from yet."
              retry={() => catalogQuery.refetch()}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-panel flex flex-col gap-6" noValidate>
            {formError && (
              <p className="text-sm text-flare border-hair border-flag rounded-slot px-3 py-2">{formError}</p>
            )}

            <Field label="What did you do" error={errors.activity_id?.message} htmlFor="activity_id">
              <Select id="activity_id" {...register('activity_id')} disabled={busy}>
                <option value="">Pick one</option>
                {grouped.map(group => (
                  <optgroup key={group.key} label={group.heading}>
                    {group.items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.label}{item.level ? ` — ${item.level}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>

            <Field
              label="Title"
              help="Name the specific thing. 'Smart India Hackathon 2026', not 'hackathon'."
              error={errors.title?.message}
              htmlFor="title"
            >
              <Input id="title" maxLength={140} {...register('title')} disabled={busy} />
            </Field>

            <Field label="Date it happened" error={errors.occurred_on?.message} htmlFor="occurred_on">
              <Input
                id="occurred_on"
                type="date"
                max={today()}
                className="tabular-nums"
                {...register('occurred_on')}
                disabled={busy}
              />
            </Field>

            <Field label="Details (optional)" error={errors.details?.message} htmlFor="details">
              <Textarea
                id="details"
                maxLength={1200}
                placeholder="Anything a reviewer would need to know."
                {...register('details')}
                disabled={busy}
              />
              <div className="flex justify-end">
                <CharCount value={detailsValue} max={1000} />
              </div>
            </Field>

            <Field
              label="Link (optional)"
              help="A public link a reviewer can open: repo, PR, article, result page."
              error={errors.external_url?.message}
              htmlFor="external_url"
            >
              <Input id="external_url" type="url" placeholder="https://" {...register('external_url')} disabled={busy} />
            </Field>

            <Seam />

            <Field
              label="Proof"
              error={fileError}
              help={
                selected?.proof_hint
                  ? `For this one: ${selected.proof_hint}.`
                  : 'PNG, JPG, WEBP or PDF. Up to 3 files, 10 MB each.'
              }
            >
              <div className="flex flex-col gap-3">
                {files.map((a, i) => (
                  <AttachedFile
                    key={`${a.file.name}-${i}`}
                    name={a.file.name}
                    bytes={a.file.size}
                    state={a.state}
                    onRemove={busy ? undefined : () => setFiles(files.filter((_, j) => j !== i))}
                  />
                ))}
                {files.length < 3 && (
                  <FilePicker
                    id="proof-files"
                    accept={ACCEPT_ATTR}
                    onFiles={addFiles}
                    disabled={busy}
                    hint={`${files.length} of 3 attached`}
                  />
                )}
              </div>
            </Field>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" loading={busy} className="w-full sm:w-auto">
                Send for verification
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                className="w-full sm:w-auto"
                onClick={() => navigate('/')}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </BoardPanel>
    </BoardLayout>
  )
}
