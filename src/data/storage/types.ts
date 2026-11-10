import type { AppData } from '@/domain/types'

/**
 * Контракт слоя хранения. Интерфейс (store, страницы) знает только этот контракт.
 *
 * Реализации:
 *  - LocalStorageAdapter — весь снимок в одном ключе localStorage (скачанный файл);
 *  - CloudDbAdapter — облачное хранилище Claude, документ на запись (версия по ссылке);
 *  - позже SupabaseAdapter — те же методы поверх таблиц.
 * Выбор адаптера — `data/storage/index.ts → selectStorage()`.
 */
export interface StorageAdapter {
  readonly name: string
  /** 'cloud' — данные синхронизируются между устройствами; 'local' — только этот браузер */
  readonly kind: 'cloud' | 'local'
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
  clear(): Promise<void>
  /**
   * Подписка на изменения, сделанные в другом месте (другое устройство, другая вкладка,
   * Claude из чата). `getLocal` возвращает текущее состояние, `apply` — применить слияние.
   */
  subscribe?(getLocal: () => AppData, apply: (merged: AppData) => void): () => void
}

/** Коллекции сущностей: в облаке каждая запись — отдельный документ */
export const COLLECTIONS = ['projects', 'tasks', 'events', 'notes', 'results', 'sprints', 'reviews'] as const
export type CollectionName = (typeof COLLECTIONS)[number]
