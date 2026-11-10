import { getCapability, inClaude } from '@/lib/claudeRuntime'
import { CloudDbAdapter } from './cloudDbAdapter'
import { LocalStorageAdapter } from './localStorageAdapter'
import type { StorageAdapter } from './types'

export const localStorageAdapter = new LocalStorageAdapter()

/** Текущий адаптер. Меняется один раз при запуске в selectStorage(). */
export let storage: StorageAdapter = localStorageAdapter

/**
 * Внутри Claude — облачное хранилище (синхронизация устройств, доступ ИИ).
 * В скачанном файле или если облако недоступно — localStorage.
 */
export async function selectStorage(): Promise<StorageAdapter> {
  if (!inClaude()) return (storage = localStorageAdapter)
  const db = await getCapability('db', 8000)
  storage = db ? new CloudDbAdapter(db) : localStorageAdapter
  return storage
}

export function setStorage(a: StorageAdapter) {
  storage = a
}

export type { StorageAdapter } from './types'
