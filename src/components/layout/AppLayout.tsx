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
  Sun,
  Trophy,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { todayString } from '@/lib/dates'
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

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background">
        <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden>
          <path d="M10 22V10h12M10 16h8" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <span className="text-[15px] font-semibold tracking-tight">Founder OS</span>
    </div>
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
              isActive && 'bg-accent font-medium text-foreground',
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

function SidebarFooter() {
  const { theme, toggleTheme, setSettingsOpen } = useUi()
  const saveError = useAppStore((s) => s.saveError)
  return (
    <div className="mt-auto grid gap-0.5 border-t pt-3">
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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col gap-4 border-r bg-sidebar px-3 py-4 lg:flex">
        <Brand />
        <QuickAddMenu />
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
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="-ml-1.5 rounded-md p-1.5 hover:bg-accent" aria-label="Открыть меню">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">{current?.label ?? 'Founder OS'}</span>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 md:px-8 md:pt-8">
            <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Загрузка…</div>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <QuickAddFab />
    </div>
  )
}
