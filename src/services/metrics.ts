import { addDays, differenceInHours, parseISO, subWeeks } from 'date-fns'
import type { AppData, DateString, ID, Project, Task } from '@/domain/types'
import { fmt, fromDateString, toDateString, todayString, weekStart } from '@/lib/dates'
import { pct } from '@/lib/utils'
import { isOverdue, projectLastActivity } from './tasks'

export interface Period {
  from: DateString
  to: DateString
}

const inPeriod = (iso: string | null, p: Period) => {
  if (!iso) return false
  const d = iso.slice(0, 10)
  return d >= p.from && d <= p.to
}
/** Локальная дата ISO-момента (createdAt хранится в UTC) */
const localDate = (iso: string) => toDateString(parseISO(iso))
const inPeriodLocal = (iso: string | null, p: Period) => !!iso && inPeriod(localDate(iso), p)

export interface TaskMetrics {
  created: number
  completed: number
  completionRate: number
  overdue: number
  /** Среднее время от создания до выполнения, дни */
  avgCompletionDays: number | null
  /** Доля задач с дедлайном, выполненных в срок */
  deadlineAdherence: number | null
  deadlineTracked: number
  plannedHours: number
  actualHours: number
}

export function taskMetrics(tasks: Task[], period: Period, today: DateString = todayString()): TaskMetrics {
  const created = tasks.filter((t) => inPeriodLocal(t.createdAt, period))
  const completed = tasks.filter((t) => t.status === 'done' && inPeriodLocal(t.completedAt, period))
  const durations = completed.map((t) => differenceInHours(parseISO(t.completedAt!), parseISO(t.createdAt)) / 24)
  const withDeadline = completed.filter((t) => t.deadline)
  const onTime = withDeadline.filter((t) => localDate(t.completedAt!) <= t.deadline!)
  // Часы: задачи, выполненные в периоде + открытые задачи с дедлайном в периоде
  const relevant = tasks.filter(
    (t) => (t.status === 'done' && inPeriodLocal(t.completedAt, period)) || (t.status !== 'done' && t.deadline && inPeriod(t.deadline, period)),
  )
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)
  return {
    created: created.length,
    completed: completed.length,
    completionRate: pct(completed.length, created.length),
    overdue: tasks.filter((t) => isOverdue(t, today)).length,
    avgCompletionDays: durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null,
    deadlineAdherence: withDeadline.length ? pct(onTime.length, withDeadline.length) : null,
    deadlineTracked: withDeadline.length,
    plannedHours: Math.round((sum(relevant.map((t) => t.plannedMinutes)) / 60) * 10) / 10,
    actualHours: Math.round((sum(completed.map((t) => t.actualMinutes)) / 60) * 10) / 10,
  }
}

export interface ProjectTime {
  projectId: ID | null
  name: string
  color: string
  plannedHours: number
  actualHours: number
}

/** Распределение времени по проектам за период (по задачам, выполненным в периоде или открытым) */
export function timeByProject(data: Pick<AppData, 'tasks' | 'projects'>, period: Period): ProjectTime[] {
  const map = new Map<ID | null, ProjectTime>()
  for (const t of data.tasks) {
    const relevant =
      (t.status === 'done' && inPeriodLocal(t.completedAt, period)) || (t.status !== 'done' && (!t.deadline || inPeriod(t.deadline, period)))
    if (!relevant) continue
    const p = data.projects.find((x) => x.id === t.projectId)
    const key = p ? p.id : null
    const row = map.get(key) ?? { projectId: key, name: p?.name ?? 'Без проекта', color: p?.color ?? '#94a3b8', plannedHours: 0, actualHours: 0 }
    row.plannedHours += (t.plannedMinutes ?? 0) / 60
    row.actualHours += (t.actualMinutes ?? 0) / 60
    map.set(key, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, plannedHours: Math.round(r.plannedHours * 10) / 10, actualHours: Math.round(r.actualHours * 10) / 10 }))
    .filter((r) => r.plannedHours || r.actualHours)
    .sort((a, b) => b.actualHours + b.plannedHours - (a.actualHours + a.plannedHours))
}

export interface WeekBucket {
  weekStart: DateString
  label: string
  created: number
  completed: number
  actualHours: number
}

/** Недельная динамика за последние N недель (включая текущую) */
export function weeklyDynamics(tasks: Task[], weeks = 8, now = new Date()): WeekBucket[] {
  const current = weekStart(now)
  return Array.from({ length: weeks }, (_, i) => {
    const ws = subWeeks(current, weeks - 1 - i)
    const period = { from: toDateString(ws), to: toDateString(addDays(ws, 6)) }
    const completed = tasks.filter((t) => t.status === 'done' && inPeriodLocal(t.completedAt, period))
    return {
      weekStart: period.from,
      label: fmt(ws, 'd MMM'),
      created: tasks.filter((t) => inPeriodLocal(t.createdAt, period)).length,
      completed: completed.length,
      actualHours: Math.round((completed.reduce((a, t) => a + (t.actualMinutes ?? 0), 0) / 60) * 10) / 10,
    }
  })
}

/** Активные проекты без изменений дольше `days` дней */
export function inactiveProjects(projects: Project[], tasks: Task[], days: number, now = new Date()) {
  const threshold = addDays(now, -days).toISOString()
  return projects
    .filter((p) => p.status === 'active')
    .map((p) => ({ project: p, lastActivity: projectLastActivity(p, tasks) }))
    .filter((x) => x.lastActivity < threshold)
    .sort((a, b) => a.lastActivity.localeCompare(b.lastActivity))
}

export function periodPreset(preset: '7d' | '30d' | '90d' | 'all', now = new Date()): Period {
  const to = todayString(now)
  if (preset === 'all') return { from: '1970-01-01', to }
  const n = preset === '7d' ? 6 : preset === '30d' ? 29 : 89
  return { from: toDateString(addDays(fromDateString(to), -n)), to }
}
