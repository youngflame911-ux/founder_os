import { SCHEMA_VERSION } from '@/domain/constants'
import { createEmptyData } from '@/domain/factories'
import type { AppData } from '@/domain/types'

/**
 * Приводит загруженные данные к текущей схеме.
 * При изменении модели: увеличить SCHEMA_VERSION и добавить шаг миграции.
 */
export function migrate(input: Partial<AppData> | null): AppData {
  const empty = createEmptyData()
  if (!input) return empty
  const data: AppData = {
    ...empty,
    ...input,
    settings: { ...empty.settings, ...(input.settings ?? {}) },
    sprints: input.sprints?.length ? input.sprints : empty.sprints,
  }
  if (!data.settings.activeSprintId || !data.sprints.some((s) => s.id === data.settings.activeSprintId)) {
    data.settings.activeSprintId = data.sprints[0]?.id ?? null
  }
  // будущие миграции: if (data.schemaVersion < 2) { ... }
  data.schemaVersion = SCHEMA_VERSION
  return data
}

/** Минимальная проверка импортируемого JSON-бэкапа */
export function isAppData(x: unknown): x is AppData {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return ['projects', 'tasks', 'events', 'notes', 'results'].every((k) => Array.isArray(o[k]))
}
