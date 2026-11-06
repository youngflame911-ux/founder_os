import { Clock, Link2, Lock } from 'lucide-react'
import type { Task } from '@/domain/types'
import { Checkbox, DemoBadge } from '@/components/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { blockers } from '@/services/tasks'
import { fmtMinutes } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { DeadlineLabel, PriorityIcon, ProjectTag, StatusBadge } from '@/features/common/bits'

/** Компактная строка задачи: используется на главной, в проекте и в списке */
export function TaskRow({ task, showProject = true, showStatus = false, compact = false, className }: { task: Task; showProject?: boolean; showStatus?: boolean; compact?: boolean; className?: string }) {
  const open = useUi((s) => s.open)
  const tasks = useAppStore((s) => s.tasks)
  const setStatus = useAppStore((s) => s.setTaskStatus)
  const done = task.status === 'done'
  const blocked = !done && blockers(task, tasks).length > 0

  return (
    <div className={cn('group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60', className)}>
      <Checkbox checked={done} onChange={(v) => setStatus(task.id, v ? 'done' : 'planned')} label={`Отметить «${task.title}» выполненной`} />
      <button onClick={() => open({ kind: 'task', id: task.id })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <PriorityIcon priority={task.priority} />
        <span className={cn('truncate text-sm', done && 'text-muted-foreground line-through')}>{task.title}</span>
        {task.isDemo && <DemoBadge />}
        {blocked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Ждёт выполнения зависимостей" />}
        {!blocked && task.dependsOn.length > 0 && <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>
      <div className={cn('hidden shrink-0 items-center gap-3', !compact && 'sm:flex')}>
        {showProject && <ProjectTag projectId={task.projectId} className="max-w-[160px]" />}
        {task.plannedMinutes ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular">
            <Clock className="h-3 w-3" />
            {fmtMinutes(task.plannedMinutes)}
          </span>
        ) : null}
        {showStatus && <StatusBadge status={task.status} />}
      </div>
      <div className="w-16 shrink-0 whitespace-nowrap text-right">
        <DeadlineLabel deadline={task.deadline} done={done} />
      </div>
    </div>
  )
}
