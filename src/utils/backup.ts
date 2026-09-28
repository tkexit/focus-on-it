import type { FocusOnItState } from '../types'
import { todayStr } from './date'

/** Downloads the entire state as one readable JSON file. */
export function downloadBackup(state: FocusOnItState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `focus-on-it-${todayStr()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Reads a backup file. Validation happens in useStorage (normalize). */
export async function readBackup(file: File): Promise<unknown> {
  return JSON.parse(await file.text())
}
