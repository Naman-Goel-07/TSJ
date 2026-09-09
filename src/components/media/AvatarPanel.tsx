/**
 * The only place a picture can be set.
 *
 * Order of operations, because getting it wrong leaves rubbish behind:
 *
 *   1. upload the new file
 *   2. set_my_avatar() points the profile at it and hands back the path it was
 *      pointing at before
 *   3. only then is the old file deleted
 *
 * If step 2 fails, the file from step 1 is removed, so the bucket never holds an
 * object no row refers to. If step 3 fails, the worst case is one orphan file,
 * which is the harmless direction to fail in.
 *
 * The path is built as `<your uid>/<uuid>.<ext>`. That is not a convention the
 * client is trusted to honour: the storage policy checks the first folder
 * against auth.uid(), and set_my_avatar() rejects a path that does not start
 * with the caller's own id. Both would have to be wrong for a member to write
 * over someone else's face.
 */
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../supabase'
import { useAuth } from '../../context/AuthContext'
import { BoardPanel } from '../board/BoardPanel'
import { SignLabel } from '../board/SignLabel'
import { Seam } from '../primitives/Seam'
import { Button } from '../primitives/Button'
import { Notice } from '../feedback/Notice'
import { Avatar } from './Avatar'
import { AVATAR_BUCKET, AVATAR_TTL_SECONDS, AVATAR_REFRESH_MS } from '../../lib/avatars'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp']
const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp'

const PICK_LABEL =
  'inline-flex items-center justify-center h-11 px-[22px] rounded-pill border-hair border-lip ' +
  'font-mono font-bold uppercase text-label text-muted cursor-pointer ' +
  'transition-colors duration-200 hover:text-chalk hover:border-chalk hover:bg-chalk/[0.03] ' +
  'peer-focus:shadow-ring peer-disabled:opacity-40 peer-disabled:cursor-not-allowed'

function extensionFor(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function AvatarPanel() {
  const { session, profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  const uid = session?.user.id
  const path = profile?.avatar_path ?? null

  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  // Sign the current file, then keep re-signing while this screen is open.
  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    let cancelled = false

    async function sign() {
      const { data } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(path as string, AVATAR_TTL_SECONDS)
      if (!cancelled) setUrl(data?.signedUrl ?? null)
    }

    sign()
    const timer = window.setInterval(sign, AVATAR_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [path])

  /** Four screens read avatars through the cache. All four are now stale. */
  function invalidateEverywhere() {
    queryClient.invalidateQueries({ queryKey: ['team-avatars'] })
    queryClient.invalidateQueries({ queryKey: ['feed-avatars'] })
    queryClient.invalidateQueries({ queryKey: ['intro-roster'] })
  }

  async function handlePick(file: File | undefined) {
    if (!file || !uid || busy) return
    setError('')
    setDone('')

    if (!ACCEPT.includes(file.type)) {
      setError('That file is not an image the bucket accepts. Use PNG, JPEG or WebP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 5 MB.`)
      return
    }

    setBusy(true)
    const nextPath = `${uid}/${crypto.randomUUID()}.${extensionFor(file.type)}`

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(nextPath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setBusy(false)
      setError(`The upload did not go through: ${uploadError.message}`)
      return
    }

    const { data: oldPath, error: rpcError } = await supabase.rpc('set_my_avatar', {
      p_avatar_path: nextPath,
    })

    if (rpcError) {
      await supabase.storage.from(AVATAR_BUCKET).remove([nextPath])
      setBusy(false)
      setError(
        rpcError.code === '42501'
          ? 'The database refused that. Your session may have gone stale — sign out and back in.'
          : rpcError.message,
      )
      return
    }

    if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath])

    await refreshProfile()
    invalidateEverywhere()
    setBusy(false)
    setDone('Picture set. It shows on the intro page and beside your name on the board.')
  }

  async function handleRemove() {
    if (!path || busy) return
    setError('')
    setDone('')
    setBusy(true)

    const { data: oldPath, error: rpcError } = await supabase.rpc('set_my_avatar', {
      p_avatar_path: null,
    })

    if (rpcError) {
      setBusy(false)
      setError(rpcError.message)
      return
    }

    if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath])

    await refreshProfile()
    invalidateEverywhere()
    setBusy(false)
    setDone('Picture removed. Your initials stand in for it.')
  }

  return (
    <BoardPanel padded={false}>
      <div className="px-panel pt-panel pb-2">
        <SignLabel>Your picture</SignLabel>
      </div>
      <Seam />

      <div className="p-panel flex flex-col sm:flex-row sm:items-start gap-6">
        <Avatar name={profile?.full_name ?? ''} url={url} size="xl" />

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {error && <Notice tone="error">{error}</Notice>}
          {done && !error && <Notice tone="good">{done}</Notice>}

          <p className="text-sm text-muted">
            PNG, JPEG or WebP, up to 5 MB. A square photo works best. Anything else is
            cropped to the circle rather than squashed into it, so faces stay the right
            shape.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="avatar_file"
              type="file"
              accept={ACCEPT_ATTR}
              disabled={busy}
              className="sr-only peer"
              onChange={e => {
                const picked = e.target.files?.[0]
                e.target.value = ''
                handlePick(picked)
              }}
            />
            <label htmlFor="avatar_file" className={PICK_LABEL}>
              {busy ? 'Working' : path ? 'Replace photo' : 'Choose a photo'}
            </label>

            {path && (
              <Button
                variant="quiet"
                onClick={handleRemove}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                Remove
              </Button>
            )}
          </div>

          <p className="text-xs text-muted">
            Anyone can see this on the public intro page, signed in or not. Nothing else
            about your record is public there.
          </p>
        </div>
      </div>
    </BoardPanel>
  )
}
