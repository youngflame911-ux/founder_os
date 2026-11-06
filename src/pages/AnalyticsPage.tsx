import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, CalendarCheck, Clock, Crosshair, Moon, Table2 } from 'lucide-react'
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Segmented, Stat } from '@/components/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { inactiveProjects, periodPreset, taskMetrics, timeByProject, weeklyDynamics } from '@/services/metrics'
import { relative } from '@/lib/dates'
import { SprintSummary, useActiveSprint } from '@/features/tasks/SprintSummary'
import { WeeklyReviewPanel } from '@/features/review/WeeklyReviewPanel'

type Preset = '7d' | '30d' | '90d' | 'all'
/** Палитра двух серий проверена валидатором (CVD ΔE ≥ 19, контраст ≥ 3:1 в обеих темах) */
const SERIES = { a: '#6366f1', b: '#0d9488' }

const axis = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-foreground tabular">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'review' ? 'review' : 'metrics'
  const [preset, setPreset] = useState<Preset>('30d')
  const [showTable, setShowTable] = useState(false)
  const { tasks, projects, settings } = useAppStore()
  const sprint = useActiveSprint()

  const period = periodPreset(preset)
  const m = useMemo(() => taskMetrics(tasks, period), [tasks, period.from, period.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const dyn = useMemo(() => weeklyDynamics(tasks, 8), [tasks])
  const byProject = useMemo(() => timeByProject({ tasks, projects }, period), [tasks, projects, period.from, period.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const stale = useMemo(() => inactiveProjects(projects, tasks, settings.inactivityDays), [projects, tasks, settings.inactivityDays])

  const setTab = (t: string) => {
    const n = new URLSearchParams(params)
    if (t === 'review') n.set('tab', 'review')
    else n.delete('tab')
    setParams(n, { replace: true })
  }

  return (
    <div>
      <PageHeader title="Аналитика" description="Все показатели считаются по вашим данным в реальном времени" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'metrics', label: 'Показатели', icon: <BarChart3 /> },
            { value: 'review', label: 'Обзор недели', icon: <CalendarCheck /> },
          ]}
        />
        {tab === 'metrics' && (
          <Segmented
            size="sm"
            value={preset}
            onChange={setPreset}
            options={[
              { value: '7d', label: '7 дней' },
              { value: '30d', label: '30 дней' },
              { value: '90d', label: '90 дней' },
              { value: 'all', label: 'Всё время' },
            ]}
          />
        )}
      </div>

      {tab === 'review' ? (
        <WeeklyReviewPanel />
      ) : !tasks.length ? (
        <EmptyState icon={<BarChart3 />} title="Данных пока нет" description="Аналитика появится, как только вы начнёте создавать и закрывать задачи. Фиктивные цифры мы не показываем." />
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Создано задач" value={m.created} />
            <Stat label="Выполнено" value={m.completed} sub={m.created ? `${m.completionRate}% от созданных` : undefined} />
            <Stat label="Просрочено сейчас" value={m.overdue} tone={m.overdue ? 'danger' : 'success'} />
            <Stat label="Среднее время" value={m.avgCompletionDays === null ? '—' : `${m.avgCompletionDays} дн.`} sub="от создания до выполнения" />
            <Stat label="В срок" value={m.deadlineAdherence === null ? '—' : `${m.deadlineAdherence}%`} sub={m.deadlineTracked ? `из ${m.deadlineTracked} с дедлайном` : 'нет задач с дедлайном'} tone={m.deadlineAdherence !== null && m.deadlineAdherence < 70 ? 'warning' : 'default'} />
            <Stat label="Часы факт / план" value={`${m.actualHours} / ${m.plannedHours}`} sub={m.plannedHours ? `${Math.round((m.actualHours / m.plannedHours) * 100)}% от плана` : 'заполните план у задач'} icon={<Clock />} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Недельная динамика"
                description="Созданные и выполненные задачи, последние 8 недель"
                action={
                  <button onClick={() => setShowTable((v) => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <Table2 className="h-3.5 w-3.5" /> {showTable ? 'График' : 'Таблица'}
                  </button>
                }
              />
              <CardBody>
                {showTable ? (
                  <table className="w-full text-sm tabular">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1 text-left font-medium">Неделя</th>
                        <th className="py-1 text-right font-medium">Создано</th>
                        <th className="py-1 text-right font-medium">Выполнено</th>
                        <th className="py-1 text-right font-medium">Часы факт</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dyn.map((w) => (
                        <tr key={w.weekStart}>
                          <td className="py-1.5">{w.label}</td>
                          <td className="py-1.5 text-right">{w.created}</td>
                          <td className="py-1.5 text-right">{w.completed}</td>
                          <td className="py-1.5 text-right">{w.actualHours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <BarChart data={dyn} barGap={2} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
                        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => <span className="text-muted-foreground">{v}</span>} />
                        <Bar dataKey="created" name="Создано" fill={SERIES.a} radius={[4, 4, 0, 0]} maxBarSize={18} />
                        <Bar dataKey="completed" name="Выполнено" fill={SERIES.b} radius={[4, 4, 0, 0]} maxBarSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Время по проектам" description="Плановые и фактические часы за период, ч" />
              <CardBody>
                {byProject.length ? (
                  <div style={{ height: Math.max(200, byProject.length * 52 + 50) }}>
                    <ResponsiveContainer>
                      <BarChart data={byProject} layout="vertical" barGap={2} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={axis} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={150} tick={axis} tickLine={false} axisLine={false} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
                        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => <span className="text-muted-foreground">{v}</span>} />
                        <Bar dataKey="plannedHours" name="План" fill={SERIES.a} radius={[0, 4, 4, 0]} maxBarSize={14} />
                        <Bar dataKey="actualHours" name="Факт" fill={SERIES.b} radius={[0, 4, 4, 0]} maxBarSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-8 text-center text-xs text-muted-foreground">Нет задач с плановыми или фактическими часами за период</p>
                )}
              </CardBody>
            </Card>

            {sprint && (
              <Card>
                <CardHeader icon={<Crosshair />} title={`Прогресс: ${sprint.name}`} />
                <CardBody>
                  <SprintSummary sprint={sprint} />
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader icon={<Moon />} title="Проекты без активности" description={`Активные проекты без изменений больше ${settings.inactivityDays} дней`} />
              <CardBody className="grid gap-2">
                {stale.length ? (
                  stale.map(({ project, lastActivity }) => (
                    <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center justify-between gap-3 rounded-md px-1 py-1 text-sm hover:bg-accent/60">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color }} />
                        <span className="truncate">{project.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-warning">{relative(lastActivity)}</span>
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Все активные проекты в движении</p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
