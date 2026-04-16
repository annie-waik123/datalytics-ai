export default function DashboardCard({
  title,
  value,
  meta,
  delta,
  icon: Icon,
  tone = 'primary',
}) {
  return (
    <article className={`ds-stat-card is-${tone}`}>
      <header className="ds-stat-card-head">
        <span className="ds-stat-card-title">{title}</span>
        {Icon ? (
          <span className="ds-stat-card-icon" aria-hidden="true">
            <Icon />
          </span>
        ) : null}
      </header>
      <div className="ds-stat-card-value">{value}</div>
      <footer className="ds-stat-card-foot">
        {meta ? <span className="ds-stat-card-meta">{meta}</span> : <span />}
        {delta ? <span className="ds-stat-card-delta">{delta}</span> : null}
      </footer>
    </article>
  )
}
