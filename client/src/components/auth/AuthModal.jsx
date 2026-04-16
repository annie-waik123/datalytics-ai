'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import ForgotPassword from '../../auth/ForgotPassword.jsx'
import Login from '../../auth/Login.jsx'
import OTPVerification from '../../auth/OTPVerification.jsx'
import Signup from '../../auth/Signup.jsx'
import Toast from './Toast.jsx'

const VIEW_COPY = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Launch your AI workspace in seconds',
    description: 'Secure access, premium onboarding, and your latest dashboards waiting behind one sign-in.',
  },
  signup: {
    eyebrow: 'Create account',
    title: 'Start with a premium SaaS onboarding flow',
    description: 'Create your workspace, set your role, verify with OTP, and jump straight into Datalytics.',
  },
  forgot: {
    eyebrow: 'Reset access',
    title: 'Recover your account without friction',
    description: 'We will send a secure password reset email so you can get back in quickly.',
  },
  otp: {
    eyebrow: 'Final step',
    title: 'Verify your email with OTP',
    description: 'This one-time check protects your workspace before we unlock the dashboard.',
  },
}

function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email)
}

function useToasts(open) {
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!open) {
      setItems([])
    }
  }, [open])

  function push(message, tone = 'info') {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setItems((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 4200)
  }

  return {
    items,
    push,
  }
}

