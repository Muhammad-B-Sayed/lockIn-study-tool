import { useState } from 'react'
import { Input } from '../ui/primitives'
import './companion.css'

/** A custom focus length, for sessions that are not one of the preset sizes. */
export function FocusLength({ value, presets, onChange }: { value: number; presets: number[]; onChange: (minutes: number) => void }) {
  const custom = !presets.includes(value)
  const [text, setText] = useState(custom ? String(value) : '')
  // Picking a preset clears whatever was typed here.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (!custom) setText('')
  }
  const n = Number(text)
  const bad = text.trim() !== '' && (!Number.isInteger(n) || n < 5 || n > 240)
  return (
    <label className="focus-len" data-on={custom || undefined}>
      <span className="focus-len__label">or</span>
      <Input
        className="t-mono focus-len__input"
        inputMode="numeric"
        maxLength={3}
        placeholder="35"
        aria-label="Custom session length in minutes, from 5 to 240"
        aria-invalid={bad || undefined}
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '')
          setText(next)
          const parsed = Number(next)
          if (next && parsed >= 5 && parsed <= 240) onChange(parsed)
        }}
      />
      <span className="focus-len__label">{bad ? 'min, 5 to 240' : 'min'}</span>
    </label>
  )
}
