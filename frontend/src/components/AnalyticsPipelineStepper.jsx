'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'

export const ANALYTICS_PIPELINE_STEPS = [
  {
    id: 'upload',
    icon: '🔍',
    label: 'Dataset Upload',
    description: 'Import, validate, and profile your source dataset.',
  },
  {
    id: 'preparation',
    icon: '🧹',
    label: 'Data Preparation',
    description: 'Clean columns, standardize fields, and fix missing values.',
  },
  {
    id: 'exploration',
    icon: '📊',
    label: 'Data Exploration',
    description: 'Profile distributions, correlations, and data quality signals.',
  },
  {
    id: 'visualization',
    icon: '📈',
    label: 'Visualization',
    description: 'Render charts and surface the strongest visual takeaways.',
  },
  {
    id: 'prediction',
    icon: '🤖',
    label: 'Prediction',
    description: 'Prepare features and run predictive modeling workflows.',
  },
  {
    id: 'powerbi',
    icon: '📊⚡',
    label: 'Auto Power BI Dashboard',
    description: 'Compose a polished dashboard-ready analytics view.',
  },
  {
    id: 'recommendations',
    icon: '💡',
    label: 'Recommendations & Insights',
    description: 'Translate findings into next-best actions and decisions.',
  },
  {
    id: 'reports',
    icon: '📄',
    label: 'Reports',
    description: 'Generate shareable summaries for stakeholders and teams.',
  },
  {
    id: 'aiInsights',
    icon: '🧠',
    label: 'AI Insights',
    description: 'Draft an AI-assisted narrative around the final analysis.',
  },
]

function clampStep(step, total) {
  if (typeof step !== 'number' || Number.isNaN(step)) return 0
  return Math.min(Math.max(step, 0), Math.max(total - 1, 0))
}

function progressForStep(index, total) {
  if (total <= 1) return 100
  return Math.round((index / (total - 1)) * 100)
}

function themeClasses(theme) {
  if (theme === 'light') {
    return {
      shell: 'bg-[radial-gradient(circle_at_top,_rgba(255,106,0,0.18),_transparent_28%),linear-gradient(180deg,_#fff8f1_0%,_#fffdf9_48%,_#f5efe6_100%)] text-slate-950',
      frame: 'border-slate-200/80 bg-white/92 shadow-[0_32px_80px_rgba(15,23,42,0.12)]',
      rail: 'bg-slate-200/90',
      railFill: 'bg-gradient-to-r from-[#ff6a00] to-[#ff8c3b]',
      heading: 'text-slate-950',
      subtext: 'text-slate-600',
      meta: 'border-slate-200/80 bg-white text-slate-500',
      bar: 'bg-slate-200/90',
      percent: 'text-slate-600',
      labelIdle: 'text-slate-400',
      labelDone: 'text-slate-600',
      labelActive: 'text-slate-950',
      circleIdle: 'border-slate-200 bg-slate-100 text-slate-400',
      circleDone: 'border-emerald-200 bg-emerald-50 text-emerald-600 shadow-[0_16px_35px_rgba(16,185,129,0.18)]',
      circleActive: 'border-[#ffb47a] bg-[#ff6a00] text-white shadow-[0_0_0_8px_rgba(255,106,0,0.12),0_18px_42px_rgba(255,106,0,0.35)]',
      iconActive: 'text-white',
      spinner: 'border-white/25 border-t-white',
      tooltip: 'border-slate-200 bg-white text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.12)]',
      badge: 'border-[#ffd2b0] bg-[#fff1e8] text-[#b64b00]',
      backdrop: 'before:bg-[radial-gradient(circle_at_15%_15%,rgba(255,106,0,0.16),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(15,23,42,0.08),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(255,106,0,0.08),transparent_30%)]',
    }
  }

  return {
    shell: 'bg-[radial-gradient(circle_at_top,_rgba(255,106,0,0.14),_transparent_24%),linear-gradient(180deg,_#0b1017_0%,_#111827_52%,_#0a0f18_100%)] text-white',
    frame: 'border-white/10 bg-[#0f1720]/96 shadow-[0_34px_90px_rgba(0,0,0,0.42)]',
    rail: 'bg-white/10',
    railFill: 'bg-gradient-to-r from-[#ff6a00] to-[#ff934d]',
    heading: 'text-white',
    subtext: 'text-slate-300',
    meta: 'border-white/10 bg-white/[0.04] text-slate-300',
    bar: 'bg-white/10',
    percent: 'text-slate-300',
    labelIdle: 'text-slate-500',
    labelDone: 'text-slate-300',
    labelActive: 'text-white',
    circleIdle: 'border-white/10 bg-white/[0.04] text-slate-500',
    circleDone: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200 shadow-[0_18px_40px_rgba(16,185,129,0.12)]',
    circleActive: 'border-[#ff9b4f] bg-[#ff6a00] text-white shadow-[0_0_0_8px_rgba(255,106,0,0.12),0_20px_45px_rgba(255,106,0,0.35)]',
    iconActive: 'text-white',
    spinner: 'border-white/20 border-t-white',
    tooltip: 'border-white/10 bg-[#121b24] text-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.35)]',
    badge: 'border-[#5b2d13] bg-[#24150d] text-[#ffb985]',
    backdrop: 'before:bg-[radial-gradient(circle_at_15%_15%,rgba(255,106,0,0.15),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.05),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(255,106,0,0.08),transparent_30%)]',
  }
}

