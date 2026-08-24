import { GrowingTextarea } from './GrowingTextarea'
import styles from './Plan.module.css'

interface Props {
  value: string
  onChange: (text: string) => void
}

/** The next step. Very quiet, almost a whisper. Free text. */
export function Plan({ value, onChange }: Props) {
  return (
    <GrowingTextarea
      value={value}
      onChange={onChange}
      placeholder="What feels worth doing today?"
      className={styles.field}
      aria-label="Next step"
    />
  )
}
