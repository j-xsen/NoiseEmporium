interface AccountButtonProps {
  email: string
  onClick: () => void
}

export default function AccountButton({ email, onClick }: AccountButtonProps) {
  return (
    <button className="account-trigger" onClick={onClick} aria-label="Account settings">
      <span className="signout-email">{email}</span>
    </button>
  )
}
