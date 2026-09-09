/**
 * Avatars: one place that knows the bucket name, the link lifetime, and how to
 * turn storage paths into URLs a browser can render.
 *
 * The bucket is private, so nothing here is a permanent URL. Paths are
 * exchanged for five-minute signed links and re-signed at four, exactly like
 * ProofViewer does for proof files. The difference is volume: the board feed
 * can show thirty rows, so links are minted in one batched call rather than one
 * request per face.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export const AVATAR_BUCKET = 'avatars'
export const AVATAR_TTL_SECONDS = 300
/** Re-sign a minute before expiry, so nobody ever renders a dead link. */
export const AVATAR_REFRESH_MS = (AVATAR_TTL_SECONDS - 60) * 1000

/**
 * Storage path -> signed URL. Nulls and duplicates are dropped before the call,
 * so a feed where eight rows belong to the same person costs one path, not
 * eight. A failure returns an empty map rather than throwing: a missing picture
 * falls back to initials, and that is not worth failing a screen over.
 */
export async function signAvatarPaths(
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)))
  if (unique.length === 0) return {}

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(unique, AVATAR_TTL_SECONDS)

  if (error || !data) return {}

  const out: Record<string, string> = {}
  for (const row of data) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl
  }
  return out
}

/**
 * member id -> signed URL, for every member of your team who has a picture.
 *
 * One query, shared by the booth, roll call and the admin roster through the
 * TanStack cache. Those screens already carry a member id on every row, so
 * nothing about their existing RPCs has to change.
 */
export function useTeamAvatars(): Record<string, string> {
  const query = useQuery({
    queryKey: ['team-avatars'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_avatars')
      if (error) throw error

      const rows = (data ?? []) as { id: string; avatar_path: string | null }[]
      const urls = await signAvatarPaths(rows.map(r => r.avatar_path))

      const map: Record<string, string> = {}
      for (const row of rows) {
        const url = row.avatar_path ? urls[row.avatar_path] : undefined
        if (url) map[row.id] = url
      }
      return map
    },
    staleTime: AVATAR_REFRESH_MS,
    refetchInterval: AVATAR_REFRESH_MS,
  })

  return query.data ?? {}
}

/**
 * submission id -> signed URL, for the board feed.
 *
 * get_board_feed() returns a member NAME and no member id, so there is nothing
 * on a feed row to join against. Rather than drop and recreate that function —
 * and change its return type, and every type that depends on it — this asks the
 * server the narrow question the feed actually has: for these submissions,
 * whose picture goes on the row?
 */
export function useFeedAvatars(submissionIds: string[]): Record<string, string> {
  const query = useQuery({
    // Sorted, so the same set of rows in a different order is a cache hit.
    queryKey: ['feed-avatars', [...submissionIds].sort().join(',')],
    enabled: submissionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_feed_avatars', {
        p_submission_ids: submissionIds,
      })
      if (error) throw error

      const rows = (data ?? []) as { submission_id: string; avatar_path: string | null }[]
      const urls = await signAvatarPaths(rows.map(r => r.avatar_path))

      const map: Record<string, string> = {}
      for (const row of rows) {
        const url = row.avatar_path ? urls[row.avatar_path] : undefined
        if (url) map[row.submission_id] = url
      }
      return map
    },
    staleTime: AVATAR_REFRESH_MS,
    refetchInterval: AVATAR_REFRESH_MS,
  })

  return query.data ?? {}
}
