import { useMemo } from 'react'
import { addDays, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Lock, Pin, PinOff, RotateCcw, Timer } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input } from '@/components/ui/primitives'
import type { DateString, WorkdaySettings } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { minToTime, nowMinuteFor, planDay, workdayFor } from '@/services/planner'
import { capitalize, fmt, fmtMinutes, fromDateString, toDateString, todayString } from '@/lib/dates'
import { PriorityIcon, ProjectTag } from '@/features/common/bits'
import { cn } from '@/lib/utils'

const HOUR_PX = 56
const SKIP_REASON = { blocked: 'ждёт зависимости', waiting: 'статус «ожидает»', not_started: 'дата начала позже' }

/**
 * Интерфейс Daily Time Planner. Расчёт — services/planner.ts.
 * План можно «зафиксировать» (сохраняется в dayPlans) — это основа
 * для будущих таймера, перепланирования и учёта факта.
 */
export function DayPlanner({ date, onDateChange }: { date: DateString; onDateChange: (d: DateString) => void }) {
  const s = useAppStore()
  const open = useUi((u) => u.open)
  const override = s.workdays[date]
  const settings = workdayFor(date, s.settings.workday, s.workdays)
  const fixed = s.dayPlans[date]
  const isToday = date === todayString()

  const plan = useMemo(
    () => planDay({ date, settings, events: s.events, tasks: s.tasks, fromMinute: isToday ? nowMinuteFor(date) : undefined }),
    [date, settings, s.events, s.tasks, isToday],
  )

  const dayStart = fromDateString(date).getTime()
  const blocks = fixed
    ? fixed.blocks.map((b) => ({ ...b, startMin: Math.round((parseISO(b.start).getTime() - dayStart) / 60000), endMin: Math.round((parseISO(b.end).getTime() - dayStart) / 60000), part: 1, partsTotal: 1 }))
    : plan.blocks
  const taskById = new Map(s.tasks.map((t) => [t.id, t]))

  const setWd = (patch: Partial<WorkdaySettings>) => s.setWorkday(date, { ...settings, ...patch })

  const from = Math.min(plan.windowStart, ...plan.busy.filter((b) => b.kind === 'event').map((b) => b.start))
  const to = Math.max(plan.windowEnd, ...plan.busy.filter((b) => b.kind === 'event').map((b) => b.end))
  const startHour = Math.floor(from / 60)
  const endHour = Math.min(24, Math.ceil(to / 60))
  const top = (m: number) => ((m - startHour * 60) / 60) * HOUR_PX
  const nowMin = nowMinuteFor(date)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => onDateChange(toDateString(addDays(fromDateString(date), -1)))} aria-label="Предыдущий день">
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onDateChange(toDateString(addDays(fromDateString(date), 1)))} aria-label="Следующий день">
              <ChevronRight />
            </Button>
            <h2 className="ml-1 text-sm font-semibold">{capitalize(fmt(date, 'EEEE, d MMMM'))}</h2>
            {!isToday && (
              <Button variant="link" size="sm" onClick={() => onDateChange(todayString())}>
                Сегодня
              </Button>
            )}
          </div>
          {fixed ? (
            <div className="flex items-center gap-2">
              <Badge variant="primary">
                <Pin className="h-3 w-3" /> Зафиксирован {fmt(fixed.fixedAt, 'd MMM, HH:mm')}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => s.clearDayPlan(date)}>
                <PinOff /> Пересчитать
              </Button>
            </div>
          ) : (
            <Button size="sm" disabled={!plan.blocks.length} onClick={() => s.fixDayPlan({ date, settings, blocks: plan.blocks.map(({ taskId, start, end }) => ({ taskId, start, end })), fixedAt: new Date().toISOString() })}>
              <Pin /> Зафиксировать план
            </Button>
          )}
        </div>
        <div className="relative max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div className="relative mb-4 ml-14 mr-3 mt-4" style={{ height: (endHour - startHour) * HOUR_PX }}>
            {Array.from({ length: endHour - startHour + 1 }, (_, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: i * HOUR_PX }}>
                <span className="absolute -left-12 -top-2 w-10 text-right text-[11px] text-muted-foreground tabular">{String(startHour + i).padStart(2, '0')}:00</span>
              </div>
            ))}
            {/* нерабочее время */}
            <div className="absolute inset-x-0 bg-muted/60" style={{ top: 0, height: Math.max(0, top(plan.windowStart)) }} />
            <div className="absolute inset-x-0 bg-muted/60" style={{ top: top(plan.windowEnd), height: Math.max(0, top(endHour * 60) - top(plan.windowEnd)) }} />

            {plan.busy.map((b, i) => (
              <button
                key={i}
                disabled={b.kind === 'break'}
                onClick={() => b.eventId && open({ kind: 'event', id: b.eventId })}
                className={cn(
                  'absolute left-0 right-[52%] overflow-hidden rounded-md px-2 py-1 text-left text-xs',
                  b.kind === 'break'
                    ? 'right-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,hsl(var(--muted-foreground)/0.12)_5px,hsl(var(--muted-foreground)/0.12)_8px)] text-muted-foreground'
                    : 'border-l-[3px] border-warning bg-warning/15 hover:bg-warning/25',
                )}
                style={{ top: top(b.start), height: Math.max(18, top(b.end) - top(b.start) - 2) }}
              >
                <span className="font-medium">{b.label}</span> <span className="opacity-70 tabular">{minToTime(b.start)}–{minToTime(b.end)}</span>
              </button>
            ))}

            {blocks.map((b, i) => {
              const t = taskById.get(b.taskId)
              if (!t) return null
              const short = top(b.endMin) - top(b.startMin) < 38
              return (
                <button
                  key={i}
                  onClick={() => open({ kind: 'task', id: t.id })}
                  className="absolute left-[50%] right-0 overflow-hidden rounded-md border-l-[3px] border-primary bg-primary/12 px-2 py-1 text-left text-xs hover:bg-primary/20"
                  style={{ top: top(b.startMin), height: Math.max(20, top(b.endMin) - top(b.startMin) - 2) }}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <PriorityIcon priority={t.priority} />
                    <span className="truncate">{t.title}</span>
                    {short && <span className="shrink-0 font-normal text-muted-foreground tabular">{minToTime(b.startMin)}</span>}
                  </span>
                  <span className={cn('text-muted-foreground tabular', short && 'hidden')}>
                    {minToTime(b.startMin)}–{minToTime(b.endMin)}
                    {b.partsTotal > 1 && ` · часть ${b.part}/${b.partsTotal}`}
                  </span>
                </button>
              )
            })}
            {nowMin !== undefined && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
              <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-destructive" style={{ top: top(nowMin) }}>
                <span className="absolute -left-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              </div>
            )}
          </div>
        </div>
        {!blocks.length && !plan.busy.some((b) => b.kind === 'event') && (
          <div className="border-t p-4">
            <EmptyState icon={<Timer />} title="Нечего планировать" description="Добавьте задачи с плановой продолжительностью — планировщик разложит их по свободным окнам с учётом встреч, приоритетов и дедлайнов." className="border-0 py-4" />
          </div>
        )}
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader
            title="Рабочий день"
            description={override ? 'Особое расписание на эту дату' : 'Расписание по умолчанию'}
            action={
              override && (
                <Button variant="ghost" size="sm" onClick={() => s.setWorkday(date, null)}>
                  <RotateCcw /> Сбросить
                </Button>
              )
            }
          />
          <CardBody className="grid grid-cols-2 gap-3">
            <Field label="Начало">
              <Input type="time" value={settings.start} onChange={(e) => setWd({ start: e.target.value })} />
            </Field>
            <Field label="Окончание">
              <Input type="time" value={settings.end} onChange={(e) => setWd({ end: e.target.value })} />
            </Field>
            <Field label="Перерыв, мин">
              <Input type="number" min={0} step={15} value={settings.breakMinutes} onChange={(e) => setWd({ breakMinutes: Math.max(0, Number(e.target.value)) })} />
            </Field>
            <Field label="Перерыв с">
              <Input type="time" value={settings.breakStart} onChange={(e) => setWd({ breakStart: e.target.value })} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Баланс дня" />
          <CardBody className="grid gap-2 text-sm">
            <Line label="Рабочее время" value={fmtMinutes(plan.capacityMinutes)} />
            <Line label="Встречи" value={fmtMinutes(plan.meetingsMinutes)} />
            <Line label="Задачи по плану" value={fmtMinutes(blocks.reduce((a, b) => a + b.endMin - b.startMin, 0))} />
            <Line label="Свободно" value={fmtMinutes(Math.max(0, plan.freeMinutes))} />
            {isToday && <p className="text-[11px] text-muted-foreground">Для сегодняшнего дня план строится начиная с текущего времени.</p>}
          </CardBody>
        </Card>

        {plan.unscheduled.length > 0 && (
          <Card>
            <CardHeader title="Не поместилось" description="Перенесите, делегируйте или уменьшите объём" />
            <CardBody className="grid gap-1 px-3">
              {plan.unscheduled.map((u) => {
                const t = taskById.get(u.taskId)!
                return (
                  <button key={u.taskId} onClick={() => open({ kind: 'task', id: t.id })} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/60">
                    <PriorityIcon priority={t.priority} />
                    <span className="truncate">{t.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular">{fmtMinutes(u.remainingMinutes)}</span>
                  </button>
                )
              })}
            </CardBody>
          </Card>
        )}

        {plan.skipped.length > 0 && (
          <Card>
            <CardHeader title="Исключены из плана" />
            <CardBody className="grid gap-1 px-3">
              {plan.skipped.slice(0, 8).map((x) => {
                const t = taskById.get(x.taskId)!
                return (
                  <button key={x.taskId} onClick={() => open({ kind: 'task', id: t.id })} className="grid gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent/60">
                    <span className="flex items-center gap-2 text-sm">
                      {x.reason === 'blocked' && <Lock className="h-3 w-3 text-muted-foreground" />}
                      <span className="truncate">{t.title}</span>
                    </span>
                    <span className="flex gap-2 text-xs text-muted-foreground">
                      {SKIP_REASON[x.reason]} <ProjectTag projectId={t.projectId} />
                    </span>
                  </button>
                )
              })}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium tabular">{value === '—' ? '0' : value}</span>
  </div>
)
