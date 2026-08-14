import { useState } from 'react'
import BottomNav, { type Tab } from './components/BottomNav'
import { ToastProvider } from './components/Toast'
import TodayWorkout from './screens/TodayWorkout'
import Machines from './screens/Machines'
import ProgressScreen from './screens/Progress'
import BodyWeightScreen from './screens/BodyWeight'
import Settings from './screens/Settings'

const TITLES: Record<Tab, string> = {
  today: "Today's Workout",
  machines: 'Machines',
  progress: 'Progress',
  weight: 'Body Weight',
  settings: 'Settings',
}

function Screen({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'today': return <TodayWorkout />
    case 'machines': return <Machines />
    case 'progress': return <ProgressScreen />
    case 'weight': return <BodyWeightScreen />
    case 'settings': return <Settings />
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')

  return (
    <ToastProvider>
      <header className="app-header">
        <h1>🏋️ {TITLES[tab]}</h1>
      </header>
      <main className="app-main">
        <Screen tab={tab} />
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </ToastProvider>
  )
}
