'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
// import { useAuth } from '../../auth/AuthContext.jsx'
import { buildProfileWorkspaceModel } from './profileWorkspaceData.js'

const WORK_TABS = [
  { key: 'datasets', label: 'Datasets' },
  { key: 'models', label: 'Models' },
  { key: 'dashboards', label: 'Dashboards' },
  { key: 'reports', label: 'Reports' },
]

const STATUS_STYLES = {
  Active: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  Processing: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30',
  Failed: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30',
  Paid: 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30',
}

function cx(...values) {
  return values.filter(Boolean).join(' ')
}

function Icon({ name, className = 'h-5 w-5' }) {
  const shared = { className, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', strokeWidth: 1.8 }

  switch (name) {
    case 'dataset':
      return <svg {...shared}><path d="M4 7.5C4 6.1 7.6 5 12 5s8 1.1 8 2.5S16.4 10 12 10 4 8.9 4 7.5Zm0 4.5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5m-16 4.5C4 17.9 7.6 19 12 19s8-1.1 8-2.5" /></svg>
    case 'model':
      return <svg {...shared}><path d="M5 12.5 12 5l7 7.5M8 15l4-4 4 4M6 19h12" /></svg>
    case 'dashboard':
      return <svg {...shared}><path d="M4 19h16M7 17V9m5 8V5m5 12v-6" /></svg>
    case 'report':
      return <svg {...shared}><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M9 12h6M9 16h4" /></svg>
    case 'query':
      return <svg {...shared}><path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L20 20" /></svg>
    case 'success':
      return <svg {...shared}><path d="m5 13 4 4L19 7" /></svg>
    case 'shield':
      return <svg {...shared}><path d="M12 3c2.5 2 5.5 3 8 3v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6c2.5 0 5.5-1 8-3Z" /></svg>
    case 'spark':
      return <svg {...shared}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /></svg>
    case 'credit':
      return <svg {...shared}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>
    case 'logout':
      return <svg {...shared}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>
    case 'moon':
      return <svg {...shared}><path d="M20 14.2A8 8 0 1 1 9.8 4 6.2 6.2 0 0 0 20 14.2Z" /></svg>
    default:
      return <svg {...shared}><circle cx="12" cy="12" r="7" /></svg>
  }
}

function MiniSparkline({ values = [], tone = 'from-cyan-400 to-sky-500' }) {
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100
    const y = 100 - (((value - min) / spread) * 70 + 15)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className={cx('rounded-2xl bg-gradient-to-r p-[1px]', tone)}>
      <svg viewBox="0 0 100 100" className="h-14 w-full rounded-[15px] bg-slate-950/70 p-2">
        <polyline
          fill="none"
          stroke="url(#sparklineGradient)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
          points={points}
        />
        <defs>
          <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

function StatusBadge({ value }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_STYLES[value] || 'bg-white/10 text-slate-200 ring-1 ring-white/10')}>
      {value}
    </span>
  )
}

function SectionHeader({ eyebrow, title, copy, action, darkMode = true }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">{eyebrow}</p> : null}
        <h2 className={cx('mt-2 text-2xl font-semibold tracking-tight', darkMode ? 'text-white' : 'text-slate-950')}>{title}</h2>
        {copy ? <p className={cx('mt-2 max-w-2xl text-sm', darkMode ? 'text-slate-300/80' : 'text-slate-600')}>{copy}</p> : null}
      </div>
      {action}
    </div>
  )
}

function StatCard({ metric }) {
  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_24px_60px_rgba(3,7,18,0.45)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.2),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.18),_transparent_35%)] opacity-70" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-300">
          <Icon name={metric.icon} className="h-5 w-5" />
        </div>
        <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', metric.trend?.direction === 'down' ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300')}>
          {metric.trend?.direction === 'down' ? '-' : '+'}
          {metric.trend?.value}
        </span>
      </div>
      <div className="relative mt-5 space-y-1">
        <p className="text-sm text-slate-300/75">{metric.label}</p>
        <p className="text-3xl font-semibold tracking-tight text-white">{metric.value}</p>
      </div>
      <div className="relative mt-5">
        <MiniSparkline values={metric.sparkline} />
      </div>
    </article>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={cx('relative mt-1 inline-flex h-7 w-12 items-center rounded-full border transition', checked ? 'border-cyan-400/40 bg-cyan-400/20' : 'border-white/10 bg-slate-900/80')}
      >
        <span className={cx('inline-block h-5 w-5 rounded-full bg-white transition', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </label>
  )
}

