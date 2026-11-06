import { useMemo, useState } from 'react'
import { addDays, subWeeks } from 'date-fns'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ListChecks, Save } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Progress, Stat, Textarea } from '@/components/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { buildWeeklyReview } from '@/services/weeklyReview'
import { fmt, fmtDate, fromDateString, toDateString, weekStartString } from '@/lib/dates'
import { uid } from '@/lib/utils'
import { TaskRow } from '@/features/tasks/TaskRow'

/**
 * Еженедельный обзор. По умолчанию — прошлая неделя (обзор делается в понедельник).
 * Сохранённый обзор фиксирует цифры и приоритеты новой недели — это история для ретроспектив.
 * Автоматическая рассылка — следующий этап (см. FOUNDER_OS_SPEC.md).
 */
export function WeeklyReviewPanel() {
  const { tasks, projects, events, reviews, saveReview, setWeeklyFocus, weeklyFocus } = useAppStore()
  const [week, setWeek] = useState(() => weekStartString(subWeeks(new Date(), 1)))
  const review = useMemo(() => buildWeeklyReview({ tasks, projects, events }, week), [tasks, projects, events, week])
  const saved = reviews.find((r) => r.weekStart === week)
  const nextWeek = toDateString(addDays(fromDateString(week), 7))
  const [priorities, setPriorities] = useState(saved?.priorities ?? '')
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const [savedMsg, setSavedMsg] = useState('')

  const shift = (n: number) => {
    const w = toDateString(addDays(fromDateString(week), n * 7))
    const s = reviews.find((r) => r.weekStart === w)
    setWeek(w)
    setPriorities(s?.priorities ?? '')
    setNotes(s?.notes ?? '')
    setSavedMsg('')
  }
  const isFuture = week >= weekStartString(new Date())

  const save = () => {
    saveReview({
      id: saved?.id ?? uid(),
      weekStart: week,
      createdAt: new Date().toISOString(),
      completedTaskIds: review.completed.map((t) => t.id),
      plannedHours: review.plannedHours,
      actualHours: review.actualHours,
      overdueCount: review.overdue.length,
      priorities,
      notes,
    })
    // первая строка приоритетов становится фокусом следующей недели, если он ещё не задан
    const first = priorities.split('\n').map((x) => x.replace(/^[-•\d.)\s]+/, '').trim()).find(Boolean)
    if (first && !weeklyFocus[nextWeek]) setWeeklyFocus(nextWeek, first)
    setSavedMsg('Обзор сохранён')
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Предыдущая неделя">
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} disabled={isFuture} aria-label="Следующая неделя">
          <ChevronRight />
        </Button>
        <h2 className="text-base font-semibold">
          Неделя {fmt(review.weekStart, 'd MMM')} – {fmt(review.weekEnd, 'd MMM yyyy')}
        </h2>
        {saved && <span className="text-xs text-muted-foreground">сохранён {fmtDate(saved.createdAt)}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Выполнено задач" value={review.completed.length} sub={`создано ${review.createdCount}`} />
        <Stat label="Часы факт" value={review.actualHours} sub="по выполненным задачам" />
        <Stat label="Часы план" value={review.plannedHours} sub="дедлайн на неделе" />
        <Stat label="Встречи, ч" value={review.meetingsHours} />
        <Stat label="Просрочки" value={review.overdue.length} tone={review.overdue.length ? 'danger' : 'success'} sub="на конец недели, ещё открыты" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<CheckCircle2 />} title="Выполнено" />
          <CardBody className="grid gap-0.5 px-3">
            {review.completed.length ? review.completed.map((t) => <TaskRow key={t.id} task={t} />) : <p className="px-2 text-xs text-muted-foreground">На этой неделе задачи не закрывались</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Прогресс проектов" />
          <CardBody className="grid gap-3">
            {review.projects.length ? (
              review.projects.map(({ project, completedThisWeek, percent, total }) => (
                <div key={project.id} className="grid gap-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color }} />
                      <span className="truncate">{project.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular">
                      +{completedThisWeek} за неделю · {total ? `${percent}%` : 'нет задач'}
                    </span>
                  </div>
                  <Progress value={percent} color={project.color} />
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Нет активных проектов</p>
            )}
          </CardBody>
        </Card>
        {review.overdue.length > 0 && (
          <Card>
            <CardHeader icon={<AlertTriangle />} title="Просрочки" description="Перенести, делегировать или закрыть" />
            <CardBody className="grid gap-0.5 px-3">
              {review.overdue.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader icon={<ListChecks />} title="Кандидаты в приоритеты новой недели" description="Срочные и важные открытые задачи" />
          <CardBody className="grid gap-0.5 px-3">
            {review.nextPriorities.length ? review.nextPriorities.map((t) => <TaskRow key={t.id} task={t} />) : <p className="px-2 text-xs text-muted-foreground">Нет срочных задач</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Итоги и план" description="Первая строка приоритетов станет фокусом следующей недели на главной" />
        <CardBody className="grid gap-3 md:grid-cols-2">
          <Textarea className="min-h-[120px]" value={priorities} onChange={(e) => setPriorities(e.target.value)} placeholder={'Приоритеты новой недели:\n1. …\n2. …\n3. …'} />
          <Textarea className="min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Что получилось, что нет, что меняю" />
          <div className="flex items-center gap-3 md:col-span-2">
            <Button onClick={save}>
              <Save /> {saved ? 'Обновить обзор' : 'Сохранить обзор'}
            </Button>
            {savedMsg && <span className="text-xs text-success">{savedMsg}</span>}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
