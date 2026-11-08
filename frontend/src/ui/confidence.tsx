import { useId } from 'react'
import type { Confidence } from '../lib/data/types'
import { CONFIDENCE } from './confidenceMeta'

/**
 * A small jar that fills with confidence. Reads without color:
 * empty ring = not rated, a third = shaky, mostly full = getting there, full = solid.
 */
export function ConfidenceGlyph({
  value,
  size = 14,
  title,
}: {
  value: Confidence
  size?: number
  title?: string
}) {
  const id = useId()
  const meta = CONFIDENCE[value]
  const r = 6.2
  const top = 8 - r + (1 - meta.fill) * (2 * r)
  return (
    <svg
      className="conf-glyph"
      data-conf={value}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={id}>
          <circle cx="8" cy="8" r={r} />
        </clipPath>
      </defs>
      {value === 'retired' ? (
        <>
          <circle cx="8" cy="8" r={r} fill="none" stroke="var(--cf)" strokeWidth="1.4" strokeDasharray="2 2" />
          <path d="M4 12 12 4" stroke="var(--cf)" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle
            cx="8"
            cy="8"
            r={r}
            fill="none"
            stroke="var(--cf)"
            strokeWidth="1.4"
            strokeDasharray={value === 'unrated' ? '2.2 1.8' : undefined}
          />
          {meta.fill > 0 ? (
            <rect x="0" y={top} width="16" height="16" fill="var(--cf)" clipPath={`url(#${id})`} />
          ) : null}
        </>
      )}
    </svg>
  )
}

export function ConfidenceLabel({ value }: { value: Confidence }) {
  return (
    <span className="conf-label" data-conf={value}>
      <ConfidenceGlyph value={value} />
      <span>{CONFIDENCE[value].label}</span>
    </span>
  )
}
