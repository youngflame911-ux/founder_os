import { AlertTriangle, ArrowDown, ArrowUp, Equal, Flame } from 'lucide-react'
import { PRIORITY_LABEL, STATUS_LABEL } from '@/domain/constants'
import type { ID, Priority, TaskStatus } from '@/domain/types'
import { Badge } from '@/components/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import { daysBetween, fmtShort, todayString } from '@/lib/dates'

const PRIORITY_ICON = { critical: Flame, high: ArrowUp, medium: Equal, low: ArrowDown }
const PRIORITY_CLASS: Record<Priority, string> = {
  critical: 'text-destructive',
  high: 'text-warning',
  medium: 'text-primary',
  low: 'text-muted-foreground',
}

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const Icon = PRIORITY_ICON[priority]
  return <Icon className={cn('h-3.5 w-3.5 shrink-0', PRIORITY_CLASS[priority], className)} aria-label={PRIORITY_LABEL[priority]} />
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', PRIORITY_CLASS[priority])}>
      <PriorityIcon priority={priority} />
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

const STATUS_VARIANT = { planned: 'outline', in_progress: 'primary', waiting: 'warning', done: 'success' } as const
export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}

export function ProjectTag({ projectId, className }: { projectId: ID | null; className?: string }) {
  const p = useAppStore((s) => (projectId ? s.projects.find((x) => x.id === projectId) : undefined))
  if (!p) return null
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
      <span className="truncate">{p.name}</span>
    </span>
  )
}

export function DeadlineLabel({ deadline, done }: { deadline: string | null; done?: boolean }) {
  if (!deadline) return null
  const days = daysBetween(todayString(), deadline)
  const late = !done && days < 0
  const soon = !done && days >= 0 && days <= 1
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs tabular text-muted-foreground', late && 'font-medium text-destructive', soon && 'text-warning')}>
      {late && <AlertTriangle className="h-3 w-3" />}
      {days === 0 ? 'Сегодня' : days === 1 ? 'Завтра' : fmtShort(deadline)}
    </span>
  )
}
