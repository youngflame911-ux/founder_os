import { create } from 'zustand'
import type {
  Achievement,
  AppData,
  CalendarEvent,
  DateString,
  DayPlan,
  ID,
  Note,
  Project,
  Sprint,
  Task,
  TaskStatus,
  WeeklyReviewSnapshot,
  WorkdaySettings,
} from '@/domain/types'
import { createEmptyData } from '@/domain/factories'
import { buildDemoData } from '@/data/demo'
import { localStorageAdapter, selectStorage, setStorage, storage } from '@/data/storage'
import { migrate } from '@/data/storage/migrations'
import { nowISO } from '@/lib/utils'

type CollectionKey = 'projects' | 'tasks' | 'events' | 'notes' | 'results' | 'sprints'
type Entity = { id: ID; updatedAt?: string }

function upsertIn<T extends Entity>(list: T[], item: T): T[] {
  const next = { ...item, updatedAt: nowISO() }
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, next]
  const copy = list.slice()
  copy[i] = next
  return copy
}

/** Поддерживает согласованность completedAt при смене статуса */
function normalizeTask(prev: Task | undefined, t: Task): Task {
  if (t.status === 'done' && !t.completedAt) return { ...t, completedAt: nowISO() }
  if (t.status !== 'done' && t.completedAt) return { ...t, completedAt: null }
  if (prev && prev.status === 'done' && t.status === 'done') return { ...t, completedAt: prev.completedAt ?? t.completedAt }
  return t
}

export interface AppState extends AppData {
  hydrated: boolean
  saveError: string | null
  /** Где живут данные: облако Claude или только этот браузер */
  storageKind: 'cloud' | 'local'
  syncing: boolean
  /** При первом запуске в облаке перенесены записи из браузера */
  migratedFromBrowser: boolean

  hydrate: (data: AppData) => void

  upsertTask: (t: Task) => void
  setTaskStatus: (id: ID, status: TaskStatus) => void
  deleteTask: (id: ID) => void

  upsertProject: (p: Project) => void
  /** Полное удаление — только для отмены действия ассистента (обычные проекты архивируются) */
  purgeProject: (id: ID) => void
  closeProject: (id: ID, reason: string, lessons: string) => void
  reopenProject: (id: ID) => void

  upsertEvent: (e: CalendarEvent) => void
  deleteEvent: (id: ID) => void

  upsertNote: (n: Note) => void
  deleteNote: (id: ID) => void

  upsertResult: (r: Achievement) => void
  deleteResult: (id: ID) => void

  upsertSprint: (s: Sprint) => void
  setActiveSprint: (id: ID) => void

  setDefaultWorkday: (w: WorkdaySettings) => void
  setWorkday: (date: DateString, w: WorkdaySettings | null) => void
  fixDayPlan: (plan: DayPlan) => void
  clearDayPlan: (date: DateString) => void

  setWeeklyFocus: (weekStart: DateString, text: string) => void
  saveReview: (r: WeeklyReviewSnapshot) => void

  loadDemo: () => void
  clearDemo: () => void
  importData: (d: AppData) => void
  resetAll: () => void
}

export const selectData = (s: AppState): AppData => ({
  schemaVersion: s.schemaVersion,
  projects: s.projects,
  tasks: s.tasks,
  events: s.events,
  notes: s.notes,
  results: s.results,
  sprints: s.sprints,
  workdays: s.workdays,
  dayPlans: s.dayPlans,
  weeklyFocus: s.weeklyFocus,
  reviews: s.reviews,
  settings: s.settings,
})

