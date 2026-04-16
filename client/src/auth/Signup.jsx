'use client'

import Button from '../components/auth/Button.jsx'
import InputField from '../components/auth/InputField.jsx'
import GoogleAuthButton from './GoogleAuthButton.jsx'
import { ROLE_OPTIONS } from './profileStore.js'

export default function Signup({
  form,
  errors,
  loading,
  googleLoading,
  onChange,
  onSubmit,
  onGoogle,
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label="Full name"
          name="fullName"
          value={form.fullName}
          onChange={onChange}
          error={errors.fullName}
          autoComplete="name"
          icon="user"
        />
        <InputField
          label="Role"
          name="role"
          as="select"
          value={form.role}
          onChange={onChange}
          error={errors.role}
          icon="briefcase"
        >
          {ROLE_OPTIONS.map((item) => (
            <option key={item} value={item} className="bg-slate-950">
              {item}
            </option>
          ))}
        </InputField>
      </div>

      <div className="space-y-4">
        <InputField
          label="Email address"
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          error={errors.email}
          autoComplete="email"
          icon="email"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            error={errors.password}
            autoComplete="new-password"
            icon="lock"
          />
          <InputField
            label="Confirm password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={onChange}
            error={errors.confirmPassword}
            autoComplete="new-password"
            icon="lock"
          />
        </div>
      </div>

      <Button type="submit" onClick={onSubmit} loading={loading}>
        Create Account
      </Button>

      <div className="space-y-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          Or sign up instantly
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <GoogleAuthButton loading={googleLoading} onClick={onGoogle} role={form.role} />
      </div>
    </div>
  )
}
