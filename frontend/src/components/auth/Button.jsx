'use client'

function Spinner() {
  return (
    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
  )
}

const VARIANT_MAP = {
  primary: 'bg-gradient-to-r from-orange-400 via-amber-400 to-cyan-300 text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.22)] hover:translate-y-[-1px]',
  secondary: 'border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]',
  ghost: 'border border-white/10 bg-transparent text-slate-300 hover:bg-white/[0.06]',
}

export default function Button({
  children,
  type = 'button',
  onClick,
  loading,
  disabled,
  className = '',
  variant = 'primary',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_MAP[variant]} ${className}`}
    >
      {loading ? <Spinner /> : null}
      <span>{children}</span>
    </button>
  )
}
