import { create } from 'zustand'
import type { Achievement, CalendarEvent, Note, Project, Task } from '@/domain/types'

/**
 * Состояние интерфейса (не сохраняется в данных):
 * открытые редакторы, диалог подтверждения, тема.
 * Любой раздел может открыть редактор любой сущности — так работают
 * глобальная кнопка «+» и переходы между связанными записями.
 */
export type EditorRequest =
  | { kind: 'task'; id?: string; initial?: Partial<Task> }
  | { kind: 'event'; id?: string; initial?: Partial<CalendarEvent> }
  | { kind: 'project'; id?: string; initial?: Partial<Project> }
  | { kind: 'note'; id?: string; initial?: Partial<Note> }
  | { kind: 'result'; id?: string; initial?: Partial<Achievement> }
  | { kind: 'closeProject'; id: string }

interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel?: string
  resolve: (ok: boolean) => void
}

export type Theme = 'light' | 'dark'
const THEME_KEY = 'founder-os:theme'

const initialTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

interface UiState {
  editor: EditorRequest | null
  confirmReq: ConfirmRequest | null
  settingsOpen: boolean
  theme: Theme
  /** Панель ИИ-ассистента; draft — текст, с которым её открыли */
  assistant: { open: boolean; draft: string }
  setAssistant: (open: boolean, draft?: string) => void
  open: (req: EditorRequest) => void
  close: () => void
  confirm: (opts: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>
  resolveConfirm: (ok: boolean) => void
  setSettingsOpen: (v: boolean) => void
  toggleTheme: () => void
}

export const useUi = create<UiState>()((set, get) => ({
  editor: null,
  confirmReq: null,
  settingsOpen: false,
  assistant: { open: false, draft: '' },
  setAssistant: (open, draft = '') => set({ assistant: { open, draft } }),
  theme: typeof document !== 'undefined' ? initialTheme() : 'light',
  open: (editor) => set({ editor }),
  close: () => set({ editor: null }),
  confirm: (opts) => new Promise<boolean>((resolve) => set({ confirmReq: { ...opts, resolve } })),
  resolveConfirm: (ok) => {
    get().confirmReq?.resolve(ok)
    set({ confirmReq: null })
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* приватный режим */
    }
    set({ theme })
  },
}))
