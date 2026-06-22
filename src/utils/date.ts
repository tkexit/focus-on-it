/** Сегодняшняя дата в локальном времени как YYYY-MM-DD. */
export function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const longFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/** Полных календарных дней с момента iso до сегодня (локальное время). */
export function daysSince(iso: string): number {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 0
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const now = new Date()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

/** «Friday, May 31» — для записей истории. */
export function formatLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return longFormat.format(new Date(y, m - 1, d))
}
