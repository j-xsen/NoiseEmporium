interface IconProps {
  size?: number
  className?: string
}

const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const PlayIcon = ({ size = 24, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={0} fill="currentColor">
    <path d="M6 4.5v15l13-7.5z" />
  </svg>
)

export const PauseIcon = ({ size = 24, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={0} fill="currentColor">
    <rect x="5" y="4" width="4" height="16" rx="1" />
    <rect x="15" y="4" width="4" height="16" rx="1" />
  </svg>
)

export const SkipBackIcon = ({ size = 24, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={0} fill="currentColor">
    <rect x="5" y="5" width="2.5" height="14" rx="1" />
    <path d="M19 5.5L9 12l10 6.5V5.5z" />
  </svg>
)

export const SkipForwardIcon = ({ size = 24, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={0} fill="currentColor">
    <rect x="16.5" y="5" width="2.5" height="14" rx="1" />
    <path d="M5 5.5l10 6.5-10 6.5V5.5z" />
  </svg>
)

export const LoopIcon = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a6 6 0 016-6h12" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a6 6 0 01-6 6H3" />
  </svg>
)

export const LibraryIcon = ({ size = 22, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <path d="M9 18V8l12-3v10" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="15" r="3" />
  </svg>
)

export const PlayerIcon = ({ size = 22, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <path d="M3 12h1M6.5 7v10M10 4.5v15M13.5 7v10M17 9.5v5M21 12h-1" />
  </svg>
)

export const PlaylistsIcon = ({ size = 22, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <path d="M3 6h18M3 12h12M3 18h9" />
    <path d="M18 16v6M15 19h6" />
  </svg>
)

export const PlusIcon = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const ChevronLeftIcon = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={2}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

export const XIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={2}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

export const TrashIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)

export const MoreIcon = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
)
