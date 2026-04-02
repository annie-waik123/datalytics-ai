'use client'

import Button from '../components/auth/Button.jsx'
import InputField from '../components/auth/InputField.jsx'
import GoogleAuthButton from './GoogleAuthButton.jsx'
import { ROLE_OPTIONS } from './profileStore.js'

export default function Login({
  form,
  errors,
  loading,
  googleLoading,
  role,
  onChange,
  onRoleChange,
  onSubmit,
  onForgot,
  onGoogle,
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <InputField
          label="Work email"
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          error={errors.email}
          autoComplete="email"
          icon="email"
        />
        <InputField
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={onChange}
          error={errors.password}
          autoComplete="current-password"
          icon="lock"
        />
      </div>

      <div className="space-y-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
        <InputField
          label="Workspace role"
          name="role"
          as="select"
          value={role}
          onChange={onRoleChange}
          icon="briefcase"
        >
          {ROLE_OPTIONS.map((item) => (
            <option key={item} value={item} className="bg-slate-950">
              {item}
            </option>
          ))}
        </InputField>
        <GoogleAuthButton loading={googleLoading} onClick={onGoogle} role={role} />
      </div>

      <Button type="submit" onClick={onSubmit} loading={loading}>
        Log In
      </Button>

      <button
        type="button"
        onClick={onForgot}
        className="w-full text-center text-sm text-slate-300 transition hover:text-white"
      >
        Forgot password?
      </button>
    </div>
  )
}
