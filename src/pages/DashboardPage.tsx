import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, isMonday, parseISO } from 'date-fns'
import { AlertTriangle, ArrowRight, CalendarClock, CalendarDays, CheckCircle2, Crosshair, FlaskConical, FolderKanban, ListTodo, PlayCircle, Sparkles, Target, Timer } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, DemoBadge, EmptyState, Progress, Stat, Textarea } from '@/components/ui/primitives'
import { EVENT_CATEGORY_COLOR } from '@/domain/constants'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { isOpen, isOverdue, projectProgress, sortByUrgency } from '@/services/tasks'
import { planDay, workdayFor } from '@/services/planner'
import { capitalize, fmt, fmtMinutes, fmtTime, todayString, weekStartString } from '@/lib/dates'
import { TaskRow } from '@/features/tasks/TaskRow'
import { SprintSummary, useActiveSprint } from '@/features/tasks/SprintSummary'
import { ProjectTag } from '@/features/common/bits'
import { useAssistantAvailable } from '@/features/assistant/AssistantPanel'
import { plural } from '@/lib/utils'

const hm = (m: number) => (m > 0 ? fmtMinutes(m) : '0 ч')
/** Подзаголовок дня одной фразой — по реальным данным */
function dek(events: number, due: number, overdue: number) {
  const parts: string[] = []
  parts.push(events ? `${events} ${plural(events, ['встреча', 'встречи', 'встреч'])} в календаре` : 'встреч нет')
  if (due) parts.push(`${due} ${plural(due, ['дедлайн', 'дедлайна', 'дедлайнов'])} сегодня`)
  if (overdue) parts.push(`${overdue} ${plural(overdue, ['задача просрочена', 'задачи просрочены', 'задач просрочено'])}`)
  return capitalize(parts.join(', ')) + '.'
}

/** Командная строка: открывает ассистента с уже введённым текстом */
function CommandBar() {
  const { sample } = useAssistantAvailable()
  const setAssistant = useUi((u) => u.setAssistant)
  const [text, setText] = useState('')
  if (!sample) return null
  const submit = () => {
    if (!text.trim()) return setAssistant(true)
    setAssistant(true, text.trim())
    setText('')
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-center gap-2 rounded-md border bg-card py-1.5 pl-3.5 pr-1.5 focus-within:border-ring"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <input
        id="command-bar"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Напишите, что сделали или что нужно сделать: «закрыл сделку с ARGO на 2 млн»"
        className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <Button type="submit" size="sm">
        Отправить
      </Button>
    </form>
  )
}

