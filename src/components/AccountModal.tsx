import { useState } from 'react'
import { XIcon, StarIcon, CheckIcon } from './Icons'
import { api } from '../lib/api'
import type { AuthUser } from '../hooks/useAuth'

interface AccountModalProps {
  user: AuthUser
  token: string
  onClose: () => void
  onLogout: () => void
  onGoToShop: () => void
  onCancelSubscription: () => Promise<string>
}

type Section = 'main' | 'change-password' | 'delete-confirm' | 'cancel-confirm'

export default function AccountModal({ user, token, onClose, onLogout, onGoToShop, onCancelSubscription }: AccountModalProps) {
  const [section, setSection] = useState<Section>('main')

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Cancel subscription state
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return }
    setPwLoading(true); setPwError(null)
    try {
      await api.post('/api/account', { currentPassword, newPassword }, token)
      setPwSuccess(true)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true); setDeleteError(null)
    try {
      await api.delete('/api/account', { password: deletePassword }, token)
      onLogout()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleCancelSubscription() {
    setCancelLoading(true); setCancelError(null)
    try {
      await onCancelSubscription()
      setSection('main')
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="account-modal" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        {section === 'main' && (
          <>
            <div className="sheet-header">
              <h3 className="sheet-title">Account</h3>
              <button className="sheet-close" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
            </div>

            <div className="account-body">
              {/* Email */}
              <div className="account-section">
                <span className="account-label">Email</span>
                <span className="account-value">{user.email}</span>
              </div>

              {/* Membership */}
              <div className="account-section">
                <span className="account-label">Membership</span>
                {user.tier === 'premium' ? (
                  <div className="account-tier-col">
                    <div className="account-tier account-tier--premium">
                      <StarIcon size={13} />
                      <span>Premium</span>
                    </div>
                    {user.cancel_at_period_end ? (
                      <span className="account-cancel-note">
                        {user.subscription_ends_at
                          ? `Cancels ${new Date(user.subscription_ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : 'Cancelled'}
                      </span>
                    ) : (
                      <>
                        {user.subscription_ends_at && (
                          <span className="account-renews-note">
                            {`Renews ${new Date(user.subscription_ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </span>
                        )}
                        <button
                          className="account-cancel-btn"
                          onClick={() => { setCancelError(null); setSection('cancel-confirm') }}
                        >
                          Cancel membership
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="account-tier-row">
                    <div className="account-tier account-tier--free">Free</div>
                    <button
                      className="account-upgrade-btn"
                      onClick={() => { onClose(); onGoToShop() }}
                    >
                      Upgrade
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <button className="account-action" onClick={() => { setSection('change-password'); setPwSuccess(false); setPwError(null) }}>
                Change password
              </button>

              <button className="account-action account-action--signout" onClick={onLogout}>
                Sign out
              </button>

              <button
                className="account-action account-action--danger"
                onClick={() => { setSection('delete-confirm'); setDeleteError(null); setDeletePassword('') }}
              >
                Delete account
              </button>
            </div>
          </>
        )}

        {section === 'change-password' && (
          <>
            <div className="sheet-header">
              <button className="account-back" onClick={() => setSection('main')}>← Back</button>
              <h3 className="sheet-title">Change Password</h3>
              <button className="sheet-close" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
            </div>
            <div className="account-body">
              {pwSuccess && (
                <div className="account-success">
                  <CheckIcon size={15} />
                  <span>Password updated successfully.</span>
                </div>
              )}
              {pwError && <p className="account-error">{pwError}</p>}

              <div className="account-form">
                <label className="account-form__label">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  autoComplete="current-password"
                />
              </div>
              <div className="account-form">
                <label className="account-form__label">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min. 8 chars)"
                  autoComplete="new-password"
                />
              </div>
              <div className="account-form">
                <label className="account-form__label">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  onKeyDown={e => { if (e.key === 'Enter') handleChangePassword() }}
                />
              </div>

              <button
                className="btn-accent account-submit"
                onClick={handleChangePassword}
                disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {pwLoading ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </>
        )}

        {section === 'delete-confirm' && (
          <>
            <div className="sheet-header">
              <button className="account-back" onClick={() => setSection('main')}>← Back</button>
              <h3 className="sheet-title">Delete Account</h3>
              <button className="sheet-close" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
            </div>
            <div className="account-body">
              <p className="account-delete-warning">
                This will permanently delete your account and all playlists. This cannot be undone.
              </p>
              {deleteError && <p className="account-error">{deleteError}</p>}
              <div className="account-form">
                <label className="account-form__label">Confirm your password</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  onKeyDown={e => { if (e.key === 'Enter' && deletePassword) handleDeleteAccount() }}
                />
              </div>
              <button
                className="account-delete-btn"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
              >
                {deleteLoading ? 'Deleting…' : 'Permanently Delete Account'}
              </button>
            </div>
          </>
        )}

        {section === 'cancel-confirm' && (
          <>
            <div className="sheet-header">
              <button className="account-back" onClick={() => setSection('main')}>← Back</button>
              <h3 className="sheet-title">Cancel Membership</h3>
              <button className="sheet-close" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
            </div>
            <div className="account-body">
              <p className="account-cancel-warning">
                Your access stays active until the end of the current billing period. After that, member-only tracks will be locked.
              </p>
              {cancelError && <p className="account-error">{cancelError}</p>}
              <button
                className="account-delete-btn"
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
              <button
                className="account-action"
                onClick={() => setSection('main')}
                disabled={cancelLoading}
              >
                Keep membership
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
