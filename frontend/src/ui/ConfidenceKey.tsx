/** The legend for coverage strips. Cells fill like the jars: a third, two thirds, full. */
export function ConfidenceKey({ withRetired = false }: { withRetired?: boolean }) {
  return (
    <ul className="conf-key" aria-label="Key">
      {(['unrated', 'shaky', 'okay', 'solid'] as const).map((c) => (
        <li key={c} data-conf={c}>
          <span className="conf-key__swatch" data-conf={c} aria-hidden />
          {c === 'unrated' ? 'Not rated' : c === 'okay' ? 'Getting there' : c === 'shaky' ? 'Shaky' : 'Solid'}
        </li>
      ))}
      {withRetired ? (
        <li data-conf="retired">
          <span className="conf-key__swatch" data-conf="retired" aria-hidden />
          Not on exam
        </li>
      ) : null}
    </ul>
  )
}
