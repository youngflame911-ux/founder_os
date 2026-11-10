import type { AppData } from '@/domain/types'
import type { StorageAdapter } from './types'

const KEY = 'founder-os:data'

export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'этот браузер'
  readonly kind = 'local' as const
  constructor(private readonly key = KEY) {}

  async load(): Promise<AppData | null> {
    try {
      const raw = localStorage.getItem(this.key)
      return raw ? (JSON.parse(raw) as AppData) : null
    } catch (e) {
      console.error('[storage] не удалось прочитать данные', e)
      return null
    }
  }

  async save(data: AppData): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(data))
    } catch (e) {
      console.error('[storage] не удалось сохранить данные', e)
      throw e
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key)
  }
}
