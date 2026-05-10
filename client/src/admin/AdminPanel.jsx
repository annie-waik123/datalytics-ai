'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMail, FiSend, FiUser, FiUsers, FiAlertTriangle, FiGift, FiInfo, FiCheckCircle } from 'react-icons/fi'
import './admin.css'

const ADMIN_TOKEN_KEY = 'datalytics_admin_token'
const API_BASE = '/api'

const navItems = [
  { key: 'analytics', label: 'Analytics', icon: 'grid' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'payments', label: 'Payments', icon: 'card' },
  { key: 'emails', label: 'Emails', icon: 'email' },
  { key: 'aifeatures', label: 'AI Features', icon: 'lock' },
  { key: 'activity', label: 'Activity Logs', icon: 'activity' },
  { key: 'authLogs', label: 'Login / Logout', icon: 'login' },
]

const defaultContentForm = { title: '', category: 'General', body: '', status: 'draft' }
const defaultCategoryForm = { name: '', description: '', status: 'active' }
const defaultPlanForm = { name: 'Basic', price: 0, currency: 'INR', features: '', status: 'active', diamonds: 0 }

const FALLBACK_PLANS = [
  {
    _id: '__free__',
    name: 'Free',
    price: 0,
    diamonds: 200,
    status: 'active',
    features: ['Core dataset upload and analytics dashboard', 'Basic dataset profiling and summary reports', 'Single dashboard workspace', 'Community AI query support'],
    _accent: 'plan-card-free',
    _isFallback: true,
  },
  {
    _id: '__basic__',
    name: 'Basic',
    price: 200,
    diamonds: 300,
    status: 'active',
    features: ['Expanded dataset and dashboard quotas', 'Automated model training and forecasts', 'Custom charts and export-ready reports', 'Faster analytics processing'],
    _accent: 'plan-card-basic',
    _isFallback: true,
  },
  {
    _id: '__pro__',
    name: 'Pro',
    price: 500,
    diamonds: 800,
    status: 'active',
    features: ['Full AI workspace with advanced insights', 'Priority model runs and forecasting', 'Unlimited dashboards and reports', 'Dedicated analytics support'],
    _accent: 'plan-card-pro',
    _isFallback: true,
  },
]

const EMAIL_TEMPLATES = {
  announcement: {
    label: 'Announcement',
    subject: 'New announcement from Datalytics',
    body: 'Hello,\n\nWe have an important Datalytics announcement to share with you. Please review the latest information and continue using your workspace as usual.\n\nThank you,\nDatalytics Team',
    iconClass: 'text-cyan-400',
    focusClass: 'focus:border-cyan-500/50 focus:ring-cyan-500/50',
    selectedClass: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.12)]',
    buttonClass: 'from-cyan-500 to-blue-500 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)]',
    previewHeader: 'bg-cyan-50 border-cyan-100',
    previewAccent: 'bg-cyan-500',
    previewTitle: 'text-cyan-950',
    tipClass: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-200/80',
    tip: 'Use Announcement for regular product news, maintenance notes, and general admin communication.',
  },
  warning: {
    label: 'Warning Mail',
    subject: 'Action required: Important account notice',
    body: 'Hello,\n\nThis is an important warning from Datalytics. Please review your account activity and take the required action as soon as possible to avoid interruption.\n\nIf you have already resolved this, you can ignore this message.\n\nThank you,\nDatalytics Team',
    iconClass: 'text-amber-400',
    focusClass: 'focus:border-amber-500/60 focus:ring-amber-500/40',
    selectedClass: 'border-amber-500/60 bg-amber-500/10 text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.14)]',
    buttonClass: 'from-amber-500 to-red-500 shadow-[0_0_20px_rgba(245,158,11,0.28)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)]',
    previewHeader: 'bg-amber-50 border-amber-100',
    previewAccent: 'bg-amber-500',
    previewTitle: 'text-amber-950',
    tipClass: 'bg-amber-500/10 border-amber-500/25 text-amber-100/85',
    tip: 'Use Warning Mail only for priority notices that need fast attention.',
  },
  offer: {
    label: 'Offer / Update',
    subject: 'Special offer and product update for you',
    body: 'Hello,\n\nWe have a new Datalytics offer/update available for you. Explore the latest benefits, improvements, and plan options inside your dashboard.\n\nThis update is designed to help you get more value from your analytics workspace.\n\nThank you,\nDatalytics Team',
    iconClass: 'text-emerald-400',
    focusClass: 'focus:border-emerald-500/50 focus:ring-emerald-500/40',
    selectedClass: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_18px_rgba(34,197,94,0.14)]',
    buttonClass: 'from-emerald-500 to-teal-500 shadow-[0_0_20px_rgba(34,197,94,0.25)] hover:shadow-[0_0_25px_rgba(34,197,94,0.42)]',
    previewHeader: 'bg-emerald-50 border-emerald-100',
    previewAccent: 'bg-emerald-500',
    previewTitle: 'text-emerald-950',
    tipClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100/80',
    tip: 'Use Offer / Update for plan promotions, feature updates, and upgrade messages.',
  },
}

