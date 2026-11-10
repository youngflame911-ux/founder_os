import { useState } from 'react'
import { Clock, Lock, Plus } from 'lucide-react'
import type { Task, TaskStatus } from '@/domain/types'
import { DemoBadge } from '@/components/ui/primitives'
import { STATUSES, STATUS_LABEL } from '@/domain/constants'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { blockers } from '@/services/tasks'
import { fmtMinutes } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { DeadlineLabel, PriorityIcon, ProjectTag } from '@/features/common/bits'

const COLUMN_DOT: Record<TaskStatus, string> = {
  planned: 'bg-muted-foreground/50',
  in_progress: 'bg-primary',
  waiting: 'bg-warning',
  done: 'bg-success',
}

export function TaskKanban({ tasks }: { tasks: Task[] }) {
  const all = useAppStore((s) => s.tasks)
  const setStatus = useAppStore((s) => s.setTaskStatus)
  const open = useUi((s) => s.open)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)

  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
      {STATUSES.map((status) => {
        const list = tasks.filter((t) => t.status === status)
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(status)
            }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={() => {
              if (dragId) setStatus(dragId, status)
              setDragId(null)
              setOver(null)
            }}
            className={cn('flex w-[78vw] shrink-0 snap-start flex-col rounded-md bg-muted/40 p-2 transition-colors md:w-auto', over === status && 'bg-primary/10 ring-1 ring-primary/40')}
          >
            <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className={cn('h-2 w-2 rounded-full', COLUMN_DOT[status])} />
                {STATUS_LABEL[status]}
                <span className="text-xs font-normal text-muted-foreground tabular">{list.length}</span>
              </span>
              <button onClick={() => open({ kind: 'task', initial: { status } })} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Добавить в «${STATUS_LABEL[status]}»`}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid min-h-[120px] content-start gap-2">
              {list.map((t) => {
                const blocked = t.status !== 'done' && blockers(t, all).length > 0
                return (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => open({ kind: 'task', id: t.id })}
                    className={cn(
                      'fos-lift cursor-pointer rounded-md border bg-card p-3',
                      dragId === t.id && 'opacity-50',
                      t.status === 'done' && 'opacity-70',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <PriorityIcon priority={t.priority} className="mt-0.5" />
                      <p className={cn('flex-1 text-sm font-medium leading-snug', t.status === 'done' && 'text-muted-foreground line-through')}>{t.title}</p>
                      {blocked && <Lock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-label="Ждёт зависимости" />}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ProjectTag projectId={t.projectId} className="max-w-[140px]" />
                      {t.plannedMinutes ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular">
                          <Clock className="h-3 w-3" />
                          {fmtMinutes(t.plannedMinutes)}
                        </span>
                      ) : null}
                      <span className="ml-auto flex items-center gap-1.5">
                        {t.isDemo && <DemoBadge />}
                        <DeadlineLabel deadline={t.deadline} done={t.status === 'done'} />
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
