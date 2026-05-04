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
    <rect x="4" y="5" width="2.5" height="14" rx="1" />
    <path d="M13.5 5.5L5.5 12l8 6.5V5.5z" />
    <path d="M21 5.5l-8 6.5 8 6.5V5.5z" />
  </svg>
)

export const SkipForwardIcon = ({ size = 24, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={0} fill="currentColor">
    <rect x="17.5" y="5" width="2.5" height="14" rx="1" />
    <path d="M10.5 5.5l8 6.5-8 6.5V5.5z" />
    <path d="M3 5.5l8 6.5-8 6.5V5.5z" />
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

export const DownloadIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <path d="M12 3v13M7 11l5 5 5-5" />
    <path d="M3 19h18" strokeLinecap="round" />
  </svg>
)

export const CheckIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={2}>
    <path d="M5 12l5 5L20 7" />
  </svg>
)

export const RetryIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <path d="M1 4v6h6M23 20v-6h-6" />
    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
  </svg>
)

export const MoreIcon = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
)

export const PencilIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export const MinusCircleIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
  </svg>
)

export const LockIcon = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={1.75}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
