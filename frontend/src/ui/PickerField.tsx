import { Icon, type IconName } from './Icon'

/**
 * A native date or time input dressed as a readable field. The real input covers the
 * field invisibly, so clicks, taps and keyboard all reach the platform picker.
 */
export function PickerField({
  type,
  value,
  display,
  placeholder,
  icon,
  label,
  disabled,
  onChange,
  onClear,
  id,
  invalid,
}: {
  id?: string
  invalid?: boolean
  type: 'date' | 'time'
  value: string
  display: string
  placeholder: string
  icon: IconName
  label: string
  disabled?: boolean
  onChange: (v: string) => void
  onClear?: () => void
}) {
  return (
    <span className="picker" data-empty={!value || undefined} data-disabled={disabled || undefined} data-invalid={invalid || undefined}>
      <Icon name={icon} size={15} className="picker__icon" />
      <span className="picker__text">{value ? display : placeholder}</span>
      <input
        id={id}
        aria-invalid={invalid || undefined}
        className="picker__native"
        type={type}
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.()
          } catch {
            /* some browsers only allow showPicker on trusted events */
          }
        }}
      />
      {value && onClear ? (
        <button type="button" className="picker__clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={onClear}>
          <Icon name="close" size={13} />
        </button>
      ) : null}
    </span>
  )
}
