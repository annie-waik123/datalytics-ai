import { useMemo, useRef, useState } from 'react'
import { buildDatasetSummary } from '../lib/dataUtils.js'
import { DEFAULT_DATASET_INTELLIGENCE_PROMPT } from '../utils/aiIntelligence.js'
import { chatWithGroq } from '../utils/groq.js'
import { useToast } from '../hooks/useToast.js'

const QUICK_QUESTIONS = [
  'Give me complete recommendations and insights for this dataset.',
  DEFAULT_DATASET_INTELLIGENCE_PROMPT,
  'Predict churn risk',
  'Summarize the data',
  'Find anomalies and root causes',
]

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

  const datasetSummary = useMemo(
    () => buildDatasetSummary(dataset, datasetProfile),
    [dataset, datasetProfile]
  )

  async function handleSend(question) {
    const query = question || input.trim()
    if (!query || loading) return
    lastQuestionRef.current = query
    setInput('')
    setStatusMessage('')
    setMessages((prev) => [...prev, { role: 'user', content: query }])
    setLoading(true)
    setStreamingText('')

    const groqMessages = [
      {
        role: 'system',
        content: `You are a data analyst. Use the dataset summary to answer questions clearly and concisely. Dataset summary: ${JSON.stringify(datasetSummary)}`,
      },
      ...messages,
      { role: 'user', content: query },
    ]

    try {
      const response = await chatWithGroq(groqMessages, datasetSummary)
      setStatusMessage(response.notice || '')
      await streamResponse(response.content)
      onComplete('aiInsights')
    } catch (err) {
      const message = 'AI insights are temporarily unavailable. Please retry.'
      addToast(message, () => handleSend(lastQuestionRef.current), 'error')
    } finally {
      setLoading(false)
    }
  }

  function streamResponse(text) {
    return new Promise((resolve) => {
      let index = 0
      const step = () => {
        index += 1
        setStreamingText(text.slice(0, index))
        if (index >= text.length) {
          setMessages((prev) => [...prev, { role: 'assistant', content: text }])
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
          <p className="ai-subtitle">Chat about the loaded dataset, with Groq when configured and local fallback when it is not.</p>
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
              <button key={item} type="button" onClick={() => handleSend(item)}>
                {item}
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
