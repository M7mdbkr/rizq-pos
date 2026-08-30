import { useState } from 'react'
import { TopBar } from '../../components/TopBar'
import { Tabs, TabDef } from '../../components/Tabs'
import { CashierScreen } from './CashierScreen'
import { StockScreen } from './StockScreen'

const TABS: TabDef[] = [
  { id: 'cashier', label: 'الكاشير', icon: 'cart' },
  { id: 'stock', label: 'المخزون', icon: 'box' },
]

export function StaffApp() {
  const [tab, setTab] = useState('cashier')
  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </TopBar>
      <main className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        {tab === 'cashier' ? <CashierScreen /> : <StockScreen />}
      </main>
    </div>
  )
}
