import { useMemo } from 'react'
import { addDays } from 'date-fns'
import { GanttChartSquare } from 'lucide-react'
import type { Task } from '@/domain/types'
import { EmptyState } from '@/components/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { atTime, toDateString } from '@/lib/dates'
import { GanttChart, type GanttTask } from '@/features/common/GanttChart'

const PRIORITY_BAR = { critical: '#dc2626', high: '#e8590c', medium: '#2346e0', low: '#94a3b8' }

/** Интервал задачи для Ганта: [начало, дедлайн] включительно; при отсутствии одной из дат — оценка по плану */
export function taskSpan(t: Task): { start: Date; end: Date } | null {
  if (!t.startDate && !t.deadline) return null
  const days = Math.max(1, Math.ceil((t.plannedMinutes ?? 60) / 480))
  const start = t.startDate ? atTime(t.startDate, '00:00') : addDays(atTime(t.deadline!, '00:00'), -(days - 1))
  const lastDay = t.deadline ? atTime(t.deadline, '00:00') : addDays(start, days - 1)
  return { start, end: addDays(lastDay, 1) }
}

const taskProgress = (t: Task) =>
  t.status === 'done' ? 100 : t.plannedMinutes && t.actualMinutes ? Math.min(95, Math.round((t.actualMinutes / t.plannedMinutes) * 100)) : 0

export function TaskGantt({ tasks }: { tasks: Task[] }) {
  const { projects, upsertTask } = useAppStore()
  const open = useUi((s) => s.open)

  const { rows, undated } = useMemo(() => {
    const dated = tasks.map((t) => ({ t, span: taskSpan(t) })).filter((x): x is { t: Task; span: { start: Date; end: Date } } => !!x.span)
    const ids = new Set(dated.map((x) => x.t.id))
    const groups = new Map<string, typeof dated>()
    for (const x of dated) {
      const k = x.t.projectId ?? '__none'
      groups.set(k, [...(groups.get(k) ?? []), x])
    }
    const rows: GanttTask[] = []
    let order = 1
    for (const [key, list] of groups) {
      const p = projects.find((x) => x.id === key)
      const projectRowId = `project:${key}`
      list.sort((a, b) => a.span.start.getTime() - b.span.start.getTime())
      rows.push({
        id: projectRowId,
        type: 'project',
        name: p?.name ?? 'Без проекта',
        start: new Date(Math.min(...list.map((x) => x.span.start.getTime()))),
        end: new Date(Math.max(...list.map((x) => x.span.end.getTime()))),
        progress: Math.round((list.filter((x) => x.t.status === 'done').length / list.length) * 100),
        isDisabled: true,
        displayOrder: order++,
        styles: { progressColor: p?.color ?? '#94a3b8', progressSelectedColor: p?.color ?? '#94a3b8' },
      })
      for (const { t, span } of list) {
        rows.push({
          id: t.id,
          type: 'task',
          name: t.title,
          project: projectRowId,
          start: span.start,
          end: span.end,
          progress: taskProgress(t),
          dependencies: t.dependsOn.filter((d) => ids.has(d)),
          displayOrder: order++,
          isDisabled: t.status === 'done',
          styles: { progressColor: PRIORITY_BAR[t.priority], progressSelectedColor: PRIORITY_BAR[t.priority], backgroundColor: `${PRIORITY_BAR[t.priority]}55`, backgroundSelectedColor: `${PRIORITY_BAR[t.priority]}88` },
        })
      }
    }
    return { rows, undated: tasks.length - dated.length }
  }, [tasks, projects])

  if (!rows.length)
    return <EmptyState icon={<GanttChartSquare />} title="Нет задач с датами" description="Укажите у задач дату начала или дедлайн — они появятся на диаграмме Ганта." />

  return (
    <div className="grid gap-2">
      <GanttChart
        tasks={rows}
        onOpen={(g) => g.type === 'task' && open({ kind: 'task', id: g.id })}
        onDateChange={(g) => {
          const t = tasks.find((x) => x.id === g.id)
          if (!t) return
          upsertTask({ ...t, startDate: toDateString(g.start), deadline: toDateString(new Date(g.end.getTime() - 1)) })
        }}
      />
      {undated > 0 && <p className="text-xs text-muted-foreground">Без дат и не показаны на диаграмме: {undated}</p>}
    </div>
  )
}
