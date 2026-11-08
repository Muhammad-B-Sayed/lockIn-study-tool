import type { Confidence } from '../lib/data/types'
import { ConfidenceGlyph } from './confidence'
import { CONFIDENCE, RATABLE } from './confidenceMeta'
import { Icon } from './Icon'
import { Menu } from './Menu'

/**
 * The current rating as one labelled chip. Opening it offers the three ratings with their meaning.
 * Used in lists, where a full three-way control on every row is noise.
 */
export function RatePicker({
  value,
  onRate,
  title,
  align = 'end',
}: {
  value: Confidence
  onRate: (c: Confidence) => void
  title: string
  align?: 'start' | 'end'
}) {
  const visible = value === 'unrated' ? 'Rate' : CONFIDENCE[value].label
  return (
    <Menu
      label={`Rate ${title}`}
      align={align}
      trigger={(p) => (
        <button {...p} type="button" className="rate-chip" data-conf={value} aria-label={`${visible}, change rating for ${title}`}>
          <ConfidenceGlyph value={value} size={14} />
          <span className="rate-chip__label">{visible}</span>
          <Icon name="chevronDown" size={13} className="rate-chip__chev" />
        </button>
      )}
      items={[
        ...RATABLE.map((c) => ({
          label: CONFIDENCE[c].label,
          icon: <ConfidenceGlyph value={c} size={15} />,
          checked: value === c,
          onSelect: () => onRate(c),
        })),
        'separator' as const,
        {
          label: value === 'retired' ? 'Put back in review' : 'Not on exam',
          icon: <ConfidenceGlyph value="retired" size={15} />,
          onSelect: () => onRate(value === 'retired' ? 'unrated' : 'retired'),
        },
      ]}
    />
  )
}
