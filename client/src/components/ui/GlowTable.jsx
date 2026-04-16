export default function GlowTable({
  columns = [],
  rows = [],
  emptyState = 'No records found.',
}) {
  if (!rows.length) {
    return (
      <div className="ds-ui-table-empty">
        {emptyState}
      </div>
    )
  }

  return (
    <div className="ds-ui-table-wrap">
      <table className="ds-ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ textAlign: column.align || 'left' }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || `${rowIndex}-${columns[0]?.key || 'row'}`}>
              {columns.map((column) => (
                <td key={`${rowIndex}-${column.key}`} style={{ textAlign: column.align || 'left' }}>
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
