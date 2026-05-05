import { useEffect, useRef, useState } from 'react'
import { sendChatMessage } from '../api/chat.js'
import { generateAIInsights, generateRecommendationInsights, syncInsightsDataset } from '../api/insights.js'
import { useToast } from '../hooks/useToast.js'
import client from '../api/client.js'

const DEFAULT_AI_INSIGHT_PROMPT = 'Generate 35-40 deep AI insights from the uploaded dataset. Cover all 8 categories: Hidden Correlations, Anomaly Detections, Trend Discoveries, Segment Insights, Predictive Signals, Risk Flags, Optimization Opportunities, and Benchmark Deviations.'

const QUICK_QUESTIONS = [
  { label: '📊 What are the key columns?', mode: 'ai_insights' },
  { label: '📈 Show me the data summary', mode: 'ai_insights' },
  { label: '🔍 What patterns do you see?', mode: 'ai_insights' },
  { label: '💡 What should I focus on?', mode: 'ai_insights' },
]

const RECOMMENDATION_HINTS = [
  'recommend',
  'strategy',
  'strategic',
  'opportunit',
  'risk',
  'executive summary',
  'business problem',
]

const AI_INSIGHT_HINTS = [
  'insight',
  'pattern',
  'anomal',
  'predict',
  'forecast',
  'root cause',
  'customer',
  'segment',
  'retention',
  'driver',
  'correlation',
  'seasonality',
]


function resolveMode(query, forcedMode) {
  if (forcedMode) {
    return forcedMode
  }

  const lower = String(query || '').toLowerCase()

  if (RECOMMENDATION_HINTS.some((hint) => lower.includes(hint))) {
    return 'recommendation_insights'
  }

  if (AI_INSIGHT_HINTS.some((hint) => lower.includes(hint))) {
    return 'ai_insights'
  }

  return 'chat'
}


function buildStatusMessage(mode, payload, usedChatEngine = false) {
  const generated = payload?.generated_response || payload || {}
  const source = String(generated.source || payload?.source || '').toLowerCase()
  const provider = String(generated.provider || payload?.provider || '').toLowerCase()

  if (usedChatEngine || source === 'data_engine') {
    return 'Using backend dataset query engine for exact answers.'
  }

  if (source === 'local_fallback') {
    return `Using backend ${mode} generation with local fallback because no live AI provider is configured.`
  }

  if (provider || source) {
    const label = (provider || source).replace(/[_-]+/g, ' ')
    return `Using backend ${mode} generation with ${label}.`
  }

  return `Using backend ${mode} generation.`
}


async function fetchInsightResponse(query, mode, options = {}) {
  if (mode === 'chat') {
    const response = await sendChatMessage(query, null, options)
    return {
      content: response?.answer || response?.reply || 'I could not generate a reply for that request.',
      statusMessage: buildStatusMessage(response?.mode || mode, response, response?.source === 'data_engine'),
    }
  }

  const response = mode === 'recommendation_insights'
    ? await generateRecommendationInsights(query, mode, options)
    : await generateAIInsights(query, mode, options)

  return {
    content:
      response?.generated_response?.content
      || response?.answer
      || 'I could not generate a reply for that request.',
    statusMessage: buildStatusMessage(mode, response, false),
  }
}

