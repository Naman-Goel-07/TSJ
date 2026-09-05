export function Field({ label, help, error, children }: { label: string, help?: string, error?: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 mb-4">
      <label className="text-base text-chalk">{label}</label>
      {children}
      {help && !error && <p className="text-xs text-chalk/60">{help}</p>}
      {error && <p className="text-xs text-flare">{error}</p>}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      className="bg-transparent border-hair border-seam rounded-slot h-11 px-3 text-chalk placeholder-chalk/40 focus:border-chalk/40 disabled:opacity-50"
      {...props}
    />
  )
}
