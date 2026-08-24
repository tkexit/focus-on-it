import { useState } from 'react'
import { Section } from './components/Section'
import { Horizon } from './components/Horizon'
import { Now } from './components/Now'
import { Plan } from './components/Plan'
import { History } from './components/History'
import { useStorage } from './hooks/useStorage'
import { downloadBackup, readBackup } from './utils/backup'
import styles from './App.module.css'

export default function App() {
  const { state, setHorizon, setNow, setPlan, importState } = useStorage()
  const [historyOpen, setHistoryOpen] = useState(false)

  const handleImport = async (file: File) => {
    try {
      importState(await readBackup(file))
    } catch {
      /* wrong file — silently ignore, don't break anything */
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.column}>
        <Section label="Horizon">
          <Horizon
            value={state.horizon.text}
            onChange={setHorizon}
            updatedAt={state.horizon.updatedAt}
          />
        </Section>

        <Section label="Now">
          <Now value={state.now.text} onChange={setNow} />
        </Section>

        <Section label="Next step">
          <Plan value={state.plan.text} onChange={setPlan} />
        </Section>
      </main>

      <button
        type="button"
        className={styles.dot}
        aria-label={historyOpen ? 'Close the path' : 'Open the path'}
        aria-pressed={historyOpen}
        onClick={() => setHistoryOpen((o) => !o)}
      />

      <History
        entries={state.history}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onExport={() => downloadBackup(state)}
        onImport={handleImport}
      />
    </div>
  )
}
