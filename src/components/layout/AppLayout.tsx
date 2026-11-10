import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Cloud,
  HardDrive,
  Sun,
  Trophy,
  X,
} from 'lucide-react'
import { getISOWeek } from 'date-fns'
import { cn } from '@/lib/utils'
import { useAssistantAvailable } from '@/features/assistant/AssistantPanel'
import { fmt, todayString } from '@/lib/dates'
import { useUi } from '@/store/useUiStore'
import { useAppStore } from '@/store/useAppStore'
import { QuickAddMenu, QuickAddFab } from './QuickAdd'

/** Строго семь разделов в порядке из ТЗ */
export const NAV = [
  { to: '/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/', label: 'Главная', icon: LayoutDashboard },
  { to: '/tasks', label: 'Задачи / 90 дней', icon: CheckSquare },
  { to: '/projects', label: 'Проекты', icon: FolderKanban },
  { to: '/knowledge', label: 'База знаний', icon: BookOpen },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/results', label: 'Результаты', icon: Trophy },
] as const

/** Шапка как у журнала: название и «номер выпуска» — неделя года */
function Brand() {
  const now = new Date()
  return (
    <div className="px-2">
      <div className="font-display text-[27px] font-extrabold leading-none">Founder OS</div>
      <div className="mt-2 border-t border-foreground pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground tabular">
        № {getISOWeek(now)} · {fmt(now, 'd MMMM yyyy')}
      </div>
    </div>
  )
}

function SyncStatus() {
  const kind = useAppStore((s) => s.storageKind)
  const syncing = useAppStore((s) => s.syncing)
  const error = useAppStore((s) => s.saveError)
  if (error) return null
  return (
    <p className="flex items-center gap-2 px-2.5 pb-1 text-[11px] text-muted-foreground" title={kind === 'cloud' ? 'Данные синхронизируются между вашими устройствами' : 'Данные хранятся только в этом браузере'}>
      {kind === 'cloud' ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
      {kind === 'cloud' ? (syncing ? 'Сохраняю в облако…' : 'В облаке, синхронизировано') : 'Только этот браузер'}
    </p>
  )
}

function AssistantNav({ onNavigate }: { onNavigate?: () => void }) {
  const { sample } = useAssistantAvailable()
  const setAssistant = useUi((s) => s.setAssistant)
  if (!sample) return null
  return (
    <button
      onClick={() => {
        onNavigate?.()
        setAssistant(true)
      }}
      className="fos-press flex h-9 w-full items-center gap-2.5 rounded-md border px-2.5 text-sm hover:bg-accent"
    >
      <Sparkles className="h-4 w-4 text-primary" />
      Ассистент
      <kbd className="ml-auto text-[10px] text-muted-foreground">/</kbd>
    </button>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const overdue = useAppStore((s) => {
    const today = todayString()
    return s.tasks.filter((t) => t.status !== 'done' && t.deadline && t.deadline < today).length
  })
  return (
    <nav className="grid gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              isActive && 'bg-accent font-semibold text-foreground [&_svg]:text-primary',
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          {to === '/tasks' && overdue > 0 && (
            <span className="ml-auto rounded-full bg-destructive/12 px-1.5 text-[11px] font-medium tabular text-destructive" title="Просроченные задачи">
              {overdue}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** Нижняя панель на телефоне: четыре главных раздела и «Ещё» */
const TABS = [NAV[1], NAV[0], NAV[2], NAV[3]]
function MobileTabBar({ onMore }: { onMore: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Основные разделы"
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'fos-press flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground',
              isActive && 'text-foreground [&_svg]:text-primary',
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span className="max-w-full truncate px-1">{to === '/tasks' ? 'Задачи' : label}</span>
        </NavLink>
      ))}
      <button onClick={onMore} className="fos-press flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Menu className="h-5 w-5" />
        Ещё
      </button>
    </nav>
  )
}

function SidebarFooter() {
  const { theme, toggleTheme, setSettingsOpen } = useUi()
  const saveError = useAppStore((s) => s.saveError)
  return (
    <div className="mt-auto grid gap-0.5 border-t pt-3">
      <SyncStatus />
      {saveError && <p className="mb-2 rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">{saveError}</p>}
      <button onClick={toggleTheme} className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      </button>
      <button onClick={() => setSettingsOpen(true)} className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
        <Settings className="h-4 w-4" />
        Настройки и данные
      </button>
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const current = NAV.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))

  useEffect(() => setMobileOpen(false), [location.pathname])

  // Горячая клавиша: N — новая задача (вне полей ввода)
  const open = useUi((s) => s.open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, [contenteditable], [role=dialog]')) return
      if (e.key === 'n' || e.key === 'т') {
        e.preventDefault()
        open({ kind: 'task' })
      }
      if (e.key === '/' || e.key === '.') {
        e.preventDefault()
        useUi.getState().setAssistant(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col gap-5 border-r bg-sidebar px-3 py-5 lg:flex">
        <Brand />
        <div className="grid gap-2">
          <QuickAddMenu />
          <AssistantNav />
        </div>
        <NavItems />
        <SidebarFooter />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 border-r bg-sidebar px-3 py-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 hover:bg-accent" aria-label="Закрыть меню">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AssistantNav onNavigate={() => setMobileOpen(false)} />
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden"
          style={{ height: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <button onClick={() => setMobileOpen(true)} className="-ml-1.5 rounded-md p-1.5 hover:bg-accent" aria-label="Открыть меню">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-lg font-bold">{current?.label ?? 'Founder OS'}</span>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pt-8 lg:pb-28">
            <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Загрузка…</div>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <QuickAddFab />
      <MobileTabBar onMore={() => setMobileOpen(true)} />
    </div>
  )
}
