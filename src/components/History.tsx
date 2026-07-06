import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { NowEntry } from '../types'
import { formatLong } from '../utils/date'
import styles from './History.module.css'

interface Props {
  entries: NowEntry[]
  open: boolean
  onClose: () => void
  onExport: () => void
  onImport: (file: File) => void
}

/** Тихий путь назад: прошлые записи «сейчас» по датам. Скрыт по умолчанию. */
export function History({ entries, open, onClose, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const auth = useAuth()

  const handleSignIn = (provider: 'google' | 'apple') => {
    auth.signIn(provider).catch((err) => {
      // Не роняем тихое место, но причину (провайдер не настроен, сеть)
      // оставляем в консоли — иначе отказ входа не отладить.
      console.error('sign-in failed:', err)
    })
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.column} onClick={(e) => e.stopPropagation()}>
        <div className={styles.heading}>The path</div>

        {entries.length === 0 ? (
          <p className={styles.empty}>
            Your past “now” notes will gather here.
            <br />
            For the moment, there’s only today.
          </p>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.date} className={styles.entry}>
                <div className={styles.date}>{formatLong(entry.date)}</div>
                <div className={styles.body}>{entry.text}</div>
              </li>
            ))}
          </ul>
        )}

        <footer className={styles.footer}>
          <p className={styles.note}>Everything you write stays on this device.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.quietButton} onClick={onExport}>
              Save a copy
            </button>
            <button
              type="button"
              className={styles.quietButton}
              onClick={() => fileRef.current?.click()}
            >
              Restore
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onImport(file)
                e.target.value = ''
              }}
            />
          </div>

          {auth.enabled && (
            <div className={styles.account}>
              {auth.session ? (
                <>
                  <p className={styles.note}>{auth.session.user.email}</p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.quietButton}
                      onClick={() => auth.signOut()}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.note}>Sign in to keep your notes across devices.</p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.quietButton}
                      onClick={() => handleSignIn('google')}
                    >
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      className={styles.quietButton}
                      onClick={() => handleSignIn('apple')}
                    >
                      Continue with Apple
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
