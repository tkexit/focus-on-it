import { useState } from 'react'
import { GrowingTextarea } from './GrowingTextarea'
import { daysSince } from '../utils/date'
import styles from './Horizon.module.css'

interface Props {
  value: string
  onChange: (text: string) => void
  /** ISO timestamp of the last change — for the quiet day counter. */
  updatedAt?: string
}

const PLACEHOLDER = 'What matters most to you right now?'

/** The main goal. Large, quiet, always visible. Click to enter edit mode. */
export function Horizon({ value, onChange, updatedAt }: Props) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <GrowingTextarea
        value={value}
        onChange={onChange}
        placeholder={PLACEHOLDER}
        className={styles.field}
        aria-label="Horizon"
        autoFocus
        onEnter={() => setEditing(false)}
        onBlur={() => setEditing(false)}
      />
    )
  }

  const empty = value.trim() === ''
  const days = !empty && updatedAt ? daysSince(updatedAt) : 0

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={empty ? `${styles.text} ${styles.empty}` : styles.text}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setEditing(true)
          }
        }}
      >
        {empty ? PLACEHOLDER : value}
      </div>
      {days > 0 && (
        <div className={styles.days}>
          {days === 1 ? 'A day with this horizon' : `${days} days with this horizon`}
        </div>
      )}
    </>
  )
}