function StepIcon({ step, status }) {
  if (status === 'done') {
    return (
      <motion.span
        initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="text-lg font-semibold"
      >
        ✔
      </motion.span>
    )
  }

  return <span className="text-lg sm:text-xl">{step.icon}</span>
}

export default function AnalyticsPipelineStepper({
  steps = ANALYTICS_PIPELINE_STEPS,
  currentStep,
  autoPlay = currentStep == null,
  stepDuration = 1400,
  onStepChange,
  onComplete,
  theme = 'system',
  title = 'Analyzing Your Data...',
  subtitle = 'This may take a few seconds',
  showProgressBar = true,
  showMeta = true,
  fullscreen = true,
  className = '',
}) {
  const totalSteps = steps.length
  const [internalStep, setInternalStep] = useState(clampStep(currentStep ?? 0, totalSteps))
  const [resolvedTheme, setResolvedTheme] = useState(theme === 'light' ? 'light' : 'dark')
  const [hoveredStep, setHoveredStep] = useState(null)
  const completionTimer = useRef(null)
  const onStepChangeRef = useRef(onStepChange)
  const onCompleteRef = useRef(onComplete)
  const progressId = useId()

  const activeStep = currentStep == null ? internalStep : clampStep(currentStep, totalSteps)
  const progress = progressForStep(activeStep, totalSteps)
  const palette = themeClasses(resolvedTheme)

  useEffect(() => {
    setInternalStep(clampStep(currentStep ?? 0, totalSteps))
  }, [currentStep, totalSteps])

  useEffect(() => {
    onStepChangeRef.current = onStepChange
    onCompleteRef.current = onComplete
  }, [onComplete, onStepChange])

  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') {
      setResolvedTheme(theme === 'light' ? 'light' : 'dark')
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: light)')
    const syncTheme = () => setResolvedTheme(media.matches ? 'light' : 'dark')

    syncTheme()
    media.addEventListener('change', syncTheme)
    return () => media.removeEventListener('change', syncTheme)
  }, [theme])

  useEffect(() => {
    onStepChangeRef.current?.(activeStep, steps[activeStep])
  }, [activeStep, steps])

  useEffect(() => {
    window.clearTimeout(completionTimer.current)

    if (!autoPlay || currentStep != null || totalSteps <= 1) {
      return () => window.clearTimeout(completionTimer.current)
    }

    if (internalStep >= totalSteps - 1) {
      completionTimer.current = window.setTimeout(() => onCompleteRef.current?.(), Math.max(stepDuration * 0.85, 600))
      return () => window.clearTimeout(completionTimer.current)
    }

    completionTimer.current = window.setTimeout(() => {
      setInternalStep((prev) => clampStep(prev + 1, totalSteps))
    }, stepDuration)

    return () => window.clearTimeout(completionTimer.current)
  }, [autoPlay, currentStep, internalStep, stepDuration, totalSteps])

  const shellClasses = fullscreen
    ? 'relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-10'
    : 'relative isolate flex w-full items-center justify-center overflow-hidden rounded-[32px] px-4 py-10 sm:px-6'

  return (
    <section className={`${shellClasses} ${palette.shell} ${palette.backdrop} ${className}`}>
      <div className="pointer-events-none absolute inset-0 before:absolute before:inset-0 before:content-['']" />

      <div className={`relative z-10 w-full max-w-7xl rounded-[32px] border p-6 sm:p-8 lg:p-12 ${palette.frame}`}>
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className={`mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] ${palette.badge}`}
          >
            <span className="h-2 w-2 rounded-full bg-[#ff6a00]" />
            Analytics Pipeline
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.04, ease: 'easeOut' }}
            className={`text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl ${palette.heading}`}
          >
            {title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
            className={`mx-auto mt-4 max-w-2xl text-sm sm:text-base ${palette.subtext}`}
          >
            {subtitle}
          </motion.p>

          {showMeta ? (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12, ease: 'easeOut' }}
              className={`mx-auto mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm ${palette.meta}`}
            >
              <span>{progress}% complete</span>
              <span className="hidden h-1 w-1 rounded-full bg-current/50 sm:block" />
              <span>
                Step {activeStep + 1} of {totalSteps}
              </span>
            </motion.div>
          ) : null}
        </div>

        <div className="overflow-x-auto pb-3">
          <div className="mx-auto flex min-w-max items-start justify-center px-2 sm:px-4">
            {steps.map((step, index) => {
              const status = index < activeStep ? 'done' : index === activeStep ? 'active' : 'idle'
              const isHovered = hoveredStep === index
              const connectorFill = index < activeStep ? '100%' : '0%'
              const circleClasses =
                status === 'done'
                  ? palette.circleDone
                  : status === 'active'
                    ? palette.circleActive
                    : palette.circleIdle
              const labelClasses =
                status === 'done'
                  ? palette.labelDone
                  : status === 'active'
                    ? palette.labelActive
                    : palette.labelIdle

              return (
                <div key={step.id} className="flex items-start">
                  <div className="relative flex min-w-[110px] flex-col items-center text-center sm:min-w-[128px] lg:min-w-[136px]">
                    <AnimatePresence>
                      {isHovered ? (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.96 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className={`absolute -top-20 z-20 hidden max-w-[180px] rounded-2xl border px-3 py-2 text-left text-xs leading-5 sm:block ${palette.tooltip}`}
                        >
                          {step.description}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <motion.button
                      type="button"
                      title={step.description}
                      onMouseEnter={() => setHoveredStep(index)}
                      onMouseLeave={() => setHoveredStep(null)}
                      onFocus={() => setHoveredStep(index)}
                      onBlur={() => setHoveredStep(null)}
                      className="group flex flex-col items-center gap-3 outline-none"
                      whileHover={{ y: -2 }}
                      whileFocus={{ y: -2 }}
                    >
                      <motion.div
                        animate={
                          status === 'active'
                            ? { scale: [1, 1.05, 1] }
                            : { scale: 1 }
                        }
                        transition={
                          status === 'active'
                            ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                            : { duration: 0.2 }
                        }
                        className={`relative flex h-14 w-14 items-center justify-center rounded-full border text-lg transition-colors duration-300 sm:h-16 sm:w-16 ${circleClasses}`}
                      >
                        {status === 'active' ? (
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                            className={`absolute inset-[8px] rounded-full border-2 ${palette.spinner}`}
                          />
                        ) : null}

                        <span className={`relative z-10 ${status === 'active' ? palette.iconActive : ''}`}>
                          <StepIcon step={step} status={status} />
                        </span>
                      </motion.div>

                      <div className="space-y-1">
                        <div className={`text-sm font-medium leading-5 sm:text-[15px] ${labelClasses}`}>{step.label}</div>
                        <div className={`mx-auto max-w-[144px] text-xs leading-5 sm:hidden ${palette.subtext}`}>
                          {step.description}
                        </div>
                      </div>
                    </motion.button>
                  </div>

                  {index < steps.length - 1 ? (
                    <div className="flex w-10 items-center pt-7 sm:w-16 sm:pt-8 lg:w-20">
                      <div className={`relative h-[3px] w-full overflow-hidden rounded-full ${palette.rail}`}>
                        <motion.div
                          initial={false}
                          animate={{ width: connectorFill }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className={`h-full rounded-full ${palette.railFill}`}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {showProgressBar ? (
          <div className="mx-auto mt-10 max-w-3xl">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className={palette.percent}>Pipeline progress</span>
              <span className={palette.percent} aria-live="polite">
                {progress}%
              </span>
            </div>
            <div
              className={`h-2 overflow-hidden rounded-full ${palette.bar}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-labelledby={progressId}
            >
              <motion.div
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className={`h-full rounded-full ${palette.railFill}`}
              />
            </div>
            <p id={progressId} className={`mt-3 text-xs sm:text-sm ${palette.percent}`}>
              {steps[activeStep]?.description}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
