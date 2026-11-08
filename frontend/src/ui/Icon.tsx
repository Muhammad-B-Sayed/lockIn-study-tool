import type { SVGProps } from 'react'

const paths = {
  today: (
    <>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
    </>
  ),
  review: (
    <>
      <path d="M16.2 8.4A6.5 6.5 0 0 0 4.4 6.2" />
      <path d="M3.8 11.6a6.5 6.5 0 0 0 11.8 2.2" />
      <path d="M4 3v3.4h3.4M16 17v-3.4h-3.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.2" width="14" height="12.8" rx="2.4" />
      <path d="M3 8.2h14M7 2.6v3M13 2.6v3" />
    </>
  ),
  courses: (
    <>
      <path d="M4 4.2c0-.7.5-1.2 1.2-1.2H15v11.6H5.4A1.4 1.4 0 0 0 4 16" />
      <path d="M4 16a1.4 1.4 0 0 0 1.4 1.4H15v-2.8" />
      <path d="M7.5 6.6h4.5" />
    </>
  ),
  settings: (
    <>
      <path d="M3.5 6h8M15.5 6h1M3.5 14h1M8.5 14h8" />
      <circle cx="13.5" cy="6" r="2" />
      <circle cx="6.5" cy="14" r="2" />
    </>
  ),
  timer: (
    <>
      <circle cx="10" cy="11.2" r="6" />
      <path d="M10 11.2V8M8 2.8h4M10 2.8v2.4M15 5.6l1.2-1.2" />
    </>
  ),
  gear: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.8v2M10 15.2v2M17.2 10h-2M4.8 10h-2M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4M15.1 15.1l-1.4-1.4M6.3 6.3 4.9 4.9" />
      <circle cx="10" cy="10" r="5.4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="9" width="12" height="8.4" rx="2.4" />
      <path d="M6.8 9V6.6a3.2 3.2 0 0 1 6.4 0V9" />
      <path d="M10 12.4v1.6" />
    </>
  ),
  plus: <path d="M10 4v12M4 10h12" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5.2" />
      <path d="m13 13 3.6 3.6" />
    </>
  ),
  chevronRight: <path d="m8 5 5 5-5 5" />,
  chevronLeft: <path d="m12 5-5 5 5 5" />,
  chevronDown: <path d="m5 8 5 5 5-5" />,
  arrowRight: <path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" />,
  arrowLeft: <path d="M16 10H4.5M9 5.5 4.5 10 9 14.5" />,
  check: <path d="m4.5 10.5 3.6 3.6 7.4-8" />,
  close: <path d="m5 5 10 10M15 5 5 15" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4.2l2.8 1.8" />
    </>
  ),
  link: (
    <>
      <path d="M8.6 11.4a3 3 0 0 0 4.3 0l2.6-2.6a3 3 0 0 0-4.3-4.3l-.8.8" />
      <path d="M11.4 8.6a3 3 0 0 0-4.3 0l-2.6 2.6a3 3 0 0 0 4.3 4.3l.8-.8" />
    </>
  ),
  external: (
    <>
      <path d="M11 4h5v5M16 4l-7 7" />
      <path d="M14 11.5V15a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 15V8a1.5 1.5 0 0 1 1.5-1.5H9" />
    </>
  ),
  play: <path d="M6.5 4.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L7.4 4.1a.6.6 0 0 0-.9.5Z" />,
  pause: <path d="M7 4.5v11M13 4.5v11" />,
  stop: <rect x="5" y="5" width="10" height="10" rx="2" />,
  undo: (
    <>
      <path d="M7.5 5.5 4 9l3.5 3.5" />
      <path d="M4 9h8a4 4 0 0 1 0 8H9" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6h12M8 6V4.5h4V6" />
      <path d="M5.5 6l.7 9.6c.1.8.7 1.4 1.5 1.4h4.6c.8 0 1.4-.6 1.5-1.4l.7-9.6" />
    </>
  ),
  edit: (
    <>
      <path d="M12.8 4.2a1.8 1.8 0 0 1 2.6 2.6L7.6 14.6 4 16l1.4-3.6 7.4-8.2Z" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="10" r=".6" />
      <circle cx="10" cy="10" r=".6" />
      <circle cx="15" cy="10" r=".6" />
    </>
  ),
  import: (
    <>
      <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" />
      <path d="M4 13v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" />
    </>
  ),
  flame: (
    <path d="M10 17.2c3 0 5-2 5-4.8 0-3.4-3-5-3.6-8.6-2.3 1.2-3.4 3.4-3.2 5.6-1-.4-1.6-1.4-1.8-2.4C5.4 8.4 5 10 5 12.4c0 2.8 2 4.8 5 4.8Z" />
  ),
  flag: (
    <>
      <path d="M5 17V3.5" />
      <path d="M5 4h9.2l-2 3.4 2 3.4H5" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.6" />
      <circle cx="10" cy="10" r=".5" />
    </>
  ),
  note: (
    <>
      <path d="M5 3.5h7l3 3v10H5z" />
      <path d="M12 3.5V7h3M7.5 10h5M7.5 13h3.5" />
    </>
  ),
  menu: <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />,
  sun: (
    <>
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 2.8v1.4M10 15.8v1.4M2.8 10h1.4M15.8 10h1.4M4.9 4.9l1 1M14.1 14.1l1 1M4.9 15.1l1-1M14.1 5.9l1-1" />
    </>
  ),
  moon: <path d="M15.6 12.4A6.4 6.4 0 0 1 7.6 4.4a6.4 6.4 0 1 0 8 8Z" />,
  monitor: (
    <>
      <rect x="2.8" y="3.8" width="14.4" height="10" rx="1.8" />
      <path d="M7 17h6M10 13.8V17" />
    </>
  ),
  download: (
    <>
      <path d="M10 3.5v9M6.5 9 10 12.5 13.5 9" />
      <path d="M4 15.5h12" />
    </>
  ),
  logout: (
    <>
      <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
      <path d="M12 6.5 15.5 10 12 13.5M15.5 10H8" />
    </>
  ),
  grip: (
    <>
      <circle cx="7.5" cy="6" r=".5" />
      <circle cx="12.5" cy="6" r=".5" />
      <circle cx="7.5" cy="10" r=".5" />
      <circle cx="12.5" cy="10" r=".5" />
      <circle cx="7.5" cy="14" r=".5" />
      <circle cx="12.5" cy="14" r=".5" />
    </>
  ),
  sparkle: <path d="M10 3c.5 3.5 1.5 4.5 5 5-3.5.5-4.5 1.5-5 5-.5-3.5-1.5-4.5-5-5 3.5-.5 4.5-1.5 5-5Z" />,
  archive: (
    <>
      <rect x="3" y="4" width="14" height="3.5" rx="1" />
      <path d="M4.5 7.5V15a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7.5M8.5 10.5h3" />
    </>
  ),
  list: <path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9M3.6 5.5h.1M3.6 10h.1M3.6 14.5h.1" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="5.2" height="5.2" rx="1.2" />
      <rect x="11.3" y="3.5" width="5.2" height="5.2" rx="1.2" />
      <rect x="3.5" y="11.3" width="5.2" height="5.2" rx="1.2" />
      <rect x="11.3" y="11.3" width="5.2" height="5.2" rx="1.2" />
    </>
  ),
} as const

export type IconName = keyof typeof paths

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName
  size?: number
  label?: string
}

export function Icon({ name, size = 18, label, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}
