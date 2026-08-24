import { GrowingTextarea } from './GrowingTextarea'
import styles from './Now.module.css'

interface Props {
  value: string
  onChange: (text: string) => void
}

/** Where I am now relative to the horizon. A fresh field every day. */
export function Now({ value, onChange }: Props) {
  return (
    <GrowingTextarea
      value={value}
      onChange={onChange}
      placeholder="Where are you today, relative to your horizon?"
      className={styles.field}
      aria-label="Now"
    />
  )
}
