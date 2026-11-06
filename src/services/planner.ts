import { parseISO } from 'date-fns'
import { DEFAULT_TASK_MINUTES, MIN_BLOCK_MINUTES } from '@/domain/constants'
import type { CalendarEvent, DateString, ID, PlannedBlock, Task, WorkdaySettings } from '@/domain/types'
import { atTime, fromDateString, toDateString } from '@/lib/dates'
import { isBlocked, isOpen, sortByUrgency } from './tasks'

/**
 * Daily Time Planner.
 * Берёт рабочее окно дня, вычитает встречи из календаря и перерыв,
 * затем жадно раскладывает задачи по свободным блокам в порядке срочности
 * (просрочка → дедлайн → приоритет). Задачи можно дробить на части от 15 минут.
 */

interface Interval {
  start: number // минуты от полуночи
  end: number
}

export interface BusyBlock extends Interval {
  kind: 'event' | 'break'
  label: string
  eventId?: ID
}

export interface PlanResult {
  date: DateString
  windowStart: number
  windowEnd: number
  blocks: (PlannedBlock & { startMin: number; endMin: number; part: number; partsTotal: number })[]
  busy: BusyBlock[]
  free: Interval[]
  unscheduled: { taskId: ID; remainingMinutes: number; reason: 'no_time' }[]
  skipped: { taskId: ID; reason: 'blocked' | 'waiting' | 'not_started' }[]
  /** Рабочее время без перерыва */
  capacityMinutes: number
  meetingsMinutes: number
  scheduledMinutes: number
  freeMinutes: number
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function subtract(base: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = []
  for (const b of base) {
    if (cut.end <= b.start || cut.start >= b.end) {
      out.push(b)
      continue
    }
    if (cut.start > b.start) out.push({ start: b.start, end: cut.start })
    if (cut.end < b.end) out.push({ start: cut.end, end: b.end })
  }
  return out
}

/** Пересечение события с днём `date` в минутах от полуночи */
function eventInterval(e: CalendarEvent, date: DateString): Interval | null {
  const dayStart = fromDateString(date).getTime()
  const dayEnd = dayStart + 24 * 60 * 60000
  const s = parseISO(e.start).getTime()
  const en = parseISO(e.end).getTime()
  if (en <= dayStart || s >= dayEnd) return null
  return {
    start: Math.max(0, Math.round((s - dayStart) / 60000)),
    end: Math.min(24 * 60, Math.round((en - dayStart) / 60000)),
  }
}

export function remainingMinutes(t: Task) {
  if (!t.plannedMinutes) return DEFAULT_TASK_MINUTES
  return Math.max(t.plannedMinutes - (t.actualMinutes ?? 0), MIN_BLOCK_MINUTES)
}

export interface PlanInput {
  date: DateString
  settings: WorkdaySettings
  events: CalendarEvent[]
  tasks: Task[]
  /** Не планировать раньше этой минуты (например, «сейчас» для сегодняшнего дня) */
  fromMinute?: number
}

export function planDay({ date, settings, events, tasks, fromMinute }: PlanInput): PlanResult {
  const windowStart = toMin(settings.start)
  const windowEnd = Math.max(windowStart, toMin(settings.end))
  const window: Interval = { start: windowStart, end: windowEnd }

  // Перерыв: в желаемое время, а если оно вне окна — посередине дня
  let breakStart = toMin(settings.breakStart || '13:00')
  const breakLen = Math.min(settings.breakMinutes || 0, windowEnd - windowStart)
  if (breakStart < windowStart || breakStart + breakLen > windowEnd) {
    breakStart = Math.round(windowStart + (windowEnd - windowStart - breakLen) / 2)
  }

  const busy: BusyBlock[] = []
  if (breakLen > 0) busy.push({ start: breakStart, end: breakStart + breakLen, kind: 'break', label: 'Перерыв' })

  let meetingsMinutes = 0
  for (const e of events) {
    if (e.allDay) continue
    const iv = eventInterval(e, date)
    if (!iv) continue
    const clipped = { start: Math.max(iv.start, windowStart), end: Math.min(iv.end, windowEnd) }
    busy.push({ ...iv, kind: 'event', label: e.title, eventId: e.id })
    if (clipped.end > clipped.start) meetingsMinutes += clipped.end - clipped.start
  }
  busy.sort((a, b) => a.start - b.start)

  let free: Interval[] = [window]
  for (const b of busy) free = subtract(free, b)
  if (fromMinute !== undefined) free = subtract(free, { start: 0, end: fromMinute })
  free = free.filter((f) => f.end - f.start >= MIN_BLOCK_MINUTES)
  const freeTotal = free.reduce((a, f) => a + f.end - f.start, 0)

  const skipped: PlanResult['skipped'] = []
  const candidates: Task[] = []
  for (const t of tasks.filter(isOpen)) {
    if (t.status === 'waiting') skipped.push({ taskId: t.id, reason: 'waiting' })
    else if (t.startDate && t.startDate > date) skipped.push({ taskId: t.id, reason: 'not_started' })
    else if (isBlocked(t, tasks)) skipped.push({ taskId: t.id, reason: 'blocked' })
    else candidates.push(t)
  }

  const slots = free.map((f) => ({ ...f }))
  const raw: { taskId: ID; startMin: number; endMin: number }[] = []
  const unscheduled: PlanResult['unscheduled'] = []

  for (const t of sortByUrgency(candidates, date)) {
    let left = remainingMinutes(t)
    for (const slot of slots) {
      if (left <= 0) break
      const len = slot.end - slot.start
      // Не оставляем обрывки короче минимального блока
      if (len < Math.min(left, MIN_BLOCK_MINUTES)) continue
      const chunk = Math.min(left, len)
      raw.push({ taskId: t.id, startMin: slot.start, endMin: slot.start + chunk })
      slot.start += chunk
      left -= chunk
    }
    if (left > 0) unscheduled.push({ taskId: t.id, remainingMinutes: left, reason: 'no_time' })
  }

  const day = fromDateString(date)
  const iso = (min: number) => {
    const d = new Date(day)
    d.setMinutes(min)
    return d.toISOString()
  }
  const blocks = raw
    .sort((a, b) => a.startMin - b.startMin)
    .map((b) => {
      const parts = raw.filter((x) => x.taskId === b.taskId).sort((x, y) => x.startMin - y.startMin)
      return {
        ...b,
        start: iso(b.startMin),
        end: iso(b.endMin),
        part: parts.indexOf(b) + 1,
        partsTotal: parts.length,
      }
    })
  const scheduledMinutes = blocks.reduce((a, b) => a + b.endMin - b.startMin, 0)

  return {
    date,
    windowStart,
    windowEnd,
    blocks,
    busy,
    free,
    unscheduled,
    skipped,
    capacityMinutes: windowEnd - windowStart - breakLen,
    meetingsMinutes,
    scheduledMinutes,
    freeMinutes: freeTotal - scheduledMinutes,
  }
}

export const minToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Минута «сейчас», если планируется сегодняшний день */
export const nowMinuteFor = (date: DateString, now = new Date()) =>
  toDateString(now) === date ? now.getHours() * 60 + now.getMinutes() : undefined

export const workdayFor = (date: DateString, defaults: WorkdaySettings, overrides: Record<DateString, WorkdaySettings>) =>
  overrides[date] ?? defaults

export { atTime }