function Icon({ name }) {
  const paths = {
    grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
    users: 'M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11ZM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.67 0-6 1.34-6 4v1h12v-1c0-2.66-3.33-4-6-4Zm8 0c-.31 0-.64.02-.98.06 1.21.88 1.98 2.06 1.98 3.94v1h5v-1c0-2.66-3.33-4-6-4Z',
    data: 'M4 5c0-1.1 3.58-2 8-2s8 .9 8 2-3.58 2-8 2-8-.9-8-2Zm0 4c0 1.1 3.58 2 8 2s8-.9 8-2V7c-1.72 1.21-5.11 1.5-8 1.5S5.72 8.21 4 7v2Zm0 4c0 1.1 3.58 2 8 2s8-.9 8-2v-2c-1.72 1.21-5.11 1.5-8 1.5S5.72 12.21 4 11v2Zm0 4c0 1.1 3.58 2 8 2s8-.9 8-2v-2c-1.72 1.21-5.11 1.5-8 1.5S5.72 16.21 4 15v2Z',
    card: 'M3 5h18v14H3V5Zm2 4h14V7H5v2Zm0 4v4h6v-4H5Z',
    lock: 'M17 9h-1V7A4 4 0 0 0 8 7v2H7a2 2 0 0 0-2 2v8h14v-8a2 2 0 0 0-2-2Zm-3 0h-4V7a2 2 0 0 1 4 0v2Z',
    search: 'M10 4a6 6 0 1 0 3.65 10.76l3.8 3.79 1.1-1.1-3.79-3.8A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
    email: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    activity: 'M4 13h3l2-5 4 10 2-5h5v2h-3.7L13 23 9 13 8.3 15H4v-2Z',
    login: 'M10 17v-3H3v-4h7V7l5 5-5 5Zm3-13h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6v-2h6V6h-6V4Z',
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={paths[name] || paths.grid} />
    </svg>
  )
}

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    let msg = data.detail || data.message || 'Request failed'
    if (Array.isArray(msg)) {
      msg = msg.map(m => m.msg || JSON.stringify(m)).join(', ')
    } else if (typeof msg === 'object') {
      msg = JSON.stringify(msg)
    }
    throw new Error(msg)
  }
  return data
}

function AdminLogin({ onLogin }) {
  const [form, setForm] = useState({ email: 'singhsangam5400@gmail.com', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/admin/login', { method: 'POST', body: form })
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
      onLogin(data.token, data.admin)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-mark"><Icon name="lock" /></div>
        <p className="admin-eyebrow">Datalytics Admin</p>
        <h1>Secure admin access</h1>
        <p className="admin-muted">Only the configured admin email or backend-approved admin role can enter this area.</p>
        <label>
          <span>Email</span>
          <input value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} type="email" />
        </label>
        <label>
          <span>Password</span>
          <input value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} type="password" autoComplete="current-password" />
        </label>
        {error ? <div className="admin-error">{error}</div> : null}
        <button type="submit" disabled={loading}>{loading ? 'Checking...' : 'Login as Admin'}</button>
      </form>
    </main>
  )
}

