export type Tab = 'today' | 'machines' | 'progress' | 'weight' | 'settings'

const ITEMS: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'today', label: 'Today', icon: '🏋️' },
  { tab: 'machines', label: 'Machines', icon: '🗂️' },
  { tab: 'progress', label: 'Progress', icon: '📈' },
  { tab: 'weight', label: 'Weight', icon: '⚖️' },
  { tab: 'settings', label: 'Settings', icon: '⚙️' },
]

interface Props {
  active: Tab
  onChange: (t: Tab) => void
}

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(item => (
        <button
          key={item.tab}
          className={active === item.tab ? 'active' : ''}
          onClick={() => onChange(item.tab)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
