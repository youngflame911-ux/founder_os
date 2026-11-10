import { useState } from 'react'
import { addDays } from 'date-fns'
import { Check, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Progress, Select } from '@/components/ui/primitives'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { buildSprintWeeks, createSprint } from '@/domain/factories'
import type { Sprint, SprintWeek } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { sprintProgress, weekStats } from '@/services/sprint'
import { daysBetween, fmt, fromDateString, toDateString, todayString } from '@/lib/dates'
import { cn, uid } from '@/lib/utils'
import { TaskRow } from './TaskRow'
import { SprintSummary } from './SprintSummary'

export function SprintPanel({ sprint }: { sprint: Sprint }) {
  const { tasks, sprints, upsertSprint, setActiveSprint } = useAppStore()
  const open = useUi((s) => s.open)
  const p = sprintProgress(sprint, tasks)
  const [selectedWeek, setSelectedWeek] = useState<number | null>(p.currentWeek?.index ?? null)
  const [newGoal, setNewGoal] = useState('')
  const [editSprint, setEditSprint] = useState(false)

  const updateGoal = (id: string, patch: Partial<Sprint['goals'][number]>) =>
    upsertSprint({ ...sprint, goals: sprint.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })
  const addGoal = () => {
    if (!newGoal.trim()) return
    upsertSprint({ ...sprint, goals: [...sprint.goals, { id: uid(), title: newGoal.trim(), target: '', done: false }] })
    setNewGoal('')
  }
  const setWeekGoal = (w: SprintWeek, goal: string) => upsertSprint({ ...sprint, weeks: sprint.weeks.map((x) => (x.index === w.index ? { ...x, goal } : x)) })

  const createNext = () => {
    const start = toDateString(addDays(fromDateString(sprint.endDate), 1))
    const s = createSprint({ name: `Спринт ${sprints.length + 1} · 90 дней`, startDate: start, endDate: toDateString(addDays(fromDateString(start), 89)) })
    upsertSprint(s)
    setActiveSprint(s.id)
  }

  const weekTasks = selectedWeek ? tasks.filter((t) => t.sprintId === sprint.id && t.sprintWeek === selectedWeek) : []
  const unassigned = tasks.filter((t) => t.sprintId === sprint.id && !t.sprintWeek)
  const today = todayString()

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {sprints.length > 1 && (
          <Select className="h-8 w-56 text-xs" value={sprint.id} onChange={(e) => setActiveSprint(e.target.value)}>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <Button size="sm" variant="outline" onClick={() => setEditSprint(true)}>
          <Pencil /> Параметры спринта
        </Button>
        {p.phase !== 'upcoming' && sprints[sprints.length - 1].id === sprint.id && (
          <Button size="sm" variant="ghost" onClick={createNext}>
            <Plus /> Следующий спринт
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card>
          <CardHeader title={sprint.name} />
          <CardBody>
            <SprintSummary sprint={sprint} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Target />} title="Цели спринта" description="3–5 измеримых результатов к концу 90 дней" />
          <CardBody className="grid gap-2">
            {sprint.goals.map((g) => (
              <div key={g.id} className="group flex items-start gap-3 rounded-md border px-3 py-2.5">
                <Checkbox className="mt-1" checked={g.done} onChange={(v) => updateGoal(g.id, { done: v })} />
                <div className="grid flex-1 gap-1">
                  <input value={g.title} onChange={(e) => updateGoal(g.id, { title: e.target.value })} className={cn('w-full bg-transparent text-sm font-medium outline-none', g.done && 'text-muted-foreground line-through')} />
                  <input value={g.target} onChange={(e) => updateGoal(g.id, { target: e.target.value })} placeholder="Критерий успеха / метрика" className="w-full bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/60" />
                </div>
                <button onClick={() => upsertSprint({ ...sprint, goals: sprint.goals.filter((x) => x.id !== g.id) })} className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100" aria-label="Удалить цель">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGoal()} placeholder="Новая цель, например «MRR 500 000 ₽»" />
              <Button variant="secondary" onClick={addGoal} disabled={!newGoal.trim()}>
                Добавить
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Недельные этапы</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          {sprint.weeks.map((w) => {
            const st = weekStats(sprint, w, tasks)
            const current = w.startDate <= today && today <= w.endDate
            const past = w.endDate < today
            return (
              <button
                key={w.index}
                onClick={() => setSelectedWeek(selectedWeek === w.index ? null : w.index)}
                className={cn(
                  'grid gap-1.5 rounded-md border bg-card p-2.5 text-left transition-colors hover:border-primary/40',
                  current && 'border-primary/60 bg-primary/[0.04]',
                  selectedWeek === w.index && 'ring-2 ring-primary/50',
                  past && 'opacity-75',
                )}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Нед. {w.index}</span>
                  {current ? <span className="text-[10px] font-medium uppercase text-primary">сейчас</span> : st.total > 0 && st.done === st.total ? <Check className="h-3.5 w-3.5 text-success" /> : null}
                </div>
                <span className="text-[11px] text-muted-foreground tabular">
                  {fmt(w.startDate, 'd MMM')}–{fmt(w.endDate, 'd MMM')}
                </span>
                <span className={cn('line-clamp-2 min-h-[2rem] text-xs', !w.goal && 'text-muted-foreground/60')}>{w.goal || 'Цель не задана'}</span>
                <Progress value={st.percent} className="h-1" />
                <span className="text-[11px] text-muted-foreground tabular">{st.total ? `${st.done}/${st.total} задач` : 'нет задач'}</span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedWeek && (
        <WeekDetail
          key={`${sprint.id}-${selectedWeek}`}
          week={sprint.weeks.find((w) => w.index === selectedWeek)!}
          tasks={weekTasks}
          onGoal={setWeekGoal}
          onAdd={() => open({ kind: 'task', initial: { sprintId: sprint.id, sprintWeek: selectedWeek, deadline: sprint.weeks[selectedWeek - 1].endDate } })}
        />
      )}

      {unassigned.length > 0 && (
        <Card>
          <CardHeader title={`Задачи спринта без недели · ${unassigned.length}`} description="Распределите их по недельным этапам" />
          <CardBody className="grid gap-0.5 px-3">
            {unassigned.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </CardBody>
        </Card>
      )}

      {editSprint && <SprintSettings sprint={sprint} onClose={() => setEditSprint(false)} />}
    </div>
  )
}

function WeekDetail({ week, tasks, onGoal, onAdd }: { week: SprintWeek; tasks: ReturnType<typeof useAppStore.getState>['tasks']; onGoal: (w: SprintWeek, g: string) => void; onAdd: () => void }) {
  const [goal, setGoal] = useState(week.goal)
  return (
    <Card>
      <CardHeader
        title={`Неделя ${week.index} · ${fmt(week.startDate, 'd MMM')} – ${fmt(week.endDate, 'd MMM')}`}
        action={
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus /> Задача
          </Button>
        }
      />
      <CardBody className="grid gap-3">
        <Input value={goal} onChange={(e) => setGoal(e.target.value)} onBlur={() => goal !== week.goal && onGoal(week, goal)} placeholder="Цель недельного этапа" />
        <div className="grid gap-0.5">
          {tasks.length ? tasks.map((t) => <TaskRow key={t.id} task={t} />) : <p className="text-xs text-muted-foreground">Задач на эту неделю нет</p>}
        </div>
      </CardBody>
    </Card>
  )
}

function SprintSettings({ sprint, onClose }: { sprint: Sprint; onClose: () => void }) {
  const upsertSprint = useAppStore((s) => s.upsertSprint)
  const [name, setName] = useState(sprint.name)
  const [start, setStart] = useState(sprint.startDate)
  const [end, setEnd] = useState(sprint.endDate)
  const days = start && end ? daysBetween(start, end) + 1 : 0
  const valid = name.trim() && days > 0
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Параметры спринта" size="sm">
        <DialogBody className="grid gap-3">
          <Field label="Название">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Начало">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Окончание (включительно)">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Длительность: {days} дн. Недельные этапы пересчитаются, цели этапов сохранятся по номеру недели.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              upsertSprint({ ...sprint, name: name.trim(), startDate: start, endDate: end, weeks: buildSprintWeeks(start, end, sprint.weeks) })
              onClose()
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
