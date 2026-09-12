import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { GlobalNav } from '../components/layout/GlobalNav'
import { StatusPill } from '../components/status/StatusPill'
import { Skeleton } from '../components/primitives/Skeleton'

export function Submissions() {
  const { session } = useAuth()

  const myQuery = useQuery({
    queryKey: ['my-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_submissions')
      if (error) throw error
      return data ?? []
    },
    enabled: !!session,
  })

  return (
    <div className="min-h-screen bg-recess haze relative overflow-hidden flex flex-col items-center py-16 px-4 sm:px-6">
      
      {/* Topbar / Navigation */}
      <div className="absolute top-0 left-0 w-full h-[56px] z-header flex items-center px-4 sm:px-6">
        <GlobalNav />
      </div>

      {/* Decorative Side Text */}
      <div className="hidden xl:block absolute left-12 top-1/2 -translate-y-1/2 text-[10px] tracking-widest text-chalk/30 uppercase space-y-2 pointer-events-none">
        <p>Your</p>
        <p>Past</p>
        <p>Echoes</p>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[800px] z-10 relative mt-16 mb-16">
        <div className="text-center mb-12">
          <span className="text-[11px] font-semibold text-lamp tracking-[0.2em] uppercase mb-4 block">History</span>
          <h1 className="text-4xl sm:text-5xl font-display font-medium text-chalk tracking-tight mb-5">
            Your Past <span className="text-lamp">Submissions</span>
          </h1>
        </div>

        <div className="rounded-2xl border border-lamp/30 bg-gradient-to-b from-lamp/15 to-recess shadow-glow overflow-hidden relative">
          <div className="relative z-10">
            {myQuery.isLoading ? (
              <div className="p-4 flex flex-col gap-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} variant="row" />)}
              </div>
            ) : myQuery.isError ? (
              <div className="p-6 text-center text-flare">Could not load your submissions.</div>
            ) : myQuery.data && myQuery.data.length === 0 ? (
              <div className="p-8 text-center text-muted">You haven't made any submissions yet.</div>
            ) : (
              <div className="flex flex-col">
                {(myQuery.data as any[] ?? []).map((row, index) => (
                  <div key={row.id}>
                    <div className="relative w-full p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-lit transition-colors duration-200">
                      <div className="flex flex-col">
                        <span className="text-lg font-medium text-chalk">{row.title}</span>
                        <span className="text-sm text-muted mt-1">{row.activity_label}{row.activity_level ? `, ${row.activity_level}` : ''}</span>
                        {row.decision_note && row.status === 'needs_info' && (
                          <div className="mt-3 p-3 bg-lamp/10 rounded-lg text-sm text-chalk/80 border border-lamp/20">
                            <strong>Note:</strong> {row.decision_note}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-4 mt-4 sm:mt-0">
                        <span className="text-sm text-muted">{new Date(row.submitted_at).toLocaleDateString()}</span>
                        <StatusPill status={row.status} size="sm" />
                      </div>
                    </div>
                    {index < (myQuery.data?.length ?? 0) - 1 && <div className="h-px w-full bg-lamp/10" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
