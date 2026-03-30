import { useState, useRef, useEffect } from 'react'
import client from '../api/client.js'

const QUICK_QUESTIONS = [
  'What is the max value?',
  'Show column statistics',
  'How many null values?',
  'What are the top categories?',
  'Describe the dataset',
  'What are the data types?',
  'Show correlation matrix',
  'Find outliers',
]

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Hi! I am **Datalytics AI**. Upload a dataset and ask me anything about it — like "max salary?", "average age?", or "how many nulls?"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasDataset, setHasDataset] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  async function sendMessage(text) {
    const msg = text || input.trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    setIsTyping(true)

    try {
      const res = await client.post('/chat', { message: msg })
      setHasDataset(res.data.has_dataset)
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }])
    } catch (err) {
      const errMsg = err?.response?.data?.detail || 'Sorry, something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }])
    } finally {
      setLoading(false)
      setIsTyping(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function clearHistory() {
    try {
      await client.delete('/chat/clear')
      setMessages([{
        role: 'assistant',
        content: '🗑️ Chat cleared! Ask me anything about your dataset.',
      }])
    } catch {}
  }

  function renderMessage(content) {
    // Enhanced markdown rendering
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:#0f172a;padding:2px 6px;border-radius:4px;font-size:12px">$1</code>')
      .replace(/\n/g, '<br>')
      .replace(/(\d+\.?\d*)/g, '<span style="color:#f97316;font-weight:600">$1</span>')
      .replace(/\b(max|min|average|mean|count|null|unique)\b/gi, '<span style="color:#8b5cf6;font-weight:500">$1</span>')
  }

  return (
    <>
      {/* Floating Button */}
      <button
        id="chatbot-toggle"
        className={`chatbot-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle AI chatbot"
        title="Ask AI about your dataset"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="chatbot-fab-ping" />
          </>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="chatbot-panel" id="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div>
                <div className="chatbot-title">Datalytics AI</div>
                <div className="chatbot-status">
                  <span className={`chatbot-status-dot ${hasDataset ? 'online' : 'offline'}`} />
                  {hasDataset ? 'Dataset loaded' : 'No dataset — upload CSV first'}
                </div>
              </div>
            </div>
            <div className="chatbot-header-right">
              <button className="chatbot-clear-btn" onClick={clearHistory} title="Clear chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                </svg>
              </button>
              <button className="chatbot-minimize-btn" onClick={() => setOpen(false)} title="Minimize">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick questions */}
          <div className="chatbot-quick">
            <div className="chatbot-quick-title">Quick Questions</div>
            <div className="chatbot-quick-grid">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  className="chatbot-quick-btn"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-msg chatbot-msg--${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="chatbot-msg-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                )}
                <div className="chatbot-msg-content">
                  <div
                    className="chatbot-msg-bubble"
                    dangerouslySetInnerHTML={{ __html: renderMessage(m.content) }}
                  />
                  <div className="chatbot-msg-time">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chatbot-msg chatbot-msg--assistant">
                <div className="chatbot-msg-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div className="chatbot-msg-content">
                  <div className="chatbot-msg-bubble chatbot-typing">
                    <div className="typing-dots">
                      <span /><span /><span />
                    </div>
                    <div className="typing-text">AI is thinking...</div>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input-row">
            <div className="chatbot-input-wrapper">
              <textarea
                ref={inputRef}
                className="chatbot-input"
                placeholder="Ask about your dataset… (e.g., What's the average age?)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={loading}
              />
              <div className="chatbot-input-actions">
                <button className="chatbot-attach-btn" title="Attach file">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              className={`chatbot-send-btn ${loading || !input.trim() ? 'disabled' : ''}`}
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              {loading ? (
                <div className="send-spinner">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
