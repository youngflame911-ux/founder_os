import { LocalStorageAdapter } from './localStorageAdapter'
import type { StorageAdapter } from './types'

/** Точка подключения хранилища. Для Supabase заменить на `new SupabaseAdapter(client)`. */
export const storage: StorageAdapter = new LocalStorageAdapter()

export type { StorageAdapter } from './types'
