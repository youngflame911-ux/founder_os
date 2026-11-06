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
import { storage } from '@/data/storage'
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

  hydrate: (data: AppData) => void

  upsertTask: (t: Task) => void
  setTaskStatus: (id: ID, status: TaskStatus) => void
  deleteTask: (id: ID) => void

  upsertProject: (p: Project) => void
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

/** Загрузка из хранилища + автосохранение с дебаунсом */
export async function initStore() {
  const loaded = await storage.load()
  useAppStore.getState().hydrate(migrate(loaded))

  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  let applyingExternal = false

  const flush = () => {
    clearTimeout(timer)
    if (!dirty) return
    dirty = false
    storage
      .save(selectData(useAppStore.getState()))
      .then(() => useAppStore.getState().saveError && useAppStore.setState({ saveError: null }))
      .catch(() => {
        dirty = true
        useAppStore.setState({ saveError: 'Не удалось сохранить данные: переполнено хранилище браузера' })
      })
  }

  useAppStore.subscribe((state, prev) => {
    if (!state.hydrated || applyingExternal) return
    const changed = (Object.keys(selectData(state)) as (keyof AppData)[]).some((k) => state[k] !== prev[k])
    if (!changed) return
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(flush, 250)
  })

  // Сохраняем при закрытии только несохранённые изменения — иначе вкладка
  // перезаписала бы данные, сохранённые в это время другой вкладкой
  window.addEventListener('beforeunload', flush)

  // Синхронизация между вкладками: подхватываем данные, записанные другой вкладкой
  window.addEventListener('storage', async (e) => {
    if (e.storageArea !== localStorage || !e.key?.startsWith('founder-os:data') || dirty) return
    const fresh = await storage.load()
    applyingExternal = true
    useAppStore.getState().hydrate(migrate(fresh))
    applyingExternal = false
  })
}
