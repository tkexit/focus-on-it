import { GrowingTextarea } from './GrowingTextarea'
import styles from './Now.module.css'

interface Props {
  value: string
  onChange: (text: string) => void
}

/** Где я сейчас относительно горизонта. Новое поле каждый день. */
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
