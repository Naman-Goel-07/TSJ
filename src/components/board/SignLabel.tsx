/**
 * A section heading on a panel.
 *
 * Was Archivo semibold — which is the wordmark's face, so a heading like "On
 * the board" competed with the board total sitting right above it. It is the
 * instrumentation voice now: Martian Mono, tracked out, dim. Something you
 * scan on the way to the content rather than read.
 */
export function SignLabel({ children }: { children: React.ReactNode }) {
  return <span className="label text-muted">{children}</span>
}
