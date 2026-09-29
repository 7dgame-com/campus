const DAY = 86_400_000
const BEIJING_OFFSET = 8 * 3_600_000

/** Calendar dates in Beijing, independent of the browser's timezone. Includes today. */
export function recentBeijingDates(days: number, now = new Date()): [string, string] {
  const today = new Date(now.getTime() + BEIJING_OFFSET).toISOString().slice(0, 10)
  return [new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY).toISOString().slice(0, 10), today]
}

export function beijingDateInterval(range: string[] | null): { start_at: string; end_at: string } | null {
  if (!range || range.length !== 2) return null
  const starts = range.map((day) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN
    const timestamp = Date.parse(`${day}T00:00:00+08:00`)
    if (!Number.isFinite(timestamp) || new Date(timestamp + BEIJING_OFFSET).toISOString().slice(0, 10) !== day) return NaN
    return timestamp
  })
  if (starts.some((value) => !Number.isFinite(value)) || starts[0] > starts[1]) return null
  return { start_at: new Date(starts[0]).toISOString(), end_at: new Date(starts[1] + DAY).toISOString() }
}

export function formatBeijingLoginTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date)
}
