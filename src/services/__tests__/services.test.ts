import { describe, expect, it } from 'vitest'
import { buildSprintWeeks, createEmptyData, createSprint, newEvent, newProject, newTask } from '@/domain/factories'
import { migrate } from '@/data/storage/migrations'
import { planDay } from '../planner'
import { sprintProgress } from '../sprint'
import { createsCycle, isOverdue, projectProgress, sortByUrgency } from '../tasks'
import { inactiveProjects, taskMetrics, weeklyDynamics } from '../metrics'
import { buildWeeklyReview } from '../weeklyReview'

const WD = { start: '09:00', end: '18:00', breakMinutes: 60, breakStart: '13:00' }
const local = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString()

describe('спринт', () => {
  it('первый спринт 9.11.2026–6.02.2027 = 90 дней и 13 недельных этапов', () => {
    const data = createEmptyData()
    const s = data.sprints[0]
    expect(s.startDate).toBe('2026-11-09')
    expect(s.endDate).toBe('2027-02-06')
    const p = sprintProgress(s, [], '2026-11-06')
    expect(p.totalDays).toBe(90)
    expect(p.phase).toBe('upcoming')
    expect(p.daysToStart).toBe(3)
    expect(s.weeks).toHaveLength(13)
    expect(s.weeks[12]).toMatchObject({ startDate: '2027-02-01', endDate: '2027-02-06' })
  })

  it('прогресс по времени, задачам и целям', () => {
    const s = createSprint({ name: 'S', startDate: '2026-11-09', endDate: '2027-02-06' })
    s.goals = [{ id: 'g1', title: 'a', target: '', done: true }, { id: 'g2', title: 'b', target: '', done: false }]
    const tasks = [newTask({ sprintId: s.id, status: 'done' }), newTask({ sprintId: s.id }), newTask({ sprintId: s.id }), newTask({ sprintId: s.id, status: 'done' })]
    const p = sprintProgress(s, tasks, '2026-11-18')
    expect(p.elapsedDays).toBe(10)
    expect(p.tasksPercent).toBe(50)
    expect(p.goalsPercent).toBe(50)
    expect(p.currentWeek?.index).toBe(2)
  })

  it('пересчёт недель сохраняет цели этапов', () => {
    const w = buildSprintWeeks('2026-11-09', '2026-11-29')
    w[0].goal = 'Запуск'
    expect(buildSprintWeeks('2026-11-09', '2026-12-06', w)[0].goal).toBe('Запуск')
  })
})

describe('задачи', () => {
  it('просрочка только для открытых задач', () => {
    expect(isOverdue(newTask({ deadline: '2026-11-01' }), '2026-11-06')).toBe(true)
    expect(isOverdue(newTask({ deadline: '2026-11-01', status: 'done' }), '2026-11-06')).toBe(false)
    expect(isOverdue(newTask({ deadline: '2026-11-06' }), '2026-11-06')).toBe(false)
  })

  it('сортировка: просроченные выше критических без дедлайна', () => {
    const a = newTask({ title: 'crit', priority: 'critical' })
    const b = newTask({ title: 'late', priority: 'low', deadline: '2026-11-01' })
    expect(sortByUrgency([a, b], '2026-11-06')[0].title).toBe('late')
  })

  it('обнаружение циклических зависимостей', () => {
    const a = newTask()
    const b = newTask({ dependsOn: [a.id] })
    const c = newTask({ dependsOn: [b.id] })
    expect(createsCycle(a.id, c.id, [a, b, c])).toBe(true)
    expect(createsCycle(c.id, a.id, [a, b, c])).toBe(false)
  })

  it('прогресс проекта по задачам', () => {
    const p = newProject()
    expect(projectProgress(p.id, [newTask({ projectId: p.id, status: 'done' }), newTask({ projectId: p.id })]).percent).toBe(50)
  })
})

