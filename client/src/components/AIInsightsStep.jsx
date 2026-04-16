import { useRef, useState } from 'react'
import { sendChatMessage } from '../api/chat.js'
import { generateAIInsights, generateRecommendationInsights, syncInsightsDataset } from '../api/insights.js'
import { useToast } from '../hooks/useToast.js'
import client from '../api/client.js'

const DEFAULT_AI_INSIGHT_PROMPT = 'Analyze the available business data and generate deep AI-driven insights.'

const QUICK_QUESTIONS = [
  { label: 'What is the source of the dataset?', mode: 'chat' },
  { label: 'What are the features and target variable?', mode: 'chat' },
  { label: 'Are there missing values or outliers?', mode: 'chat' },
  { label: 'What is the size and distribution of the dataset?', mode: 'chat' },
  { label: 'Is the dataset balanced or imbalanced?', mode: 'chat' },
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

  if (usedChatEngine || source === 'data_engine') {
    return 'Using backend dataset query engine for exact answers.'
  }

  if (source === 'groq') {
    return `Using backend ${mode} generation with Groq.`
  }

  if (source === 'local_fallback') {
    return `Using backend ${mode} generation with local fallback because Groq is not configured.`
  }

  return `Using backend ${mode} generation.`
}


async function fetchInsightResponse(query, mode) {
  if (mode === 'chat') {
    const response = await sendChatMessage(query)
    return {
      content: response?.answer || response?.reply || 'I could not generate a reply for that request.',
      statusMessage: buildStatusMessage(response?.mode || mode, response, response?.source === 'data_engine'),
    }
  }

  const response = mode === 'recommendation_insights'
    ? await generateRecommendationInsights(query, mode)
    : await generateAIInsights(query, mode)

  return {
    content:
      response?.generated_response?.content
      || response?.answer
      || 'I could not generate a reply for that request.',
    statusMessage: buildStatusMessage(mode, response, false),
  }
}


export default function AIInsightsStep({ dataset, datasetProfile, onComplete, onJumpToUpload }) {
  const { addToast } = useToast()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const lastQuestionRef = useRef('')

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
    lastQuestionRef.current = query
    setInput('')
    setStatusMessage('')
    setMessages((prev) => [...prev, { role: 'user', content: query }])
    setLoading(true)
    setStreamingText('')

    try {
      await syncInsightsDataset(dataset)
      const response = await fetchInsightResponse(query, mode)
      setStatusMessage(response.statusMessage || '')
      await streamResponse(response.content)
      onComplete('aiInsights')
      // Log every query individually to MongoDB
      client.post('/user-activities/log', {
        action: 'Query',
        category: 'queries',
        details: query.slice(0, 120),
        metadata: { mode },
      }).catch(() => {})
    } catch (err) {
      const message = 'AI insights are temporarily unavailable. Please retry.'
      addToast(message, () => handleSend(lastQuestionRef.current, forcedMode), 'error')
    } finally {
      setLoading(false)
    }
  }

  function streamResponse(text) {
    return new Promise((resolve) => {
      let index = 0
      const safeText = String(text || '')

      const step = () => {
        index += 1
        setStreamingText(safeText.slice(0, index))
        if (index >= safeText.length) {
          setMessages((prev) => [...prev, { role: 'assistant', content: safeText }])
          setStreamingText('')
          resolve()
          return
        }
        requestAnimationFrame(step)
      }

      requestAnimationFrame(step)
    })
  }

  return (
    <div className="ai-container">
      <div className="ai-header">
        <div>
          <h2 className="ai-title">AI Insights</h2>
          <p className="ai-subtitle">Ask exact data questions or generate backend-powered AI insights from the uploaded dataset.</p>
        </div>
      </div>

      {statusMessage && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{statusMessage}</div>
      )}

      <div className="ai-chat-shell">
        <div className="ai-chat-sidebar">
          <div className="ai-chat-summary">
            <div className="ai-chat-metric">
              <span>Rows</span>
              <strong>{datasetProfile.rowCount.toLocaleString()}</strong>
            </div>
            <div className="ai-chat-metric">
              <span>Columns</span>
              <strong>{datasetProfile.columnCount}</strong>
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
        </div>

        <div className="ai-chat-main">
          <div className="ai-chat-messages">
            {messages.length === 0 && !streamingText ? (
              <div className="ai-chat-empty">Ask a question to get started.</div>
            ) : (
              messages.map((message, idx) => (
                <div key={`${message.role}-${idx}`} className={`ai-chat-bubble ${message.role}`}>
                  {message.content}
                </div>
              ))
            )}
            {loading && (
              <div className="ai-chat-bubble assistant">
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {streamingText && (
              <div className="ai-chat-bubble assistant">{streamingText}</div>
            )}
          </div>

          <div className="ai-chat-input">
            <input
              type="text"
              placeholder="Ask anything about the dataset..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSend()
                }
              }}
            />
            <button type="button" className="btn btn-primary" onClick={() => handleSend()} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
