import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { addDays, addMonths, addWeeks, endOfWeek, format, getDay, parse, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Timer } from 'lucide-react'
import { Button, Checkbox, PageHeader, Segmented, Select } from '@/components/ui/primitives'
import { EVENT_CATEGORY_COLOR, EVENT_CATEGORY_LABEL, PRIORITY_LABEL } from '@/domain/constants'
import type { EventCategory } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { atTime, capitalize, fmt, toDateString, todayString } from '@/lib/dates'
import { DayPlanner } from '@/features/planner/DayPlanner'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
  getDay,
  locales: { ru },
})

const messages = {
  date: 'Дата',
  time: 'Время',
  event: 'Событие',
  allDay: 'Весь день',
  week: 'Неделя',
  work_week: 'Рабочая неделя',
  day: 'День',
  month: 'Месяц',
  previous: 'Назад',
  next: 'Вперёд',
  today: 'Сегодня',
  agenda: 'Список',
  noEventsInRange: 'Нет событий в этом периоде',
  showMore: (n: number) => `ещё ${n}`,
}

interface CalItem {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  kind: 'event' | 'task'
  color: string
  done?: boolean
}

type Mode = 'grid' | 'planner'

export default function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('view') === 'planner' ? 'planner' : 'grid'
  const [view, setView] = useState<View>(() => (window.innerWidth < 640 ? 'day' : 'month'))
  const [date, setDate] = useState(new Date())
  const [plannerDate, setPlannerDate] = useState(todayString())
  const [showTasks, setShowTasks] = useState(true)
  const [projectFilter, setProjectFilter] = useState('')
  const { events, tasks, projects } = useAppStore()
  const open = useUi((s) => s.open)

  const items = useMemo<CalItem[]>(() => {
    const byProject = <T extends { projectId: string | null }>(x: T) => !projectFilter || x.projectId === projectFilter
    const evs: CalItem[] = events.filter(byProject).map((e) => ({
      id: e.id,
      title: e.title,
      start: new Date(e.start),
      end: new Date(e.end),
      allDay: e.allDay,
      kind: 'event',
      color: EVENT_CATEGORY_COLOR[e.category],
    }))
    const ts: CalItem[] = showTasks
      ? tasks
          .filter((t) => t.deadline)
          .filter(byProject)
          .map((t) => {
            const d = atTime(t.deadline!, '00:00')
            return {
              id: t.id,
              title: `${t.status === 'done' ? '✓ ' : ''}${t.title}`,
              start: d,
              end: d,
              allDay: true,
              kind: 'task' as const,
              color: projects.find((p) => p.id === t.projectId)?.color ?? '#94a3b8',
              done: t.status === 'done',
            }
          })
      : []
    return [...evs, ...ts]
  }, [events, tasks, projects, showTasks, projectFilter])

  const navigate = (dir: -1 | 1) => setDate((d) => (view === 'month' ? addMonths(d, dir) : view === 'week' ? addWeeks(d, dir) : addDays(d, dir)))
  const label =
    view === 'month'
      ? capitalize(fmt(date, 'LLLL yyyy'))
      : view === 'week'
        ? `${fmt(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM')} – ${fmt(endOfWeek(date, { weekStartsOn: 1 }), 'd MMM yyyy')}`
        : capitalize(fmt(date, 'EEEE, d MMMM yyyy'))

  const setMode = (m: Mode) => {
    const next = new URLSearchParams(params)
    if (m === 'planner') next.set('view', 'planner')
    else next.delete('view')
    setParams(next, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title="Календарь"
        description={mode === 'grid' ? 'События, встречи, платежи и дедлайны задач' : 'Автоматическое распределение задач по свободному времени'}
        actions={
          <>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'grid', label: 'Сетка', icon: <CalendarDays /> },
                { value: 'planner', label: 'План дня', icon: <Timer /> },
              ]}
            />
            <Button onClick={() => open({ kind: 'event' })}>
              <Plus /> Событие
            </Button>
          </>
        }
      />

      {mode === 'planner' ? (
        <DayPlanner date={plannerDate} onDateChange={setPlannerDate} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setDate(new Date())}>
                Сегодня
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Назад">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => navigate(1)} aria-label="Вперёд">
                <ChevronRight />
              </Button>
              <h2 className="ml-1 text-base font-semibold">{label}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={showTasks} onChange={setShowTasks} /> Дедлайны задач
              </label>
              <Select className="h-8 w-44 text-xs" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <option value="">Все проекты</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Segmented
                size="sm"
                value={view as 'month' | 'week' | 'day'}
                onChange={(v) => setView(v)}
                options={[
                  { value: 'month', label: 'Месяц' },
                  { value: 'week', label: 'Неделя' },
                  { value: 'day', label: 'День' },
                ]}
              />
            </div>
          </div>

          <div className="fos-calendar" style={{ height: view === 'month' ? 'max(760px, calc(100dvh - 230px))' : 'calc(100dvh - 230px)', minHeight: 560 }}>
            <Calendar<CalItem>
              localizer={localizer}
              culture="ru"
              messages={messages}
              events={items}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={['month', 'week', 'day']}
              toolbar={false}
              selectable
              popup
              step={30}
              timeslots={2}
              scrollToTime={atTime(todayString(), '08:00')}
              formats={{
                timeGutterFormat: 'HH:mm',
                eventTimeRangeFormat: ({ start, end }) => `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`,
                dayFormat: (d) => format(d, 'EEEEEE d', { locale: ru }),
                weekdayFormat: (d) => format(d, 'EEEEEE', { locale: ru }),
                dayHeaderFormat: (d) => format(d, 'EEEE, d MMMM', { locale: ru }),
              }}
              onSelectSlot={(slot) => {
                const day = toDateString(slot.start)
                const isMonthClick = view === 'month'
                const start = isMonthClick ? atTime(day, '09:00') : slot.start
                const end = isMonthClick ? atTime(day, '10:00') : slot.end
                open({ kind: 'event', initial: { start: start.toISOString(), end: end.toISOString() } })
              }}
              onSelectEvent={(e) => open(e.kind === 'event' ? { kind: 'event', id: e.id } : { kind: 'task', id: e.id })}
              onDrillDown={(d) => {
                setDate(d)
                setView('day')
              }}
              eventPropGetter={(e) =>
                e.kind === 'task'
                  ? {
                      style: {
                        background: 'transparent',
                        color: 'hsl(var(--foreground))',
                        boxShadow: `inset 0 0 0 1px ${e.color}`,
                        opacity: e.done ? 0.5 : 1,
                        textDecoration: e.done ? 'line-through' : undefined,
                      },
                    }
                  : { style: { background: `${e.color}26`, color: 'hsl(var(--foreground))', borderLeft: `3px solid ${e.color}` } }
              }
              tooltipAccessor={(e) => {
                if (e.kind === 'event') {
                  const ev = events.find((x) => x.id === e.id)
                  return ev ? `${EVENT_CATEGORY_LABEL[ev.category]}: ${ev.title}` : e.title
                }
                const t = tasks.find((x) => x.id === e.id)
                return t ? `Дедлайн задачи · ${PRIORITY_LABEL[t.priority]}: ${t.title}` : e.title
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(Object.keys(EVENT_CATEGORY_LABEL) as EventCategory[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: EVENT_CATEGORY_COLOR[c] }} />
                {EVENT_CATEGORY_LABEL[c]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3 rounded-sm border border-muted-foreground" /> Дедлайн задачи
            </span>
          </div>
        </>
      )}
    </div>
  )
}