function StatCard({ label, value, tone = 'cyan', onClick }) {
  return (
    <button type="button" className={`admin-stat is-${tone} ${onClick ? 'is-clickable' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </button>
  )
}

function BarList({ title, data, labelKey, valueKey, onSelect }) {
  const max = Math.max(1, ...data.map((item) => Number(item[valueKey] || 0)))
  return (
    <section className="admin-panel-card">
      <h3>{title}</h3>
      <div className="admin-bars">
        {data.length ? data.map((item) => {
          const value = Number(item[valueKey] || 0)
          return (
            <button type="button" className="admin-bar-row is-clickable" key={item[labelKey]} onClick={() => onSelect?.(title, item)}>
              <span>{item[labelKey]}</span>
              <div><i style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div>
              <b>{value}</b>
            </button>
          )
        }) : <p className="admin-muted">No activity yet.</p>}
      </div>
    </section>
  )
}

function AnalyticsPage({ analytics, loading }) {
  const cards = analytics?.cards || {}
  const [detail, setDetail] = useState(null)
  const openCard = (label, value) => setDetail({ title: label, body: `${value ?? 0} total records`, rows: [] })
  const openBar = (title, item) => setDetail({
    title: `${title}: ${item.category || item.date}`,
    body: `${item.count || 0} activity events`,
    rows: Object.entries(item).map(([key, value]) => ({ key, value })),
  })
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Analytics</p>
          <h2>Application overview</h2>
        </div>
        {loading ? <span className="admin-loading-pill">Refreshing</span> : null}
      </div>
      <div className="admin-stat-grid">
        <StatCard label="Total Users" value={cards.total_users} tone="cyan" onClick={() => openCard('Total Users', cards.total_users)} />
        <StatCard label="New Today" value={cards.new_users_daily} tone="orange" onClick={() => openCard('New Today', cards.new_users_daily)} />
        <StatCard label="New This Month" value={cards.new_users_monthly} tone="green" onClick={() => openCard('New This Month', cards.new_users_monthly)} />
        <StatCard label="Active Users" value={cards.active_users} tone="purple" onClick={() => openCard('Active Users', cards.active_users)} />
        <StatCard label="Banned Users" value={cards.banned_users} tone="red" onClick={() => openCard('Banned Users', cards.banned_users)} />
        <StatCard label="Pending Uploads" value={cards.pending_uploads} tone="amber" onClick={() => openCard('Pending Uploads', cards.pending_uploads)} />
      </div>
      <div className="admin-two-col">
        <BarList title="Usage by module" data={analytics?.usage_by_category || []} labelKey="category" valueKey="count" onSelect={openBar} />
        <BarList title="Daily usage" data={analytics?.daily_usage || []} labelKey="date" valueKey="count" onSelect={openBar} />
      </div>
      {detail ? <AnalyticsDetailModal detail={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  )
}

function AnalyticsDetailModal({ detail, onClose }) {
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>{detail.title}</h2>
          <button className="admin-close-btn" onClick={onClose}>x</button>
        </div>
        <div className="admin-modal-body">
          <p className="admin-muted">{detail.body}</p>
          {detail.rows?.length ? (
            <div className="admin-list compact">
              {detail.rows.map((row) => (
                <article key={row.key}>
                  <strong>{row.key}</strong>
                  <span>{String(row.value)}</span>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function UsersPage({ users, onStatus, onRole, onDelete, onViewUser }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => users.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase())), [users, query])
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">User Management</p>
          <h2>Accounts and access</h2>
        </div>
        <label className="admin-search"><Icon name="search" /><input placeholder="Search users" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Plan</th><th>Credits</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.name}</strong><small>{user.provider}</small></td>
                <td>{user.email}</td>
                <td><span className={`admin-badge is-${user.status}`}>{user.status}</span></td>
                <td>
                  <select value={user.role} onChange={(e) => onRole(user.id, e.target.value)}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{user.plan || 'None'}</td>
                <td><strong>{user.diamonds || 0}</strong></td>
                <td className="admin-actions">
                  <button onClick={() => onViewUser(user.id)}>View Details</button>
                  <button onClick={() => onStatus(user.id, user.status === 'banned' ? 'active' : 'banned')}>{user.status === 'banned' ? 'Unban' : 'Ban'}</button>
                  <button className="danger" onClick={() => onDelete(user.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UserDetailsModal({ userDetails, onClose }) {
  if (!userDetails) return null;
  const { user, datasets } = userDetails;
  
  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-content large">
        <div className="admin-modal-header">
          <h2>User Details: {user.name}</h2>
          <button className="admin-close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="admin-modal-body admin-two-col">
          <section className="admin-panel-card">
            <h3>Profile info</h3>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {user.role}</p>
            <p><strong>Current Plan:</strong> {user.plan || 'None'}</p>
            <p><strong>Credits:</strong> {user.diamonds || 0}</p>
            <p><strong>Status:</strong> {user.status}</p>
            <p><strong>Joined:</strong> {new Date(user.created_at).toLocaleString()}</p>
          </section>
          
          <section className="admin-panel-card">
            <h3>Purchase History</h3>
            <div className="admin-list compact">
              {user.purchase_history?.length > 0 ? (
                user.purchase_history.map((tx, idx) => (
                  <article key={idx}>
                    <strong>{tx.plan_name || 'Credit Purchase'}</strong>
                    <span>{new Date(tx.timestamp).toLocaleString()} · +{tx.diamonds || 0} Credits</span>
                    <span>Status: {tx.status}</span>
                  </article>
                ))
              ) : (
                <p className="admin-muted">No purchase history found.</p>
              )}
            </div>
          </section>
        </div>

        <div className="admin-modal-body">
          <section className="admin-panel-card">
            <h3>Uploaded Datasets</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Rows</th><th>Status</th><th>Uploaded</th></tr></thead>
                <tbody>
                  {datasets?.length > 0 ? (
                    datasets.map(d => (
                      <tr key={d._id}>
                        <td>{d.filename || d.name}</td>
                        <td>{d.metadata?.rows || 'N/A'}</td>
                        <td><span className={`admin-badge is-${d.status}`}>{d.status}</span></td>
                        <td>{new Date(d.uploaded_at).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4" className="admin-muted" style={{textAlign: 'center'}}>No datasets uploaded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}


function PlanEditCard({ plan, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: plan.name,
    price: plan.price,
    diamonds: plan.diamonds || 0,
    features: Array.isArray(plan.features) ? plan.features.join(', ') : (plan.features || ''),
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(plan._id, { ...form, _isFallback: plan._isFallback })
    setSaving(false)
    setEditing(false)
  }

  const featureList = Array.isArray(plan.features) ? plan.features : String(plan.features || '').split(',').map(f => f.trim()).filter(Boolean)

  return (
    <div className={`plan-edit-card ${plan._accent || ''}`}>
      <div className="plan-card-top">
        {editing ? (
          <input
            className="plan-name-input"
            value={form.name}
            onChange={(e) => setForm(v => ({ ...v, name: e.target.value }))}
            placeholder="Plan Name"
          />
        ) : (
          <h3 className="plan-card-name">{plan.name}</h3>
        )}
        <span className={`admin-badge is-${plan.status || 'active'}`}>{plan.status || 'active'}</span>
      </div>

      <div className="plan-card-fields">
        <div className="plan-field">
          <label>₹ Price</label>
          {editing ? (
            <input type="number" value={form.price} onChange={(e) => setForm(v => ({ ...v, price: Number(e.target.value) }))} />
          ) : (
            <span className="plan-value">₹{plan.price}</span>
          )}
        </div>
        <div className="plan-field">
          <label>🪙 Credits</label>
          {editing ? (
            <input type="number" value={form.diamonds} onChange={(e) => setForm(v => ({ ...v, diamonds: Number(e.target.value) }))} />
          ) : (
            <span className="plan-value">{plan.diamonds || 0}</span>
          )}
        </div>
      </div>

      {!editing && featureList.length > 0 && (
        <ul className="plan-features-list">
          {featureList.map((f, i) => <li key={i}>✓ {f}</li>)}
        </ul>
      )}

      {editing && (
        <div className="plan-field" style={{ flexDirection: 'column' }}>
          <label style={{ marginBottom: 4 }}>Features (comma separated)</label>
          <textarea
            className="plan-features-input"
            rows={3}
            value={form.features}
            onChange={e => setForm(v => ({ ...v, features: e.target.value }))}
            placeholder="Feature 1, Feature 2, Feature 3"
          />
        </div>
      )}

      <div className="plan-card-actions">
        {editing ? (
          <>
            <button className="plan-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : '✓ Save'}
            </button>
            <button className="plan-cancel-btn" onClick={() => {
              setEditing(false)
              setForm({ name: plan.name, price: plan.price, diamonds: plan.diamonds || 0, features: Array.isArray(plan.features) ? plan.features.join(', ') : (plan.features || '') })
            }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="plan-edit-btn" onClick={() => setEditing(true)}>✏️ Edit</button>
            {!plan._isFallback && (
              <button className="plan-delete-btn danger" onClick={() => onDelete(plan._id)}>Delete</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PaymentsPage({ payments, onCreatePlan, onUpdatePlan, onDeletePlan }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newPlan, setNewPlan] = useState({ name: '', price: 0, diamonds: 0 })
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    if (!newPlan.name.trim()) return
    setAdding(true)
    await onCreatePlan({ ...newPlan, currency: 'INR', features: [], status: 'active' }, () => {})
    setNewPlan({ name: '', price: 0, diamonds: 0 })
    setShowAdd(false)
    setAdding(false)
  }

  // Use API plans if available, otherwise show 3 default fallback plans
  const apiPlans = payments.plans || []
  const plans = apiPlans.length > 0
    ? apiPlans.map((plan, idx) => ({ ...plan, _accent: ['plan-card-free', 'plan-card-basic', 'plan-card-pro'][idx] || '' }))
    : FALLBACK_PLANS

  async function handleSave(id, form) {
    const isFallback = form._isFallback || id.startsWith('__')
    if (isFallback) {
      // Create a new plan in DB from the fallback
      await onCreatePlan({
        name: form.name,
        price: form.price,
        diamonds: form.diamonds,
        currency: 'INR',
        features: typeof form.features === 'string'
          ? form.features.split(',').map(f => f.trim()).filter(Boolean)
          : (form.features || []),
        status: 'active',
      }, () => {})
    } else {
      const original = apiPlans.find(p => p._id === id) || {}
      await onUpdatePlan({
        _id: id,
        ...original,
        ...form,
        features: typeof form.features === 'string'
          ? form.features.split(',').map(f => f.trim()).filter(Boolean)
          : (form.features || []),
      })
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Payments</p>
          <h2>Plans & Transactions</h2>
        </div>
        <button className="plan-add-btn" onClick={() => setShowAdd(v => !v)}>+ New Plan</button>
      </div>

      {apiPlans.length === 0 && (
        <div className="plan-fallback-notice">
          ℹ️ Showing default plans. Edit and save to persist them to the database.
        </div>
      )}

      {showAdd && (
        <div className="plan-add-form">
          <input placeholder="Plan Name" value={newPlan.name} onChange={e => setNewPlan(v => ({ ...v, name: e.target.value }))} />
          <div className="plan-add-row">
            <span>₹</span>
            <input type="number" placeholder="Price" value={newPlan.price} onChange={e => setNewPlan(v => ({ ...v, price: Number(e.target.value) }))} />
          </div>
          <div className="plan-add-row">
            <span>🪙</span>
            <input type="number" placeholder="Credits" value={newPlan.diamonds} onChange={e => setNewPlan(v => ({ ...v, diamonds: Number(e.target.value) }))} />
          </div>
          <button onClick={handleAdd} disabled={adding}>{adding ? 'Adding...' : 'Add Plan'}</button>
          <button className="plan-cancel-btn" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      )}

      <div className="plan-cards-grid">
        {plans.map((plan) => (
          <PlanEditCard
            key={plan._id}
            plan={plan}
            onSave={handleSave}
            onDelete={onDeletePlan}
          />
        ))}
      </div>

      <section className="admin-panel-card" style={{ marginTop: '1.5rem' }}>
        <h3>Payment History</h3>
        <div className="admin-list compact">
          {(payments.transactions || []).length === 0 ? (
            <p className="admin-muted">No transactions yet.</p>
          ) : (
            (payments.transactions || []).map((txn, index) => (
              <article key={txn._id || txn.order_id || index}>
                <strong>{txn.plan_name || txn.current_plan || 'Plan'}</strong>
                <span>{txn.user_email || 'unknown'} · {txn.status || 'Paid'} · +{txn.diamonds || 0} Credits</span>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function EmailsPage({ users, token }) {
  const [form, setForm] = useState({
    target: 'all',
    userId: '',
    subject: EMAIL_TEMPLATES.announcement.subject,
    body: EMAIL_TEMPLATES.announcement.body,
    type: 'announcement',
  })
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const activeTemplate = EMAIL_TEMPLATES[form.type] || EMAIL_TEMPLATES.announcement

  function updateEmailType(type) {
    const nextTemplate = EMAIL_TEMPLATES[type] || EMAIL_TEMPLATES.announcement
    const currentTemplate = EMAIL_TEMPLATES[form.type] || EMAIL_TEMPLATES.announcement
    setForm({
      ...form,
      type,
      subject: !form.subject.trim() || form.subject === currentTemplate.subject ? nextTemplate.subject : form.subject,
      body: !form.body.trim() || form.body === currentTemplate.body ? nextTemplate.body : form.body,
    })
  }

  async function handleSend(e) {
    e.preventDefault()
    setSending(true)
    setError('')
    setMessage('')
    try {
      const userIds = form.target === 'all' ? ['all'] : [form.userId]
      if (form.target === 'one' && !form.userId) {
         throw new Error("Please select a user")
      }
      const finalSubject = form.subject.trim() || activeTemplate.subject
      const finalBody = form.body.trim() || activeTemplate.body
      const res = await fetch('/api/admin/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userIds, subject: finalSubject, body: finalBody, type: form.type })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'Failed to send')
      setMessage(`Successfully sent ${data.count} email(s)`)
      setForm(f => ({ ...f, subject: activeTemplate.subject, body: activeTemplate.body }))
      setTimeout(() => setMessage(''), 5000)
    } catch(err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const getTypeIcon = () => {
    switch(form.type) {
      case 'warning': return <FiAlertTriangle className={activeTemplate.iconClass} />
      case 'offer': return <FiGift className={activeTemplate.iconClass} />
      default: return <FiInfo className={activeTemplate.iconClass} />
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
      className="admin-page"
    >
      <div className="admin-page-head mb-8">
        <div>
          <p className="admin-eyebrow flex items-center gap-2">
            <FiMail /> Communications
          </p>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Email Announcements</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <section className="lg:col-span-3 relative">
          {/* A sleek background glow */}
          <div className={`absolute -inset-1 rounded-[24px] blur-xl opacity-50 ${
            form.type === 'warning'
              ? 'bg-gradient-to-r from-amber-500/20 to-red-500/20'
              : form.type === 'offer'
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20'
                : 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20'
          }`}></div>
          
          <form onSubmit={handleSend} className="relative bg-[#0b101a]/90 backdrop-blur-xl border border-slate-700/40 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col gap-6">
            
            {/* Target Audience */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Target Audience</label>
              <div className="flex bg-[#111827] rounded-xl p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, target: 'all' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    form.target === 'all' 
                      ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <FiUsers /> All Users
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, target: 'one' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    form.target === 'one' 
                      ? 'bg-purple-500/20 text-purple-300 shadow-sm border border-purple-500/30' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <FiUser /> Specific User
                </button>
              </div>
            </div>

            <AnimatePresence>
              {form.target === 'one' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select User</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-[#111827] border border-slate-700/60 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 appearance-none transition-all"
                        value={form.userId} 
                        onChange={e => setForm({ ...form, userId: e.target.value })}
                      >
                        <option className="bg-[#111827] text-slate-200" value="">-- Choose a user --</option>
                        {users.map(u => <option className="bg-[#111827] text-slate-200" key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        ▼
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Type */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Type</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {getTypeIcon()}
                </div>
                <select 
                  className={`w-full bg-[#111827] border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-1 appearance-none transition-all ${activeTemplate.selectedClass} ${activeTemplate.focusClass}`}
                  value={form.type} 
                  onChange={e => updateEmailType(e.target.value)}
                >
                  <option className="bg-[#111827] text-slate-200" value="announcement">Announcement</option>
                  <option className="bg-[#111827] text-slate-200" value="warning">Warning Mail</option>
                  <option className="bg-[#111827] text-slate-200" value="offer">Offer / Update</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  ▼
                </div>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subject</label>
              <input 
                className={`w-full bg-[#111827] border border-slate-700/60 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:ring-1 transition-all placeholder:text-slate-600 ${activeTemplate.focusClass}`}
                placeholder={activeTemplate.subject}
                value={form.subject} 
                onChange={e => setForm({ ...form, subject: e.target.value })} 
                required 
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body Content</label>
              <textarea 
                className={`w-full bg-[#111827] border border-slate-700/60 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:ring-1 transition-all placeholder:text-slate-600 resize-y ${activeTemplate.focusClass}`}
                rows={6} 
                placeholder={activeTemplate.body}
                value={form.body} 
                onChange={e => setForm({ ...form, body: e.target.value })} 
                required 
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
              <button 
                type="submit" 
                disabled={sending} 
                className={`w-full sm:w-auto relative group overflow-hidden rounded-xl bg-gradient-to-r px-8 py-3.5 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:pointer-events-none ${activeTemplate.buttonClass}`}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <span className="relative flex items-center justify-center gap-2">
                  {sending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FiSend /> Dispatch Email
                    </>
                  )}
                </span>
              </button>

              <AnimatePresence mode="wait">
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-emerald-400 text-sm font-semibold bg-emerald-400/10 px-4 py-2 rounded-lg border border-emerald-400/20"
                  >
                    <FiCheckCircle /> {message}
                  </motion.div>
                )}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-rose-400 text-sm font-semibold bg-rose-400/10 px-4 py-2 rounded-lg border border-rose-400/20"
                  >
                    <FiAlertTriangle /> {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </form>
        </section>

        {/* Live Preview / Tips Side Panel */}
        <section className="lg:col-span-2 hidden lg:block">
          <div className="bg-[#111827]/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sticky top-6">
            <h3 className="text-slate-300 font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <FiInfo /> Live Preview
            </h3>
            
            <div className="bg-white rounded-xl overflow-hidden shadow-sm">
              <div className={`h-1.5 ${activeTemplate.previewAccent}`} />
              <div className={`${activeTemplate.previewHeader} border-b px-4 py-3`}>
                <div className="text-xs text-slate-500 mb-1">From: <span className="text-slate-800 font-medium">Datalytics Admin</span></div>
                <div className="text-xs text-slate-500 mb-1">To: <span className="text-slate-800 font-medium">{form.target === 'all' ? 'All Users' : (form.userId ? 'Selected User' : '...')}</span></div>
                <div className={`text-sm font-bold mt-2 truncate ${activeTemplate.previewTitle}`}>{form.subject || activeTemplate.subject}</div>
              </div>
              <div className="p-4 bg-white min-h-[160px]">
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {form.body || activeTemplate.body}
                </p>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              <div className={`${activeTemplate.tipClass} border rounded-lg p-3 text-xs leading-relaxed`}>
                <strong>{activeTemplate.label} tip:</strong> {activeTemplate.tip}
              </div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  )
}

