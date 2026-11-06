import type { DateString, Sprint, SprintWeek, Task } from '@/domain/types'
import { daysBetween, todayString } from '@/lib/dates'
import { pct } from '@/lib/utils'

export interface SprintProgress {
  totalDays: number
  /** Сколько дней прошло (0 до старта, totalDays после окончания) */
  elapsedDays: number
  daysLeft: number
  /** Дней до старта, если спринт ещё не начался */
  daysToStart: number
  timePercent: number
  phase: 'upcoming' | 'active' | 'finished'
  currentWeek: SprintWeek | null
  tasksTotal: number
  tasksDone: number
  tasksPercent: number
  goalsTotal: number
  goalsDone: number
  goalsPercent: number
  /** Итоговый прогресс: среднее задач и целей (по тому, что заполнено) */
  overallPercent: number
}

export function sprintProgress(sprint: Sprint, tasks: Task[], today: DateString = todayString()): SprintProgress {
  const totalDays = daysBetween(sprint.startDate, sprint.endDate) + 1
  const fromStart = daysBetween(sprint.startDate, today)
  const phase = fromStart < 0 ? 'upcoming' : today > sprint.endDate ? 'finished' : 'active'
  const elapsedDays = phase === 'upcoming' ? 0 : phase === 'finished' ? totalDays : fromStart + 1
  const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id)
  const tasksDone = sprintTasks.filter((t) => t.status === 'done').length
  const goalsDone = sprint.goals.filter((g) => g.done).length
  const tasksPercent = pct(tasksDone, sprintTasks.length)
  const goalsPercent = pct(goalsDone, sprint.goals.length)
  const parts = [sprintTasks.length ? tasksPercent : null, sprint.goals.length ? goalsPercent : null].filter(
    (x): x is number => x !== null,
  )
  return {
    totalDays,
    elapsedDays,
    daysLeft: totalDays - elapsedDays,
    daysToStart: phase === 'upcoming' ? -fromStart : 0,
    timePercent: pct(elapsedDays, totalDays),
    phase,
    currentWeek: sprint.weeks.find((w) => w.startDate <= today && today <= w.endDate) ?? null,
    tasksTotal: sprintTasks.length,
    tasksDone,
    tasksPercent,
    goalsTotal: sprint.goals.length,
    goalsDone,
    goalsPercent,
    overallPercent: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0,
  }
}

export function weekStats(sprint: Sprint, week: SprintWeek, tasks: Task[]) {
  const list = tasks.filter((t) => t.sprintId === sprint.id && t.sprintWeek === week.index)
  const done = list.filter((t) => t.status === 'done').length
  return { total: list.length, done, percent: pct(done, list.length) }
}