// ── Fly-to-dashboard particle animation ──────────────────────────────────────
function spawnFlyParticle(originEl, onDone) {
  // Find the sidebar (left pipeline) - look for the ds-sidebar or main nav
  const sidebarEl =
    document.querySelector('.ds-sidebar') ||
    document.querySelector('[class*="sidebar"]') ||
    document.querySelector('nav')

  const originRect = originEl.getBoundingClientRect()
  const targetRect = sidebarEl
    ? sidebarEl.getBoundingClientRect()
    : { left: 0, top: window.innerHeight / 2, width: 240 }

  // Create floating orb
  const particle = document.createElement('div')
  particle.style.cssText = `
    position: fixed;
    z-index: 9999;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #22c55e, #f97316);
    box-shadow: 0 0 24px rgba(34,197,94,0.8), 0 0 48px rgba(249,115,22,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: white;
    pointer-events: none;
    top: ${originRect.top + originRect.height / 2 - 24}px;
    left: ${originRect.left + originRect.width / 2 - 24}px;
    transition: all 0.75s cubic-bezier(0.23, 1, 0.32, 1);
    opacity: 1;
    transform: scale(1);
  `
  particle.textContent = '📊'
  document.body.appendChild(particle)

  // Spawn trailing sparks
  for (let i = 0; i < 8; i++) {
    const spark = document.createElement('div')
    const angle = (i / 8) * 360
    spark.style.cssText = `
      position: fixed;
      z-index: 9998;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${i % 2 === 0 ? '#22c55e' : '#f97316'};
      top: ${originRect.top + originRect.height / 2 - 3}px;
      left: ${originRect.left + originRect.width / 2 - 3}px;
      pointer-events: none;
      transition: all 0.6s ease-out;
      opacity: 1;
    `
    document.body.appendChild(spark)

    requestAnimationFrame(() => {
      spark.style.transform = `translate(${Math.cos(angle * Math.PI / 180) * 50}px, ${Math.sin(angle * Math.PI / 180) * 50}px) scale(0)`
      spark.style.opacity = '0'
    })

    setTimeout(() => spark.remove(), 650)
  }

  // Animate orb to sidebar target position
  const destX = targetRect.left + targetRect.width / 2 - 24
  const destY = targetRect.top + targetRect.height / 2 - 24

  requestAnimationFrame(() => {
    particle.style.top = `${destY}px`
    particle.style.left = `${destX}px`
    particle.style.transform = 'scale(0.4)'
    particle.style.opacity = '0'
  })

  // Sidebar flash effect
  setTimeout(() => {
    if (sidebarEl) {
      sidebarEl.style.transition = 'box-shadow 0.3s ease'
      sidebarEl.style.boxShadow = '0 0 32px rgba(34,197,94,0.6), inset 0 0 32px rgba(34,197,94,0.15)'
      setTimeout(() => {
        sidebarEl.style.boxShadow = ''
      }, 600)
    }
    particle.remove()
    if (onDone) onDone()
  }, 800)
}

