/**
 * AI Analyst API — two features:
 *  1. AI Data Analyst agent  (/analyst/execute, /analyst/execute/stream)
 *  2. Natural-language analytics (/analytics/interpret, /analytics/query, /analytics/capabilities)
 *
 * SSE streaming uses fetch (not axios) so the activity feed updates in real
 * time as each real backend step completes. Falls back to the blocking JSON
 * endpoint when streaming is unavailable.
 */
import client from './client.js'
import { buildDatasetSyncPayload, isBackendDatasetReady } from './datasetSession.js'

const ANALYST_TIMEOUT_MS = 420_000   // 7 min for long agent runs
const QUERY_TIMEOUT_MS = 180_000

// ── Dataset sync (browser-owned datasets only) ──────────────────────────────

export async function syncAnalystDataset(dataset) {
  if (!dataset || !dataset.rows?.length) {
    return { synced: false, reason: 'no_dataset' }
  }
  if (isBackendDatasetReady(dataset)) {
    return { synced: true, source: 'backend_session', skipped: true }
  }
  const payload = buildDatasetSyncPayload(dataset, { replaceOriginal: true })
  try {
    const response = await client.post('/data/sync', payload, { timeout: 60_000 })
    return { synced: true, source: 'data/sync', payload: response.data }
  } catch (error) {
    console.warn('[syncAnalystDataset] /data/sync failed:', error?.message)
  }
  try {
    const response = await client.post('/visualization/sync', payload, { timeout: 60_000 })
    return { synced: true, source: 'visualization/sync', payload: response.data }
  } catch (error) {
    console.warn('[syncAnalystDataset] fallback sync failed:', error?.message)
    return { synced: false, reason: 'sync_failed' }
  }
}

// ── Capabilities & examples ─────────────────────────────────────────────────

export async function fetchAnalyticsCapabilities() {
  const response = await client.get('/analytics/capabilities', { timeout: 15_000 })
  return response.data
}

// ── Natural-language analytics (Feature 2) ──────────────────────────────────

export async function interpretAnalytics(query, options = {}) {
  const response = await client.post(
    '/analytics/interpret',
    { query: String(query).trim() },
    { timeout: QUERY_TIMEOUT_MS, signal: options.signal },
  )
  return response.data
}

export async function queryAnalytics(query, options = {}) {
  const response = await client.post(
    '/analytics/query',
    { query: String(query).trim(), mode: options.mode || 'auto', include_explanation: true },
    { timeout: QUERY_TIMEOUT_MS, signal: options.signal },
  )
  return response.data
}

// ── AI Data Analyst agent (Feature 1) ───────────────────────────────────────

/** Blocking variant — returns the full report. */
export async function runAnalyst(request, options = {}) {
  const response = await client.post(
    '/analyst/execute',
    {
      request: String(request).trim(),
      mode: options.mode || 'auto',
      include_ml: options.include_ml ?? null,
      include_charts: options.include_charts ?? null,
      max_charts: options.max_charts ?? 3,
    },
    { timeout: ANALYST_TIMEOUT_MS, signal: options.signal },
  )
  return response.data
}

/**
 * Streaming variant (SSE). `onEvent(event)` receives the parsed payload of each
 * event: {type:'plan', steps}, {type:'step', key, status, detail?, error?},
 * {type:'result', report}, or {type:'error', message}.
 * Returns an AbortController so the caller can cancel.
 */
export async function streamAnalyst(request, options = {}) {
  const controller = new AbortController()
  const payload = {
    request: String(request).trim(),
    mode: options.mode || 'auto',
    include_ml: options.include_ml ?? null,
    include_charts: options.include_charts ?? null,
    max_charts: options.max_charts ?? 3,
  }

  async function attempt() {
    const headers = { 'Content-Type': 'application/json' }
    const sessionId = localStorage.getItem('ml_dashboard_session_id') || crypto.randomUUID()
    headers['X-Session-ID'] = sessionId
    const token = localStorage.getItem('auth_token')
    if (token) headers.Authorization = `Bearer ${token}`
    if (!localStorage.getItem('ml_dashboard_session_id')) {
      localStorage.setItem('ml_dashboard_session_id', sessionId)
    }

    const response = await fetch('/api/analyst/execute/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      let message = `The AI Analyst failed (HTTP ${response.status}).`
      try {
        const body = await response.json()
        message = body?.detail || body?.message || message
      } catch { /* keep generic message */ }
      throw Object.assign(new Error(message), { status: response.status })
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
      // Older browser without streams — fall back to the blocking endpoint.
      const report = await runAnalyst(request, { ...options, signal: controller.signal })
      options.onEvent?.({ type: 'result', report })
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let done = false

    while (!done) {
      const { value, done: streamDone } = await reader.read()
      done = streamDone
      if (value) buffer += decoder.decode(value, { stream: !done })
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data) continue
          let event
          try {
            event = JSON.parse(data)
          } catch {
            continue
          }
          if (event?.type === 'result') {
            done = true
            options.onEvent?.({ type: 'result', report: event.report })
            break
          }
          if (event?.type === 'error') {
            options.onEvent?.({ type: 'error', message: event.message })
            return
          }
          options.onEvent?.(event)
        }
      }
    }
  }

  const promise = attempt()
  promise.controller = controller
  return promise
}

export default {
  syncAnalystDataset,
  fetchAnalyticsCapabilities,
  interpretAnalytics,
  queryAnalytics,
  runAnalyst,
  streamAnalyst,
}
