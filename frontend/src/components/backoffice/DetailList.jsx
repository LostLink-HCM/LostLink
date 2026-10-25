export default function DetailList({ rows }) {
  return (
    <dl className="mb-3">
      {rows.map(([term, value]) => (
        <div
          key={term}
          className="grid grid-cols-[120px_1fr] gap-3 border-b border-line-subtle py-2 text-small max-sm:grid-cols-[90px_minmax(0,1fr)]"
        >
          <dt className="text-ink-subtle">{term}</dt>
          <dd className="font-medium [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