export const useAppStore = create<AppState>()((set, get) => {
  const put = <K extends CollectionKey>(key: K, item: AppData[K][number]) =>
    set((s) => ({ [key]: upsertIn(s[key] as Entity[], item as Entity) }) as Partial<AppState>)
  const remove = (key: CollectionKey, id: ID) =>
    set((s) => ({ [key]: (s[key] as Entity[]).filter((x) => x.id !== id) }) as Partial<AppState>)

  return {
    ...createEmptyData(),
    hydrated: false,
    saveError: null,
    storageKind: 'local',
    syncing: false,
    migratedFromBrowser: false,

    hydrate: (data) => set({ ...data, hydrated: true }),

    upsertTask: (t) => {
      const prev = get().tasks.find((x) => x.id === t.id)
      put('tasks', normalizeTask(prev, t))
    },
    setTaskStatus: (id, status) => {
      const t = get().tasks.find((x) => x.id === id)
      if (t) get().upsertTask({ ...t, status })
    },
    deleteTask: (id) =>
      set((s) => ({
        tasks: s.tasks
          .filter((t) => t.id !== id)
          .map((t) => (t.dependsOn.includes(id) ? { ...t, dependsOn: t.dependsOn.filter((d) => d !== id) } : t)),
      })),

    upsertProject: (p) => put('projects', p),
    purgeProject: (id) =>
      set((s) => {
        const unlink = <T extends { projectId: ID | null }>(x: T): T => (x.projectId === id ? { ...x, projectId: null } : x)
        return {
          projects: s.projects.filter((p) => p.id !== id),
          tasks: s.tasks.map(unlink),
          events: s.events.map(unlink),
          notes: s.notes.map(unlink),
          results: s.results.map(unlink),
        }
      }),
    closeProject: (id, reason, lessons) => {
      const p = get().projects.find((x) => x.id === id)
      if (!p) return
      put('projects', { ...p, status: 'closed', closure: { reason, lessons, closedAt: nowISO() } })
    },
    reopenProject: (id) => {
      const p = get().projects.find((x) => x.id === id)
      // Выводы прошлого закрытия сохраняем в описании, чтобы история не потерялась
      if (!p) return
      const history = p.closure
        ? `${p.description}\n\n— Закрывался ${p.closure.closedAt.slice(0, 10)}. Причина: ${p.closure.reason}. Выводы: ${p.closure.lessons}`.trim()
        : p.description
      put('projects', { ...p, status: 'active', closure: null, description: history })
    },

    upsertEvent: (e) => put('events', e),
    deleteEvent: (id) => remove('events', id),

    upsertNote: (n) => put('notes', n),
    deleteNote: (id) => remove('notes', id),

    upsertResult: (r) => put('results', r),
    deleteResult: (id) => remove('results', id),

    upsertSprint: (sp) => put('sprints', sp),
    setActiveSprint: (id) => set((s) => ({ settings: { ...s.settings, activeSprintId: id } })),

    setDefaultWorkday: (w) => set((s) => ({ settings: { ...s.settings, workday: w } })),
    setWorkday: (date, w) =>
      set((s) => {
        const next = { ...s.workdays }
        if (w) next[date] = w
        else delete next[date]
        return { workdays: next }
      }),
    fixDayPlan: (plan) => set((s) => ({ dayPlans: { ...s.dayPlans, [plan.date]: plan } })),
    clearDayPlan: (date) =>
      set((s) => {
        const next = { ...s.dayPlans }
        delete next[date]
        return { dayPlans: next }
      }),

    setWeeklyFocus: (weekStart, text) => set((s) => ({ weeklyFocus: { ...s.weeklyFocus, [weekStart]: text } })),
    saveReview: (r) =>
      set((s) => ({ reviews: [...s.reviews.filter((x) => x.weekStart !== r.weekStart), r] })),

    loadDemo: () =>
      set((s) => {
        const demo = buildDemoData(s.settings.activeSprintId)
        return {
          projects: [...s.projects, ...demo.projects],
          tasks: [...s.tasks, ...demo.tasks],
          events: [...s.events, ...demo.events],
          notes: [...s.notes, ...demo.notes],
          results: [...s.results, ...demo.results],
        }
      }),
    clearDemo: () =>
      set((s) => {
        const demoTaskIds = new Set(s.tasks.filter((t) => t.isDemo).map((t) => t.id))
        const demoProjectIds = new Set(s.projects.filter((p) => p.isDemo).map((p) => p.id))
        const unlinkProject = <T extends { projectId: ID | null }>(x: T): T =>
          x.projectId && demoProjectIds.has(x.projectId) ? { ...x, projectId: null } : x
        return {
          projects: s.projects.filter((x) => !x.isDemo),
          tasks: s.tasks
            .filter((x) => !x.isDemo)
            .map((t) => unlinkProject({ ...t, dependsOn: t.dependsOn.filter((d) => !demoTaskIds.has(d)) })),
          events: s.events.filter((x) => !x.isDemo).map(unlinkProject),
          notes: s.notes.filter((x) => !x.isDemo).map(unlinkProject),
          results: s.results.filter((x) => !x.isDemo).map(unlinkProject),
        }
      }),
    importData: (d) => set({ ...migrate(d) }),
    resetAll: () => set({ ...createEmptyData() }),
  }
})

const ENTITY_KEYS = ['projects', 'tasks', 'events', 'notes', 'results', 'reviews'] as const

/**
 * Объединение двух наборов данных: записи — по id (побеждает более свежий updatedAt),
 * настройки и прочее — из `base`, недостающее дополняется из `extra`.
 */
