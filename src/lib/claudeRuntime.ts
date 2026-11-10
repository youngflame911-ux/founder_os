/**
 * Доступ к возможностям среды Claude (страница открыта по ссылке в Claude).
 * В скачанном файле `window.claude` нет — все функции возвращают null,
 * и приложение работает в локальном режиме без ИИ.
 *
 * Типы — минимальные подмножества контрактов runtime 0.2.96, которые использует приложение.
 */

export interface DbDocSnap {
  id: string
  exists: boolean
  data(): Record<string, unknown> | undefined
  metadata: { fromCache: boolean; hasPendingWrites: boolean }
}
export interface DbQuerySnap {
  docs: DbDocSnap[]
  metadata: { fromCache: boolean; hasPendingWrites: boolean }
}
export interface DbDocRef {
  get(): Promise<DbDocSnap>
  set(data: Record<string, unknown>): Promise<void>
  delete(): Promise<void>
  onSnapshot(next: (s: DbDocSnap) => void, error?: (e: { code: string; message: string }) => void): () => void
}
export interface DbCollectionRef {
  doc(id: string): DbDocRef
  get(): Promise<DbQuerySnap>
  onSnapshot(next: (s: DbQuerySnap) => void, error?: (e: { code: string; message: string }) => void): () => void
}
export interface ClaudeDb {
  doc(path: string): DbDocRef
  collection(path: string): DbCollectionRef
}

export interface SampleTool {
  name: string
  description: string
  inputSchema?: { type: 'object'; properties?: Record<string, unknown>; required?: string[] }
  execute(input: Record<string, unknown>, ctx: { signal: AbortSignal }): unknown
}
export interface SampleOptions {
  onText?: (u: { text: string; delta: string }) => void
  signal?: AbortSignal
  tools?: SampleTool[]
  modelTier?: 'default' | 'complex' | 'quick'
  effort?: 'low' | 'medium' | 'high'
  cache?: boolean
}
export type SampleMessage = { role: 'user' | 'assistant'; content: string }
export type SampleFn = ((input: string | SampleMessage[], opts?: SampleOptions) => Promise<{ text: string; truncated: boolean }>) & {
  limits(): Promise<{ tools?: { maxCount: number } }>
}
export interface SampleError {
  code: string
  message: string
  text?: string
}

export interface Dictation {
  start(opts?: { language?: string }): Promise<void>
  stop(): Promise<void>
  onPartial(h: (e: { text: string }) => void): () => void
  onFinal(h: (e: { text: string }) => void): () => void
  onState(h: (e: { state: 'idle' | 'starting' | 'listening' | 'finishing'; reason?: string }) => void): () => void
}

export interface Downloads {
  save(req: { filename: string; data: string | Blob }): Promise<{ status: 'saved' | 'delivered' }>
}

interface CapabilityMap {
  db: ClaudeDb
  sample: SampleFn
  dictation: Dictation
  downloads: Downloads
}

type ClaudeGlobal = { use?: (name: string) => Promise<unknown> }

/** true, если страница открыта внутри Claude (есть среда возможностей) */
export const inClaude = () => typeof window !== 'undefined' && typeof (window as unknown as { claude?: ClaudeGlobal }).claude?.use === 'function'

const cache = new Map<string, Promise<unknown>>()

/** Получить возможность среды или null. Не ждёт дольше timeoutMs. */
export function getCapability<K extends keyof CapabilityMap>(name: K, timeoutMs = 10000): Promise<CapabilityMap[K] | null> {
  if (!inClaude()) return Promise.resolve(null)
  if (!cache.has(name)) {
    const claude = (window as unknown as { claude: Required<ClaudeGlobal> }).claude
    const p = Promise.race([
      claude.use(name).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), timeoutMs)),
    ])
    cache.set(name, p)
  }
  return cache.get(name) as Promise<CapabilityMap[K] | null>
}