describe('планировщик дня', () => {
  const date = '2026-11-10'

  it('учитывает встречи и перерыв', () => {
    const ev = newEvent({ start: local(date, '10:00'), end: local(date, '11:00') })
    const r = planDay({ date, settings: WD, events: [ev], tasks: [] })
    expect(r.capacityMinutes).toBe(8 * 60)
    expect(r.meetingsMinutes).toBe(60)
    expect(r.free.map((f) => [f.start, f.end])).toEqual([[540, 600], [660, 780], [840, 1080]])
  })

  it('раскладывает по срочности и делит задачу на части', () => {
    const ev = newEvent({ start: local(date, '10:00'), end: local(date, '11:00') })
    const urgent = newTask({ title: 'urgent', priority: 'critical', deadline: date, plannedMinutes: 90 })
    const later = newTask({ title: 'later', priority: 'low', plannedMinutes: 30 })
    const r = planDay({ date, settings: WD, events: [ev], tasks: [later, urgent] })
    const first = r.blocks.filter((b) => b.taskId === urgent.id)
    expect(first).toHaveLength(2) // 09:00–10:00 + 11:00–11:30
    expect(first[0].startMin).toBe(540)
    expect(first[1]).toMatchObject({ startMin: 660, endMin: 690, part: 2, partsTotal: 2 })
    expect(r.blocks.find((b) => b.taskId === later.id)?.startMin).toBe(690)
  })

  it('пропускает заблокированные, ожидающие и не начатые задачи; сообщает о нехватке времени', () => {
    const dep = newTask({ plannedMinutes: 600 })
    const blocked = newTask({ dependsOn: [dep.id] })
    const waiting = newTask({ status: 'waiting' })
    const future = newTask({ startDate: '2026-12-01' })
    const r = planDay({ date, settings: WD, events: [], tasks: [dep, blocked, waiting, future] })
    expect(r.skipped.map((s) => s.reason).sort()).toEqual(['blocked', 'not_started', 'waiting'])
    expect(r.unscheduled[0]).toMatchObject({ taskId: dep.id, remainingMinutes: 120 })
  })
})

describe('аналитика и обзор недели', () => {
  it('считает выполнение, соблюдение дедлайнов и часы', () => {
    const tasks = [
      newTask({ createdAt: local('2026-11-02', '10:00'), status: 'done', completedAt: local('2026-11-04', '10:00'), deadline: '2026-11-05', plannedMinutes: 60, actualMinutes: 90 }),
      newTask({ createdAt: local('2026-11-02', '10:00'), status: 'done', completedAt: local('2026-11-06', '10:00'), deadline: '2026-11-05', plannedMinutes: 60, actualMinutes: 30 }),
      newTask({ createdAt: local('2026-11-03', '10:00'), deadline: '2026-11-04' }),
    ]
    const m = taskMetrics(tasks, { from: '2026-11-01', to: '2026-11-07' }, '2026-11-07')
    expect(m.created).toBe(3)
    expect(m.completed).toBe(2)
    expect(m.completionRate).toBe(67)
    expect(m.deadlineAdherence).toBe(50)
    expect(m.overdue).toBe(1)
    expect(m.actualHours).toBe(2)
    expect(m.avgCompletionDays).toBe(3)
  })

  it('недельная динамика и неактивные проекты', () => {
    const now = new Date('2026-11-06T12:00:00')
    const tasks = [newTask({ createdAt: local('2026-11-03', '10:00'), status: 'done', completedAt: local('2026-11-05', '10:00') })]
    const dyn = weeklyDynamics(tasks, 4, now)
    expect(dyn).toHaveLength(4)
    expect(dyn[3]).toMatchObject({ weekStart: '2026-11-02', created: 1, completed: 1 })
    const stale = newProject({ updatedAt: '2026-10-01T00:00:00Z' })
    const fresh = newProject({ updatedAt: '2026-11-05T00:00:00Z' })
    expect(inactiveProjects([stale, fresh], [], 14, now).map((x) => x.project.id)).toEqual([stale.id])
  })

  it('обзор недели собирает выполненное и приоритеты', () => {
    const done = newTask({ status: 'done', completedAt: local('2026-11-04', '12:00'), actualMinutes: 120 })
    const next = newTask({ priority: 'high', deadline: '2026-11-12' })
    const r = buildWeeklyReview({ tasks: [done, next], projects: [], events: [] }, '2026-11-02')
    expect(r.completed).toHaveLength(1)
    expect(r.actualHours).toBe(2)
    expect(r.nextPriorities[0].id).toBe(next.id)
  })
})

describe('хранилище', () => {
  it('миграция пустых и частичных данных', () => {
    const d = migrate(null)
    expect(d.sprints).toHaveLength(1)
    expect(d.settings.activeSprintId).toBe(d.sprints[0].id)
    const partial = migrate({ tasks: [newTask()] } as never)
    expect(partial.tasks).toHaveLength(1)
    expect(partial.settings.workday.start).toBe('09:00')
  })
})