export default function AIInsightsStep({ dataset, datasetProfile, onComplete, onJumpToUpload }) {
  const { addToast } = useToast()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [flyingMessageIdx, setFlyingMessageIdx] = useState(null)
  const lastQuestionRef = useRef('')
  const abortControllerRef = useRef(null)
  const streamFrameRef = useRef(null)
  const streamCancelledRef = useRef(false)
  const messagesEndRef = useRef(null)
  const displayRows = datasetProfile?.totalRowCount || datasetProfile?.rowCount || 0
  const displayColumns = datasetProfile?.totalColumnCount || datasetProfile?.columnCount || 0

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (streamFrameRef.current) {
        cancelAnimationFrame(streamFrameRef.current)
      }
      streamCancelledRef.current = true
    }
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  function isAbortError(error) {
    return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'
  }

  function handlePause() {
    const hasActiveWork = loading || Boolean(streamingText)
    if (!hasActiveWork) return

    streamCancelledRef.current = true

    if (streamFrameRef.current) {
      cancelAnimationFrame(streamFrameRef.current)
      streamFrameRef.current = null
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setLoading(false)
    setStatusMessage('Current AI response paused.')
  }

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to unlock AI insights</h2>
        <p>Ask questions about drivers, trends, and anomalies once data is available.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  async function handleSend(question, forcedMode = null) {
    const query = String(question || input).trim()
    if (!query || loading) return

    const mode = resolveMode(query, forcedMode)
    const controller = new AbortController()

    abortControllerRef.current = controller
    streamCancelledRef.current = false
    lastQuestionRef.current = query
    setInput('')
    setStatusMessage('')
    setMessages((prev) => [...prev, { role: 'user', content: query }])
    setLoading(true)
    setStreamingText('')

    try {
      await syncInsightsDataset(dataset, { signal: controller.signal })
      const response = await fetchInsightResponse(query, mode, { signal: controller.signal })
      setStatusMessage(response.statusMessage || '')
      const completed = await streamResponse(response.content)
      if (!completed) {
        return
      }
      onComplete('aiInsights')
      // Log every query individually to MongoDB
      client.post('/user-activities/log', {
        action: 'Query',
        category: 'queries',
        details: query.slice(0, 120),
        metadata: { mode },
      }).catch(() => {})
    } catch (err) {
      if (isAbortError(err)) {
        setStatusMessage('Current AI response paused.')
        return
      }
      const message = 'AI insights are temporarily unavailable. Please retry.'
      addToast(message, () => handleSend(lastQuestionRef.current, forcedMode), 'error')
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      setLoading(false)
    }
  }

  function streamResponse(text) {
    return new Promise((resolve) => {
      let index = 0
      const safeText = String(text || '')

      streamCancelledRef.current = false

      if (!safeText) {
        setStreamingText('')
        resolve(true)
        return
      }

      const finalize = (completed) => {
        if (completed) {
          setMessages((prev) => [...prev, { role: 'assistant', content: safeText }])
        } else if (index > 0) {
          setMessages((prev) => [...prev, { role: 'assistant', content: safeText.slice(0, index) }])
        }
        setStreamingText('')
        streamFrameRef.current = null
        resolve(completed)
      }

      const step = () => {
        if (streamCancelledRef.current) {
          finalize(false)
          return
        }
        index += 1
        setStreamingText(safeText.slice(0, index))
        if (index >= safeText.length) {
          finalize(true)
          return
        }
        streamFrameRef.current = requestAnimationFrame(step)
      }

      streamFrameRef.current = requestAnimationFrame(step)
    })
  }

  function handleAddToDashboard(event, messageContent, idx) {
    setFlyingMessageIdx(idx)
    const btnEl = event.currentTarget

    // Spawn fly animation
    spawnFlyParticle(btnEl, () => {
      // After animation: dispatch the widget event
      window.dispatchEvent(new CustomEvent('datalytics:create-dashboard-widget', {
        detail: {
          chart_type: 'text_box',
          title: 'AI Insight',
          insight: messageContent,
        }
      }))
      setFlyingMessageIdx(null)
      addToast('✅ AI Insight added to Power BI Dashboard!', null, 'success')
    })
  }

  return (
    <div className="ai-container">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="ai-header">
        <div>
          <h2 className="ai-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: 'linear-gradient(135deg,#22c55e,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Insights</span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: '6px', padding: '2px 8px', fontWeight: 600, letterSpacing: '0.06em', WebkitTextFillColor: '#22c55e' }}>EIGHTEEN AI</span>
          </h2>
          <p className="ai-subtitle">Ask exact data questions or generate backend-powered AI insights from the uploaded dataset.</p>
        </div>
      </div>

      {statusMessage && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{statusMessage}</div>
      )}

      <div className="ai-chat-shell">
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div className="ai-chat-sidebar">
          <div className="ai-chat-summary">
            <div className="ai-chat-metric">
              <span>Rows</span>
              <strong>{displayRows.toLocaleString()}</strong>
            </div>
            <div className="ai-chat-metric">
              <span>Columns</span>
              <strong>{displayColumns}</strong>
            </div>
            <div className="ai-chat-metric">
              <span>Missing</span>
              <strong>{datasetProfile.missingTotal}</strong>
            </div>
          </div>

          <div className="ai-quick-questions">
            <div className="ai-quick-title">Suggested questions</div>
            {QUICK_QUESTIONS.map((item) => (
              <button key={item.label} type="button" onClick={() => handleSend(item.label, item.mode)}>
                {item.label}
              </button>
            ))}
          </div>

          {/* Dashboard tip */}
          <div style={{
            marginTop: '1rem',
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(34,197,94,0.07)',
            border: '1px solid rgba(34,197,94,0.2)',
            fontSize: '0.75rem',
            color: 'rgba(240,244,255,0.65)',
            lineHeight: 1.5,
          }}>
            <span style={{ color: '#22c55e', fontWeight: 700, display: 'block', marginBottom: 4 }}>💡 Tip</span>
            Click <strong style={{ color: '#f97316' }}>+ Add to Dashboard</strong> below any AI response to instantly pin it to your Power BI Dashboard.
          </div>
        </div>

        {/* ── Chat Main ───────────────────────────────────────── */}
        <div className="ai-chat-main">
          <div className="ai-chat-messages">
            {messages.length === 0 && !streamingText ? (
              <div className="ai-chat-empty" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'var(--text-muted)', textAlign: 'center', gap: '20px'
              }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(34,197,94,0.1))',
                  border: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: '0 0 40px rgba(249,115,22,0.15), inset 0 0 20px rgba(255,255,255,0.05)',
                  display: 'grid', placeItems: 'center', fontSize: '2.5rem',
                  animation: 'pulse 3s infinite alternate'
                }}>🧠</div>
                <div style={{ maxWidth: '400px', lineHeight: '1.6' }}>
                  <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '8px', fontWeight: '700' }}>How can I help you analyze?</h3>
                  <p style={{ fontSize: '0.95rem' }}>Ask a question or click a quick action to generate industry-level intelligence from your dataset.</p>
                </div>
              </div>
            ) : (
              messages.map((message, idx) => (
                <div
                  key={`${message.role}-${idx}`}
                  className={`ai-chat-bubble ${message.role}`}
                  style={{
                    animation: 'bubbleIn 0.35s cubic-bezier(0.23,1,0.32,1) both',
                  }}
                >
                  {message.role === 'assistant' ? (
                    <div>
                      <AIResponseRenderer content={message.content} />
                      {/* ── Add to Dashboard button ─── */}
                      <div style={{ marginTop: '0.9rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={(e) => handleAddToDashboard(e, message.content, idx)}
                          disabled={flyingMessageIdx === idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '5px 14px',
                            borderRadius: '20px',
                            border: '1px solid rgba(34,197,94,0.45)',
                            background: flyingMessageIdx === idx
                              ? 'rgba(34,197,94,0.3)'
                              : 'rgba(34,197,94,0.1)',
                            color: '#22c55e',
                            cursor: flyingMessageIdx === idx ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            letterSpacing: '0.04em',
                          }}
                          onMouseEnter={e => {
                            if (flyingMessageIdx !== idx) {
                              e.currentTarget.style.background = 'rgba(34,197,94,0.2)'
                              e.currentTarget.style.boxShadow = '0 0 12px rgba(34,197,94,0.35)'
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = flyingMessageIdx === idx ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.1)'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          {flyingMessageIdx === idx ? (
                            <>
                              <span style={{
                                display: 'inline-block',
                                width: '10px', height: '10px',
                                borderRadius: '50%',
                                border: '2px solid #22c55e',
                                borderTopColor: 'transparent',
                                animation: 'spin 0.6s linear infinite',
                              }} />
                              Sending…
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 3h18v18H3z" />
                                <path d="M3 9h18M9 21V9" />
                              </svg>
                              + Add to Dashboard
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="ai-chat-bubble assistant" style={{ animation: 'bubbleIn 0.35s ease both' }}>
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: '#22c55e', fontWeight: 600 }}>Eighteen AI is analysing…</span>
              </div>
            )}
            {streamingText && (
              <div className="ai-chat-bubble assistant" style={{ animation: 'bubbleIn 0.35s ease both' }}>
                <AIResponseRenderer content={streamingText} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ─────────────────────────────────────────── */}
          <div className="ai-chat-input">
            <input
              type="text"
              placeholder="Ask anything about the dataset…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSend()
                }
              }}
            />
            <div className="ai-chat-input-actions">
              <button
                type="button"
                className="btn btn-secondary ai-chat-pause-btn"
                onClick={handlePause}
                disabled={!loading && !streamingText}
                title="Pause"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" fill="url(#goldGradient2)" opacity="0.95"/>
                  <rect x="8" y="8" width="8" height="8" fill="white" rx="1.5"/>
                  <defs>
                    <linearGradient id="goldGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#FFB347', stopOpacity: 1 }} />
                      <stop offset="60%" style={{ stopColor: '#F97316', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#EA580C', stopOpacity: 1 }} />
                    </linearGradient>
                  </defs>
                </svg>
              </button>
              <button 
                type="button" 
                onClick={() => handleSend()} 
                disabled={loading || !input.trim()}
                style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: (loading || !input.trim()) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #f97316, #ea580c)',
                  border: 'none', color: '#fff', cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
                  display: 'grid', placeItems: 'center', transition: 'all 0.2s',
                  boxShadow: (loading || !input.trim()) ? 'none' : '0 4px 14px rgba(249, 115, 22, 0.4)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AIResponseRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  
  return (
    <div className="ai-formatted-response" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', lineHeight: '1.6' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: '0.4rem' }} />;
        
        const parts = trimmed.split(/(\*\*.*?\*\*)/g).map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        if (/^[-•*]\s/.test(trimmed)) {
          const bulletContent = trimmed.replace(/^[-•*]\s*/, '');
          const bulletParts = bulletContent.split(/(\*\*.*?\*\*)/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>;
            }
            return part;
          });
          return <li key={idx} style={{ marginLeft: '1.2rem', listStyleType: 'disc', marginBottom: '4px' }}>{bulletParts}</li>;
        }

        if (/^\d+\.\s/.test(trimmed)) {
          return <div key={idx} style={{ fontWeight: 600, marginTop: '0.5rem', color: '#6ee7b7' }}>{parts}</div>;
        }

        if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
          return <div key={idx} style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '1rem', color: '#f97316' }}>{parts.map(p => typeof p === 'string' ? p.replace(/^#+\s*/, '') : p)}</div>;
        }

        return <div key={idx}>{parts}</div>;
      })}
    </div>
  );
}
