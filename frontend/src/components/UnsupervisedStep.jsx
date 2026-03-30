import { useEffect, useState } from 'react'
import client from '../api/client.js'
import PlotFigure from './PlotFigure.jsx'

export default function UnsupervisedStep({ status, setStatus }) {
  const [loading, setLoading] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [nClusters, setNClusters] = useState(3)
  const [eps, setEps] = useState(0.5)
  const [minSamples, setMinSamples] = useState(5)

  useEffect(() => {
    let cancelled = false

    async function loadExisting() {
      try {
        const res = await client.get('/cluster-results')
        if (!cancelled) {
          setResult(res.data)
        }
      } catch (e) {
        if (!cancelled && e.response?.status !== 404) {
          setError(e.response?.data?.detail || 'Failed to load clustering results.')
        }
      } finally {
        if (!cancelled) {
          setHydrating(false)
        }
      }
    }

    loadExisting()
    return () => {
      cancelled = true
    }
  }, [])

  if (!status.preprocessing_done) {
    return <div className="alert alert-warning">Please preprocess the dataset first.</div>
  }

  async function handleCluster() {
    setLoading(true)
    setError(null)
    try {
      const res = await client.post('/cluster', {
        n_clusters: nClusters,
        eps: parseFloat(eps),
        min_samples: minSamples,
      })
      setResult(res.data)
      setStatus(s => ({ ...s, unsupervised_done: true }))
    } catch (e) {
      setError(e.response?.data?.detail || 'Clustering failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Unsupervised Models</h1>
      <p className="page-subtitle">Run clustering models against the shared processed dataset and inspect PCA-based cluster views.</p>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label>K-Means / GMM clusters: {nClusters}</label>
            <input type="range" min={2} max={10} value={nClusters} onChange={e => setNClusters(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>DBSCAN eps: {eps}</label>
            <input type="range" min={0.1} max={5} step={0.1} value={eps} onChange={e => setEps(e.target.value)} />
          </div>
          <div className="form-group">
            <label>DBSCAN min samples: {minSamples}</label>
            <input type="range" min={2} max={20} value={minSamples} onChange={e => setMinSamples(Number(e.target.value))} />
          </div>
        </div>
        <button className="btn btn-secondary btn-block" onClick={handleCluster} disabled={loading}>
          {loading ? 'Running clustering...' : 'Train clustering models'}
        </button>
      </div>

      {hydrating && <div className="spinner-wrap"><div className="spinner" /><span>Loading clustering state...</span></div>}
      {error && <div className="alert alert-warning">{error}</div>}

      {result?.cluster_results?.length > 0 && (
        <>
          {(result.large_dataset_mode || result.sampled_cluster) && (
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              Clustering ran in bounded mode on <strong>{(result.cluster_rows_used || 0).toLocaleString()}</strong> rows
              to keep large datasets responsive.
            </div>
          )}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="section-title">Clustering Comparison</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{['Model', 'Silhouette', 'Davies-Bouldin', 'Clusters'].map(column => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {result.cluster_results.map((row, index) => (
                    <tr key={index}>
                      <td>{row.Model}</td>
                      <td>{formatMetric(row.Silhouette)}</td>
                      <td>{formatMetric(row['Davies-Bouldin'])}</td>
                      <td>{row.Clusters}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.pca_data?.plots?.map(plot => (
            <div key={plot.name} className="card" style={{ marginBottom: '1rem' }}>
              <div className="section-title">{plot.name} PCA View</div>
              <PlotFigure figure={plot.figure} style={{ height: 420 }} />
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function formatMetric(value) {
  return typeof value === 'number' ? value.toFixed(4) : String(value)
}
