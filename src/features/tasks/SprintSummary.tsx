import type { Sprint } from '@/domain/types'
import { Progress } from '@/components/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { sprintProgress } from '@/services/sprint'
import { fmt } from '@/lib/dates'
import { plural } from '@/lib/utils'

export function useActiveSprint(): Sprint | undefined {
  return useAppStore((s) => s.sprints.find((x) => x.id === s.settings.activeSprintId) ?? s.sprints[0])
}

export function SprintSummary({ sprint }: { sprint: Sprint }) {
  const tasks = useAppStore((s) => s.tasks)
  const p = sprintProgress(sprint, tasks)
  const status =
    p.phase === 'upcoming'
      ? `Старт через ${p.daysToStart} ${plural(p.daysToStart, ['день', 'дня', 'дней'])}`
      : p.phase === 'finished'
        ? 'Спринт завершён'
        : `День ${p.elapsedDays} из ${p.totalDays} · осталось ${p.daysLeft}`

  return (
    <div className="grid gap-4">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{status}</span>
          <span className="text-xs text-muted-foreground tabular">
            {fmt(sprint.startDate, 'd MMM')} – {fmt(sprint.endDate, 'd MMM yyyy')}
          </span>
        </div>
        {p.currentWeek && (
          <p className="mt-1 text-xs text-muted-foreground">
            Неделя {p.currentWeek.index} из {sprint.weeks.length}
            {p.currentWeek.goal ? ` · ${p.currentWeek.goal}` : ''}
          </p>
        )}
      </div>
      <Row label="Время" value={p.timePercent} sub={`${p.elapsedDays}/${p.totalDays} дн.`} color="hsl(var(--muted-foreground))" />
      <Row label="Задачи спринта" value={p.tasksPercent} sub={p.tasksTotal ? `${p.tasksDone}/${p.tasksTotal}` : 'нет задач'} />
      <Row label="Цели" value={p.goalsPercent} sub={p.goalsTotal ? `${p.goalsDone}/${p.goalsTotal}` : 'не заданы'} color="hsl(var(--success))" />
      {p.phase === 'active' && p.tasksTotal > 0 && p.tasksPercent + 10 < p.timePercent && (
        <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">Выполнение отстаёт от графика на {p.timePercent - p.tasksPercent} п.п.</p>
      )}
    </div>
  )
}

function Row({ label, value, sub, color }: { label: string; value: number; sub: string; color?: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular">
          <span className="font-medium">{value}%</span> <span className="text-muted-foreground">· {sub}</span>
        </span>
      </div>
      <Progress value={value} color={color} />
    </div>
  )
}
