import {
  addDays,
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isValid,
  parse,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DateString } from '@/domain/types'

export const DATE_FMT = 'yyyy-MM-dd'

export const toDateString = (d: Date): DateString => format(d, DATE_FMT)
export const fromDateString = (s: DateString): Date => parse(s, DATE_FMT, new Date())
export const todayString = (now = new Date()): DateString => toDateString(now)

/** Понедельник недели (ISO-неделя, неделя начинается с понедельника) */
export const weekStart = (d: Date): Date => startOfWeek(d, { weekStartsOn: 1 })
export const weekStartString = (d: Date): DateString => toDateString(weekStart(d))

export const fmt = (d: Date | string, pattern: string) => {
  const date = typeof d === 'string' ? (d.length === 10 ? fromDateString(d) : parseISO(d)) : d
  return isValid(date) ? format(date, pattern, { locale: ru }) : '—'
}

export const fmtDate = (d: Date | string | null | undefined) => (d ? fmt(d, 'd MMM yyyy') : '—')
export const fmtShort = (d: Date | string | null | undefined) => (d ? fmt(d, 'd MMM') : '—')
export const fmtTime = (d: Date | string) => fmt(d, 'HH:mm')

export const daysBetween = (a: DateString, b: DateString) =>
  differenceInCalendarDays(fromDateString(b), fromDateString(a))

export const relative = (iso: string) =>
  formatDistanceToNowStrict(parseISO(iso), { locale: ru, addSuffix: true })

export const minutesToHours = (m: number) => Math.round((m / 60) * 10) / 10

export const fmtMinutes = (m: number | null | undefined) => {
  if (!m) return '—'
  const h = Math.floor(m / 60)
  const mm = Math.round(m % 60)
  if (!h) return `${mm} мин`
  return mm ? `${h} ч ${mm} мин` : `${h} ч`
}

/** 'HH:mm' + дата → Date */
export const atTime = (date: DateString, time: string): Date => {
  const [h, m] = time.split(':').map(Number)
  const d = fromDateString(date)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

export const eachDate = (from: DateString, to: DateString): DateString[] => {
  const out: DateString[] = []
  const n = daysBetween(from, to)
  for (let i = 0; i <= n; i++) out.push(toDateString(addDays(fromDateString(from), i)))
  return out
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
