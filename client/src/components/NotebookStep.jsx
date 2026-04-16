'use client'

import { useEffect, useRef, useState } from 'react'

// ── constants ──────────────────────────────────────────────────
const STORAGE_KEY = 'datalytics-notebooks'

const FONTS = [
  { label: 'Inter',        value: 'Inter, sans-serif' },
  { label: 'Georgia',      value: 'Georgia, serif' },
  { label: 'Courier New',  value: '"Courier New", monospace' },
  { label: 'Poppins',      value: 'Poppins, sans-serif' },
  { label: 'Dancing Script', value: '"Dancing Script", cursive' },
  { label: 'Roboto Mono',  value: '"Roboto Mono", monospace' },
]

const THEMES = [
  { label: 'Dark',       bg: '#0d1117', text: '#e6edf3', accent: '#00c6ff' },
  { label: 'Midnight',   bg: '#0a0020', text: '#d4b8ff', accent: '#a855f7' },
  { label: 'Forest',     bg: '#0d1f0f', text: '#b7efc5', accent: '#22c55e' },
  { label: 'Sunset',     bg: '#1a0a00', text: '#ffd6b8', accent: '#ff6a00' },
  { label: 'Ocean',      bg: '#001525', text: '#b8e8ff', accent: '#38bdf8' },
  { label: 'Paper',      bg: '#fdf6e3', text: '#2d2320', accent: '#b45309' },
  { label: 'Rose',       bg: '#1a0012', text: '#ffd6f0', accent: '#f43f8e' },
  { label: 'Slate',      bg: '#0f172a', text: '#cbd5e1', accent: '#64748b' },
]

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadNotebooks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return []
}

function saveNotebooks(notebooks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks))
  } catch (_) {}
}

