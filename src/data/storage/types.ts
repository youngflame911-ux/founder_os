import type { AppData } from '@/domain/types'

/**
 * Контракт слоя хранения. Интерфейс (store, страницы) знает только этот контракт.
 *
 * Сейчас: LocalStorageAdapter — весь снимок данных в одном ключе localStorage.
 * Позже: SupabaseAdapter реализует те же методы (load → select из таблиц,
 * save → upsert изменённых коллекций). Замена адаптера — одна строка в `data/storage/index.ts`.
 */
export interface StorageAdapter {
  readonly name: string
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
  clear(): Promise<void>
}

/** Коллекции, которые станут таблицами в Supabase */
export const COLLECTIONS = ['projects', 'tasks', 'events', 'notes', 'results', 'sprints', 'reviews'] as const
export type CollectionName = (typeof COLLECTIONS)[number]
