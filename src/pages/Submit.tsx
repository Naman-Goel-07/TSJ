import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/primitives/Button'
import { Skeleton } from '../components/primitives/Skeleton'
import { ErrorState } from '../components/feedback/EmptyState'
import { AttachedFile } from '../components/primitives/Field'
import { TextButton } from '../components/primitives/Controls'
import { FileText, Calendar, LayoutGrid, Link as LinkIcon, List, Upload, ChevronDown } from 'lucide-react'

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

function CustomInput({ icon, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode; error?: string }) {
  return (
    <div className="flex flex-col gap-1 w-full relative">
      <div className={`relative flex items-center w-full h-12 bg-recess border rounded-xl overflow-hidden transition-colors ${error ? 'border-flare/50 focus-within:border-flare' : 'border-seam focus-within:border-lamp/40 focus-within:shadow-ring'}`}>
        <div className="pl-4 pr-3 text-chalk/40 flex-shrink-0 flex items-center justify-center pointer-events-none">
          {icon}
        </div>
        <input className="flex-1 h-full bg-transparent text-sm text-chalk placeholder-chalk/30 focus:outline-none" {...props} />
      </div>
      {error && <span className="text-[11px] text-flare absolute -bottom-5 left-0">{error}</span>}
    </div>
  )
}