function WorkTable({ items, page, onOpen, onShare, onDownload, onDelete }) {
  if (!items.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 px-6 py-10 text-center">
        <p className="text-base font-medium text-white">No matching items</p>
        <p className="mt-2 text-sm text-slate-400">Try changing the search term or status filter to surface more workspace assets.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60">
      <div className="hidden grid-cols-[1.7fr_repeat(3,minmax(0,1fr))_1.2fr] gap-4 border-b border-white/10 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 lg:grid">
        <span>Name</span>
        <span>Created</span>
        <span>Last Modified</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      <div className="divide-y divide-white/8">
        {items.map((item) => (
          <div key={item.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.7fr_repeat(3,minmax(0,1fr))_1.2fr] lg:items-center">
            <div>
              <p className="font-medium text-white">{item.name}</p>
              <p className="mt-1 text-xs text-slate-400">{item.type}</p>
            </div>
            <p className="text-sm text-slate-300">{item.createdDate}</p>
            <p className="text-sm text-slate-300">{item.lastModified}</p>
            <div><StatusBadge value={item.status} /></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onOpen(item)} className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20">Open</button>
              <button type="button" onClick={() => onDownload(item)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/25">Download</button>
              <button type="button" onClick={() => onShare(item)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/25">Share</button>
              <button type="button" onClick={() => onDelete(item)} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20">Delete</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 text-sm text-slate-400">
        <span>Page {page}</span>
        <span>{items.length} items on this page</span>
      </div>
    </div>
  )
}

function ExpandableList({ items, expanded, onToggle, badgeLabel }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = Boolean(expanded[item.id])
        return (
          <article key={item.id} className="rounded-[24px] border border-white/10 bg-slate-950/65 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {badgeLabel ? <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">{badgeLabel}</span> : null}
                  {item.severity ? <StatusBadge value={item.severity === 'high' ? 'Failed' : item.severity === 'positive' ? 'Active' : 'Processing'} /> : null}
                </div>
                <p className="mt-3 text-base font-medium text-white">{item.title || item.query}</p>
                <p className="mt-1 text-sm text-slate-400">{item.summary || item.time}</p>
              </div>
              <button type="button" onClick={() => onToggle(item.id)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200">
                {isOpen ? 'Hide' : 'View'}
              </button>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">{item.time}</p>
            {isOpen ? <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-300">{item.details}</p> : null}
          </article>
        )
      })}
    </div>
  )
}

function ThemeCard({ darkMode, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cx('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition', darkMode ? 'border-white/10 bg-white/5 text-slate-100 hover:border-cyan-400/30' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300')}
    >
      <Icon name="moon" className="h-4 w-4" />
      {darkMode ? 'Light Mode' : 'Dark Mode'}
    </button>
  )
}

export default function UserProfileStep({
  authProfile,
  dataset,
  datasetProfile,
  savedCharts,
  dashboardState,
  predictionStatus,
  completedSteps,
  onNavigate,
}) {
  const router = useRouter()
  // const { logout } = useAuth()
  const [darkMode, setDarkMode] = useState(true)
  const [loading, setLoading] = useState(true)
  const [workTab, setWorkTab] = useState('datasets')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [expandedInsights, setExpandedInsights] = useState({})
  const [expandedChat, setExpandedChat] = useState({})
  const [expandedQueries, setExpandedQueries] = useState({})
  const [saveState, setSaveState] = useState('idle')
  const [settings, setSettings] = useState({
    fullName: authProfile?.fullName || 'Datalytics User',
    email: authProfile?.email || 'workspace@datalytics.ai',
    language: 'English (India)',
    privacy: true,
    emailNotifications: true,
    pushNotifications: false,
    twoFactor: true,
  })
  const [apiKey, setApiKey] = useState('dl_prod_9fb2_****_x8sk')

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('datalytics-profile-theme')
    if (savedTheme) setDarkMode(savedTheme === 'dark')
    const timer = window.setTimeout(() => setLoading(false), 450)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('datalytics-profile-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!authProfile) return
    setSettings((current) => ({
      ...current,
      fullName: authProfile.fullName || current.fullName,
      email: authProfile.email || current.email,
    }))
  }, [authProfile])

  const model = buildProfileWorkspaceModel({
    authProfile,
    dataset,
    datasetProfile,
    savedCharts,
    dashboardState,
    predictionStatus,
    completedSteps,
  })

  const activeItems = model.work[workTab] || []
  const filteredItems = activeItems.filter((item) => {
    const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter
    const matchesType = typeFilter === 'All' || item.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / 4))
  const pagedItems = filteredItems.slice((page - 1) * 4, page * 4)
  const uniqueTypes = ['All', ...new Set(activeItems.map((item) => item.type))]

  useEffect(() => {
    setPage(1)
  }, [workTab, searchTerm, statusFilter, typeFilter])

  function toggleExpanded(setter, id) {
    setter((current) => ({ ...current, [id]: !current[id] }))
  }

  function flashSavedState() {
    setSaveState('saved')
    window.setTimeout(() => setSaveState('idle'), 1800)
  }

  async function handleLogout() {
    // await logout()
    router.replace('/')
  }

  function handleNavigateFromItem(item) {
    if (!onNavigate) return
    const targetByTab = {
      datasets: 'upload',
      models: 'prediction',
      dashboards: 'powerbi',
      reports: 'reports',
    }
    onNavigate(targetByTab[workTab] || 'upload')
  }

  const shellClass = darkMode
    ? 'bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.14),_transparent_30%),linear-gradient(180deg,#09111f_0%,#0b1324_100%)] text-white'
    : 'bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(251,146,60,0.12),_transparent_32%),linear-gradient(180deg,#f5f9ff_0%,#eef4ff_100%)] text-slate-950'
  const cardClass = darkMode ? 'border-white/10 bg-slate-950/65 shadow-[0_24px_60px_rgba(3,7,18,0.45)]' : 'border-slate-200/80 bg-white/80 shadow-[0_24px_60px_rgba(148,163,184,0.2)]'
  const inputClass = darkMode
    ? 'border-white/10 bg-white/5 text-white placeholder:text-slate-500'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'

  if (loading) {
    return (
      <div className={cx('min-h-[calc(100vh-9rem)] rounded-[32px] border p-4 md:p-6', shellClass, darkMode ? 'border-white/10' : 'border-slate-200/80')}>
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="animate-pulse space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="h-5 w-40 rounded-full bg-white/10" />
            <div className="h-10 w-72 rounded-full bg-white/10" />
            <div className="h-20 rounded-[24px] bg-white/10" />
          </div>
          <div className="animate-pulse rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="h-full rounded-[24px] bg-white/10" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cx('min-h-[calc(100vh-8rem)] rounded-[32px] border p-4 md:p-6 xl:p-7', shellClass, darkMode ? 'border-white/10' : 'border-slate-200/80')}>
      <section className={cx('relative overflow-hidden rounded-[32px] border p-6 md:p-8', cardClass)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.18),_transparent_28%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-orange-400 via-amber-500 to-cyan-400 text-2xl font-bold text-slate-950 shadow-[0_20px_40px_rgba(56,189,248,0.35)]">
                {model.profile.initials}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className={cx('text-3xl font-semibold tracking-tight', darkMode ? 'text-white' : 'text-slate-950')}>{model.profile.fullName}</h1>
                  <span className={cx('rounded-full px-3 py-1 text-xs font-semibold', darkMode ? 'bg-white/8 text-slate-200 ring-1 ring-white/10' : 'bg-slate-900 text-white')}>{model.profile.role}</span>
                  <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/20">{model.profile.plan}</span>
                </div>
                <p className={cx('mt-2 text-sm', darkMode ? 'text-slate-300/80' : 'text-slate-600')}>{model.profile.headline}</p>
                <div className={cx('mt-3 flex flex-wrap items-center gap-3 text-sm', darkMode ? 'text-slate-300/80' : 'text-slate-600')}>
                  <span>{model.profile.email}</span>
                  <span className="h-1 w-1 rounded-full bg-current opacity-40" />
                  <span>Joined {model.profile.joinDate}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300 ring-1 ring-emerald-400/25">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {model.profile.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Workspace Focus', value: dataset?.name || 'Unified Analytics' },
                { label: 'Primary KPI', value: datasetProfile?.numericColumns?.[0] || 'Revenue' },
                { label: 'Preferred Stack', value: 'AI + Dashboard Ops' },
              ].map((item) => (
                <div key={item.label} className={cx('rounded-[24px] border p-4 backdrop-blur-xl', darkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/70')}>
                  <p className={cx('text-xs uppercase tracking-[0.22em]', darkMode ? 'text-slate-400' : 'text-slate-500')}>{item.label}</p>
                  <p className={cx('mt-2 text-base font-medium', darkMode ? 'text-white' : 'text-slate-950')}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={flashSavedState} className="rounded-full bg-gradient-to-r from-orange-400 to-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:scale-[1.02]">Edit Profile</button>
              <ThemeCard darkMode={darkMode} onToggle={() => setDarkMode((current) => !current)} />
              <button type="button" onClick={handleLogout} className={cx('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition', darkMode ? 'border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20' : 'border-rose-200 bg-rose-50 text-rose-700')}>
                <Icon name="logout" className="h-4 w-4" />
                Logout
              </button>
            </div>
            <div className={cx('grid w-full gap-3 rounded-[28px] border p-5 xl:max-w-md', darkMode ? 'border-white/10 bg-slate-900/75' : 'border-slate-200 bg-white/80')}>
              <div className="flex items-center justify-between">
                <span className={cx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>Profile completion</span>
                <span className={cx('text-sm font-semibold', darkMode ? 'text-white' : 'text-slate-900')}>92%</span>
              </div>
              <div className={cx('h-3 rounded-full', darkMode ? 'bg-white/10' : 'bg-slate-100')}>
                <div className="h-3 w-[92%] rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-orange-400" />
              </div>
              <div className={cx('flex items-center justify-between text-xs', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                <span>2FA enabled</span>
                <span>{saveState === 'saved' ? 'Changes saved' : 'Billing healthy'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader eyebrow="Analytics Overview" title="User analytics at a glance" copy="A lightweight Power BI-style executive strip with trends, momentum, and profile performance signals." darkMode={darkMode} />
        <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {model.metrics.map((metric) => <StatCard key={metric.id} metric={metric} />)}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <section className={cx('rounded-[32px] border p-5 md:p-6', cardClass)}>
          <SectionHeader eyebrow="My Work" title="Assets, datasets, and deliverables" copy="Search across your analysis workspace, filter by state, and jump into any artifact fast." darkMode={darkMode} />
          <div className="mt-5 flex flex-wrap gap-2">
            {WORK_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setWorkTab(tab.key)}
                className={cx('rounded-full px-4 py-2 text-sm font-medium transition', workTab === tab.key ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950' : darkMode ? 'border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/30' : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr]">
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name..." className={cx('rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-cyan-400/40', inputClass)} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={cx('rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-cyan-400/40', inputClass)}>
              {['All', 'Active', 'Processing', 'Failed'].map((option) => <option key={option}>{option}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={cx('rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-cyan-400/40', inputClass)}>
              {uniqueTypes.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div className="mt-5">
            <WorkTable
              items={pagedItems}
              page={page}
              onOpen={handleNavigateFromItem}
              onShare={flashSavedState}
              onDownload={flashSavedState}
              onDelete={flashSavedState}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className={cx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>{filteredItems.length} assets found</p>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">Prev</button>
              <button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 disabled:opacity-40">Next</button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className={cx('rounded-[32px] border p-5 md:p-6', cardClass)}>
            <SectionHeader
              eyebrow="AI Insights"
              title="Insights and activity history"
              copy="Short, high-signal updates from your AI copilot, plus query history and recent prompts."
              darkMode={darkMode}
              action={<button type="button" onClick={flashSavedState} className="rounded-full bg-gradient-to-r from-orange-400 to-amber-500 px-4 py-2 text-sm font-semibold text-slate-950">Regenerate Insight</button>}
            />
            <div className="mt-5 space-y-5">
              <ExpandableList items={model.aiFeed} expanded={expandedInsights} onToggle={(id) => toggleExpanded(setExpandedInsights, id)} badgeLabel="AI" />
              <ExpandableList items={model.chatHistory} expanded={expandedChat} onToggle={(id) => toggleExpanded(setExpandedChat, id)} badgeLabel="Chat" />
              <ExpandableList items={model.recentQueries} expanded={expandedQueries} onToggle={(id) => toggleExpanded(setExpandedQueries, id)} badgeLabel="Query" />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className={cx('rounded-[32px] border p-5 md:p-6', cardClass)}>
          <SectionHeader eyebrow="Settings" title="Profile, privacy, and access" copy="Keep your workspace identity, alert behavior, and security controls aligned with the way your team works." darkMode={darkMode} />
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className={cx('text-sm font-medium', darkMode ? 'text-slate-200' : 'text-slate-700')}>Full Name</span>
              <input value={settings.fullName} onChange={(event) => setSettings((current) => ({ ...current, fullName: event.target.value }))} className={cx('w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-cyan-400/40', inputClass)} />
            </label>
            <label className="space-y-2">
              <span className={cx('text-sm font-medium', darkMode ? 'text-slate-200' : 'text-slate-700')}>Email</span>
              <input value={settings.email} onChange={(event) => setSettings((current) => ({ ...current, email: event.target.value }))} className={cx('w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-cyan-400/40', inputClass)} />
            </label>
            <label className="space-y-2">
              <span className={cx('text-sm font-medium', darkMode ? 'text-slate-200' : 'text-slate-700')}>Language</span>
              <select value={settings.language} onChange={(event) => setSettings((current) => ({ ...current, language: event.target.value }))} className={cx('w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-cyan-400/40', inputClass)}>
                {['English (India)', 'English (US)', 'Hindi'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={cx('text-sm font-medium', darkMode ? 'text-slate-200' : 'text-slate-700')}>Change Password</span>
              <input type="password" value="********" readOnly className={cx('w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:border-cyan-400/40', inputClass)} />
            </label>
          </div>
          <div className="mt-5 grid gap-4">
            <Toggle label="Email notifications" description="Receive dataset refreshes, report delivery, and billing updates." checked={settings.emailNotifications} onChange={() => setSettings((current) => ({ ...current, emailNotifications: !current.emailNotifications }))} />
            <Toggle label="Push notifications" description="Instant alerts for failures, spikes, and pipeline milestones." checked={settings.pushNotifications} onChange={() => setSettings((current) => ({ ...current, pushNotifications: !current.pushNotifications }))} />
            <Toggle label="Data privacy controls" description="Limit AI suggestions to authorized workspace metadata only." checked={settings.privacy} onChange={() => setSettings((current) => ({ ...current, privacy: !current.privacy }))} />
            <Toggle label="Two-factor authentication" description="Require a secondary verification challenge during sign-in." checked={settings.twoFactor} onChange={() => setSettings((current) => ({ ...current, twoFactor: !current.twoFactor }))} />
          </div>
          <div className={cx('mt-5 rounded-[24px] border p-4', darkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={cx('text-sm font-medium', darkMode ? 'text-white' : 'text-slate-950')}>API Key Management</p>
                <p className={cx('mt-1 text-xs', darkMode ? 'text-slate-400' : 'text-slate-500')}>Copy or rotate the current integration token without leaving the profile workspace.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => navigator.clipboard?.writeText(apiKey)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">Copy</button>
                <button type="button" onClick={() => setApiKey(`dl_prod_${Math.random().toString(36).slice(2, 6)}_****_${Math.random().toString(36).slice(2, 6)}`)} className="rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">Regenerate</button>
              </div>
            </div>
            <div className={cx('mt-3 rounded-2xl border px-4 py-3 font-mono text-sm', inputClass)}>{apiKey}</div>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className={cx('text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>{saveState === 'saved' ? 'Saved successfully' : 'Last updated just now'}</span>
            <button type="button" onClick={flashSavedState} className="rounded-full bg-gradient-to-r from-orange-400 to-amber-500 px-5 py-2 text-sm font-semibold text-slate-950">Save Changes</button>
          </div>
        </section>

        <div className="space-y-6">
          <section className={cx('rounded-[32px] border p-5 md:p-6', cardClass)}>
            <SectionHeader eyebrow="Billing" title="Subscription and usage" copy="Keep plan capacity aligned with growth and compare upgrade paths before you need more headroom." darkMode={darkMode} action={<button type="button" onClick={() => setShowPricingModal(true)} className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200">Pricing</button>} />
            <div className="mt-5 rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/12 via-sky-400/10 to-orange-400/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Current Plan</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{model.billing.currentPlan}</p>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-3 text-cyan-200">
                  <Icon name="credit" className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">Upgrade</button>
                <button type="button" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">Downgrade</button>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {model.billing.usage.map((usage) => {
                const width = `${Math.min(100, (usage.used / usage.total) * 100)}%`
                return (
                  <div key={usage.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className={darkMode ? 'text-slate-200' : 'text-slate-700'}>{usage.label}</span>
                      <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{usage.used}/{usage.total}</span>
                    </div>
                    <div className={cx('h-3 rounded-full', darkMode ? 'bg-white/10' : 'bg-slate-100')}>
                      <div className="h-3 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-orange-400" style={{ width }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                <span>Invoice</span>
                <span>Amount</span>
                <span>Status</span>
              </div>
              {model.billing.history.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0">
                  <div>
                    <p className={darkMode ? 'text-white' : 'text-slate-900'}>{entry.invoice}</p>
                    <p className="text-xs text-slate-400">{entry.date}</p>
                  </div>
                  <span className={darkMode ? 'text-slate-200' : 'text-slate-700'}>{entry.amount}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={entry.status} />
                    <button type="button" onClick={flashSavedState} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">Download</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={cx('rounded-[32px] border p-5 md:p-6', cardClass)}>
            <SectionHeader eyebrow="Security" title="Security dashboard" copy="Review sessions, login context, and trusted-device controls from one place." darkMode={darkMode} />
            <div className={cx('mt-5 rounded-[24px] border p-4', darkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={cx('text-sm font-medium', darkMode ? 'text-white' : 'text-slate-950')}>Last Login</p>
                  <p className={cx('mt-1 text-lg font-semibold', darkMode ? 'text-cyan-200' : 'text-sky-700')}>{model.security.lastLogin}</p>
                  <p className={cx('mt-1 text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>{model.security.location}</p>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                  <Icon name="shield" className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {model.security.sessions.map((session) => (
                <div key={session.id} className={cx('flex flex-wrap items-center justify-between gap-3 rounded-[24px] border p-4', darkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
                  <div>
                    <p className={cx('font-medium', darkMode ? 'text-white' : 'text-slate-950')}>{session.device}</p>
                    <p className={cx('mt-1 text-sm', darkMode ? 'text-slate-400' : 'text-slate-500')}>{session.browser} | {session.location}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge value={session.active ? 'Active' : 'Processing'} />
                    <span className={cx('text-xs', darkMode ? 'text-slate-400' : 'text-slate-500')}>{session.lastSeen}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setSettings((current) => ({ ...current, twoFactor: !current.twoFactor }))} className="rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">
                {settings.twoFactor ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
              <button type="button" onClick={flashSavedState} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200">Logout all devices</button>
            </div>
          </section>
        </div>
      </div>

      {showPricingModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className={cx('w-full max-w-4xl rounded-[32px] border p-6', cardClass)}>
            <div className="flex items-start justify-between gap-4">
              <SectionHeader eyebrow="Pricing" title="Choose the right plan" copy="Compare the seats, AI depth, and governance features across tiers." darkMode={darkMode} />
              <button type="button" onClick={() => setShowPricingModal(false)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">Close</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {model.billing.comparisonPlans.map((plan) => (
                <article key={plan.name} className={cx('rounded-[28px] border p-5', plan.highlight ? 'border-cyan-400/35 bg-cyan-400/10' : darkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50')}>
                  <p className={cx('text-xs uppercase tracking-[0.24em]', darkMode ? 'text-slate-400' : 'text-slate-500')}>{plan.name}</p>
                  <p className={cx('mt-3 text-3xl font-semibold', darkMode ? 'text-white' : 'text-slate-950')}>{plan.price}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                  <p className={cx('mt-3 text-sm leading-6', darkMode ? 'text-slate-300/85' : 'text-slate-600')}>{plan.description}</p>
                  <button type="button" onClick={flashSavedState} className={cx('mt-5 rounded-full px-4 py-2 text-sm font-semibold', plan.highlight ? 'bg-white text-slate-950' : 'bg-gradient-to-r from-orange-400 to-amber-500 text-slate-950')}>Select Plan</button>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
