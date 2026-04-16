import client from './client.js'
import { buildDatasetSyncPayload } from './datasetSession.js'

/**
 * Always sync the dataset to the backend before generating insights.
 * We ALWAYS force-sync (no short-circuit) to ensure Groq has fresh data.
 */
export async function syncInsightsDataset(dataset, options = {}) {
  if (!dataset || !dataset.rows?.length) {
    return { synced: false, reason: 'no_dataset' }
  }

  const payload = buildDatasetSyncPayload(dataset, { replaceOriginal: true })

  try {
    const response = await client.post('/data/sync', payload, { timeout: 30_000 })
    return { synced: true, source: 'data/sync', payload: response.data }
  } catch (error) {
    if (error?.response?.status !== 404) {
      // Don't throw — let the insight call proceed anyway
      console.warn('[syncInsightsDataset] /data/sync failed:', error?.message)
    }
  }

  try {
    const fallback = await client.post('/visualization/sync', payload, { timeout: 30_000 })
    return { synced: true, source: 'visualization/sync', payload: fallback.data }
  } catch (fallbackError) {
    console.warn('[syncInsightsDataset] fallback sync also failed:', fallbackError?.message)
    return { synced: false, reason: 'sync_failed' }
  }
}

/**
 * Generate business recommendations via backend Groq (recommendation_insights mode).
 * The backend will load the dataset from session and send it to Groq with the prompt.
 */
export async function generateRecommendationInsights(prompt, mode = 'recommendation_insights') {
  const response = await client.post(
    '/recommendations/generate',
    { generate: true, mode, prompt },
    { timeout: 120_000 }, // 2 min — Groq needs time for long structured output
  )
  return response.data
}

/**
 * Generate AI insights via backend Groq (ai_insights mode).
 */
export async function generateAIInsights(prompt, mode = 'ai_insights') {
  const response = await client.post(
    '/ai-insights/generate',
    { generate: true, mode, prompt },
    { timeout: 120_000 },
  )
  return response.data
}
