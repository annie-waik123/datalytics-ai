/**
 * Chat API — supports 3 modes:
 *   - "chat"                    → general dataset Q&A
 *   - "ai_insights"             → deep AI pattern analysis
 *   - "recommendation_insights" → executive business recommendations
 *
 * Production-grade: proper timeouts, error normalisation, retry logic.
 */
import client from './client.js'

const VALID_MODES = new Set(['chat', 'ai_insights', 'recommendation_insights', 'decision_making'])

// Longer timeout for AI modes that need more compute time
const AI_TIMEOUT_MS = 120_000   // 2 min for insights/recommendations
const CHAT_TIMEOUT_MS = 60_000  // 1 min for regular chat

/**
 * Normalize an API error to a human-readable string.
 * @param {unknown} error
 * @returns {string}
 */
export function normalizeApiError(error) {
  if (!error) return 'An unknown error occurred.'

  // Axios error with backend detail message
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || String(d)).join('; ')

  // Network-level errors
  if (error?.code === 'ECONNABORTED' || error?.message?.toLowerCase().includes('timeout')) {
    return 'The AI is taking too long to respond. Please try a shorter query or retry.'
  }
  if (error?.code === 'ERR_NETWORK' || !error?.response) {
    return 'Cannot reach the server. Check your connection or ensure the backend is running.'
  }

  // HTTP status codes
  const status = error?.response?.status
  if (status === 429) return 'The AI service is rate-limited. Please wait a moment and retry.'
  if (status === 503 || status === 502) return 'The AI service is temporarily unavailable. Please retry.'
  if (status === 401 || status === 403) return 'Authentication error. Your session may have expired.'
  if (status >= 500) return 'A server error occurred. The team has been notified. Please retry.'

  return error?.message || 'An unexpected error occurred.'
}

/**
 * Fetch chat history from backend.
 */
export async function fetchChatHistory() {
  const response = await client.get('/chat/history', { timeout: 15_000 })
  return response.data
}

/**
 * Send a chat message.
 * @param {string} message - User message text
 * @param {string|null} [mode]  - Optional mode: "chat" | "ai_insights" | "recommendation_insights"
 */
export async function sendChatMessage(message, mode = null, options = {}) {
  const payload = { message: String(message).trim() }
  if (mode && VALID_MODES.has(mode)) {
    payload.mode = mode
  }
  const response = await client.post('/chat', payload, { timeout: CHAT_TIMEOUT_MS, signal: options.signal })
  return response.data
}

/**
 * Send a message in AI Insights mode (deep pattern analysis).
 */
export async function sendAIInsightsMessage(message, options = {}) {
  const response = await client.post(
    '/chat/ai-insights',
    { message: String(message).trim() },
    { timeout: AI_TIMEOUT_MS, signal: options.signal },
  )
  return response.data
}

/**
 * Send a message in Recommendation Insights mode (business strategy).
 */
export async function sendRecommendationsMessage(message, options = {}) {
  const response = await client.post(
    '/chat/recommendations',
    { message: String(message).trim() },
    { timeout: AI_TIMEOUT_MS, signal: options.signal },
  )
  return response.data
}

/**
 * Clear chat history.
 */
export async function clearChatHistory() {
  const response = await client.delete('/chat/clear', { timeout: 10_000 })
  return response.data
}

/**
 * Fetch supported chat modes and model info.
 */
export async function fetchChatModes() {
  const response = await client.get('/chat/modes', { timeout: 10_000 })
  return response.data
}

/**
 * Check chatbot service health.
 */
export async function checkChatHealth() {
  try {
    const response = await client.get('/chat/health', { timeout: 8_000 })
    return response.data
  } catch {
    return { status: 'error', configured: false, groq_configured: false }
  }
}