function defaultNotebook() {
  return {
    id: uid(),
    title: 'Untitled Note',
    content: '',
    font: FONTS[0].value,
    theme: THEMES[0],
    fontSize: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ── small sub-components ───────────────────────────────────────
function Tooltip({ text, children }) {
  return (
    <div className="relative group flex items-center">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-slate-800 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-white/10">
        {text}
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────
export default function NotebookStep() {
  const [notebooks, setNotebooks] = useState(() => loadNotebooks())
  const [activeId, setActiveId]   = useState(() => {
    const nb = loadNotebooks()
    return nb.length ? nb[0].id : null
  })
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [saved, setSaved] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState('list') // 'list' | 'editor'
  const autoSaveRef = useRef(null)
  const textareaRef = useRef(null)
  const isFirstMount = useRef(true)

  const active = notebooks.find(n => n.id === activeId) || null

  // ── detect mobile ─────────────────────────────────────────────
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth <= 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── persist whenever notebooks change ────────────────────────
  useEffect(() => {
    saveNotebooks(notebooks)
  }, [notebooks])

  // ── auto-focus REMOVED to prevent automatic scrolling on profile load ───────────
  useEffect(() => {
    // We strictly do NOT use textareaRef.current.focus() here anymore.
    // Focusing on an element deep in the page causes the browser to jump/scroll down.
  }, [activeId])

  // ── helpers ───────────────────────────────────────────────────
  function updateActive(patch) {
    setNotebooks(prev =>
      prev.map(n =>
        n.id === activeId
          ? { ...n, ...patch, updatedAt: new Date().toISOString() }
          : n
      )
    )
    // flash saved indicator with debounce
    clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 600)
  }

  function createNotebook() {
    const nb = defaultNotebook()
    setNotebooks(prev => [nb, ...prev])
    setActiveId(nb.id)
    if (isMobile) setMobileView('editor')
  }

  function deleteNotebook(id) {
    const next = notebooks.filter(n => n.id !== id)
    setNotebooks(next)
    if (activeId === id) {
      setActiveId(next.length ? next[0].id : null)
      if (isMobile) setMobileView('list')
    }
  }

  function startRename(nb) {
    setRenamingId(nb.id)
    setRenameValue(nb.title)
  }

  function commitRename() {
    if (!renameValue.trim()) return
    setNotebooks(prev =>
      prev.map(n => n.id === renamingId ? { ...n, title: renameValue.trim() } : n)
    )
    setRenamingId(null)
  }

  function selectNote(id) {
    setActiveId(id)
    if (isMobile) setMobileView('editor')
  }

  const filtered = notebooks.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const theme  = active?.theme  || THEMES[0]
  const font   = active?.font   || FONTS[0].value
  const fSize  = active?.fontSize || 15

  // ── word / char count ─────────────────────────────────────────
  const content = active?.content || ''
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount = content.length

  // ── sidebar visibility ────────────────────────────────────────
  const showSidebar = !isMobile || mobileView === 'list'
  const showEditor  = !isMobile || mobileView === 'editor'

  // ── render ────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        height: isMobile ? 'calc(100vh - 7rem)' : 'calc(100vh - 9rem)',
        minHeight: isMobile ? 0 : 520,
        gap: 0,
        borderRadius: isMobile ? 16 : 24,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#090f1c',
        boxShadow: '0 8px 50px rgba(0,0,0,0.5)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ── MOBILE TOP BAR ── */}
      {isMobile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'linear-gradient(180deg,#0b1120,#080d18)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#00c6ff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            📓 {mobileView === 'editor' && active ? active.title : 'Notebooks'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {mobileView === 'editor' ? (
              <button
                onClick={() => setMobileView('list')}
                style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#94a3b8', cursor: 'pointer',
                }}
              >
                ← Notes
              </button>
            ) : (
              <button
                onClick={createNotebook}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg,#00c6ff,#0066ff)',
                  border: 'none', color: '#fff', fontWeight: 900,
                  fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(0,198,255,0.4)',
                }}
              >
                +
              </button>
            )}
          </div>
        </div>
      )}

      {/* ────────── LEFT SIDEBAR ──────────────────────────────── */}
      {showSidebar && (
        <aside
          style={{
            width: isMobile ? '100%' : 230,
            minWidth: isMobile ? 0 : 230,
            flex: isMobile ? 1 : 'none',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg,#0b1120,#080d18)',
            borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* header — desktop only */}
          {!isMobile && (
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#00c6ff', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  📓 Notebooks
                </span>
                <button
                  onClick={createNotebook}
                  title="New notebook"
                  style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: 'linear-gradient(135deg,#00c6ff,#0066ff)',
                    border: 'none', color: '#fff', fontWeight: 900,
                    fontSize: 18, lineHeight: '26px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 10px rgba(0,198,255,0.4)',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  +
                </button>
              </div>
              {/* search */}
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search notes…"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                  color: '#e2e8f0', fontSize: 11, padding: '5px 10px',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* search — mobile */}
          {isMobile && (
            <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search notes…"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                  color: '#e2e8f0', fontSize: 13, padding: '8px 12px',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {filtered.length === 0 ? (
              <div style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 30 }}>
                No notebooks yet.<br />Click + to create one.
              </div>
            ) : (
              filtered.map(nb => {
                const isActive = nb.id === activeId
                return (
                  <div
                    key={nb.id}
                    onClick={() => selectNote(nb.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: isMobile ? '12px 10px' : '7px 8px',
                      borderRadius: 10, cursor: 'pointer',
                      marginBottom: isMobile ? 6 : 3,
                      background: isActive
                        ? 'linear-gradient(135deg,rgba(0,198,255,0.15),rgba(0,102,255,0.08))'
                        : 'transparent',
                      border: isActive ? '1px solid rgba(0,198,255,0.2)' : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* color dot */}
                    <div style={{
                      width: isMobile ? 10 : 8, height: isMobile ? 10 : 8,
                      borderRadius: '50%', flexShrink: 0,
                      background: nb.theme?.accent || '#00c6ff',
                      boxShadow: `0 0 6px ${nb.theme?.accent || '#00c6ff'}88`,
                    }} />

                    {renamingId === nb.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          flex: 1, background: 'rgba(0,198,255,0.1)', border: '1px solid #00c6ff50',
                          borderRadius: 5, color: '#fff', fontSize: isMobile ? 14 : 11, padding: '2px 6px', outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        onDoubleClick={e => { e.stopPropagation(); startRename(nb) }}
                        style={{
                          flex: 1, fontSize: isMobile ? 14 : 11,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#e2e8f0' : '#94a3b8',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {nb.title}
                      </span>
                    )}

                    {/* delete btn */}
                    <button
                      onClick={e => { e.stopPropagation(); deleteNotebook(nb.id) }}
                      title="Delete"
                      style={{
                        flexShrink: 0, width: isMobile ? 24 : 18, height: isMobile ? 24 : 18,
                        borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#475569', fontSize: isMobile ? 16 : 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* footer count */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: '#334155' }}>
            {notebooks.length} notebook{notebooks.length !== 1 ? 's' : ''} saved
          </div>
        </aside>
      )}

      {/* ────────── EDITOR AREA ───────────────────────────────── */}
      {showEditor && (
        active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: theme.bg, transition: 'background 0.4s', minWidth: 0 }}>

            {/* toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexWrap: 'wrap',
              padding: isMobile ? '8px 12px' : '10px 16px',
              borderBottom: `1px solid ${theme.accent}22`,
              background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
            }}>
              {/* title — on desktop only in toolbar */}
              {!isMobile && (
                <input
                  value={active.title}
                  onChange={e => updateActive({ title: e.target.value })}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: theme.text, fontSize: 15, fontWeight: 700, flex: 1, minWidth: 120,
                    borderBottom: `1px solid ${theme.accent}44`,
                  }}
                />
              )}

              {/* font picker */}
              <select
                value={active.font}
                onChange={e => updateActive({ font: e.target.value })}
                style={{
                  background: 'rgba(255,255,255,0.07)', border: `1px solid ${theme.accent}33`,
                  borderRadius: 8, color: theme.text, fontSize: isMobile ? 12 : 11,
                  padding: isMobile ? '6px 8px' : '4px 8px', cursor: 'pointer', outline: 'none',
                  maxWidth: isMobile ? 90 : 'none',
                }}
              >
                {FONTS.map(f => <option key={f.value} value={f.value} style={{ background: '#0f172a' }}>{f.label}</option>)}
              </select>

              {/* font size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => updateActive({ fontSize: Math.max(10, fSize - 1) })}
                  style={{ ...btnStyle(theme), width: isMobile ? 28 : 22, height: isMobile ? 28 : 22, fontSize: 14 }}>−</button>
                <span style={{ color: theme.text, fontSize: 11, minWidth: 20, textAlign: 'center' }}>{fSize}</span>
                <button onClick={() => updateActive({ fontSize: Math.min(32, fSize + 1) })}
                  style={{ ...btnStyle(theme), width: isMobile ? 28 : 22, height: isMobile ? 28 : 22, fontSize: 14 }}>+</button>
              </div>

              {/* theme dots */}
              <div style={{ display: 'flex', gap: isMobile ? 7 : 5, alignItems: 'center' }}>
                {THEMES.map(t => (
                  <button
                    key={t.label}
                    title={t.label}
                    onClick={() => updateActive({ theme: t })}
                    style={{
                      width: isMobile ? 18 : 14, height: isMobile ? 18 : 14,
                      borderRadius: '50%', cursor: 'pointer',
                      background: t.accent,
                      border: active.theme?.label === t.label ? `2px solid #fff` : '2px solid transparent',
                      boxShadow: `0 0 6px ${t.accent}88`, outline: 'none', transition: 'transform 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  />
                ))}
              </div>

              {/* saved indicator */}
              {saved && (
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                  ✓ Saved
                </span>
              )}

              {/* word count */}
              <span style={{ fontSize: 10, color: theme.text + '66', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {wordCount}w · {charCount}c
              </span>
            </div>

            {/* title input — mobile only, below toolbar */}
            {isMobile && (
              <div style={{ padding: '8px 14px', borderBottom: `1px solid ${theme.accent}18` }}>
                <input
                  value={active.title}
                  onChange={e => updateActive({ title: e.target.value })}
                  placeholder="Note title…"
                  style={{
                    width: '100%', background: 'transparent', border: 'none', outline: 'none',
                    color: theme.text, fontSize: 17, fontWeight: 700,
                    borderBottom: `1px solid ${theme.accent}44`, paddingBottom: 4,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* textarea */}
            <textarea
              ref={textareaRef}
              value={active.content}
              onChange={e => updateActive({ content: e.target.value })}
              placeholder={`Start writing "${active.title}"…\n\nCapture your ideas, plans, data notes — anything.\nDouble-click a notebook name to rename it.`}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                background: 'transparent',
                color: theme.text,
                fontFamily: font,
                fontSize: fSize,
                lineHeight: 1.75,
                padding: isMobile ? '16px 16px' : '24px 32px',
                transition: 'color 0.4s, font-family 0.2s, font-size 0.2s',
                caretColor: theme.accent,
              }}
              spellCheck
            />

            {/* status bar */}
            <div style={{
              padding: '6px 16px', borderTop: `1px solid ${theme.accent}18`,
              background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center',
              gap: isMobile ? 6 : 12, fontSize: 10, color: theme.text + '50',
              flexWrap: 'wrap',
            }}>
              <span>📓 {active.title}</span>
              {!isMobile && <><span>·</span><span>Updated {new Date(active.updatedAt).toLocaleTimeString()}</span></>}
              <span>·</span>
              <span style={{ color: theme.accent, fontWeight: 600 }}>{theme.label} theme</span>
            </div>
          </div>
        ) : (
          // empty state
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#090f1c', gap: 16 }}>
            <div style={{ fontSize: 48 }}>📓</div>
            <p style={{ color: '#475569', fontSize: 14 }}>No notebook selected</p>
            <button
              onClick={createNotebook}
              style={{
                padding: '10px 24px', borderRadius: 12,
                background: 'linear-gradient(135deg,#00c6ff,#0066ff)',
                border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: 'pointer', boxShadow: '0 0 20px rgba(0,198,255,0.3)',
              }}
            >
              + Create First Notebook
            </button>
          </div>
        )
      )}
    </div>
  )
}

function btnStyle(theme) {
  return {
    background: 'rgba(255,255,255,0.07)',
    border: `1px solid ${theme.accent}33`,
    borderRadius: 6, color: theme.text,
    cursor: 'pointer', outline: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  }
}
