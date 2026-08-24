import type { ReactNode } from 'react'
import styles from './Section.module.css'

interface Props {
  label: string
  children: ReactNode
}

/** Label · thin rule · content. One rhythm for all three layers. */
export function Section({ label, children }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.label}>{label}</div>
      <div className={styles.rule} />
      <div className={styles.body}>{children}</div>
    </section>
  )
}
