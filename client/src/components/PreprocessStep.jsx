import OnClickPred from './onclickpred.jsx'

export default function PreprocessStep({ dataset, uploadData, setStatus }) {
  const normalized = dataset || (uploadData ? { columns: uploadData.all_columns || [] } : null)
  return <OnClickPred dataset={normalized} setStatus={setStatus} />
}
