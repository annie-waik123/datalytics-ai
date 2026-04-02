'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../components/auth/Button.jsx'

function normalizeOtpInput(value = '') {
  return value.replace(/\D/g, '').slice(0, 6)
}

export default function OTPVerification({
  email,
  fullName,
  loading,
  cooldown,
  previewCode,
  onSubmit,
  onResend,
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const inputsRef = useRef([])

  useEffect(() => {
    setDigits(['', '', '', '', '', ''])
    window.setTimeout(() => {
      inputsRef.current[0]?.focus()
    }, 80)
  }, [email])

  const code = useMemo(() => digits.join(''), [digits])

  function updateDigit(index, nextValue) {
    const cleanValue = normalizeOtpInput(nextValue)

    if (cleanValue.length > 1) {
      const split = cleanValue.split('').slice(0, 6)
      const nextDigits = Array.from({ length: 6 }, (_, itemIndex) => split[itemIndex] || '')
      setDigits(nextDigits)
      const nextFocusIndex = Math.min(split.length, 5)
      inputsRef.current[nextFocusIndex]?.focus()
      return
    }

    setDigits((current) => {
      const nextDigits = [...current]
      nextDigits[index] = cleanValue
      return nextDigits
    })

    if (cleanValue && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  function handlePaste(event) {
    event.preventDefault()
    const pasted = normalizeOtpInput(event.clipboardData.getData('text'))
    if (!pasted) return
    const nextDigits = Array.from({ length: 6 }, (_, index) => pasted[index] || '')
    setDigits(nextDigits)
    inputsRef.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-300">
        <p className="font-medium text-white">Check your inbox</p>
        <p className="mt-2">
          We sent a 6-digit code to <span className="text-cyan-200">{email}</span>. Enter it below to finish setting up
          {fullName ? ` ${fullName}` : ' your workspace'}.
        </p>
        {previewCode ? (
          <p className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Dev preview OTP: {previewCode}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Verification code</span>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
          Resend in {cooldown}s
        </span>
      </div>

      <div className="grid grid-cols-6 gap-3" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element
            }}
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            className="h-14 rounded-[18px] border border-white/10 bg-white/[0.05] text-center text-lg font-semibold text-white outline-none transition focus:border-cyan-300/60"
          />
        ))}
      </div>

      <Button onClick={() => onSubmit(code)} loading={loading} disabled={code.length !== 6}>
        Verify OTP
      </Button>

      <button
        type="button"
        disabled={cooldown > 0 || loading}
        onClick={onResend}
        className="w-full text-center text-sm text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Didn&apos;t receive it? Resend code
      </button>
    </div>
  )
}