const greeting = (h: number) => (h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер')

export default function DashboardPage() {
  const s = useAppStore()
  const open = useUi((u) => u.open)
  const sprint = useActiveSprint()
  const now = new Date()
  const today = todayString(now)
  const week = weekStartString(now)

  const d = useMemo(() => {
    const openTasks = s.tasks.filter(isOpen)
    const eventsToday = s.events
      .filter((e) => fmt(e.start, 'yyyy-MM-dd') <= today && fmt(e.end, 'yyyy-MM-dd') >= today)
      .sort((a, b) => a.start.localeCompare(b.start))
    const horizon = addDays(now, 7).toISOString()
    const upcoming = s.events.filter((e) => e.end >= now.toISOString() && e.start <= horizon).sort((a, b) => a.start.localeCompare(b.start))
    return {
      eventsToday,
      upcoming: upcoming.slice(0, 6),
      dueToday: openTasks.filter((t) => t.deadline === today),
      overdue: sortByUrgency(openTasks.filter((t) => isOverdue(t, today)), today),
      inProgress: sortByUrgency(openTasks.filter((t) => t.status === 'in_progress'), today),
      priority: sortByUrgency(openTasks.filter((t) => (t.priority === 'critical' || t.priority === 'high') && !isOverdue(t, today)), today).slice(0, 7),
      projects: s.projects.filter((p) => p.status === 'active').map((p) => ({ p, ...projectProgress(p.id, s.tasks) })),
      fullDayPlan: planDay({ date: today, settings: workdayFor(today, s.settings.workday, s.workdays), events: s.events, tasks: s.tasks }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tasks, s.events, s.projects, s.settings.workday, s.workdays, today])

  const isEmpty = !s.tasks.length && !s.projects.length && !s.events.length

  return (
    <div className="grid gap-6">
      <header className="fos-rule fos-enter flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="min-w-0">
          <h1 className="font-display text-[38px] font-extrabold leading-[1.02] md:text-[56px]">{capitalize(fmt(now, 'EEEE, d MMMM'))}</h1>
          <p className="mt-2 max-w-[62ch] text-[15px] text-muted-foreground">
            {greeting(now.getHours())}. {dek(d.eventsToday.length, d.dueToday.length, d.overdue.length)}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/calendar?view=planner">
            <Timer /> План дня
          </Link>
        </Button>
      </header>

      <CommandBar />

      {s.migratedFromBrowser && (
        <p className="rounded-md border border-success/40 bg-success/[0.06] px-4 py-3 text-sm">
          Записи из этого браузера перенесены в облако. Теперь они видны на всех ваших устройствах.
        </p>
      )}

      {isMonday(now) && !s.reviews.some((r) => r.weekStart === weekStartString(addDays(now, -7))) && (
        <Link to="/analytics?tab=review" className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm hover:bg-primary/10">
          <span>
            <span className="font-medium">Понедельник — время обзора.</span> <span className="text-muted-foreground">Итоги прошлой недели собраны автоматически.</span>
          </span>
          <ArrowRight className="h-4 w-4 text-primary" />
        </Link>
      )}

      {isEmpty && (
        <EmptyState
          icon={<Target />}
          title="Добро пожаловать в Founder OS"
          description="Начните с проекта и нескольких задач — главная, аналитика и планировщик будут считаться автоматически по вашим данным."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => open({ kind: 'project' })}>
                <FolderKanban /> Создать проект
              </Button>
              <Button variant="outline" onClick={() => open({ kind: 'task' })}>
                <ListTodo /> Добавить задачу
              </Button>
              <Button variant="ghost" onClick={() => s.loadDemo()}>
                <FlaskConical /> Посмотреть на демо-данных
              </Button>
            </div>
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Событий сегодня" value={d.eventsToday.length} icon={<CalendarDays />} sub={d.eventsToday[0] ? `первое в ${fmtTime(d.eventsToday[0].start)}` : 'свободный день'} />
        <Stat label="Дедлайн сегодня" value={d.dueToday.length} icon={<CalendarClock />} tone={d.dueToday.length ? 'warning' : 'default'} />
        <Stat label="В работе" value={d.inProgress.length} icon={<PlayCircle />} />
        <Stat label="Просрочено" value={d.overdue.length} icon={<AlertTriangle />} tone={d.overdue.length ? 'danger' : 'success'} sub={d.overdue.length ? 'требуют решения' : 'всё в срок'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <CardHeader
              icon={<Timer />}
              title="Обзор дня"
              description="Рабочее время с учётом встреч и перерыва"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/calendar?view=planner">
                    Планировщик <ArrowRight />
                  </Link>
                </Button>
              }
            />
            <CardBody className="grid gap-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini label="Рабочее время" value={hm(d.fullDayPlan.capacityMinutes)} />
                <Mini label="Встречи" value={hm(d.fullDayPlan.meetingsMinutes)} />
                <Mini label="Задачи по плану" value={hm(d.fullDayPlan.scheduledMinutes)} />
                <Mini label="Свободно" value={hm(Math.max(0, d.fullDayPlan.freeMinutes))} />
              </div>
              <DayBar plan={d.fullDayPlan} />
              {d.eventsToday.length > 0 ? (
                <div className="grid gap-1">
                  {d.eventsToday.map((e) => (
                    <button key={e.id} onClick={() => open({ kind: 'event', id: e.id })} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/60">
                      <span className="w-24 shrink-0 text-xs text-muted-foreground tabular">{e.allDay ? 'Весь день' : `${fmtTime(e.start)}–${fmtTime(e.end)}`}</span>
                      <span className="h-4 w-1 shrink-0 rounded-full" style={{ background: EVENT_CATEGORY_COLOR[e.category] }} />
                      <span className="min-w-0 break-words leading-snug">{e.title}</span>
                      {e.isDemo && <DemoBadge />}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Встреч сегодня нет.</p>
              )}
            </CardBody>
          </Card>

          <TaskCard icon={<Target />} title="Приоритетные задачи" description="Высокий и критический приоритет" tasks={d.priority} empty="Нет срочных задач с высоким приоритетом" />
          <div className="grid gap-6 lg:grid-cols-2">
            <TaskCard icon={<AlertTriangle />} title="Просроченные" tasks={d.overdue} empty="Просрочек нет" compact />
            <TaskCard icon={<PlayCircle />} title="В работе" tasks={d.inProgress} empty="Ничего не в работе" compact />
          </div>
        </div>

        <div className="grid content-start gap-6">
          <WeeklyFocus week={week} />
          {sprint && (
            <Card>
              <CardHeader icon={<Crosshair />} title={sprint.name} action={<Button variant="ghost" size="sm" asChild><Link to="/tasks?view=sprint">Открыть</Link></Button>} />
              <CardBody>
                <SprintSummary sprint={sprint} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader icon={<FolderKanban />} title="Активные проекты" action={<Button variant="ghost" size="sm" asChild><Link to="/projects">Все</Link></Button>} />
            <CardBody className="grid gap-4">
              {d.projects.length ? (
                d.projects.map(({ p, done, total, percent }) => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="grid gap-1.5 rounded-md hover:opacity-80">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular">
                        {total ? `${done}/${total} · ${percent}%` : 'нет задач'}
                      </span>
                    </div>
                    <Progress value={percent} color={p.color} />
                  </Link>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Активных проектов нет</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<CalendarDays />} title="Ближайшие события" description="7 дней" />
            <CardBody className="grid gap-1">
              {d.upcoming.length ? (
                d.upcoming.map((e) => (
                  <button key={e.id} onClick={() => open({ kind: 'event', id: e.id })} className="grid gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent/60">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: EVENT_CATEGORY_COLOR[e.category] }} />
                      <span className="min-w-0 break-words leading-snug">{e.title}</span>
                    </span>
                    <span className="flex items-center gap-2 pl-4 text-xs text-muted-foreground">
                      {capitalize(fmt(e.start, e.allDay ? 'EEEEEE, d MMM' : 'EEEEEE, d MMM, HH:mm'))}
                      <ProjectTag projectId={e.projectId} />
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Ничего не запланировано</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular">{value}</div>
    </div>
  )
}

/** Полоса рабочего дня: встречи, перерыв, запланированные задачи */
function DayBar({ plan }: { plan: ReturnType<typeof planDay> }) {
  const span = plan.windowEnd - plan.windowStart || 1
  const pos = (a: number, b: number) => ({
    left: `${((Math.max(a, plan.windowStart) - plan.windowStart) / span) * 100}%`,
    width: `${((Math.min(b, plan.windowEnd) - Math.max(a, plan.windowStart)) / span) * 100}%`,
  })
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const hours: number[] = []
  for (let h = Math.ceil(plan.windowStart / 60); h * 60 <= plan.windowEnd; h += 2) hours.push(h)
  return (
    <div>
      <div className="relative h-7 overflow-hidden rounded-md bg-secondary">
        {plan.blocks.map((b, i) => (
          <div key={i} className="absolute inset-y-1 rounded-sm bg-primary/70" style={pos(b.startMin, b.endMin)} title="Задача по плану" />
        ))}
        {plan.busy.map((b, i) =>
          b.end > plan.windowStart && b.start < plan.windowEnd ? (
            <div
              key={`b${i}`}
              className={b.kind === 'break' ? 'absolute inset-y-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,hsl(var(--muted-foreground)/0.25)_4px,hsl(var(--muted-foreground)/0.25)_6px)]' : 'absolute inset-y-0 bg-warning/80'}
              style={pos(b.start, b.end)}
              title={b.label}
            />
          ) : null,
        )}
        {nowMin > plan.windowStart && nowMin < plan.windowEnd && <div className="absolute inset-y-0 w-0.5 bg-destructive" style={{ left: `${((nowMin - plan.windowStart) / span) * 100}%` }} />}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-muted-foreground tabular">
        {hours.map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h * 60 - plan.windowStart) / span) * 100}%` }}>
            {h}:00
          </span>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <Legend className="bg-primary/70" label="Задачи" />
        <Legend className="bg-warning/80" label="Встречи" />
        <Legend className="bg-muted-foreground/30" label="Перерыв" />
      </div>
    </div>
  )
}
const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`h-2 w-2 rounded-sm ${className}`} />
    {label}
  </span>
)

function TaskCard({ icon, title, description, tasks, empty, compact }: { icon: React.ReactNode; title: string; description?: string; tasks: ReturnType<typeof sortByUrgency>; empty: string; compact?: boolean }) {
  const shown = tasks.slice(0, compact ? 5 : 7)
  return (
    <Card>
      <CardHeader icon={icon} title={<>{title} <span className="font-normal text-muted-foreground tabular">{tasks.length}</span></>} description={description} action={<Button variant="ghost" size="sm" asChild><Link to="/tasks">Все задачи</Link></Button>} />
      <CardBody className="grid gap-0.5 px-3">
        {shown.length ? (
          shown.map((t) => <TaskRow key={t.id} task={t} compact={compact} />)
        ) : (
          <p className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            {empty}
          </p>
        )}
        {tasks.length > shown.length && <p className="px-2 pt-1 text-xs text-muted-foreground">и ещё {tasks.length - shown.length}</p>}
      </CardBody>
    </Card>
  )
}

function WeeklyFocus({ week }: { week: string }) {
  const value = useAppStore((s) => s.weeklyFocus[week] ?? '')
  const save = useAppStore((s) => s.setWeeklyFocus)
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(!value)
  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.06] to-transparent">
      <CardHeader icon={<Crosshair />} title="Фокус недели" description={`Неделя с ${fmt(parseISO(week), 'd MMMM')}`} />
      <CardBody>
        {editing ? (
          <div className="grid gap-2">
            <Textarea autoFocus={!!value} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Одна главная вещь, которая сделает неделю успешной" className="min-h-[70px] bg-background" />
            <div className="flex justify-end gap-2">
              {value && (
                <Button size="sm" variant="ghost" onClick={() => (setDraft(value), setEditing(false))}>
                  Отмена
                </Button>
              )}
              <Button size="sm" disabled={!draft.trim()} onClick={() => (save(week, draft.trim()), setEditing(false))}>
                Сохранить
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="w-full whitespace-pre-wrap text-left text-[15px] font-medium leading-snug hover:opacity-80">
            {value}
          </button>
        )}
      </CardBody>
    </Card>
  )
}
