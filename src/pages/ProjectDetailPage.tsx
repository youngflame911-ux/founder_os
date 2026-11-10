import { Link, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, BookOpen, CalendarDays, CheckSquare, Pencil, Plus, RotateCcw, Trophy } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, DemoBadge, EmptyState, Progress, Stat } from '@/components/ui/primitives'
import { EVENT_CATEGORY_COLOR, NOTE_CATEGORY_LABEL, PROJECT_STATUS_LABEL } from '@/domain/constants'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { isOverdue, projectLastActivity, projectProgress, sortByUrgency } from '@/services/tasks'
import { capitalize, daysBetween, fmt, fmtDate, minutesToHours, relative, todayString } from '@/lib/dates'
import { TaskRow } from '@/features/tasks/TaskRow'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const s = useAppStore()
  const { open, confirm } = useUi()
  const p = s.projects.find((x) => x.id === id)
  if (!p) return <EmptyState title="Проект не найден" action={<Button asChild variant="outline"><Link to="/projects">К проектам</Link></Button>} />

  const tasks = s.tasks.filter((t) => t.projectId === p.id)
  const openTasks = sortByUrgency(tasks.filter((t) => t.status !== 'done'))
  const doneTasks = tasks.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const events = s.events.filter((e) => e.projectId === p.id).sort((a, b) => b.start.localeCompare(a.start))
  const notes = s.notes.filter((n) => n.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date))
  const results = s.results.filter((r) => r.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date))
  const pr = projectProgress(p.id, s.tasks)
  const actual = tasks.reduce((a, t) => a + (t.actualMinutes ?? 0), 0)
  const planned = tasks.reduce((a, t) => a + (t.plannedMinutes ?? 0), 0)
  const daysIn = Math.max(0, daysBetween(p.startDate, todayString()))
  const daysLeft = p.deadline ? daysBetween(todayString(), p.deadline) : null
  const closed = p.status === 'closed'
  const nowIso = new Date().toISOString()

  return (
    <div className="grid gap-6">
      <div>
        <Link to="/projects" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Проекты
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{p.name}</h1>
              <Badge variant={p.status === 'active' ? 'primary' : 'outline'}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
              {p.isDemo && <DemoBadge />}
            </div>
            {p.goal && <p className="mt-1.5 text-sm">🎯 {p.goal}</p>}
            {p.description && <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{p.description}</p>}
          </div>
          <div className="flex gap-2">
            {closed ? (
              <Button variant="outline" onClick={async () => (await confirm({ title: 'Вернуть проект в работу?', confirmLabel: 'Восстановить' })) && s.reopenProject(p.id)}>
                <RotateCcw /> Восстановить
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => open({ kind: 'project', id: p.id })}>
                  <Pencil /> Изменить
                </Button>
                <Button variant="ghost" onClick={() => open({ kind: 'closeProject', id: p.id })}>
                  <Archive /> Закрыть
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {closed && p.closure && (
        <Card className="grid gap-3 border-dashed p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Закрыт {fmtDate(p.closure.closedAt)} · причина</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{p.closure.reason}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Выводы</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{p.closure.lessons}</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="px-4 py-3.5">
          <div className="text-xs text-muted-foreground">Прогресс</div>
          <div className="mt-1.5 text-2xl font-semibold tabular">{pr.percent}%</div>
          <Progress className="mt-2" value={pr.percent} color={p.color} />
        </Card>
        <Stat label="Задачи" value={`${pr.done}/${pr.total}`} sub={`${tasks.filter((t) => isOverdue(t)).length} просрочено`} />
        <Stat label="Срок" value={daysLeft === null ? '—' : daysLeft} sub={daysLeft === null ? `в работе ${daysIn} дн.` : daysLeft < 0 ? 'дней просрочки' : `дн. до ${fmt(p.deadline!, 'd MMM')} · идёт ${daysIn}-й день`} tone={daysLeft !== null && daysLeft < 0 ? 'danger' : 'default'} />
        <Stat label="Часы факт / план" value={`${minutesToHours(actual)} / ${minutesToHours(planned)}`} sub={`активность ${relative(projectLastActivity(p, s.tasks))}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={<CheckSquare />}
            title={`Задачи · ${openTasks.length} открыто`}
            action={
              !closed && (
                <Button size="sm" variant="outline" onClick={() => open({ kind: 'task', initial: { projectId: p.id } })}>
                  <Plus /> Задача
                </Button>
              )
            }
          />
          <CardBody className="grid gap-0.5 px-3">
            {openTasks.map((t) => (
              <TaskRow key={t.id} task={t} showProject={false} showStatus />
            ))}
            {!tasks.length && <p className="px-2 text-xs text-muted-foreground">Задач нет — разбейте цель проекта на шаги.</p>}
            {doneTasks.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer px-2 py-1 text-xs text-muted-foreground">Выполнено · {doneTasks.length}</summary>
                {doneTasks.map((t) => (
                  <TaskRow key={t.id} task={t} showProject={false} />
                ))}
              </details>
            )}
          </CardBody>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader icon={<Trophy />} title="Результаты" action={<Button size="icon-sm" variant="ghost" aria-label="Добавить результат" onClick={() => open({ kind: 'result', initial: { projectId: p.id } })}><Plus /></Button>} />
            <CardBody className="grid gap-3">
              {results.length ? (
                results.map((r) => (
                  <button key={r.id} onClick={() => open({ kind: 'result', id: r.id })} className="grid gap-0.5 text-left hover:opacity-80">
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(r.date)} · {daysBetween(p.startDate, r.date)}-й день проекта
                      {r.metricValue != null && ` · ${r.metricValue.toLocaleString('ru-RU')} ${r.metricUnit}`}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Пока нет зафиксированных результатов</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<CalendarDays />} title="События" action={<Button size="icon-sm" variant="ghost" aria-label="Добавить событие" onClick={() => open({ kind: 'event', initial: { projectId: p.id } })}><Plus /></Button>} />
            <CardBody className="grid gap-1">
              {events.length ? (
                events.slice(0, 8).map((e) => (
                  <button key={e.id} onClick={() => open({ kind: 'event', id: e.id })} className={`flex items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-accent/60 ${e.end < nowIso ? 'opacity-60' : ''}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: EVENT_CATEGORY_COLOR[e.category] }} />
                    <span className="min-w-0 break-words leading-snug">{e.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{capitalize(fmt(e.start, 'd MMM'))}</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Нет связанных событий</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<BookOpen />} title="База знаний" action={<Button size="icon-sm" variant="ghost" aria-label="Добавить заметку" onClick={() => open({ kind: 'note', initial: { projectId: p.id } })}><Plus /></Button>} />
            <CardBody className="grid gap-1">
              {notes.length ? (
                notes.slice(0, 8).map((n) => (
                  <button key={n.id} onClick={() => open({ kind: 'note', id: n.id })} className="flex items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-accent/60">
                    <Badge variant="outline">{NOTE_CATEGORY_LABEL[n.category]}</Badge>
                    <span className="min-w-0 break-words leading-snug">{n.title}</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Нет связанных записей</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
