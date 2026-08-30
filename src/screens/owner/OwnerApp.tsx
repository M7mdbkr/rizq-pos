import { useState, useEffect } from 'react'
import { TopBar } from '../../components/TopBar'
import { Tabs, TabDef } from '../../components/Tabs'
import { startTelegramBot, stopTelegramBot } from '../../integrations/telegram'
import { Dashboard } from './Dashboard'
import { Assistant } from './Assistant'
import { Analytics } from './Analytics'
import { Inventory } from './Inventory'
import { Customers } from './Customers'
import { Operations } from './Operations'
import { Compliance } from './Compliance'
import { Discounts } from './Discounts'
import { Reports } from './Reports'
import { Settings } from './Settings'

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: 'dashboard' },
  { id: 'assistant', label: 'المساعد الذكي', icon: 'sparkle' },
  { id: 'analytics', label: 'التحليلات', icon: 'chart' },
  { id: 'inventory', label: 'المخزون', icon: 'box' },
  { id: 'customers', label: 'العملاء', icon: 'user' },
  { id: 'operations', label: 'العمليات', icon: 'trash' },
  { id: 'compliance', label: 'الالتزامات', icon: 'alert' },
  { id: 'discounts', label: 'الخصومات', icon: 'tag' },
  { id: 'reports', label: 'المحاسبة', icon: 'ledger' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
]

export function OwnerApp() {
  const [tab, setTab] = useState('dashboard')

  // run the Telegram assistant/report bot while the owner is in the app
  useEffect(() => {
    startTelegramBot()
    return () => stopTelegramBot()
  }, [])

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </TopBar>
      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'assistant' && <Assistant />}
        {tab === 'analytics' && <Analytics />}
        {tab === 'inventory' && <Inventory />}
        {tab === 'customers' && <Customers />}
        {tab === 'operations' && <Operations />}
        {tab === 'compliance' && <Compliance />}
        {tab === 'discounts' && <Discounts />}
        {tab === 'reports' && <Reports />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
