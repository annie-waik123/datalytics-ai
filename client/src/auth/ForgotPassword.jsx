'use client'

import Button from '../components/auth/Button.jsx'
import InputField from '../components/auth/InputField.jsx'

export default function ForgotPassword({
  email,
  error,
  loading,
  onChange,
  onSubmit,
}) {
  return (
    <div className="space-y-5">
      <InputField
        label="Email address"
        name="forgotEmail"
        type="email"
        value={email}
        onChange={onChange}
        error={error}
        autoComplete="email"
        icon="email"
      />

      <div className="rounded-[20px] border border-cyan-400/15 bg-cyan-400/[0.06] p-4 text-sm leading-6 text-slate-300">
        We will send a secure reset link to your email so you can get back in quickly.
      </div>

      <Button onClick={onSubmit} loading={loading}>
        Send Reset Link
      </Button>
    </div>
  )
}
