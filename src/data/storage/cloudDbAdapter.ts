import { addDays } from 'date-fns'
import type { AppData } from '@/domain/types'
import type { ClaudeDb, DbQuerySnap } from '@/lib/claudeRuntime'
import { toDateString } from '@/lib/dates'
import { COLLECTIONS, type CollectionName, type StorageAdapter } from './types'

/**
 * Облачное хранилище Claude (capability `db`).
 *
 * Схема:
 *   <collection>/<id>  — по документу на проект, задачу, событие, заметку, результат, спринт, обзор
 *   meta/state         — schemaVersion, settings, workdays, dayPlans (последние 60 дней), weeklyFocus, updatedAt
 * meta/state пишется последним: его наличие означает «хранилище инициализировано».
 *
 * Сохранение — дифф с последним синхронизированным состоянием: пишутся только изменённые документы.
 * Слияние входящих изменений — по `updatedAt` записи: побеждает более свежая.
 */

const META = 'meta/state'
type Doc = Record<string, unknown>
type Row = { id: string; updatedAt?: string }
const CONCURRENCY = 4

/** JSON с отсортированными ключами — чтобы сравнение не зависело от порядка полей */
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, (val as Doc)[k]])) : val,
  )
}

const metaOf = (d: AppData): Doc => {
  const cutoff = toDateString(addDays(new Date(), -60))
  return {
    schemaVersion: d.schemaVersion,
    settings: d.settings,
    workdays: Object.fromEntries(Object.entries(d.workdays).filter(([k]) => k >= cutoff)),
    dayPlans: Object.fromEntries(Object.entries(d.dayPlans).filter(([k]) => k >= cutoff)),
    weeklyFocus: d.weeklyFocus,
  }
}

/** Все документы, которыми должно быть представлено состояние: path → json */
function toDocs(d: AppData): Map<string, string> {
  const out = new Map<string, string>()
  for (const c of COLLECTIONS) for (const row of d[c] as Row[]) out.set(`${c}/${row.id}`, stable(row))
  out.set(META, stable(metaOf(d)))
  return out
}

async function pool<T>(items: T[], fn: (t: T) => Promise<void>) {
  const queue = items.slice()
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift()!)
  })
  await Promise.all(workers)
}

export class CloudDbAdapter implements StorageAdapter {
  readonly name = 'облако Claude'
  readonly kind = 'cloud' as const
  /** Последнее состояние, совпадающее с сервером: path → json */
  private synced = new Map<string, string>()
  private saving: Promise<void> = Promise.resolve()

  constructor(private readonly db: ClaudeDb) {}

  async load(): Promise<AppData | null> {
    const meta = await this.db.doc(META).get()
    if (!meta.exists) return null
    const snaps = await Promise.all(COLLECTIONS.map((c) => this.db.collection(c).get()))
    const data = this.assemble(meta.data() ?? {}, snaps)
    this.synced = toDocs(data)
    // meta, как он лежит в облаке (без updatedAt), — чтобы не переписывать без нужды
    this.synced.set(META, stable(metaOf(data)))
    return data
  }

  private assemble(meta: Doc, snaps: DbQuerySnap[]): AppData {
    const data = { ...(meta as Partial<AppData>) } as AppData
    COLLECTIONS.forEach((c, i) => {
      ;(data as unknown as Record<CollectionName, unknown[]>)[c] = snaps[i].docs.filter((d) => d.exists).map((d) => d.data())
    })
    return data
  }

  save(data: AppData): Promise<void> {
    // сохранения выстраиваются в очередь: в один документ — одна запись за раз
    this.saving = this.saving.catch(() => undefined).then(() => this.write(data))
    return this.saving
  }

  private async write(data: AppData) {
    const want = toDocs(data)
    const changed = [...want].filter(([p, json]) => this.synced.get(p) !== json && p !== META)
    const removed = [...this.synced.keys()].filter((p) => !want.has(p))
    await pool(changed, async ([p, json]) => {
      await this.db.doc(p).set(JSON.parse(json))
      this.synced.set(p, json)
    })
    await pool(removed, async (p) => {
      await this.db.doc(p).delete()
      this.synced.delete(p)
    })
    const meta = want.get(META)!
    if (this.synced.get(META) !== meta) {
      await this.db.doc(META).set({ ...JSON.parse(meta), updatedAt: new Date().toISOString() })
      this.synced.set(META, meta)
    }
  }

  async clear() {
    await this.write({ ...(Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as AppData), schemaVersion: 1, settings: {} as AppData['settings'], workdays: {}, dayPlans: {}, weeklyFocus: {} })
    await this.db.doc(META).delete()
    this.synced.clear()
  }

  subscribe(getLocal: () => AppData, apply: (merged: AppData) => void) {
    const remote: Partial<Record<CollectionName, Map<string, Row>>> = {}
    let remoteMeta: Doc | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const reconcile = () => {
      if (COLLECTIONS.some((c) => !remote[c]) || !remoteMeta) return
      const local = getLocal()
      let touched = false
      const next = { ...local } as unknown as Record<string, unknown>
      for (const c of COLLECTIONS) {
        const rmap = remote[c]!
        const localRows = local[c] as Row[]
        const byId = new Map(localRows.map((r) => [r.id, r]))
        const merged: Row[] = []
        for (const r of localRows) {
          const path = `${c}/${r.id}`
          const rr = rmap.get(r.id)
          if (!rr) {
            // удалено в другом месте, если запись уже была синхронизирована
            if (this.synced.has(path) && this.synced.get(path) === stable(r)) {
              this.synced.delete(path)
              touched = true
              continue
            }
            merged.push(r)
          } else if ((rr.updatedAt ?? '') > (r.updatedAt ?? '')) {
            merged.push(rr)
            this.synced.set(path, stable(rr))
            touched = true
          } else merged.push(r)
        }
        for (const [id, rr] of rmap) {
          if (byId.has(id)) continue
          const path = `${c}/${id}`
          // новая запись извне (а не удалённая здесь и ещё не стёртая в облаке)
          if (!this.synced.has(path)) {
            merged.push(rr)
            this.synced.set(path, stable(rr))
            touched = true
          }
        }
        next[c] = merged
      }
      const localMetaJson = stable(metaOf(local))
      const { updatedAt: _u, ...rm } = remoteMeta
      void _u
      const remoteMetaJson = stable(rm)
      if (remoteMetaJson !== this.synced.get(META) && remoteMetaJson !== localMetaJson) {
        Object.assign(next, rm)
        this.synced.set(META, remoteMetaJson)
        touched = true
      }
      if (touched) apply(next as unknown as AppData)
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(reconcile, 400)
    }

    const unsubs = COLLECTIONS.map((c) =>
      this.db.collection(c).onSnapshot(
        (snap) => {
          if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return
          remote[c] = new Map(snap.docs.filter((d) => d.exists).map((d) => [d.id, d.data() as Row]))
          schedule()
        },
        (e) => console.warn('[cloud] подписка остановлена', c, e.code),
      ),
    )
    unsubs.push(
      this.db.doc(META).onSnapshot(
        (snap) => {
          if (snap.metadata.fromCache || snap.metadata.hasPendingWrites || !snap.exists) return
          remoteMeta = snap.data() ?? null
          schedule()
        },
        (e) => console.warn('[cloud] подписка meta остановлена', e.code),
      ),
    )
    return () => {
      clearTimeout(timer)
      unsubs.forEach((u) => u())
    }
  }
}
