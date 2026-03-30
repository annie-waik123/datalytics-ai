import client from '../api/client.js'

export default function DownloadStep({ trainData, preprocessData, status }) {
  const hasModel = Boolean(trainData?.best_model_name || status.best_model_name)
  const hasProcessed = Boolean(preprocessData || status.preprocessing_done)
  const hasResults = Boolean(status.supervised_done)
  const hasClusters = Boolean(status.unsupervised_done)
  const hasPredictions = Boolean(status.has_predictions)
  const modelName = trainData?.best_model_name || status.best_model_name || 'model'

  async function download(endpoint, filename) {
    try {
      const res = await client.get(endpoint, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Download failed: ' + (e.response?.data?.detail || e.message))
    }
  }

  const downloads = [
    {
      title: 'Best Trained Model',
      description: `Download the best model (${modelName}) as a pickle file.`,
      label: 'Download Model (.pkl)',
      action: () => download('/download-model', `${modelName.replace(/ /g, '_')}_model.pkl`),
      disabled: !hasModel,
    },
    {
      title: 'Processed Dataset',
      description: 'Download the preprocessed dataset as CSV.',
      label: 'Download Processed Data (.csv)',
      action: () => download('/download-processed-data', 'processed_dataset.csv'),
      disabled: !hasProcessed,
    },
    {
      title: 'Prediction Results',
      description: 'Download all predictions made in this session.',
      label: 'Download Predictions (.csv)',
      action: () => download('/download-predictions', 'prediction_results.csv'),
      disabled: !hasPredictions,
    },
    {
      title: 'Model Comparison Report',
      description: 'Download the full model comparison table as CSV.',
      label: 'Download Report (.csv)',
      action: () => download('/download-report', 'model_comparison_report.csv'),
      disabled: !hasResults,
    },
    {
      title: 'Clustering Report',
      description: 'Download clustering metrics as CSV.',
      label: 'Download Clustering Report (.csv)',
      action: () => download('/download-clustering-report', 'clustering_report.csv'),
      disabled: !hasClusters,
    },
  ]

  return (
    <div>
      <h1 className="page-title">Download Results</h1>
      <p className="page-subtitle">Export the same model artifacts, reports, and prediction tables that were available in the original Streamlit app.</p>

      <div className="form-row form-row-2" style={{ gap: '1rem' }}>
        {downloads.map(item => (
          <div key={item.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <strong style={{ fontSize: '1rem' }}>{item.title}</strong>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', flex: 1 }}>{item.description}</p>
            <button className="btn btn-primary btn-sm" onClick={item.action} disabled={item.disabled}>
              {item.label}
            </button>
            {item.disabled && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>This export becomes available once the related step has run.</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
