import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyData, newProject, newTask } from '@/domain/factories'
import { useAppStore } from '@/store/useAppStore'
import { buildContext, buildTools, undoActions, type AssistantAction } from '../assistantCore'

const st = () => useAppStore.getState()
const run = (tools: ReturnType<typeof buildTools>, name: string, input: Record<string, unknown>) =>
  tools.find((t) => t.name === name)!.execute(input, { signal: new AbortController().signal })

let log: AssistantAction[]
let tools: ReturnType<typeof buildTools>
beforeEach(() => {
  useAppStore.setState({ ...createEmptyData(), hydrated: true })
  st().upsertProject(newProject({ name: 'ARGO Energy' }))
  log = []
  tools = buildTools((a) => log.push(a))
})

describe('инструменты ассистента', () => {
  it('создаёт задачу с проектом по части названия, дедлайном и часами', () => {
    run(tools, 'create_task', { title: 'КП для инвестора', project: 'argo', deadline: '2026-11-13', plannedHours: 3, priority: 'high', inSprint: true, sprintWeek: 1 })
    const t = st().tasks[0]
    expect(t).toMatchObject({ title: 'КП для инвестора', projectId: st().projects[0].id, deadline: '2026-11-13', plannedMinutes: 180, priority: 'high', sprintWeek: 1 })
    expect(t.sprintId).toBe(st().settings.activeSprintId)
    expect(log[0].label).toContain('Создана задача')
  })

  it('отмечает задачу выполненной и пишет результат; отмена возвращает всё как было', () => {
    const t = newTask({ title: 'Договор с поставщиком' })
    st().upsertTask(t)
    run(tools, 'update_task', { id: t.id, status: 'done', actualHours: 1.5 })
    run(tools, 'create_result', { title: 'Первая оплата', project: 'ARGO Energy', metricValue: '150 000', metricUnit: '₽' })
    expect(st().tasks[0]).toMatchObject({ status: 'done', actualMinutes: 90 })
    expect(st().tasks[0].completedAt).toBeTruthy()
    expect(st().results[0]).toMatchObject({ metricValue: 150000, metricUnit: '₽' })
    undoActions(log)
    expect(st().tasks[0].status).toBe('planned')
    expect(st().results).toHaveLength(0)
  })

  it('событие по локальному времени и ошибки на неизвестный проект и плохую дату', () => {
    run(tools, 'create_event', { title: 'Встреча с банком', start: '2026-11-12T15:00' })
    const e = st().events[0]
    expect(new Date(e.start).getHours()).toBe(15)
    expect(new Date(e.end).getTime() - new Date(e.start).getTime()).toBe(3600000)
    expect(() => run(tools, 'create_task', { title: 'X', project: 'Неизвестный' })).toThrow(/не найден/)
    expect(() => run(tools, 'create_task', { title: 'X', deadline: 'в пятницу' })).toThrow(/YYYY-MM-DD/)
  })

  it('закрытие проекта требует причину и выводы', () => {
    expect(() => run(tools, 'close_project', { project: 'ARGO', reason: '', lessons: '' })).toThrow()
    run(tools, 'close_project', { project: 'ARGO', reason: 'Цель достигнута', lessons: 'Продавать раньше' })
    expect(st().projects[0].status).toBe('closed')
    undoActions(log)
    expect(st().projects[0].status).toBe('active')
  })

  it('контекст содержит дату, проекты и открытые задачи с id', () => {
    st().upsertTask(newTask({ title: 'Позвонить в банк' }))
    const ctx = buildContext(new Date('2026-11-10T10:00:00'))
    expect(ctx).toContain('2026-11-10')
    expect(ctx).toContain('ARGO Energy')
    expect(ctx).toMatch(/\[[\w-]+\] Позвонить в банк/)
  })
})
