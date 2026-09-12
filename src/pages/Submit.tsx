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
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { TextButton } from '../components/primitives/Controls'

type ExistingProof = { id: string; storage_path: string; file_name: string; size_bytes: number }

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

function CalendarPicker({
  value,
  maxDate,
  onChange,
  disabled,
}: {
  value: string
  maxDate: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  const parseDate = (value: string) => {
    if (!value) return null
    const [year, month, day] = value.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }

  const selectedDate = parseDate(value)
  const max = parseDate(maxDate) ?? new Date()

  const [viewDate, setViewDate] = useState(
    selectedDate ?? max
  )

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthName = viewDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const formattedValue = selectedDate
    ? selectedDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Select a date'

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday = 0, Sunday = 6
  const startingDay = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()

  const days = []

  for (let i = 0; i < startingDay; i++) {
    days.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const previousMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    const next = new Date(year, month + 1, 1)

    // Don't allow navigating beyond the current month
    if (
      next.getFullYear() > max.getFullYear() ||
      (next.getFullYear() === max.getFullYear() &&
        next.getMonth() > max.getMonth())
    ) {
      return
    }

    setViewDate(next)
  }

  const selectDay = (day: number) => {
    const selected = new Date(year, month, day)

    // Prevent future dates
    if (selected > max) return

    const formatted =
      `${selected.getFullYear()}-` +
      `${String(selected.getMonth() + 1).padStart(2, '0')}-` +
      `${String(selected.getDate()).padStart(2, '0')}`

    onChange(formatted)
    setOpen(false)
  }

  const isSelected = (day: number) => {
    if (!selectedDate) return false

    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    )
  }

  const isToday = (day: number) => {
    const todayDate = new Date()

    return (
      todayDate.getFullYear() === year &&
      todayDate.getMonth() === month &&
      todayDate.getDate() === day
    )
  }

  const isFuture = (day: number) => {
    const date = new Date(year, month, day)
    return date > max
  }

  return (
    <div className="relative">
      {/* Date field */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open && selectedDate) {
            setViewDate(selectedDate)
          } else if (!open) {
            setViewDate(max)
          }

          setOpen(!open)
        }}
        className="w-full h-11 bg-transparent border-hair border-seam rounded-slot px-3
                   text-base text-chalk flex items-center justify-between
                   focus:outline-none focus:border-chalk/40 focus:shadow-ring
                   disabled:opacity-50 disabled:cursor-not-allowed
                   text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={selectedDate ? 'text-chalk' : 'text-chalk/40'}>
          {formattedValue}
        </span>

        <span className="text-chalk/60 text-lg leading-none">
          ▣
        </span>
      </button>

      {/* Calendar */}
      {open && (
        <div
          className="absolute z-50 mt-2 w-full max-w-[360px] rounded-slot
                     border-hair border-seam bg-recess p-4 shadow-xl"
          role="dialog"
          aria-label="Choose a date"
        >
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={previousMonth}
              className="w-10 h-10 rounded-slot border-hair border-seam
                         text-chalk hover:bg-lit transition-colors
                         focus:outline-none focus:shadow-ring"
              aria-label="Previous month"
            >
              ‹
            </button>

            <span className="text-base font-semibold text-chalk">
              {monthName}
            </span>

            <button
              type="button"
              onClick={nextMonth}
              className="w-10 h-10 rounded-slot border-hair border-seam
                         text-chalk hover:bg-lit transition-colors
                         focus:outline-none focus:shadow-ring"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
              <div
                key={`${day}-${index}`}
                className="h-8 flex items-center justify-center
                           text-xs font-semibold text-chalk/40"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-10" />
              }

              const selected = isSelected(day)
              const today = isToday(day)
              const future = isFuture(day)

              return (
              <button
                key={day}
                type="button"
                disabled={future}
                onClick={() => selectDay(day)}
                className={[
                  'h-10 w-full rounded-slot text-sm transition-colors',
                  'focus:outline-none focus:shadow-ring',

                  // Selected date
                  selected
                    ? 'bg-flare text-[#050507] font-bold hover:bg-flare/90'

                    // Dates after today
                    : future
                      ? 'text-chalk/20 cursor-not-allowed'

                      // Today
                      : today
                        ? 'border-hair border-chalk/40 text-chalk font-semibold hover:bg-lit'

                        // Normal date
                        : 'text-chalk hover:bg-lit',
                ].join(' ')}
                aria-label={`${day} ${monthName}`}
                aria-pressed={selected}
              >
                {day}
              </button>
            )


            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-4 pt-3 border-t border-seam flex justify-between">
            <button
              type="button"
              onClick={() => {
                const todayValue = today()
                onChange(todayValue)
                setViewDate(max)
                setOpen(false)
              }}
              className="text-sm text-chalk/70 hover:text-chalk"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-chalk/50 hover:text-chalk"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Submit() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const uid = session?.user.id

  // /submit?edit=<id> reopens a submission that a core member sent back.
  const [params] = useSearchParams()
  const editId = params.get('edit')
  const isEdit = !!editId
  const [existing, setExisting] = useState<ExistingProof[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [loadError, setLoadError] = useState('')
  const [reviewerNote, setReviewerNote] = useState('')

  const [files, setFiles] = useState<Attachment[]>([])
  const [fileError, setFileError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver,
    defaultValues: { activity_id: '', title: '', occurred_on: today(), details: '', external_url: '' },
  })

  // Load the sent-back submission and its files into the form.
  useEffect(() => {
    if (!editId) return
    let cancelled = false

    async function load() {
      const { data, error } = await supabase.rpc('get_my_submission', { p_id: editId! })
      if (cancelled) return
      const row = data?.[0]
      if (error || !row) {
        setLoadError('That submission could not be opened. It may not be yours.')
        return
      }
      if (row.status !== 'needs_info') {
        setLoadError('That submission is not waiting on you. Only sent-back items can be edited.')
        return
      }
      reset({
        activity_id: row.activity_id,
        title: row.title,
        occurred_on: row.occurred_on,
        details: row.details ?? '',
        external_url: row.external_url ?? '',
      })
      setReviewerNote(row.decision_note ?? '')

      const { data: proofs } = await supabase.rpc('get_submission_proofs', { p_submission_id: editId! })
      if (!cancelled) setExisting((proofs ?? []) as ExistingProof[])
    }

    load()
    return () => { cancelled = true }
  }, [editId, reset])

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
      const cap = isEdit ? 5 : 3
      if (next.length + keptExisting.length >= cap) {
        setFileError(`${cap} files is the maximum. Remove one to add another.`)
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

  const keptExisting = existing.filter(p => !removedIds.includes(p.id))

  async function onSubmit(values: FormValues) {
    if (!uid) return
    if (files.length === 0 && keptExisting.length === 0) {
      setFileError('Attach at least one file showing the proof. Core members verify against it.')
      return
    }

    setBusy(true)
    setFormError('')
    setFileError('')

    const submissionId = editId ?? crypto.randomUUID()
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

      const newProofs = staged.map(a => ({
        storage_path: a.path,
        file_name: a.file.name,
        mime_type: a.file.type,
        size_bytes: a.file.size,
      }))

      const { error: rpcError } = isEdit
        ? await supabase.rpc('resubmit_submission', {
            p_id: submissionId,
            p_activity_id: values.activity_id,
            p_title: values.title,
            p_occurred_on: values.occurred_on,
            p_details: values.details?.trim() || null,
            p_external_url: values.external_url?.trim() || null,
            p_add_proofs: newProofs,
            p_remove_proof_ids: removedIds,
          })
        : await supabase.rpc('submit_achievement', {
            p_id: submissionId,
            p_team_id = 'f0ab9a4a-2e4b-4568-99ef-5b4736cc33c5',
            p_activity_id: values.activity_id,
            p_title: values.title,
            p_occurred_on: values.occurred_on,
            p_details: values.details?.trim() || null,
            p_external_url: values.external_url?.trim() || null,
            p_proofs: newProofs,
          })

      if (rpcError) {
        await cleanup()
        setFiles(files.map(a => ({ ...a, path: '', state: 'ready' as const })))
        setFormError(`${rpcError.message}. Nothing was saved, so you can fix it and submit again.`)
        setBusy(false)
        return
      }

      // Rows are gone from the database, so clear the files they pointed at.
      if (removedIds.length) {
        const paths = existing.filter(p => removedIds.includes(p.id)).map(p => p.storage_path)
        if (paths.length) await supabase.storage.from('proofs').remove(paths)
      }

      queryClient.invalidateQueries({ queryKey: ['my-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
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
      <TextButton
        onClick={() => navigate('/')}
        >
        Back to the board
      </TextButton>
    </div>
  )

  if (posted) {
    return (
      <BoardLayout topbar={topbar}>
        <BoardPanel>
          <div className="flex flex-col items-start gap-4 py-4">
            <SignLabel>In the queue</SignLabel>
            <h2 className="text-2xl font-display font-bold text-chalk">
              {posted} is {isEdit ? 'back in the queue.' : 'in the queue.'}
            </h2>
            <p className="text-base text-chalk/60 max-w-[50ch]">
              {isEdit
                ? 'A core member will look at it again with the evidence you added. You can follow it under Your calls.'
                : 'A core member will check your proof and post it to the board. You can follow it under Your calls. If they need more evidence, it will come back marked Sent back.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => navigate('/')}>Back to the board</Button>
              {!isEdit && (
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Submit another
                </Button>
              )}
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
          <SignLabel>{isEdit ? 'Sent back' : 'Call one in'}</SignLabel>
          <h2 className="text-xl font-display font-bold text-chalk mt-2">
            {isEdit ? 'Send it again' : 'Submit an achievement'}
          </h2>
          <p className="text-sm text-chalk/60 mt-1">
            {isEdit
              ? 'Fix what was asked for and it goes back into the queue.'
              : 'Everything here goes to a core member for verification before it reaches the board.'}
          </p>
          {reviewerNote && (
            <div className="mt-4 border-l-4 border-l-amber bg-recess px-3 py-2">
              <p className="text-xs text-chalk/60 mb-1">What the reviewer asked for</p>
              <p className="text-sm text-chalk">{reviewerNote}</p>
            </div>
          )}
          {loadError && <p className="text-sm text-flare mt-4">{loadError}</p>}
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

            <Field
  label="Date it happened"
  error={errors.occurred_on?.message}
  htmlFor="occurred_on"
>
  <input
    id="occurred_on"
    type="hidden"
    {...register('occurred_on')}
  />

  <CalendarPicker
    value={watch('occurred_on')}
    maxDate={today()}
    onChange={(value) => {
      setValue('occurred_on', value, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }}
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
                {keptExisting.map(p => (
                  <AttachedFile
                    key={p.id}
                    name={p.file_name}
                    bytes={p.size_bytes}
                    state="done"
                    onRemove={busy ? undefined : () => setRemovedIds([...removedIds, p.id])}
                  />
                ))}
                {files.map((a, i) => (
                  <AttachedFile
                    key={`${a.file.name}-${i}`}
                    name={a.file.name}
                    bytes={a.file.size}
                    state={a.state}
                    onRemove={busy ? undefined : () => setFiles(files.filter((_, j) => j !== i))}
                  />
                ))}
                {files.length + keptExisting.length < (isEdit ? 5 : 3) && (
                  <FilePicker
                    id="proof-files"
                    accept={ACCEPT_ATTR}
                    onFiles={addFiles}
                    disabled={busy}
                    hint={`${files.length + keptExisting.length} of ${isEdit ? 5 : 3} attached`}
                  />
                )}
              </div>
            </Field>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" loading={busy} disabled={!!loadError} className="w-full sm:w-auto">
                {isEdit ? 'Send it back for review' : 'Send for verification'}
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
