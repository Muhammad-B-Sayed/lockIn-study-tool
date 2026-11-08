import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'

export type MenuItem =
  | {
      label: ReactNode
      icon?: IconName | ReactNode
      onSelect: () => void
      tone?: 'danger'
      hint?: ReactNode
      checked?: boolean
      disabled?: boolean
    }
  | 'separator'

const EDGE = 12
const SHEET_QUERY = '(max-width: 640px)'

/**
 * A dropdown menu rendered in a top layer, so list rows can never draw over it.
 * It flips above the trigger when there is no room below, stays 12px inside the viewport,
 * and becomes a bottom sheet on phones. Arrow keys move, Enter selects, Escape closes.
 */
export function Menu({
  trigger,
  items,
  align = 'end',
  label,
}: {
  trigger: (props: {
    onClick: () => void
    'aria-haspopup': 'menu'
    'aria-expanded': boolean
    'aria-controls': string | undefined
  }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  label: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const triggerEl = () => rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]') ?? null

  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus()
  }, [])

  // Place the list next to its trigger. Written straight to the node to avoid a second render.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const list = listRef.current
      const t = rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
      if (!list || !t) return
      if (window.matchMedia(SHEET_QUERY).matches) {
        list.dataset.sheet = 'true'
        list.style.cssText = ''
        return
      }
      delete list.dataset.sheet
      const r = t.getBoundingClientRect()
      const w = list.offsetWidth
      const h = list.offsetHeight
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = align === 'end' ? r.right - w : r.left
      left = Math.min(Math.max(EDGE, left), vw - w - EDGE)
      const below = r.bottom + 6
      const above = r.top - 6 - h
      const top = below + h <= vh - EDGE || above < EDGE ? below : above
      list.style.left = `${Math.round(left)}px`
      list.style.top = `${Math.round(Math.max(EDGE, top))}px`
      list.style.transformOrigin = `${align === 'end' ? 'right' : 'left'} ${top === below ? 'top' : 'bottom'}`
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const first = listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
    first?.focus({ preventScroll: true })
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!listRef.current?.contains(t) && !triggerEl()?.contains(t)) close(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, close])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
    )
    const i = els.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      els[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      els[els.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  return (
    <span className="menu" ref={rootRef}>
      {trigger({
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
      })}
      {open
        ? createPortal(
            <>
              <div className="menu__scrim" aria-hidden />
              <div ref={listRef} id={id} role="menu" aria-label={label} className="menu__list" onKeyDown={onKeyDown}>
                <p className="menu__sheet-title" aria-hidden>
                  {label}
                </p>
                {items.map((item, idx) =>
                  item === 'separator' ? (
                    <div key={`sep-${idx}`} className="menu__sep" role="separator" />
                  ) : (
                    <button
                      key={idx}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      className={['menu__item', item.tone === 'danger' ? 'menu__item--danger' : ''].join(' ')}
                      onClick={() => {
                        close()
                        item.onSelect()
                      }}
                    >
                      <span className="menu__icon">
                        {typeof item.icon === 'string' ? <Icon name={item.icon as IconName} size={16} /> : item.icon}
                      </span>
                      <span className="menu__label">{item.label}</span>
                      {item.checked ? <Icon name="check" size={15} className="menu__check" /> : null}
                      {item.hint ? <span className="menu__hint">{item.hint}</span> : null}
                    </button>
                  ),
                )}
              </div>
            </>,
            // Inside <main> when there is one, so the menu stays within a page landmark.
            document.getElementById('main') ?? document.body,
          )
        : null}
    </span>
  )
}
