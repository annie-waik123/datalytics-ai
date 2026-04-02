import client from './client.js'
import { buildDatasetSyncPayload, isBackendDatasetReady } from './datasetSession.js'

export async function syncVisualizationDataset(dataset, options = {}) {
  if (isBackendDatasetReady(dataset) && !options.forceSync) {
    try {
      return { metadata: await fetchVisualizationMetadata() }
    } catch (error) {
      if (error?.response?.status !== 404) throw error
    }
  }

  const response = await client.post('/visualization/sync', buildDatasetSyncPayload(dataset, options))
  return response.data
}

export async function fetchVisualizationMetadata() {
  const response = await client.get('/visualization/metadata')
  return response.data
}

export async function renderVisualizationChart(payload) {
  const response = await client.post('/visualization/chart', payload)
  return response.data
}

export async function renderVisualizationBatch(charts) {
  const response = await client.post('/visualization/batch', { charts })
  return response.data
}
