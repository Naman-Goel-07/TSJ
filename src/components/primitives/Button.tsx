export function Button({
  children,
  variant = 'primary',
  disabled,
  loading,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'destructive' | 'quiet'
  loading?: boolean
}) {
  const base = "inline-flex items-center justify-center rounded-slot font-body font-semibold h-11 px-4 transition-none"
  const variants = {
    primary: "bg-lamp text-graphite hover:brightness-95 active:translate-y-px disabled:opacity-50",
    secondary: "bg-transparent text-chalk border-hair border-chalk hover:bg-lit active:translate-y-px disabled:opacity-50",
    destructive: "bg-flag text-chalk hover:brightness-95 active:translate-y-px disabled:opacity-50",
    quiet: "bg-transparent text-chalk hover:text-chalk/80"
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? 'Posting...' : children}
    </button>
  )
}
