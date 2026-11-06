import { PRIORITY_WEIGHT } from '@/domain/constants'
import type { DateString, ID, Project, Task } from '@/domain/types'
import { daysBetween, todayString } from '@/lib/dates'
import { pct } from '@/lib/utils'

export const isOpen = (t: Task) => t.status !== 'done'

export const isOverdue = (t: Task, today: DateString = todayString()) =>
  isOpen(t) && !!t.deadline && t.deadline < today

/** Незавершённые зависимости задачи */
export const blockers = (t: Task, all: Task[]) =>
  t.dependsOn.map((id) => all.find((x) => x.id === id)).filter((x): x is Task => !!x && isOpen(x))

export const isBlocked = (t: Task, all: Task[]) => blockers(t, all).length > 0

/** Возвращает true, если добавление зависимости `depId` к задаче `taskId` создаст цикл */
export function createsCycle(taskId: ID, depId: ID, all: Task[]): boolean {
  if (taskId === depId) return true
  const byId = new Map(all.map((t) => [t.id, t]))
  const stack = [depId]
  const seen = new Set<ID>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === taskId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    byId.get(cur)?.dependsOn.forEach((d) => stack.push(d))
  }
  return false
}

/**
 * Оценка срочности для сортировки и планировщика:
 * просрочка > близкий дедлайн > приоритет > «в работе» > давность создания.
 */
export function urgencyScore(t: Task, today: DateString = todayString()): number {
  let score = PRIORITY_WEIGHT[t.priority] * 10
  if (t.deadline) {
    const days = daysBetween(today, t.deadline)
    if (days < 0) score += 100 + Math.min(-days, 30)
    else if (days === 0) score += 60
    else if (days <= 2) score += 40
    else if (days <= 7) score += 20
    else score += Math.max(0, 10 - days / 7)
  }
  if (t.status === 'in_progress') score += 8
  return score
}

export const sortByUrgency = (tasks: Task[], today?: DateString) =>
  [...tasks].sort((a, b) => urgencyScore(b, today) - urgencyScore(a, today) || a.createdAt.localeCompare(b.createdAt))

/** Прогресс проекта = доля выполненных задач */
export function projectProgress(projectId: ID, tasks: Task[]) {
  const list = tasks.filter((t) => t.projectId === projectId)
  const done = list.filter((t) => t.status === 'done').length
  return { total: list.length, done, percent: pct(done, list.length) }
}

/** Последняя активность по проекту: изменения проекта или его задач */
export function projectLastActivity(p: Project, tasks: Task[]): string {
  return tasks
    .filter((t) => t.projectId === p.id)
    .reduce((max, t) => (t.updatedAt > max ? t.updatedAt : max), p.updatedAt)
}