export default function AuthModal({
  open,
  initialView = 'signup',
  onClose,
  onAuthenticated,
}) {
  const {
    profile,
    loadingAction,
    firebaseReady,
    firebaseSetupMessage,
    loginWithEmail,
    loginWithGoogle,
    logout,
    resendOtp,
    sendResetLink,
    signUpWithEmail,
    verifyOtp,
  } = useAuth()
  const [view, setView] = useState(initialView)
  const [loginRole, setLoginRole] = useState('Data Analyst')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Data Analyst',
  })
  const [forgotEmail, setForgotEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [otpMeta, setOtpMeta] = useState({ previewCode: '', email: '', fullName: '' })
  const [cooldown, setCooldown] = useState(30)
  const { items, push } = useToasts(open)

  useEffect(() => {
    if (!open) return
    const nextView = profile && !profile.verified ? 'otp' : initialView
    setView(nextView)
    setErrors({})
    if (profile?.email && !profile?.verified) {
      setOtpMeta({
        previewCode: '',
        email: profile.email,
        fullName: profile.fullName,
      })
      setCooldown(30)
    }
  }, [open, initialView, profile])

  useEffect(() => {
    if (!(open && view === 'otp' && cooldown > 0)) return undefined
    const timer = window.setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [open, view, cooldown])

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const copy = VIEW_COPY[view]
  const currentName = otpMeta.fullName || profile?.fullName || signupForm.fullName

  const loadingMap = useMemo(
    () => ({
      login: loadingAction === 'login',
      signup: loadingAction === 'signup',
      google: loadingAction === 'google',
      forgot: loadingAction === 'forgot-password',
      verify: loadingAction === 'verify-otp',
    }),
    [loadingAction]
  )

  function updateLoginForm(event) {
    const { name, value } = event.target
    setLoginForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function updateSignupForm(event) {
    const { name, value } = event.target
    setSignupForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function validateLogin() {
    const nextErrors = {}
    if (!validateEmail(loginForm.email)) nextErrors.email = 'Enter a valid email address.'
    if (!loginForm.password) nextErrors.password = 'Password is required.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function validateSignup() {
    const nextErrors = {}
    if (!signupForm.fullName.trim()) nextErrors.fullName = 'Your full name is required.'
    if (!validateEmail(signupForm.email)) nextErrors.email = 'Enter a valid email address.'
    if (signupForm.password.length < 6) nextErrors.password = 'Use at least 6 characters.'
    if (signupForm.password !== signupForm.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    if (!signupForm.role) nextErrors.role = 'Choose a role for your workspace.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleLogin() {
    if (!validateLogin()) return

    try {
      const response = await loginWithEmail(loginForm)
      if (response.requiresOtp) {
        setOtpMeta({
          previewCode: response.otpResult?.preview_code || '',
          email: response.profile.email,
          fullName: response.profile.fullName,
        })
        setCooldown(30)
        setView('otp')
        push('Email abhi verify nahi hui. OTP verification continue karein.', 'warning')
        return
      }

      push(`Welcome back, ${response.profile.fullName} 👋`, 'success')
      window.setTimeout(() => {
        onAuthenticated?.(response.profile)
      }, 600)
    } catch (error) {
      push(error.message, 'error')
    }
  }

  async function handleSignup() {
    if (!validateSignup()) return

    try {
      const response = await signUpWithEmail(signupForm)
      setOtpMeta({
        previewCode: response.otpResult?.preview_code || '',
        email: response.profile.email,
        fullName: response.profile.fullName,
      })
      setCooldown(30)
      setView('otp')
      push('OTP sent successfully. Verify to finish onboarding.', 'success')
    } catch (error) {
      push(error.message, 'error')
    }
  }

  async function handleGoogle() {
    try {
      const response = await loginWithGoogle(view === 'signup' ? signupForm.role : loginRole)
      push(
        response.isNewUser
          ? `Welcome, ${response.profile.fullName} 🎉 Your account is ready!`
          : `Welcome back, ${response.profile.fullName} 👋`,
        'success'
      )
      window.setTimeout(() => {
        onAuthenticated?.(response.profile)
      }, 600)
    } catch (error) {
      push(error.message, 'error')
    }
  }

  async function handleForgot() {
    const nextErrors = {}
    if (!validateEmail(forgotEmail)) {
      nextErrors.forgotEmail = 'Enter a valid email address.'
      setErrors(nextErrors)
      return
    }

    try {
      await sendResetLink(forgotEmail)
      push('Password reset email sent successfully.', 'success')
      window.setTimeout(() => {
        setView('login')
      }, 700)
    } catch (error) {
      push(error.message, 'error')
    }
  }

  async function handleVerifyOtp(code) {
    try {
      const response = await verifyOtp(code)
      push(`Welcome, ${response.profile.fullName} 🎉 Your account is ready!`, 'success')
      window.setTimeout(() => {
        onAuthenticated?.(response.profile)
      }, 650)
    } catch (error) {
      push(error.message, 'error')
    }
  }

  async function handleResendOtp() {
    try {
      const response = await resendOtp()
      setOtpMeta((current) => ({
        ...current,
        previewCode: response?.preview_code || '',
      }))
      setCooldown(30)
      push('A fresh OTP has been sent to your email.', 'info')
    } catch (error) {
      push(error.message, 'error')
    }
  }

  async function handleClose() {
    if (profile && !profile.verified) {
      await logout()
    }
    onClose?.()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="auth-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-md"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            handleClose()
          }
        }}
      >
        <Toast items={items} />

        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          className="relative grid w-full max-w-6xl overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(160deg,rgba(6,10,24,0.96),rgba(10,16,35,0.94))] shadow-[0_40px_120px_rgba(2,6,23,0.72)] lg:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.18),_transparent_22%)]" />

          <div className="relative hidden overflow-hidden border-r border-white/10 p-10 lg:flex lg:flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-end justify-center gap-1 rounded-2xl bg-white/[0.08]">
                <span className="h-4 w-1 rounded-full bg-orange-400" />
                <span className="h-6 w-1 rounded-full bg-amber-300" />
                <span className="h-5 w-1 rounded-full bg-cyan-300" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Datalytics</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Premium onboarding</h2>
              </div>
            </div>

            <div className="mt-14 max-w-xl space-y-6">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-200/80">{copy.eyebrow}</p>
              <h3 className="text-5xl font-semibold leading-[1.02] tracking-tight text-white">
                {copy.title}
              </h3>
              <p className="max-w-lg text-base leading-7 text-slate-300/85">{copy.description}</p>
            </div>

            <div className="mt-10 grid gap-4">
              {[
                'Google auth + email/password in one polished flow',
                'OTP verification, welcome mail, and secure auto-login',
                'User role saved under the profile across the dashboard',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </div>
                  <p className="text-sm leading-6 text-slate-200">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Launch checklist</p>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                <span>Authentication</span>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-200">Ready</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                <span>Verification</span>
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-100">OTP enabled</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                <span>Experience</span>
                <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-100">SaaS motion UI</span>
              </div>
            </div>
          </div>

          <div className="relative p-5 sm:p-8 lg:p-10">
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 transition hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>

            <div className="mx-auto max-w-xl">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 items-end justify-center gap-1 rounded-2xl bg-white/[0.08]">
                  <span className="h-4 w-1 rounded-full bg-orange-400" />
                  <span className="h-6 w-1 rounded-full bg-amber-300" />
                  <span className="h-5 w-1 rounded-full bg-cyan-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Datalytics</p>
                  <p className="text-sm text-slate-300">Secure onboarding</p>
                </div>
              </div>

              <div className="mt-10 space-y-3">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{copy.eyebrow}</p>
                <h3 className="text-3xl font-semibold tracking-tight text-white">{copy.title}</h3>
                <p className="max-w-xl text-sm leading-6 text-slate-400">{copy.description}</p>
              </div>

              {!firebaseReady ? (
                <div className="mt-5 rounded-[22px] border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50">
                  {firebaseSetupMessage}
                </div>
              ) : null}

              {view === 'login' || view === 'signup' ? (
                <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
                  {[
                    { id: 'login', label: 'Login' },
                    { id: 'signup', label: 'Sign Up' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setView(item.id)
                        setErrors({})
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        view === item.id
                          ? 'bg-white text-slate-950 shadow-[0_10px_24px_rgba(255,255,255,0.14)]'
                          : 'text-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={view}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.18 }}
                  >
                    {view === 'login' ? (
                      <Login
                        form={loginForm}
                        errors={errors}
                        role={loginRole}
                        loading={loadingMap.login}
                        googleLoading={loadingMap.google}
                        onChange={updateLoginForm}
                        onRoleChange={(event) => setLoginRole(event.target.value)}
                        onSubmit={handleLogin}
                        onForgot={() => {
                          setErrors({})
                          setView('forgot')
                        }}
                        onGoogle={handleGoogle}
                      />
                    ) : null}

                    {view === 'signup' ? (
                      <Signup
                        form={signupForm}
                        errors={errors}
                        loading={loadingMap.signup}
                        googleLoading={loadingMap.google}
                        onChange={updateSignupForm}
                        onSubmit={handleSignup}
                        onGoogle={handleGoogle}
                      />
                    ) : null}

                    {view === 'forgot' ? (
                      <ForgotPassword
                        email={forgotEmail}
                        error={errors.forgotEmail}
                        loading={loadingMap.forgot}
                        onChange={(event) => {
                          setForgotEmail(event.target.value)
                          setErrors((current) => ({ ...current, forgotEmail: '' }))
                        }}
                        onSubmit={handleForgot}
                      />
                    ) : null}

                    {view === 'otp' ? (
                      <OTPVerification
                        email={otpMeta.email || profile?.email || loginForm.email || signupForm.email}
                        fullName={currentName}
                        loading={loadingMap.verify}
                        cooldown={cooldown}
                        previewCode={otpMeta.previewCode}
                        onSubmit={handleVerifyOtp}
                        onResend={handleResendOtp}
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                <div>
                  {view === 'forgot' ? (
                    <button type="button" onClick={() => setView('login')} className="transition hover:text-white">
                      Back to login
                    </button>
                  ) : view === 'otp' ? (
                    <span>Verification protected by one-time email code</span>
                  ) : (
                    <span>
                      {view === 'login' ? 'New here?' : 'Already have an account?'}{' '}
                      <button
                        type="button"
                        onClick={() => setView(view === 'login' ? 'signup' : 'login')}
                        className="font-medium text-white underline-offset-4 transition hover:underline"
                      >
                        {view === 'login' ? 'Create account' : 'Log in'}
                      </button>
                    </span>
                  )}
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                  Start Analyzing
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
