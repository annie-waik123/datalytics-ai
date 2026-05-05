import client from './client.js'
import { buildDatasetSyncPayload, isBackendDatasetReady } from './datasetSession.js'

const INSIGHT_GENERATION_TIMEOUT_MS = 300_000

/**
 * Sync only browser-owned datasets. Backend-managed uploads already have the
 * canonical full dataframe in the server session; re-syncing would send samples.
 */
export async function syncInsightsDataset(dataset, options = {}) {
  if (!dataset || !dataset.rows?.length) {
    return { synced: false, reason: 'no_dataset' }
  }

  if (isBackendDatasetReady(dataset)) {
    return { synced: true, source: 'backend_session', skipped: true }
  }

  const payload = buildDatasetSyncPayload(dataset, { replaceOriginal: true })

  try {
    const response = await client.post('/data/sync', payload, { timeout: 30_000, signal: options.signal })
    return { synced: true, source: 'data/sync', payload: response.data }
  } catch (error) {
    if (error?.code === 'ERR_CANCELED' || options.signal?.aborted) {
      throw error
    }
    if (error?.response?.status !== 404) {
      // Don't throw — let the insight call proceed anyway
      console.warn('[syncInsightsDataset] /data/sync failed:', error?.message)
    }
  }

  try {
    const fallback = await client.post('/visualization/sync', payload, { timeout: 30_000, signal: options.signal })
    return { synced: true, source: 'visualization/sync', payload: fallback.data }
  } catch (fallbackError) {
    if (fallbackError?.code === 'ERR_CANCELED' || options.signal?.aborted) {
      throw fallbackError
    }
    console.warn('[syncInsightsDataset] fallback sync also failed:', fallbackError?.message)
    return { synced: false, reason: 'sync_failed' }
  }
}

/**
 * Generate business recommendations via backend Groq (recommendation_insights mode).
 * The backend will load the dataset from session and send it to Groq with the prompt.
 */
export async function generateRecommendationInsights(prompt, mode = 'recommendation_insights', options = {}) {
  const response = await client.post(
    '/chat/recommendations',
    { message: prompt, mode, source: 'page' },
    { timeout: INSIGHT_GENERATION_TIMEOUT_MS, signal: options.signal },
  )
  return response.data
}

/**
 * Generate AI insights via backend Groq (ai_insights mode).
 */
export async function generateAIInsights(prompt, mode = 'ai_insights', options = {}) {
  const response = await client.post(
    '/chat/ai-insights',
    { message: prompt, mode, source: 'page' },
    { timeout: INSIGHT_GENERATION_TIMEOUT_MS, signal: options.signal },
  )
  return response.data
}
