import { Lock } from 'lucide-react'
import type { Task, TaskStatus } from '@/domain/types'
import { Checkbox, DemoBadge, EmptyState } from '@/components/ui/primitives'
import { STATUSES, STATUS_LABEL } from '@/domain/constants'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { blockers } from '@/services/tasks'
import { fmtMinutes } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { DeadlineLabel, PriorityBadge, ProjectTag } from '@/features/common/bits'
import { ListTodo } from 'lucide-react'

export function TaskList({ tasks }: { tasks: Task[] }) {
  const all = useAppStore((s) => s.tasks)
  const setStatus = useAppStore((s) => s.setTaskStatus)
  const open = useUi((s) => s.open)

  if (!tasks.length) return <EmptyState icon={<ListTodo />} title="Задач не найдено" description="Измените фильтры или создайте задачу кнопкой «+»" />

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="hidden border-b bg-muted/40 text-left text-xs text-muted-foreground md:table-header-group">
          <tr>
            <th className="w-10 py-2 pl-4" />
            <th className="py-2 font-medium">Задача</th>
            <th className="hidden py-2 font-medium lg:table-cell">Проект</th>
            <th className="py-2 font-medium">Приоритет</th>
            <th className="py-2 font-medium">Статус</th>
            <th className="hidden py-2 font-medium xl:table-cell">План / факт</th>
            <th className="py-2 pr-4 text-right font-medium">Дедлайн</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {tasks.map((t) => {
            const done = t.status === 'done'
            const blocked = !done && blockers(t, all).length > 0
            return (
              <tr key={t.id} className="group hover:bg-accent/40">
                <td className="py-2.5 pl-4 align-middle">
                  <Checkbox checked={done} onChange={(v) => setStatus(t.id, v ? 'done' : 'planned')} label="Выполнено" />
                </td>
                <td className="max-w-0 py-2.5 pr-3">
                  <button onClick={() => open({ kind: 'task', id: t.id })} className="flex w-full min-w-0 items-center gap-2 text-left">
                    <span className={cn('truncate font-medium', done && 'font-normal text-muted-foreground line-through')}>{t.title}</span>
                    {t.isDemo && <DemoBadge />}
                    {blocked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Ждёт зависимости" />}
                  </button>
                  <div className="mt-0.5 flex items-center gap-3 md:hidden">
                    <ProjectTag projectId={t.projectId} />
                    <span className="text-xs text-muted-foreground">{STATUS_LABEL[t.status]}</span>
                  </div>
                  {t.sprintWeek && <span className="hidden text-[11px] text-muted-foreground md:inline">Спринт · неделя {t.sprintWeek}</span>}
                </td>
                <td className="hidden max-w-[180px] py-2.5 pr-3 lg:table-cell">
                  <ProjectTag projectId={t.projectId} />
                </td>
                <td className="hidden py-2.5 pr-3 md:table-cell">
                  <PriorityBadge priority={t.priority} />
                </td>
                <td className="hidden py-2.5 pr-3 md:table-cell">
                  <select
                    value={t.status}
                    onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
                    className="h-7 rounded-md border border-transparent bg-transparent px-1.5 text-xs hover:border-input focus:border-input focus:outline-none"
                    aria-label="Статус"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="hidden py-2.5 pr-3 text-xs text-muted-foreground tabular xl:table-cell">
                  {fmtMinutes(t.plannedMinutes)} / {fmtMinutes(t.actualMinutes)}
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <DeadlineLabel deadline={t.deadline} done={done} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
