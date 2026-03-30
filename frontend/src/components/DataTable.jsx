export default function DataTable({ rows = [], columns, limit, compact }) {
  if (!rows.length) {
    return <div className="alert alert-info">No data available.</div>
  }

  const safeRows = limit ? rows.slice(0, limit) : rows
  const cols = columns || Object.keys(safeRows[0] || {})

  return (
    <div className={`table-wrap ${compact ? 'table-wrap-compact' : ''}`}> 
      <table>
        <thead>
          <tr>
            {cols.map(column => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {safeRows.map((row, index) => (
            <tr key={index}>
              {cols.map(column => (
                <td key={`${index}-${column}`}>
                  {row[column] == null || row[column] === '' ? '-' : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
