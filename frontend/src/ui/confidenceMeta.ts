import type { Confidence } from '../lib/data/types'

export const CONFIDENCE: Record<
  Confidence,
  { label: string; short: string; fill: number; hint: string; key?: string }
> = {
  unrated: { label: 'Not rated', short: 'New', fill: 0, hint: 'Not rated yet' },
  shaky: { label: 'Shaky', short: 'Shaky', fill: 0.3, hint: 'I could not explain this yet', key: '1' },
  okay: { label: 'Getting there', short: 'Getting there', fill: 0.62, hint: 'I mostly get it, with gaps', key: '2' },
  solid: { label: 'Solid', short: 'Solid', fill: 1, hint: 'I could teach this', key: '3' },
  retired: { label: 'Not on exam', short: 'Not on exam', fill: 0, hint: 'Skipped on purpose. It stays out of review and coverage' },
}

export const RATABLE: Confidence[] = ['shaky', 'okay', 'solid']
