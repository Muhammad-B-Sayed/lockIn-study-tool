import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconRight?: IconName
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={['btn', `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children ? <span className="btn__label">{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 15 : 17} /> : null}
    </button>
  )
})

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName
  label: string
  size?: Size
  variant?: 'ghost' | 'secondary'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', variant = 'ghost', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={['icon-btn', `icon-btn--${size}`, `icon-btn--${variant}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 15 : size === 'lg' ? 20 : 17} />
    </button>
  )
})

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

// ---------- fields ----------

type FieldShellProps = {
  label: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  htmlFor: string
  optional?: boolean
}

export function Field({ label, hint, error, children, htmlFor, optional }: FieldShellProps) {
  return (
    <div className={['field', error ? 'field--error' : ''].join(' ')}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {optional ? <span className="field__optional">optional</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={['input', className].filter(Boolean).join(' ')} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={['input', 'input--area', className].filter(Boolean).join(' ')} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <span className="select">
      <select ref={ref} className={['input', 'input--select', className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={15} className="select__chev" />
    </span>
  )
})

// ---------- segmented ----------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; icon?: IconName }[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={`seg seg--${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="seg__opt"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.value === value)
            const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
            if (!step) return
            e.preventDefault()
            const n = (i + step + options.length) % options.length
            onChange(options[n].value)
            const group = e.currentTarget.parentElement
            requestAnimationFrame(() => (group?.children[n] as HTMLElement | undefined)?.focus())
          }}
          tabIndex={o.value === value ? 0 : -1}
        >
          {o.icon ? <Icon name={o.icon} size={15} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- dialog ----------

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-labelledby="dialog-title"
    >
      {open ? (
        <div className="dialog__panel">
          <header className="dialog__head">
            <div>
              <h2 id="dialog-title" className="dialog__title t-display">
                {title}
              </h2>
              {description ? <p className="dialog__desc">{description}</p> : null}
            </div>
            <IconButton icon="close" label="Close" onClick={onClose} size="sm" />
          </header>
          <div className="dialog__body">{children}</div>
          {footer ? <footer className="dialog__foot">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  )
}

// ---------- states ----------

export function EmptyState({
  title,
  children,
  action,
  art,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  art?: ReactNode
}) {
  return (
    <div className="empty">
      {art ? <div className="empty__art">{art}</div> : null}
      <p className="empty__title t-display">{title}</p>
      {children ? <p className="empty__body">{children}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number | string; w?: number | string; r?: number }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <span className="sr-only">{label}</span>
    </span>
  )
}