export function mergeData(base: AppData, extra: AppData): AppData {
  const out: AppData = { ...base }
  for (const k of [...ENTITY_KEYS, 'sprints'] as const) {
    const map = new Map<string, { id: string; updatedAt?: string }>()
    for (const r of base[k] as { id: string; updatedAt?: string }[]) map.set(r.id, r)
    for (const r of extra[k] as { id: string; updatedAt?: string }[]) {
      const cur = map.get(r.id)
      if (!cur || (r.updatedAt ?? '') > (cur.updatedAt ?? '')) map.set(r.id, r)
    }
    ;(out as unknown as Record<string, unknown>)[k] = [...map.values()]
  }
  // Если в облаке остался только автоматически созданный пустой спринт, а в браузере есть свой — берём браузерный
  const baseSprintUsed = base.sprints.some((sp) => sp.goals.length || sp.weeks.some((w) => w.goal))
  if (!baseSprintUsed && extra.sprints.length) {
    out.sprints = extra.sprints
    out.settings = { ...base.settings, activeSprintId: extra.settings.activeSprintId }
  }
  out.weeklyFocus = { ...extra.weeklyFocus, ...base.weeklyFocus }
  out.workdays = { ...extra.workdays, ...base.workdays }
  out.dayPlans = { ...extra.dayPlans, ...base.dayPlans }
  return migrate(out)
}

/** Загрузка из хранилища + автосохранение с дебаунсом + синхронизация */
export async function initStore() {
  const adapter = await selectStorage()
  let loaded: AppData | null = null
  let migratedFromBrowser = false

  if (adapter.kind === 'cloud') {
    try {
      const cloud = await adapter.load()
      // Записи этого браузера, ещё не перенесённые в облако (каждое устройство переносит своё один раз)
      let alreadyMigrated = true
      try {
        alreadyMigrated = !!localStorage.getItem('founder-os:migratedAt')
      } catch {
        /* хранилище браузера недоступно */
      }
      const local = alreadyMigrated ? null : await localStorageAdapter.load()
      const localHasRecords = !!local && ENTITY_KEYS.some((k) => (local[k] as unknown[] | undefined)?.length)
      if (!cloud || localHasRecords) {
        loaded = cloud ? mergeData(migrate(cloud), migrate(local)) : migrate(local)
        await adapter.save(loaded)
        migratedFromBrowser = localHasRecords
      } else loaded = cloud
      if (!alreadyMigrated) {
        try {
          localStorage.setItem('founder-os:migratedAt', new Date().toISOString())
        } catch {
          /* копия всё равно в облаке */
        }
      }
    } catch (e) {
      console.error('[storage] облако недоступно', e)
      useAppStore.setState({ saveError: 'Облако недоступно — показаны данные этого браузера. Изменения не синхронизируются.' })
      loaded = await localStorageAdapter.load()
      setStorage(localStorageAdapter)
    }
  } else {
    loaded = await adapter.load()
  }

  useAppStore.getState().hydrate(migrate(loaded))
  useAppStore.setState({ storageKind: storage.kind, migratedFromBrowser })

  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  let applyingExternal = false

  const flush = () => {
    clearTimeout(timer)
    if (!dirty) return
    dirty = false
    useAppStore.setState({ syncing: true })
    storage
      .save(selectData(useAppStore.getState()))
      .then(() => useAppStore.setState({ syncing: false, saveError: null }))
      .catch((e: { code?: string }) => {
        dirty = true
        const msg =
          storage.kind === 'cloud'
            ? e?.code === 'quota_exceeded'
              ? 'Облачное хранилище заполнено — удалите старые записи'
              : 'Не удалось сохранить в облако — повторим при следующем изменении'
            : 'Не удалось сохранить данные: переполнено хранилище браузера'
        useAppStore.setState({ syncing: false, saveError: msg })
      })
  }

  useAppStore.subscribe((state, prev) => {
    if (!state.hydrated || applyingExternal) return
    const changed = (Object.keys(selectData(state)) as (keyof AppData)[]).some((k) => state[k] !== prev[k])
    if (!changed) return
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(flush, storage.kind === 'cloud' ? 600 : 250)
  })

  // Сохраняем при закрытии только несохранённые изменения
  window.addEventListener('beforeunload', flush)

  const applyExternal = (data: AppData) => {
    if (dirty) return // локальные правки важнее; они уйдут следующим сохранением
    applyingExternal = true
    useAppStore.getState().hydrate(migrate(data))
    applyingExternal = false
  }

  if (storage.subscribe) {
    // Облако: изменения с других устройств и от Claude из чата приходят сами
    storage.subscribe(() => selectData(useAppStore.getState()), applyExternal)
  } else {
    // Браузер: синхронизация между вкладками
    window.addEventListener('storage', async (e) => {
      if (e.storageArea !== localStorage || !e.key?.startsWith('founder-os:data') || dirty) return
      const fresh = await storage.load()
      if (fresh) applyExternal(fresh)
    })
  }
}
