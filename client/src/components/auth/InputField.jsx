'use client'

function FieldIcon({ icon }) {
  switch (icon) {
    case 'user':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      )
    case 'email':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      )
    case 'lock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </svg>
      )
    case 'briefcase':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="7" width="18" height="12" rx="3" />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          <path d="M3 12h18" />
        </svg>
      )
    default:
      return null
  }
}

export default function InputField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  icon,
  autoComplete,
  disabled,
  as = 'input',
  children,
}) {
  const Element = as

  return (
    <label className="block">
      <div className="group relative">
        <div className="pointer-events-none absolute left-4 top-4 z-[1] text-slate-400 transition group-focus-within:text-cyan-300">
          <span className="block h-5 w-5">
            <FieldIcon icon={icon} />
          </span>
        </div>
        <Element
          name={name}
          type={as === 'input' ? type : undefined}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          disabled={disabled}
          placeholder=" "
          className={`peer min-h-[60px] w-full rounded-[18px] border bg-white/[0.05] px-12 pb-3 pt-6 text-sm text-white outline-none transition placeholder:text-transparent ${
            error
              ? 'border-rose-400/60 focus:border-rose-300'
              : 'border-white/10 focus:border-cyan-300/60'
          } ${as === 'select' ? 'appearance-none pr-10' : ''}`}
        >
          {children}
        </Element>
        <span className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-sm text-slate-400 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-4 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-[0.22em] peer-focus:text-cyan-200 peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-[0.22em] peer-[:not(:placeholder-shown)]:text-slate-300">
          {label}
        </span>
        {as === 'select' ? (
          <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m6 9 6 6 6-6" />
          </svg>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </label>
  )
}
