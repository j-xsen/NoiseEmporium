import { HomeIcon, LibraryIcon, ShopIcon } from './Icons'
import type { Tab } from '../types'

interface BottomNavProps {
  tab: Tab
  onChange: (tab: Tab) => void
  isLoggedIn: boolean
}

const tabs: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; authRequired?: boolean }[] = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'library', label: 'Library', Icon: LibraryIcon, authRequired: true },
  { id: 'shop', label: 'Shop', Icon: ShopIcon },
]

export default function BottomNav({ tab, onChange, isLoggedIn }: BottomNavProps) {
  const visibleTabs = tabs.filter(t => !t.authRequired || isLoggedIn)
  return (
    <nav className="bottom-nav">
      {visibleTabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`nav-tab ${tab === id ? 'nav-tab--active' : ''}`}
          onClick={() => onChange(id)}
          aria-label={label}
          aria-current={tab === id ? 'page' : undefined}
        >
          <Icon size={22} />
          <span className="nav-tab__label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
