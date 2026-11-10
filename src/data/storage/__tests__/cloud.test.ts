import { describe, expect, it, vi } from 'vitest'
import { createEmptyData, newProject, newTask } from '@/domain/factories'
import type { ClaudeDb, DbDocSnap, DbQuerySnap } from '@/lib/claudeRuntime'
import { CloudDbAdapter } from '../cloudDbAdapter'
import { mergeData } from '@/store/useAppStore'

/** Имитация облачного хранилища: документы в Map, подписки срабатывают синхронно */
function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>()
  const writes: string[] = []
  const listeners = new Set<() => void>()
  const snap = (path: string): DbDocSnap => ({
    id: path.split('/').pop()!,
    exists: docs.has(path),
    data: () => docs.get(path),
    metadata: { fromCache: false, hasPendingWrites: false },
  })
  const query = (col: string): DbQuerySnap => ({
    docs: [...docs.keys()].filter((p) => p.startsWith(col + '/') && p.split('/').length === 2).map(snap),
    metadata: { fromCache: false, hasPendingWrites: false },
  })
  const notify = () => listeners.forEach((l) => l())
  const docRef = (path: string) => ({
    get: async () => snap(path),
    set: async (d: Record<string, unknown>) => {
      writes.push('set ' + path)
      docs.set(path, structuredClone(d))
      notify()
    },
    delete: async () => {
      writes.push('del ' + path)
      docs.delete(path)
      notify()
    },
    onSnapshot: (next: (s: DbDocSnap) => void) => {
      const l = () => next(snap(path))
      listeners.add(l)
      l()
      return () => listeners.delete(l)
    },
  })
  const db: ClaudeDb = {
    doc: docRef,
    collection: (col: string) => ({
      doc: (id: string) => docRef(`${col}/${id}`),
      get: async () => query(col),
      onSnapshot: (next: (s: DbQuerySnap) => void) => {
        const l = () => next(query(col))
        listeners.add(l)
        l()
        return () => listeners.delete(l)
      },
    }),
  }
  return { db, docs, writes }
}

describe('облачное хранилище', () => {
  it('пустое облако → null; сохранение пишет документ на запись и meta последним', async () => {
    const { db, docs, writes } = fakeDb()
    const a = new CloudDbAdapter(db)
    expect(await a.load()).toBeNull()
    const data = createEmptyData()
    const p = newProject({ name: 'ARGO' })
    data.projects = [p]
    data.tasks = [newTask({ title: 'Звонок', projectId: p.id })]
    await a.save(data)
    expect(docs.has(`projects/${p.id}`)).toBe(true)
    expect(writes[writes.length - 1]).toBe('set meta/state')
    const reloaded = await new CloudDbAdapter(db).load()
    expect(reloaded?.tasks[0].title).toBe('Звонок')
    expect(reloaded?.sprints[0].startDate).toBe('2026-11-09')
  })

  it('повторное сохранение пишет только изменения и удаляет убранное', async () => {
    const { db, writes } = fakeDb()
    const a = new CloudDbAdapter(db)
    const data = createEmptyData()
    const t1 = newTask({ title: 'A' })
    const t2 = newTask({ title: 'B' })
    data.tasks = [t1, t2]
    await a.save(data)
    writes.length = 0
    await a.save({ ...data, tasks: [{ ...t1, title: 'A2' }] })
    expect(writes.sort()).toEqual([`del tasks/${t2.id}`, `set tasks/${t1.id}`])
    writes.length = 0
    await a.save({ ...data, tasks: [{ ...t1, title: 'A2' }] })
    expect(writes).toEqual([])
  })

  it('подхватывает более свежие изменения с другого устройства', async () => {
    const { db, docs } = fakeDb()
    const a = new CloudDbAdapter(db)
    const data = createEmptyData()
    const t = newTask({ title: 'Старое', updatedAt: '2026-11-10T08:00:00.000Z' })
    data.tasks = [t]
    await a.save(data)
    let local = await a.load()
    const apply = vi.fn((d) => (local = d))
    vi.useFakeTimers()
    a.subscribe(() => local!, apply)
    // другое устройство меняет задачу и добавляет новую
    docs.set(`tasks/${t.id}`, { ...t, title: 'Новое', updatedAt: '2026-11-10T09:00:00.000Z' })
    const extra = newTask({ title: 'С телефона' })
    await db.doc(`tasks/${extra.id}`).set(extra as unknown as Record<string, unknown>)
    vi.advanceTimersByTime(500)
    vi.useRealTimers()
    expect(apply).toHaveBeenCalled()
    expect(local!.tasks.map((x) => x.title).sort()).toEqual(['Новое', 'С телефона'])
  })

  it('объединение данных браузера с облаком: по id, побеждает свежий updatedAt', () => {
    const cloud = createEmptyData()
    const local = createEmptyData()
    const shared = newTask({ title: 'облако', updatedAt: '2026-11-10T10:00:00Z' })
    cloud.tasks = [shared]
    local.tasks = [{ ...shared, title: 'браузер-старое', updatedAt: '2026-11-09T10:00:00Z' }, newTask({ title: 'только в браузере' })]
    const m = mergeData(cloud, local)
    expect(m.tasks.map((t) => t.title).sort()).toEqual(['облако', 'только в браузере'])
  })
})
