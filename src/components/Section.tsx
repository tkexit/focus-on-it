import type { ReactNode } from 'react'
import styles from './Section.module.css'

interface Props {
  label: string
  children: ReactNode
}

/** Подпись · тонкая линия · содержимое. Один ритм для всех трёх слоёв. */
export function Section({ label, children }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.label}>{label}</div>
      <div className={styles.rule} />
      <div className={styles.body}>{children}</div>
    </section>
  )
}
