import AccountButton from './AccountButton'
import PwaTipButton from './PwaTipButton'

interface Props {
  email: string
  onClick: () => void
}

export default function AccountArea({ email, onClick }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
      <AccountButton email={email} onClick={onClick} />
      <PwaTipButton />
    </div>
  )
}
