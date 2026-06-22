import type { SlowModeState } from '../types'
import { todayStr } from './date'

/** Скачивает всё состояние одним читаемым JSON-файлом. */
export function downloadBackup(state: SlowModeState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `slow-mode-${todayStr()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Читает файл бэкапа. Валидация — на стороне useStorage (normalize). */
export async function readBackup(file: File): Promise<unknown> {
  return JSON.parse(await file.text())
}
