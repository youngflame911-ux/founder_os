import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays } from 'date-fns'
import { Archive, FolderKanban, GanttChartSquare, LayoutGrid, Plus, RotateCcw } from 'lucide-react'
import { Badge, Button, Card, DemoBadge, EmptyState, PageHeader, Progress, Segmented } from '@/components/ui/primitives'
import { PROJECT_STATUS_LABEL } from '@/domain/constants'
import type { Project } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { isOverdue, projectLastActivity, projectProgress } from '@/services/tasks'
import { atTime, daysBetween, fmtDate, relative, toDateString, todayString } from '@/lib/dates'
import { plural } from '@/lib/utils'
import { GanttChart, type GanttTask } from '@/features/common/GanttChart'

type Tab = 'active' | 'archive' | 'gantt'

export default function ProjectsPage() {
  const [tab, setTab] = useState<Tab>('active')
  const { projects, tasks } = useAppStore()
  const open = useUi((s) => s.open)
  const active = projects.filter((p) => p.status !== 'closed').sort((a, b) => ['active', 'paused', 'idea'].indexOf(a.status) - ['active', 'paused', 'idea'].indexOf(b.status))
  const archived = projects.filter((p) => p.status === 'closed').sort((a, b) => (b.closure?.closedAt ?? '').localeCompare(a.closure?.closedAt ?? ''))

  return (
    <div>
      <PageHeader
        title="Проекты"
        description={`${active.length} в работе · ${archived.length} в архиве`}
        actions={
          <Button onClick={() => open({ kind: 'project' })}>
            <Plus /> Проект
          </Button>
        }
      />
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Текущие', icon: <LayoutGrid /> },
          { value: 'archive', label: `Архив${archived.length ? ` · ${archived.length}` : ''}`, icon: <Archive /> },
          { value: 'gantt', label: 'Гант', icon: <GanttChartSquare /> },
        ]}
      />

      {tab === 'active' &&
        (active.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<FolderKanban />} title="Проектов пока нет" description="Проект объединяет задачи, события, заметки и результаты одной цели." action={<Button onClick={() => open({ kind: 'project' })}><Plus /> Создать проект</Button>} />
        ))}

      {tab === 'archive' &&
        (archived.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {archived.map((p) => (
              <ArchiveCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Archive />} title="Архив пуст" description="Закрытые проекты сохраняются здесь вместе с причиной закрытия и выводами." />
        ))}

      {tab === 'gantt' && <ProjectsGantt projects={projects} tasks={tasks} />}
    </div>
  )
}

function ProjectCard({ project: p }: { project: Project }) {
  const tasks = useAppStore((s) => s.tasks)
  const inactivityDays = useAppStore((s) => s.settings.inactivityDays)
  const pr = projectProgress(p.id, tasks)
  const overdue = tasks.filter((t) => t.projectId === p.id && isOverdue(t)).length
  const last = projectLastActivity(p, tasks)
  const stale = p.status === 'active' && last < addDays(new Date(), -inactivityDays).toISOString()
  const daysLeft = p.deadline ? daysBetween(todayString(), p.deadline) : null

  return (
    <Link to={`/projects/${p.id}`}>
      <Card className="fos-lift group grid h-full gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <h3 className="truncate font-semibold">{p.name}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {p.isDemo && <DemoBadge />}
            <Badge variant={p.status === 'active' ? 'primary' : 'outline'}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
          </div>
        </div>
        {p.goal && <p className="line-clamp-2 text-sm text-muted-foreground">🎯 {p.goal}</p>}
        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{pr.total ? `${pr.done} из ${pr.total} задач` : 'Задач пока нет'}</span>
            <span className="font-medium tabular">{pr.percent}%</span>
          </div>
          <Progress value={pr.percent} color={p.color} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {daysLeft === null ? 'Без дедлайна' : daysLeft < 0 ? <span className="text-destructive">Дедлайн прошёл {fmtDate(p.deadline)}</span> : `До дедлайна ${daysLeft} ${plural(daysLeft, ['день', 'дня', 'дней'])}`}
          </span>
          {overdue > 0 && <span className="text-destructive">Просрочено: {overdue}</span>}
          {stale && <span className="text-warning">Нет активности {relative(last)}</span>}
        </div>
      </Card>
    </Link>
  )
}

function ArchiveCard({ project: p }: { project: Project }) {
  const reopen = useAppStore((s) => s.reopenProject)
  const confirm = useUi((s) => s.confirm)
  return (
    <Card className="grid gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/projects/${p.id}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full opacity-60" style={{ background: p.color }} />
          <h3 className="truncate font-semibold">{p.name}</h3>
        </Link>
        <div className="flex items-center gap-2">
          {p.isDemo && <DemoBadge />}
          <span className="text-xs text-muted-foreground">закрыт {fmtDate(p.closure?.closedAt)}</span>
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Причина</p>
          <p className="whitespace-pre-wrap">{p.closure?.reason}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Выводы</p>
          <p className="whitespace-pre-wrap">{p.closure?.lessons}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={async () => {
          if (await confirm({ title: 'Вернуть проект в работу?', description: 'Причина и выводы закрытия сохранятся в описании проекта.', confirmLabel: 'Восстановить' })) reopen(p.id)
        }}
      >
        <RotateCcw /> Восстановить
      </Button>
    </Card>
  )
}

function ProjectsGantt({ projects, tasks }: { projects: Project[]; tasks: ReturnType<typeof useAppStore.getState>['tasks'] }) {
  const upsertProject = useAppStore((s) => s.upsertProject)
  const navigate = useNavigate()
  const rows = useMemo<GanttTask[]>(
    () =>
      projects
        .filter((p) => p.status !== 'closed')
        .map((p, i) => {
          const start = atTime(p.startDate, '00:00')
          const lastTask = tasks.filter((t) => t.projectId === p.id && t.deadline).map((t) => t.deadline!).sort().pop()
          const endDay = p.deadline ?? lastTask ?? p.startDate
          const end = addDays(atTime(endDay < p.startDate ? p.startDate : endDay, '00:00'), 1)
          return {
            id: p.id,
            type: 'task' as const,
            name: p.deadline ? p.name : `${p.name} (без дедлайна)`,
            start,
            end,
            progress: projectProgress(p.id, tasks).percent,
            displayOrder: i + 1,
            styles: { progressColor: p.color, progressSelectedColor: p.color, backgroundColor: `${p.color}50`, backgroundSelectedColor: `${p.color}80` },
          }
        }),
    [projects, tasks],
  )
  if (!rows.length) return <EmptyState icon={<GanttChartSquare />} title="Нет текущих проектов" />
  return (
    <GanttChart
      tasks={rows}
      listTitle="Проект"
      onOpen={(g) => navigate(`/projects/${g.id}`)}
      onDateChange={(g) => {
        const p = projects.find((x) => x.id === g.id)
        if (p) upsertProject({ ...p, startDate: toDateString(g.start), deadline: toDateString(new Date(g.end.getTime() - 1)) })
      }}
    />
  )
}
