import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Columns3, Crosshair, GanttChartSquare, List, Plus, Search, X } from 'lucide-react'
import { Button, Checkbox, PageHeader, Segmented, Select } from '@/components/ui/primitives'
import { PRIORITIES, PRIORITY_LABEL, PRIORITY_WEIGHT, STATUSES, STATUS_LABEL } from '@/domain/constants'
import type { Priority, Task, TaskStatus } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { isOverdue, sortByUrgency } from '@/services/tasks'
import { plural } from '@/lib/utils'
import { TaskList } from '@/features/tasks/TaskList'
import { TaskKanban } from '@/features/tasks/TaskKanban'
import { TaskGantt } from '@/features/tasks/TaskGantt'
import { SprintPanel } from '@/features/tasks/SprintPanel'
import { useActiveSprint } from '@/features/tasks/SprintSummary'

type View = 'list' | 'kanban' | 'gantt' | 'sprint'
type Sort = 'urgency' | 'deadline' | 'priority' | 'created'

export default function TasksPage() {
  const [params, setParams] = useSearchParams()
  const view = (['list', 'kanban', 'gantt', 'sprint'].includes(params.get('view') ?? '') ? params.get('view') : 'list') as View
  const tasks = useAppStore((s) => s.tasks)
  const projects = useAppStore((s) => s.projects)
  const open = useUi((s) => s.open)
  const sprint = useActiveSprint()

  const [q, setQ] = useState('')
  const [project, setProject] = useState('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [status, setStatus] = useState<TaskStatus | 'open' | 'overdue' | ''>('open')
  const [sprintOnly, setSprintOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('urgency')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = tasks.filter(
      (t) =>
        (!query || t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)) &&
        (!project || (project === '__none' ? !t.projectId : t.projectId === project)) &&
        (!priority || t.priority === priority) &&
        (!sprintOnly || (sprint && t.sprintId === sprint.id)),
    )
    // в канбане статус — это колонки, фильтр по статусу не применяем
    if (view === 'list' || view === 'gantt') {
      if (status === 'open') list = list.filter((t) => t.status !== 'done')
      else if (status === 'overdue') list = list.filter((t) => isOverdue(t))
      else if (status) list = list.filter((t) => t.status === status)
    }
    const by: Record<Sort, (a: Task, b: Task) => number> = {
      urgency: () => 0,
      deadline: (a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'),
      priority: (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    }
    const ranked = sortByUrgency(list)
    return sort === 'urgency' ? ranked : ranked.sort(by[sort])
  }, [tasks, q, project, priority, status, sprintOnly, sprint, sort, view])

  const setView = (v: View) => {
    const next = new URLSearchParams(params)
    next.set('view', v)
    setParams(next, { replace: true })
  }
  const hasFilters = q || project || priority || sprintOnly || status !== 'open'
  const openCount = tasks.filter((t) => t.status !== 'done').length

  return (
    <div>
      <PageHeader
        title="Задачи / 90 дней"
        description={`${openCount} ${plural(openCount, ['открытая задача', 'открытые задачи', 'открытых задач'])} · всего ${tasks.length}`}
        actions={
          <Button onClick={() => open({ kind: 'task', initial: view === 'sprint' && sprint ? { sprintId: sprint.id } : undefined })}>
            <Plus /> Задача
          </Button>
        }
      />
      <div className="mb-4 overflow-x-auto">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: 'Список', icon: <List /> },
            { value: 'kanban', label: 'Канбан', icon: <Columns3 /> },
            { value: 'gantt', label: 'Гант', icon: <GanttChartSquare /> },
            { value: 'sprint', label: 'Спринт 90 дней', icon: <Crosshair /> },
          ]}
        />
      </div>

      {view !== 'sprint' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск задач" className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none focus:border-ring" />
          </div>
          <Select className="h-8 w-auto min-w-[140px] text-xs" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Все проекты</option>
            <option value="__none">Без проекта</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select className="h-8 w-auto min-w-[130px] text-xs" value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
            <option value="">Любой приоритет</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
          {view !== 'kanban' && (
            <Select className="h-8 w-auto min-w-[130px] text-xs" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="open">Открытые</option>
              <option value="overdue">Просроченные</option>
              <option value="">Все статусы</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
          {view === 'list' && (
            <Select className="h-8 w-auto text-xs" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
              <option value="urgency">По срочности</option>
              <option value="deadline">По дедлайну</option>
              <option value="priority">По приоритету</option>
              <option value="created">Сначала новые</option>
            </Select>
          )}
          {sprint && (
            <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Checkbox checked={sprintOnly} onChange={setSprintOnly} /> Только спринт
            </label>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setProject('')
                setPriority('')
                setStatus('open')
                setSprintOnly(false)
              }}
            >
              <X /> Сбросить
            </Button>
          )}
        </div>
      )}

      {view === 'list' && <TaskList tasks={filtered} />}
      {view === 'kanban' && <TaskKanban tasks={filtered} />}
      {view === 'gantt' && <TaskGantt tasks={filtered} />}
      {view === 'sprint' && sprint && <SprintPanel sprint={sprint} />}
    </div>
  )
}
