import { addDays, parseISO } from 'date-fns'
import type { AppData, DateString, Project, Task } from '@/domain/types'
import { fromDateString, toDateString } from '@/lib/dates'
import { isOpen, isOverdue, projectProgress, sortByUrgency } from './tasks'

export interface WeeklyReview {
  weekStart: DateString
  weekEnd: DateString
  completed: Task[]
  createdCount: number
  plannedHours: number
  actualHours: number
  meetingsHours: number
  overdue: Task[]
  projects: { project: Project; completedThisWeek: number; percent: number; total: number }[]
  /** Кандидаты в приоритеты следующей недели */
  nextPriorities: Task[]
}

const local = (iso: string) => toDateString(parseISO(iso))

/** Обзор недели, начинающейся в понедельник `weekStart` */
export function buildWeeklyReview(data: Pick<AppData, 'tasks' | 'projects' | 'events'>, weekStart: DateString): WeeklyReview {
  const weekEnd = toDateString(addDays(fromDateString(weekStart), 6))
  const nextEnd = toDateString(addDays(fromDateString(weekStart), 13))
  const nextStart = toDateString(addDays(fromDateString(weekStart), 7))
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd

  const completed = data.tasks.filter((t) => t.status === 'done' && t.completedAt && inWeek(local(t.completedAt)))
  const sum = (xs: Task[], k: 'plannedMinutes' | 'actualMinutes') => xs.reduce((a, t) => a + (t[k] ?? 0), 0) / 60
  const plannedPool = data.tasks.filter((t) => (t.deadline && inWeek(t.deadline)) || completed.includes(t))

  const meetingsMin = data.events
    .filter((e) => !e.allDay && inWeek(local(e.start)))
    .reduce((a, e) => a + (parseISO(e.end).getTime() - parseISO(e.start).getTime()) / 60000, 0)

  const projects = data.projects
    .filter((p) => p.status === 'active')
    .map((p) => {
      const pr = projectProgress(p.id, data.tasks)
      return { project: p, completedThisWeek: completed.filter((t) => t.projectId === p.id).length, percent: pr.percent, total: pr.total }
    })
    .sort((a, b) => b.completedThisWeek - a.completedThisWeek)

  const open = data.tasks.filter(isOpen)
  const nextPriorities = sortByUrgency(
    open.filter((t) => (t.deadline && t.deadline <= nextEnd) || t.priority === 'critical' || t.priority === 'high'),
    nextStart,
  ).slice(0, 7)

  const round = (x: number) => Math.round(x * 10) / 10
  return {
    weekStart,
    weekEnd,
    completed,
    createdCount: data.tasks.filter((t) => inWeek(local(t.createdAt))).length,
    plannedHours: round(sum(plannedPool, 'plannedMinutes')),
    actualHours: round(sum(completed, 'actualMinutes')),
    meetingsHours: round(meetingsMin / 60),
    // просроченные на конец недели
    overdue: open.filter((t) => isOverdue(t, toDateString(addDays(fromDateString(weekEnd), 1)))),
    projects,
    nextPriorities,
  }
}
