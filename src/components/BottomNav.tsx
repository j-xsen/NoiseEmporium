import { HomeIcon, PlayerIcon, LibraryIcon } from './Icons'
import type { Tab } from '../types'

interface BottomNavProps {
  tab: Tab
  onChange: (tab: Tab) => void
  hasSong: boolean
}

const tabs: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'player', label: 'Now Playing', Icon: PlayerIcon },
  { id: 'library', label: 'Library', Icon: LibraryIcon },
]

export default function BottomNav({ tab, onChange, hasSong }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`nav-tab ${tab === id ? 'nav-tab--active' : ''}`}
          onClick={() => onChange(id)}
          aria-label={label}
          aria-current={tab === id ? 'page' : undefined}
        >
          <Icon size={22} />
          <span className="nav-tab__label">{label}</span>
          {id === 'player' && hasSong && tab !== 'player' && (
            <span className="nav-tab__dot" aria-hidden="true" />
          )}
        </button>
      ))}
    </nav>
  )
}
