export function isBackendDatasetReady(dataset) {
  return Boolean(dataset?.meta?.backend_managed) && !dataset?.meta?.needs_backend_sync
}

export function buildDatasetSyncPayload(dataset, options = {}) {
  return {
    rows: dataset?.rows || [],
    columns: dataset?.columns || [],
    name: dataset?.name || 'Dataset',
    meta: dataset?.meta || {},
    replace_original: Boolean(options.replaceOriginal),
  }
}
