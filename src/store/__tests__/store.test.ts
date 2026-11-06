import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyData, newProject, newTask } from '@/domain/factories'
import { useAppStore } from '../useAppStore'

const st = () => useAppStore.getState()

beforeEach(() => {
  useAppStore.setState({ ...createEmptyData(), hydrated: true })
})

describe('store', () => {
  it('выставляет и снимает completedAt при смене статуса', () => {
    const t = newTask({ title: 'A' })
    st().upsertTask(t)
    st().setTaskStatus(t.id, 'done')
    const done = st().tasks[0]
    expect(done.completedAt).toBeTruthy()
    st().upsertTask({ ...done, title: 'A2' })
    expect(st().tasks[0].completedAt).toBe(done.completedAt) // редактирование не сбрасывает дату
    st().setTaskStatus(t.id, 'in_progress')
    expect(st().tasks[0].completedAt).toBeNull()
  })

  it('удаление задачи снимает зависимости', () => {
    const a = newTask()
    const b = newTask({ dependsOn: [a.id] })
    st().upsertTask(a)
    st().upsertTask(b)
    st().deleteTask(a.id)
    expect(st().tasks).toHaveLength(1)
    expect(st().tasks[0].dependsOn).toEqual([])
  })

  it('закрытие проекта сохраняет причину и выводы, восстановление переносит их в описание', () => {
    const p = newProject({ name: 'P', description: 'D' })
    st().upsertProject(p)
    st().closeProject(p.id, 'Гипотеза не подтвердилась', 'Раньше проверять спрос')
    expect(st().projects[0]).toMatchObject({ status: 'closed', closure: { reason: 'Гипотеза не подтвердилась' } })
    st().reopenProject(p.id)
    expect(st().projects[0].status).toBe('active')
    expect(st().projects[0].description).toContain('Раньше проверять спрос')
  })

  it('демо-данные загружаются и удаляются, не задевая реальные записи', () => {
    const real = newProject({ name: 'Реальный' })
    st().upsertProject(real)
    st().loadDemo()
    expect(st().projects.filter((p) => p.isDemo).length).toBeGreaterThan(0)
    // реальная задача, ссылающаяся на демо-проект, остаётся, но отвязывается
    const demoProject = st().projects.find((p) => p.isDemo)!
    st().upsertTask(newTask({ title: 'Моя', projectId: demoProject.id }))
    st().clearDemo()
    expect(st().projects.map((p) => p.name)).toEqual(['Реальный'])
    expect(st().tasks).toHaveLength(1)
    expect(st().tasks[0].projectId).toBeNull()
    expect([...st().events, ...st().notes, ...st().results].some((x) => x.isDemo)).toBe(false)
  })
})
