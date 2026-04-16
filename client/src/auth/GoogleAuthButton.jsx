'use client'

import Button from '../components/auth/Button.jsx'

export default function GoogleAuthButton({ loading, onClick, role }) {
  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={onClick} loading={loading} className="gap-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-950">
          G
        </span>
        Continue with Google
      </Button>
      <p className="text-center text-[11px] uppercase tracking-[0.24em] text-slate-500">
        First Google sign-in will use role: {role}
      </p>
    </div>
  )
}