function AIFeaturesPage({ features, onSave, saving, message }) {
  const [local, setLocal] = useState(features)

  useEffect(() => {
    setLocal(features)
  }, [features])

  const FEATURE_CONFIG = [
    {
      key: 'chatbot',
      label: 'AI Chatbot',
      desc: 'Allows users to chat with the AI assistant powered by OpenAI/Groq. When OFF, all chatbot API calls are blocked.',
      icon: '🤖',
    },
    {
      key: 'recommendations',
      label: 'Recommendations & Insights',
      desc: 'AI-generated dataset recommendations and smart insights. When OFF, users see a disabled message.',
      icon: '💡',
    },
    {
      key: 'decision_making',
      label: 'Decision Making',
      desc: 'AI-powered decision support and scenario analysis. When OFF, the feature is blocked for all users.',
      icon: '🎯',
    },
    {
      key: 'ai_insights',
      label: 'AI Insights',
      desc: 'Automatic LLM-generated data insights and summaries. When OFF, no OpenAI calls are made.',
      icon: '✨',
    },
  ]

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">AI Control Panel</p>
          <h2>AI Feature Kill Switch</h2>
          <p className="admin-muted" style={{ marginTop: 4 }}>Toggle AI-powered features ON or OFF globally. When a feature is OFF, all related OpenAI API calls are blocked and users see a "feature disabled" message.</p>
        </div>
      </div>

      <div className="admin-panel-card" style={{ maxWidth: 680 }}>
        {FEATURE_CONFIG.map(({ key, label, desc, icon }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <span style={{ fontSize: 26 }}>{icon}</span>
              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: 4 }}>{label}</strong>
                <span className="admin-muted" style={{ fontSize: 12 }}>{desc}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLocal(prev => ({ ...prev, [key]: !prev[key] }))}
              style={{
                flexShrink: 0,
                marginLeft: 24,
                width: 52,
                height: 28,
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                background: local[key] ? '#22c55e' : '#475569',
                position: 'relative',
                transition: 'background 0.2s',
              }}
              title={local[key] ? 'Click to disable' : 'Click to enable'}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: local[key] ? 26 : 3,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>
        ))}

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => onSave(local)}
            disabled={saving}
            style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 28px',
              fontWeight: 700,
              fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {message && (
            <span style={{ fontSize: 13, color: message.startsWith('✅') ? '#22c55e' : '#f87171' }}>
              {message}
            </span>
          )}
        </div>
      </div>

      <div className="admin-panel-card" style={{ maxWidth: 680, marginTop: 16, background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
        <h3 style={{ color: '#f97316', marginBottom: 8 }}>⚠️ How This Works</h3>
        <p className="admin-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          When you toggle a feature OFF and save, the backend stores this flag in MongoDB. Every API call for that feature checks this flag first — if disabled, it immediately returns a <code style={{ color: '#fb923c' }}>503</code> error with the message <em>"This feature is currently disabled by the administrator."</em> Users will see this message in the UI instead of the AI response.
        </p>
      </div>
    </div>
  )
}

