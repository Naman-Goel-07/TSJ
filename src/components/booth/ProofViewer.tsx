/**
 * Proof viewer for the booth.
 *
 * The proofs bucket is private. Nothing here is a permanent URL: every file gets
 * a 5-minute signed link, generated on demand and regenerated before it expires,
 * so a screenshot of a reviewer's screen leaks a link that is already dead.
 *
 * Proof rows come from get_submission_proofs(), a security-definer function that
 * checks the caller either owns the submission or holds submissions.verify.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { Skeleton } from '../primitives/Skeleton'

const TTL_SECONDS = 300
const REFRESH_MS = (TTL_SECONDS - 60) * 1000

type Proof = {
  id: string
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  url: string
}

function humanSize(bytes: number): string {
  const kb = bytes / 1024
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`
}

export function ProofViewer({ submissionId }: { submissionId: string }) {
  const [proofs, setProofs] = useState<Proof[] | null>(null)
  const [error, setError] = useState('')
  const [zoomed, setZoomed] = useState<Proof | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError('')
      const { data, error: rpcError } = await supabase.rpc('get_submission_proofs', {
        p_submission_id: submissionId,
      })
      if (cancelled) return
      if (rpcError) {
        setError(`Could not list the proof files: ${rpcError.message}`)
        setProofs([])
        return
      }

      const rows = data ?? []
      const signed = await Promise.all(
        rows.map(async row => {
          const { data: link } = await supabase.storage
            .from('proofs')
            .createSignedUrl(row.storage_path, TTL_SECONDS)
          return { ...row, url: link?.signedUrl ?? '' }
        }),
      )
      if (cancelled) return
      setProofs(signed)
      if (signed.some(p => !p.url)) {
        setError('One or more files could not be opened. The storage policies may be missing.')
      }
    }

    setProofs(null)
    setZoomed(null)
    load()

    // Links expire in 5 minutes. Refresh at 4 so a reviewer reading a long
    // submission never clicks a dead link.
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [submissionId])

  if (proofs === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton variant="card" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-flare">{error}</p>}

      {proofs.length === 0 && !error && (
        <p className="text-sm text-chalk/60">
          No files attached. Send this back and ask for proof before posting it.
        </p>
      )}

      {proofs.map(proof =>
        proof.mime_type.startsWith('image/') ? (
          <button
            key={proof.id}
            type="button"
            onClick={() => setZoomed(proof)}
            className="block w-full text-left border-hair border-seam rounded-slot overflow-hidden
                       focus:outline-none focus:shadow-ring hover:border-chalk/40"
          >
            <img
              src={proof.url}
              alt={proof.file_name}
              className="w-full max-h-80 object-contain bg-recess"
              loading="lazy"
            />
            <span className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-chalk/60">
              <span className="truncate">{proof.file_name}</span>
              <span className="tabular-nums shrink-0">{humanSize(proof.size_bytes)}</span>
            </span>
          </button>
        ) : (
          <a
            key={proof.id}
            href={proof.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 h-11 px-3 border-hair border-seam rounded-slot
                       text-sm text-chalk hover:bg-lit focus:outline-none focus:shadow-ring"
          >
            <span className="truncate">{proof.file_name}</span>
            <span className="text-xs text-chalk/60 tabular-nums shrink-0">
              PDF, {humanSize(proof.size_bytes)}
            </span>
          </a>
        ),
      )}

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.file_name}
          className="fixed inset-0 z-dialog bg-graphite/90 flex items-center justify-center p-gutter"
          onClick={() => setZoomed(null)}
        >
          <img
            src={zoomed.url}
            alt={zoomed.file_name}
            className="max-w-full max-h-full object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 h-11 px-4 rounded-slot border-hair border-chalk
                       text-sm font-semibold text-chalk hover:bg-lit focus:outline-none focus:shadow-ring"
            onClick={() => setZoomed(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
