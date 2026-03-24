import { DownloadIcon, CheckIcon, RetryIcon } from './Icons'
import type { DlStatus } from '../hooks/useDownloads'
import type { Song } from '../types'

interface Props {
  song: Song
  status: DlStatus
  onDownload: (song: Song) => void
  onRemove: (id: string) => void
}

export default function DownloadButton({ song, status, onDownload, onRemove }: Props) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (status === 'done') onRemove(song.id)
    else if (status !== 'downloading') onDownload(song)
  }

  return (
    <button
      className={`dl-btn dl-btn--${status}`}
      onClick={handleClick}
      aria-label={
        status === 'done' ? 'Remove download' :
        status === 'downloading' ? 'Downloading…' :
        'Download for offline'
      }
    >
      {status === 'downloading' && <span className="dl-spinner" />}
      {status === 'done' && <CheckIcon size={17} />}
      {status === 'error' && <RetryIcon size={17} />}
      {status === 'none' && <DownloadIcon size={17} />}
    </button>
  )
}
