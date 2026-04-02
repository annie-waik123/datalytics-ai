import client from './client.js'
import { buildDatasetSyncPayload, isBackendDatasetReady } from './datasetSession.js'
import {
  getLocalDashboardMetadata,
  getLocalDashboardRender,
  getLocalDashboardSuggestion,
  loadLocalDashboardDefinition,
  saveLocalDashboardDefinition,
  setDashboardSessionDataset,
} from '../utils/dashboardDemoEngine.js'

let dashboardTransport = 'auto'

async function tryRemote(request, fallback) {
  if (dashboardTransport === 'local') {
    return fallback()
  }

  try {
    const result = await request()
    dashboardTransport = 'remote'
    return result
  } catch (error) {
    dashboardTransport = 'local'
    return fallback(error)
  }
}

export async function syncDashboardDataset(dataset, profile) {
  setDashboardSessionDataset(dataset, profile)

  if (!isBackendDatasetReady(dataset)) {
    dashboardTransport = 'local'
    return { metadata: await getLocalDashboardMetadata() }
  }

  const payload = buildDatasetSyncPayload(dataset, { replaceOriginal: true })

  try {
    const response = await client.post('/data/sync', payload)
    dashboardTransport = 'remote'
    return response.data
  } catch (error) {
    try {
      const response = await client.post('/visualization/sync', payload)
      dashboardTransport = 'remote'
      return response.data
    } catch {
      dashboardTransport = 'local'
      return { metadata: await getLocalDashboardMetadata() }
    }
  }
}

export async function fetchDashboardMetadata() {
  return tryRemote(
    async () => {
      const response = await client.get('/dashboard/metadata')
      return response.data
    },
    () => getLocalDashboardMetadata()
  )
}

export async function suggestDashboardWidget(payload) {
  return tryRemote(
    async () => {
      const response = await client.post('/dashboard/suggest', payload)
      return response.data
    },
    () => getLocalDashboardSuggestion(payload)
  )
}

export async function renderDashboardWidget(payload) {
  return tryRemote(
    async () => {
      const response = await client.post('/dashboard/render', payload)
      return response.data
    },
    () => getLocalDashboardRender(payload)
  )
}

export async function saveDashboardDefinition(payload) {
  return tryRemote(
    async () => {
      const response = await client.post('/dashboard/save', payload)
      return response.data
    },
    () => saveLocalDashboardDefinition(payload)
  )
}

export async function loadDashboardDefinition() {
  return tryRemote(
    async () => {
      const response = await client.get('/dashboard/load')
      return response.data
    },
    () => loadLocalDashboardDefinition()
  )
}
