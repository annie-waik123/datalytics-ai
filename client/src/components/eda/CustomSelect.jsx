import { useEffect, useRef, useState } from 'react'
import './CustomSelect.css'

/**
 * CustomSelect — fully styled dropdown matching the Neon Cyberpunk EDA theme.
 * Drop-in replacement for <select> inside .eda-field.
 *
 * Props:
 *   value      — current selected value (string)
 *   onChange   — callback(value: string)
 *   options    — [{ value, label }]
 *   placeholder — optional placeholder text
 *   disabled   — boolean
 */
export default function CustomSelect({ value, onChange, options = [], placeholder = 'Select…', disabled = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selected = options.find((o) => String(o.value) === String(value))

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard navigation
  function handleKeyDown(e) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v) }
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'ArrowDown' && open) {
      const idx = options.findIndex((o) => String(o.value) === String(value))
      const next = options[idx + 1]
      if (next) onChange(next.value)
    }
    if (e.key === 'ArrowUp' && open) {
      const idx = options.findIndex((o) => String(o.value) === String(value))
      const prev = options[idx - 1]
      if (prev) onChange(prev.value)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`csel${open ? ' csel--open' : ''}${disabled ? ' csel--disabled' : ''}`}
      tabIndex={disabled ? -1 : 0}
      role="listbox"
      aria-expanded={open}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        type="button"
        className="csel__trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className={`csel__value${!selected ? ' csel__value--placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="csel__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="csel__panel">
          <div className="csel__list">
            {options.map((opt) => {
              const isActive = String(opt.value) === String(value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`csel__option${isActive ? ' csel__option--active' : ''}`}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                >
                  {isActive && (
                    <svg className="csel__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  <span>{opt.label}</span>
                </button>
              )
            })}
            {options.length === 0 && <div className="csel__empty">No options</div>}
          </div>
        </div>
      )}
    </div>
  )
}
