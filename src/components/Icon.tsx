interface IconProps {
  name: IconName
  className?: string
  size?: number
}

export type IconName =
  | 'cart'
  | 'flame'
  | 'utensils'
  | 'salad'
  | 'cup'
  | 'cake'
  | 'trash'
  | 'plus'
  | 'minus'
  | 'close'
  | 'check'
  | 'logout'
  | 'settings'
  | 'chart'
  | 'box'
  | 'tag'
  | 'ledger'
  | 'dashboard'
  | 'sun'
  | 'moon'
  | 'print'
  | 'search'
  | 'alert'
  | 'download'
  | 'user'
  | 'edit'
  | 'phone'
  | 'star'
  | 'sparkle'

const PATHS: Record<IconName, string> = {
  cart: 'M2.5 2.5h2l2.2 11.3a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8l1.5-7.8H6M9 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  flame: 'M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c0-1-.3-2-1-3 2 1 4 4 4 7a7 7 0 1 1-14 0c0-4 4-6 7-11Z',
  utensils: 'M4 3v7a2 2 0 0 0 2 2h0v9M6 3v6M8 3v6m9-6c-1.5 0-3 2-3 5s1 4 1 4v8',
  salad: 'M4 11h16a8 8 0 0 1-16 0Zm8-8c-2 0-3 1.5-3 3m3-3c2 0 3 1.5 3 3M7 11l-1-3m11 3 1-3',
  cup: 'M5 4h11l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 4Zm11 4h2a2 2 0 0 1 0 4h-2',
  cake: 'M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M12 4v4m0-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM5 15c1.5 0 1.5 1.5 3.5 1.5S10 15 12 15s2 1.5 3.5 1.5S17 15 19 15',
  trash: 'M4 7h16M9 7V4h6v3m-7 0 1 13h6l1-13',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M4 12l5 5L20 6',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4-2 .5.5 2.2-2 2-2-1-1.2 1.8H12l-1.2-1.8-2 1-2-2 .5-2.2L5 12l-2-.5.5-2.2-2-2 2-2-.5-2.2L5 12',
  chart: 'M4 20V4M4 20h16M8 16v-5m4 5V8m4 8v-3',
  box: 'M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10',
  tag: 'M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Zm5-4a1 1 0 1 0 0 .01Z',
  ledger: 'M5 3h11l4 4v14H5V3Zm0 5h11M5 12h14M5 16h14M16 3v4h4',
  dashboard: 'M3 13h8V3H3v10Zm10 8h8V3h-8v18ZM3 21h8v-6H3v6Z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5v2m0 16v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  print: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6v-7Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3',
  alert: 'M12 9v4m0 4h.01M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  edit: 'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3ZM13.5 6.5l3 3',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  star: 'M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9L12 3Z',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2 2m8 8 2 2m0-12-2 2M8 16l-2 2',
}

export function Icon({ name, className = '', size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
