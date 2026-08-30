import { Icon, IconName } from './Icon'

export interface TabDef {
  id: string
  label: string
  icon: IconName
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <nav className="flex items-center gap-1 rounded-xl bg-black/20 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
            active === t.id
              ? 'gold-gradient font-semibold text-rizq-black'
              : 'text-rizq-light/60 hover:text-rizq-light'
          }`}
        >
          <Icon name={t.icon} size={17} />
          <span className="hidden md:inline">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