function ThemeCalendarPicker({
  value,
  maxDate,
  onChange,
  disabled,
  error,
}: {
  value: string
  maxDate: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
}) {
  const [open, setOpen] = useState(false)

  const parseDate = (val: string) => {
    if (!val) return null
    const [year, month, day] = val.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }

  const selectedDate = parseDate(value)
  const max = parseDate(maxDate) ?? new Date()
  const [viewDate, setViewDate] = useState(selectedDate ?? max)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const formattedValue = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Select a date'

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startingDay = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()
  const days: (number | null)[] = [
    ...Array.from({ length: startingDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ]

  const selectDay = (day: number) => {
    const selected = new Date(year, month, day)
    if (selected > max) return
    const formatted = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`
    onChange(formatted)
    setOpen(false)
  }

  return (
    <div className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`relative flex items-center w-full h-12 bg-recess border rounded-xl overflow-hidden transition-colors ${error ? 'border-flare/50 focus:border-flare' : 'border-seam focus:border-lamp/40 focus:shadow-ring'}`}
      >
        <div className="pl-4 pr-3 text-chalk/40 flex-shrink-0 flex items-center justify-center pointer-events-none">
          <Calendar className="w-4 h-4" />
        </div>
        <span className={`flex-1 text-left text-sm ${selectedDate ? 'text-chalk' : 'text-chalk/30'}`}>
          {formattedValue}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full max-w-[340px] rounded-2xl bg-enamel border border-lamp/30 shadow-glow p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="w-8 h-8 rounded-lg border border-seam flex items-center justify-center text-chalk hover:bg-recess transition-colors"
            >‹</button>
            <span className="text-sm font-semibold text-chalk">{monthName}</span>
            <button
              type="button"
              onClick={() => {
                const next = new Date(year, month + 1, 1)
                if (next.getFullYear() > max.getFullYear() || (next.getFullYear() === max.getFullYear() && next.getMonth() > max.getMonth())) return
                setViewDate(next)
              }}
              className="w-8 h-8 rounded-lg border border-seam flex items-center justify-center text-chalk hover:bg-recess transition-colors"
            >›</button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <div key={i} className="h-8 flex items-center justify-center text-[10px] font-semibold text-chalk/40">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className="h-8" />
              const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === month && selectedDate?.getFullYear() === year
              const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
              const isFuture = new Date(year, month, day) > max

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isFuture}
                  onClick={() => selectDay(day as number)}
                  className={`h-8 w-full rounded-lg text-xs transition-colors flex items-center justify-center
                    ${isSelected ? 'bg-lamp text-white font-bold shadow-[0_0_12px_rgba(200,50,80,0.4)]' : 
                      isFuture ? 'text-chalk/20 cursor-not-allowed' : 
                      isToday ? 'border border-lamp/50 text-lamp font-semibold hover:bg-lamp/10' : 
                      'text-chalk hover:bg-recess'}`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          
          <div className="mt-4 pt-3 border-t border-seam flex justify-between">
            <button type="button" onClick={() => { onChange(today()); setViewDate(max); setOpen(false) }} className="text-xs text-lamp hover:text-lamp/80 font-medium">Today</button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-chalk/50 hover:text-chalk">Close</button>
          </div>
        </div>
      )}
      {error && <span className="text-[11px] text-flare absolute -bottom-5 left-0">{error}</span>}
    </div>
  )
}

function CustomCategoryPicker({ 
  value, 
  onChange, 
  grouped, 
  disabled, 
  error 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  grouped: { key: string; heading: string; items: any[] }[]; 
  disabled?: boolean; 
  error?: string 
}) {
  const [open, setOpen] = useState(false)
  
  const selectedItem = grouped.flatMap(g => g.items).find(i => i.id === value)
  
  return (
    <div className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`relative flex items-center w-full h-12 bg-recess border rounded-xl overflow-hidden transition-colors ${error ? 'border-flare/50 focus:border-flare' : 'border-seam focus:border-lamp/40 focus:shadow-ring'}`}
      >
        <div className="pl-4 pr-3 text-chalk/40 flex-shrink-0 flex items-center justify-center pointer-events-none">
          <LayoutGrid className="w-4 h-4" />
        </div>
        <span className={`flex-1 text-left text-sm truncate ${selectedItem ? 'text-chalk' : 'text-chalk/30'}`}>
          {selectedItem ? `${selectedItem.label}${selectedItem.level ? ` — ${selectedItem.level}` : ''}` : 'Select category'}
        </span>
        <div className="pr-4 text-chalk/40 pointer-events-none">
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl bg-enamel border border-lamp/30 shadow-glow p-2 max-h-[300px] overflow-y-auto">
          {grouped.map(group => (
            <div key={group.key} className="mb-3 last:mb-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-lamp uppercase tracking-wider">{group.heading}</div>
              <div className="flex flex-col gap-0.5">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { onChange(item.id); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-baseline justify-between
                      ${value === item.id ? 'bg-lamp/15 text-lamp font-medium' : 'text-chalk hover:bg-recess'}`}
                  >
                    <span>{item.label}</span>
                    {item.level && <span className={`text-xs ml-2 ${value === item.id ? 'text-lamp/70' : 'text-chalk/40'}`}>{item.level}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <span className="text-[11px] text-flare absolute -bottom-5 left-0">{error}</span>}
    </div>
  )
}

function CustomTextarea({ icon, error, charCount, maxChars, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { icon: React.ReactNode; error?: string; charCount: number; maxChars: number }) {
  return (
    <div className="flex flex-col gap-1 w-full relative">
      <div className={`relative flex items-start w-full min-h-[140px] bg-recess border rounded-xl overflow-hidden transition-colors ${error ? 'border-flare/50 focus-within:border-flare' : 'border-seam focus-within:border-lamp/40 focus-within:shadow-ring'}`}>
        <div className="pl-4 pr-3 pt-4 text-chalk/40 flex-shrink-0 flex items-center justify-center pointer-events-none">
          {icon}
        </div>
        <textarea className="flex-1 w-full h-full min-h-[140px] bg-transparent text-sm text-chalk placeholder-chalk/30 focus:outline-none py-4 pr-4 resize-none" {...props} />
        <div className="absolute bottom-3 right-4 text-[10px] text-chalk/40 tabular-nums">
          {charCount}/{maxChars}
        </div>
      </div>
      {error && <span className="text-[11px] text-flare absolute -bottom-5 left-0">{error}</span>}
    </div>
  )
}

export function Submit() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const uid = session?.user.id

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
            p_team_id : 'f0ab9a4a-2e4b-4568-99ef-5b4736cc33c5',
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

  if (posted) {
    return (
      <div className="min-h-screen bg-recess haze flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl font-display font-medium text-chalk tracking-tight mb-4">
          {posted} is {isEdit ? 'back in the queue.' : 'in the queue.'}
        </h2>
        <p className="text-base text-chalk/60 max-w-xl mx-auto mb-8">
          {isEdit
            ? 'A core member will look at it again with the evidence you added. You can follow it under Your calls.'
            : 'A core member will check your proof and post it to the board. You can follow it under Your calls. If they need more evidence, it will come back marked Sent back.'}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button onClick={() => navigate('/')}>Back to the board</Button>
          {!isEdit && (
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Submit another
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-recess haze relative overflow-hidden flex flex-col items-center py-16 px-4 sm:px-6">
      
      {/* Topbar / Navigation */}
      <div className="absolute top-0 left-0 w-full h-[56px] z-header flex items-center justify-between px-6">
        <button className="font-display font-bold text-xl text-chalk tracking-sign uppercase hover:text-lamp transition-colors" onClick={() => navigate('/')}>ECHO</button>
        <TextButton onClick={() => navigate('/')}>Back to the board</TextButton>
      </div>

      {/* Decorative Side Text */}
      <div className="hidden xl:block absolute left-12 top-1/2 -translate-y-1/2 text-[10px] tracking-widest text-chalk/30 uppercase space-y-2 pointer-events-none">
        <p>Different</p>
        <p>People</p>
        <p>Same Echo</p>
      </div>
      <div className="hidden xl:block absolute right-12 top-1/2 -translate-y-1/2 text-[10px] tracking-widest text-chalk/30 uppercase space-y-2 text-right pointer-events-none">
        <p>Ideas</p>
        <p>People</p>
        <p>Impact</p>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[800px] z-10 relative mt-8">
        
        {/* Header section */}
        <div className="text-center mb-12">
          <span className="text-[11px] font-semibold text-lamp tracking-[0.2em] uppercase mb-4 block">Submit</span>
          <h1 className="text-4xl sm:text-5xl font-display font-medium text-chalk tracking-tight mb-5">
            Add Your <span className="text-lamp">Achievement</span>
          </h1>
          <p className="text-xs sm:text-sm tracking-[0.1em] text-chalk/50 uppercase">
            Small steps create a louder echo
          </p>
        </div>

        {/* Form Container matching mockup layout but with lamp theme */}
        <div className="bg-enamel/95 border border-lamp/30 rounded-2xl p-6 sm:p-10 shadow-[0_0_40px_-10px_rgba(200,50,80,0.15)] relative">
          
          {loadError && <div className="mb-6 p-4 bg-flag/10 border border-flag/20 rounded-xl text-sm text-flag">{loadError}</div>}
          
          {reviewerNote && (
            <div className="mb-6 border-l-4 border-l-amber bg-recess px-4 py-3 rounded-r-xl">
              <p className="text-xs font-semibold text-amber uppercase tracking-wider mb-1">Reviewer's Note</p>
              <p className="text-sm text-chalk">{reviewerNote}</p>
            </div>
          )}

          {catalogQuery.isLoading ? (
            <div className="flex flex-col gap-6">
              {[...Array(4)].map((_, i) => <Skeleton key={i} variant="row" />)}
            </div>
          ) : catalogQuery.isError ? (
            <ErrorState headline="Could not load the achievement list" body="The activity catalog failed to load, so there is nothing to pick from yet." retry={() => catalogQuery.refetch()} />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
              
              {formError && (
                <div className="p-3 bg-flag/10 border border-flag/20 rounded-xl text-sm text-flag">{formError}</div>
              )}

              {/* Grid for top inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-7">
                
                {/* Project Title */}
                <div>
                  <label className="block text-sm font-medium text-chalk mb-2">Project Title <span className="text-lamp">*</span></label>
                  <CustomInput
                    icon={<FileText className="w-4 h-4" />}
                    placeholder="Enter project title"
                    maxLength={140}
                    {...register('title')}
                    disabled={busy}
                    error={errors.title?.message}
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-chalk mb-2">Date <span className="text-lamp">*</span></label>
                  <input type="hidden" {...register('occurred_on')} />
                  <ThemeCalendarPicker
                    value={watch('occurred_on')}
                    maxDate={today()}
                    onChange={(val) => setValue('occurred_on', val, { shouldDirty: true, shouldValidate: true })}
                    disabled={busy}
                    error={errors.occurred_on?.message}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-chalk mb-2">Category <span className="text-lamp">*</span></label>
                  <input type="hidden" {...register('activity_id')} />
                  <CustomCategoryPicker
                    value={watch('activity_id')}
                    onChange={(val) => setValue('activity_id', val, { shouldDirty: true, shouldValidate: true })}
                    grouped={grouped}
                    disabled={busy}
                    error={errors.activity_id?.message}
                  />
                </div>

                {/* Reference Link */}
                <div>
                  <label className="block text-sm font-medium text-chalk mb-2">Reference Link</label>
                  <CustomInput
                    type="url"
                    icon={<LinkIcon className="w-4 h-4" />}
                    placeholder="https://"
                    {...register('external_url')}
                    disabled={busy}
                    error={errors.external_url?.message}
                  />
                </div>

              </div>

              {/* Description */}
              <div className="mt-1">
                <label className="block text-sm font-medium text-chalk mb-2">Description <span className="text-lamp">*</span></label>
                <CustomTextarea
                  icon={<List className="w-4 h-4" />}
                  placeholder="Briefly describe your contribution..."
                  maxLength={1000}
                  {...register('details')}
                  disabled={busy}
                  error={errors.details?.message}
                  charCount={detailsValue.length}
                  maxChars={1000}
                />
              </div>

              {/* Proof File Upload */}
              <div className="mt-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-chalk">Proof <span className="text-lamp">*</span></label>
                  <span className="text-xs text-chalk/40">
                    {selected?.proof_hint ? selected.proof_hint : 'PNG, JPG, PDF (Max 10MB)'}
                  </span>
                </div>
                
                <div className="border border-dashed border-lamp/30 rounded-xl bg-lamp/[0.02] hover:bg-lamp/[0.04] transition-colors p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT_ATTR}
                    disabled={busy}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={e => {
                      addFiles(Array.from(e.target.files ?? []))
                      e.target.value = ''
                    }}
                  />
                  <div className="w-12 h-12 rounded-full bg-lamp/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-5 h-5 text-lamp" />
                  </div>
                  <p className="text-sm font-medium text-chalk mb-1">Upload Proof</p>
                  <p className="text-xs text-chalk/50">Drag & drop files here, or click to upload</p>
                  
                  {fileError && <p className="text-[11px] text-flare mt-3 absolute bottom-2">{fileError}</p>}
                </div>

                {/* Uploaded Files List */}
                {(keptExisting.length > 0 || files.length > 0) && (
                  <div className="flex flex-col gap-2 mt-3">
                    {keptExisting.map(p => (
                      <AttachedFile key={p.id} name={p.file_name} bytes={p.size_bytes} state="done" onRemove={busy ? undefined : () => setRemovedIds([...removedIds, p.id])} />
                    ))}
                    {files.map((a, i) => (
                      <AttachedFile key={`${a.file.name}-${i}`} name={a.file.name} bytes={a.file.size} state={a.state} onRemove={busy ? undefined : () => setFiles(files.filter((_, j) => j !== i))} />
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-4 pt-6 border-t border-seam">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => navigate('/')} className="px-6">
                  Cancel
                </Button>
                <Button type="submit" loading={busy} disabled={!!loadError} className="px-8 bg-lamp/10 text-lamp border border-lamp/30 hover:bg-lamp/20 hover:border-lamp/50">
                  {isEdit ? 'Submit' : 'Submit'}
                </Button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  )
}
