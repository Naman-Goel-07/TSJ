/**
 * Form primitives. Every control carries a visible focus ring (shadow-ring),
 * and errors are rendered by Field, never inside the control itself.
 */
import { forwardRef } from 'react'

const CONTROL =
  'w-full bg-transparent border-hair border-seam rounded-slot px-3 text-base text-chalk ' +
  'placeholder-chalk/40 focus:outline-none focus:border-chalk/40 focus:shadow-ring ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

export function Field({
  label,
  help,
  error,
  htmlFor,
  children,
}: {
  label: string
  help?: string
  error?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-base text-chalk">{label}</label>
      {children}
      {help && !error && <p className="text-xs text-chalk/60">{help}</p>}
      {error && <p className="text-xs text-flare">{error}</p>}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${CONTROL} h-11 ${className}`} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return (
      <select ref={ref} className={`${CONTROL} h-11 bg-recess ${className}`} {...props}>
        {children}
      </select>
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`${CONTROL} py-2 min-h-[96px] resize-y ${className}`} {...props} />
  },
)

/** Character counter for length-capped fields. tabular-nums so it does not jitter. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max
  return (
    <span className={`text-xs tabular-nums ${over ? 'text-flare' : 'text-chalk/60'}`}>
      {value.length} / {max}
    </span>
  )
}

/** File picker styled as a slot rather than a browser default. */
export function FilePicker({
  id,
  accept,
  onFiles,
  disabled,
  hint,
}: {
  id: string
  accept: string
  onFiles: (files: File[]) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        className="sr-only peer"
        onChange={e => {
          onFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <label
        htmlFor={id}
        className="inline-flex items-center justify-center h-11 px-4 rounded-slot border-hair border-chalk
                   text-base font-semibold text-chalk cursor-pointer hover:bg-lit
                   peer-focus:shadow-ring peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"
      >
        Choose files
      </label>
      {hint && <p className="text-xs text-chalk/60">{hint}</p>}
    </div>
  )
}

/** One attached file, with its size and a way to take it back off. */
export function AttachedFile({
  name,
  bytes,
  state,
  onRemove,
}: {
  name: string
  bytes: number
  state: 'ready' | 'uploading' | 'done' | 'failed'
  onRemove?: () => void
}) {
  const kb = bytes / 1024
  const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`
  const stateText = {
    ready: '',
    uploading: 'Uploading',
    done: 'Uploaded',
    failed: 'Failed',
  }[state]
  const stateClass = state === 'failed' ? 'text-flare' : state === 'done' ? 'text-posted' : 'text-chalk/60'

  return (
    <div className="flex items-center gap-3 h-11 px-3 border-hair border-seam rounded-slot">
      <span className="flex-1 truncate text-sm text-chalk">{name}</span>
      <span className="text-xs text-chalk/60 tabular-nums shrink-0">{size}</span>
      {stateText && <span className={`text-xs shrink-0 ${stateClass}`}>{stateText}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-chalk/60 hover:text-chalk underline shrink-0 focus:outline-none focus:shadow-ring rounded-slot px-1"
        >
          Remove
        </button>
      )}
    </div>
  )
}