function ActivityLogsPage({ logs, loading }) {

  const [query, setQuery] = useState('')
  const loginCount = (logs || []).filter((log) => log.action === 'Login').length
  const logoutCount = (logs || []).filter((log) => log.action === 'Logout').length
  const uniqueUsers = new Set((logs || []).map((log) => log.email).filter(Boolean)).size
  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    return (logs || []).filter((log) => `${log.email} ${log.action} ${log.category} ${log.details}`.toLowerCase().includes(needle))
  }, [logs, query])

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Activity Logs</p>
          <h2>User workflow history</h2>
        </div>
        <label className="admin-search"><Icon name="search" /><input placeholder="Search logs" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      </div>
      {loading ? <span className="admin-loading-pill">Refreshing</span> : null}
      <div className="admin-stat-grid activity-summary-grid">
        <StatCard label="Total Events" value={(logs || []).length} tone="cyan" />
        <StatCard label="Login Events" value={loginCount} tone="green" />
        <StatCard label="Logout Events" value={logoutCount} tone="orange" />
        <StatCard label="Unique Users" value={uniqueUsers} tone="purple" />
      </div>
      <div className="admin-table-wrap admin-table-scroll">
        <table className="admin-table">
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Section</th><th>Details</th></tr></thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown'}</td>
                <td>{log.email || 'unknown'}</td>
                <td><strong>{log.action}</strong></td>
                <td><span className={`admin-badge is-${log.category || 'other'}`}>{log.category || 'other'}</span></td>
                <td>{log.details || '-'}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr><td colSpan={5}><p className="admin-muted">No activity logs found.</p></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuthLogsPage({ logs, loading }) {
  const [query, setQuery] = useState('')
  const loginCount = (logs || []).filter((log) => log.action === 'Login').length
  const logoutCount = (logs || []).filter((log) => log.action === 'Logout').length
  const uniqueUsers = new Set((logs || []).map((log) => log.email).filter(Boolean)).size
  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    return (logs || []).filter((log) => `${log.name} ${log.email} ${log.action} ${log.details}`.toLowerCase().includes(needle))
  }, [logs, query])

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Login / Logout</p>
          <h2>User access history</h2>
        </div>
        <label className="admin-search"><Icon name="search" /><input placeholder="Search users" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      </div>
      {loading ? <span className="admin-loading-pill">Refreshing</span> : null}
      <div className="admin-stat-grid activity-summary-grid">
        <StatCard label="Access Events" value={(logs || []).length} tone="cyan" />
        <StatCard label="Logged In" value={loginCount} tone="green" />
        <StatCard label="Logged Out" value={logoutCount} tone="orange" />
        <StatCard label="Users Tracked" value={uniqueUsers} tone="purple" />
      </div>
      <div className="admin-table-wrap admin-table-scroll">
        <table className="admin-table">
          <thead><tr><th>Time</th><th>Name</th><th>Email</th><th>Event</th><th>Details</th></tr></thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown'}</td>
                <td><strong>{log.name || 'Unknown User'}</strong></td>
                <td>{log.email || 'unknown'}</td>
                <td><span className={`admin-badge ${log.action === 'Logout' ? 'is-inactive' : 'is-auth'}`}>{log.action}</span></td>
                <td>{log.details || '-'}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr><td colSpan={5}><p className="admin-muted">No login/logout records found.</p></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminProfileModal({ admin, onClose, onSave }) {
  const [form, setForm] = useState({ name: admin?.name || 'Admin', avatar_url: admin?.avatar_url || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 900 * 1024) {
      setError('Image is too large. Please upload under 900 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setError('')
      setForm((v) => ({ ...v, avatar_url: String(reader.result || '') }))
    }
    reader.onerror = () => setError('Could not read this image.')
    reader.readAsDataURL(file)
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <form className="admin-modal-content" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>Edit admin profile</h2>
          <button type="button" className="admin-close-btn" onClick={onClose}>x</button>
        </div>
        <div className="admin-modal-body admin-form-grid">
          <label>
            <span>Name</span>
            <input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Admin name" />
          </label>
          <label>
            <span>Photo URL</span>
            <input value={form.avatar_url} onChange={(e) => setForm((v) => ({ ...v, avatar_url: e.target.value }))} placeholder="https://..." />
          </label>
          <label>
            <span>Upload photo from local</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          </label>
          {form.avatar_url ? <img className="admin-profile-preview" src={form.avatar_url} alt="Admin preview" /> : null}
          {error ? <div className="admin-error">{error}</div> : null}
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
        </div>
      </form>
    </div>
  )
}

export default function AdminPanel({ integratedToken, onIntegratedLogout }) {
  const [token, setToken] = useState('')
  const [admin, setAdmin] = useState(null)
  const [active, setActive] = useState('analytics')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [users, setUsers] = useState([])
  const [payments, setPayments] = useState({ transactions: [], plans: [] })
  const [activityLogs, setActivityLogs] = useState([])
  const [authLogs, setAuthLogs] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [aiFeatures, setAiFeatures] = useState({ chatbot: true, recommendations: true, decision_making: true, ai_insights: true })
  const [aiSaving, setAiSaving] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

  async function authed(path, options = {}) {
    return apiRequest(path, { ...options, token })
  }

  async function loadAll(nextToken = token) {
    if (!nextToken) return
    setLoading(true)
    setError('')
    try {
      const [me, analyticsData, usersData, paymentData, activityData, authData, aiFeaturesData] = await Promise.all([
        apiRequest('/admin/me', { token: nextToken }),
        apiRequest('/admin/analytics', { token: nextToken }),
        apiRequest('/admin/users', { token: nextToken }),
        apiRequest('/admin/payments', { token: nextToken }),
        apiRequest('/admin/activity-logs', { token: nextToken }),
        apiRequest('/admin/auth-logs', { token: nextToken }),
        apiRequest('/admin/ai-features', { token: nextToken }),
      ])
      setAdmin(me.admin)
      setAnalytics(analyticsData)
      setUsers(usersData.users || [])
      setPayments(paymentData)
      setActivityLogs(activityData.logs || [])
      setAuthLogs(authData.logs || [])
      if (aiFeaturesData?.features) setAiFeatures(aiFeaturesData.features)
    } catch (err) {
      setError(err.message)
      if (String(err.message).toLowerCase().includes('token')) {
        localStorage.removeItem(ADMIN_TOKEN_KEY)
        setToken('')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (integratedToken) {
      setToken(integratedToken)
      loadAll(integratedToken)
    } else {
      const saved = localStorage.getItem(ADMIN_TOKEN_KEY)
      if (saved) {
        setToken(saved)
        loadAll(saved)
      }
    }
  }, [integratedToken])

  if (!token && !integratedToken) return <AdminLogin onLogin={(nextToken, nextAdmin) => { setToken(nextToken); setAdmin(nextAdmin); loadAll(nextToken) }} />

  async function handleLogout() {
    try {
      await authed('/admin/logout', { method: 'POST' })
    } catch {
      // Logout should continue even if activity logging fails.
    }
    if (onIntegratedLogout) {
      onIntegratedLogout()
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      setToken('')
    }
  }

  async function updateUserStatus(id, status) {
    try {
      await authed(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status } : u))
    } catch (err) {
      alert(`Failed to update status: ${err.message}`)
    }
  }
  async function updateUserRole(id, role) {
    await authed(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } })
    await loadAll()
  }
  async function deleteUser(id) {
    if (!confirm('Delete this user permanently?')) return
    await authed(`/admin/users/${id}`, { method: 'DELETE' })
    await loadAll()
  }

  async function handleViewUser(id) {
    try {
      const data = await authed(`/admin/users/${id}`)
      setSelectedUser(data)
    } catch (err) {
      alert(err.message)
    }
  }

  async function createPlan(form, reset) {
    await authed('/admin/plans', { method: 'POST', body: { ...form, features: String(form.features || '').split(',').map((item) => item.trim()).filter(Boolean) } })
    reset?.()
    await loadAll()
  }
  async function updatePlan(plan) {
    await authed(`/admin/plans/${plan._id}`, {
      method: 'PUT',
      body: {
        name: plan.name,
        price: plan.price || 0,
        currency: plan.currency || 'INR',
        status: plan.status || 'active',
        diamonds: plan.diamonds || 0,
        features: plan.features || [],
      }
    })
    await loadAll()
  }
  async function deletePlan(id) {
    if (!confirm('Delete this subscription plan?')) return
    await authed(`/admin/plans/${id}`, { method: 'DELETE' })
    await loadAll()
  }
  async function updateAdminProfile(form) {
    const data = await authed('/admin/profile', { method: 'PATCH', body: form })
    setAdmin(data.admin)
    await loadAll()
  }

  async function saveAiFeatures(features) {
    setAiSaving(true)
    setAiMessage('')
    try {
      await authed('/admin/ai-features', { method: 'PUT', body: features })
      setAiFeatures(features)
      setAiMessage('✅ AI feature settings saved successfully!')
      setTimeout(() => setAiMessage(''), 4000)
    } catch (err) {
      setAiMessage(`❌ Failed to save: ${err.message}`)
    } finally {
      setAiSaving(false)
    }
  }

  const adminInitials = (admin?.name || admin?.email || 'DL').split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button type="button" className="admin-brand admin-brand-button" onClick={() => setEditingProfile(true)}>
          <span>{admin?.avatar_url ? <img src={admin.avatar_url} alt={admin?.name || 'Admin'} /> : adminInitials}</span>
          <div><strong>{admin?.name || 'Admin Panel'}</strong><small>{admin?.email}</small><em>Edit profile</em></div>
        </button>
        <nav>
          {navItems.map((item) => (
            <button key={item.key} className={active === item.key ? 'active' : ''} onClick={() => setActive(item.key)}>
              <Icon name={item.icon} /> {item.label}
            </button>
          ))}
        </nav>
        <button className="admin-logout" onClick={handleLogout}>Logout</button>
      </aside>
      <main className="admin-main">
        {error ? <div className="admin-error top">{error}</div> : null}
        {active === 'analytics' ? <AnalyticsPage analytics={analytics} loading={loading} /> : null}
        {active === 'users' ? <UsersPage users={users} onStatus={updateUserStatus} onRole={updateUserRole} onDelete={deleteUser} onViewUser={handleViewUser} /> : null}
        {active === 'payments' ? <PaymentsPage payments={payments} onCreatePlan={createPlan} onUpdatePlan={updatePlan} onDeletePlan={deletePlan} /> : null}
        {active === 'emails' ? <EmailsPage users={users} token={token} /> : null}
        {active === 'aifeatures' ? <AIFeaturesPage features={aiFeatures} onSave={saveAiFeatures} saving={aiSaving} message={aiMessage} /> : null}
        {active === 'activity' ? <ActivityLogsPage logs={activityLogs} loading={loading} /> : null}
        {active === 'authLogs' ? <AuthLogsPage logs={authLogs} loading={loading} /> : null}
      </main>
      
      {selectedUser && (
        <UserDetailsModal 
          userDetails={selectedUser} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
      {editingProfile ? (
        <AdminProfileModal
          admin={admin}
          onClose={() => setEditingProfile(false)}
          onSave={updateAdminProfile}
        />
      ) : null}
    </div>
  )
}
