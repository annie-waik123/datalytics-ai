import client from './client.js'
import { buildDatasetSyncPayload, isBackendDatasetReady } from './datasetSession.js'

export async function fetchEdaSummary() {
  const response = await client.get('/eda/summary')
  return response.data
}

export async function syncDatasetToBackend(dataset, options = {}) {
  if (isBackendDatasetReady(dataset) && !options.forceSync) {
    try {
      const summary = await fetchEdaSummary()
      return {
        dataset,
        summary,
      }
    } catch (error) {
      if (error?.response?.status !== 404) throw error
    }
  }

  const response = await client.post('/eda/sync', buildDatasetSyncPayload(dataset, options))
  return response.data
}

export async function runEdaAction(action, options = {}) {
  const response = await client.post('/eda/action', {
    action,
    options,
  })
  return response.data
}

export async function createEdaChart(payload) {
  const response = await client.post('/eda/chart', payload)
  return response.data
}

export async function fetchEdaReportJson() {
  const response = await client.get('/eda/report/json')
  return response.data
}

export async function fetchEdaReportHtml() {
  const response = await client.get('/eda/report/html', { responseType: 'text' })
  return response.data
}

export async function downloadEdaCsv() {
  const response = await client.get('/eda/download-csv', { responseType: 'blob' })
  return response
}
