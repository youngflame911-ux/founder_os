import { useMemo, useState } from 'react'
import { Plus, Trophy } from 'lucide-react'
import { Button, Card, DemoBadge, EmptyState, PageHeader, Select } from '@/components/ui/primitives'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { capitalize, daysBetween, fmt, fmtDate } from '@/lib/dates'
import { groupBy, plural } from '@/lib/utils'
import { ProjectTag } from '@/features/common/bits'

export default function ResultsPage() {
  const { results, projects } = useAppStore()
  const open = useUi((s) => s.open)
  const [project, setProject] = useState('')

  const list = useMemo(() => results.filter((r) => !project || (project === '__none' ? !r.projectId : r.projectId === project)).sort((a, b) => b.date.localeCompare(a.date)), [results, project])
  const byMonth = groupBy(list, (r) => r.date.slice(0, 7))
  const months = Object.keys(byMonth).sort().reverse()

  return (
    <div>
      <PageHeader
        title="Результаты"
        description="Журнал достижений — то, что реально сдвинулось"
        actions={
          <>
            <Select className="w-48" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Все проекты</option>
              <option value="__none">Без проекта</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Button onClick={() => open({ kind: 'result', initial: project && project !== '__none' ? { projectId: project } : undefined })}>
              <Plus /> Результат
            </Button>
          </>
        }
      />

      {list.length ? (
        <div className="grid gap-8">
          {months.map((m) => (
            <section key={m}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {capitalize(fmt(`${m}-01`, 'LLLL yyyy'))} · {byMonth[m].length}
              </h2>
              <ol className="relative grid gap-3 border-l pl-6">
                {byMonth[m].map((r) => {
                  const p = projects.find((x) => x.id === r.projectId)
                  const day = p ? daysBetween(p.startDate, r.date) : null
                  return (
                    <li key={r.id} className="relative">
                      <span className="absolute -left-[31px] top-4 grid h-4 w-4 place-items-center rounded-full border-2 border-background bg-primary" />
                      <Card className="cursor-pointer p-4 transition-shadow hover:shadow-md" onClick={() => open({ kind: 'result', id: r.id })}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold leading-snug">{r.title}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{fmtDate(r.date)}</span>
                              <ProjectTag projectId={r.projectId} />
                              {day !== null && day >= 0 && (
                                <span>
                                  через {day} {plural(day, ['день', 'дня', 'дней'])} работы над проектом
                                </span>
                              )}
                              {r.isDemo && <DemoBadge />}
                            </div>
                          </div>
                          {r.metricValue != null && (
                            <div className="text-right">
                              <div className="text-xl font-semibold tabular text-success">{r.metricValue.toLocaleString('ru-RU')}</div>
                              <div className="text-xs text-muted-foreground">{r.metricUnit}</div>
                            </div>
                          )}
                        </div>
                        {r.description && <p className="mt-3 whitespace-pre-wrap text-sm">{r.description}</p>}
                        {r.lessons && (
                          <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Вывод: </span>
                            {r.lessons}
                          </p>
                        )}
                      </Card>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Trophy />} title={results.length ? 'Нет результатов по этому проекту' : 'Журнал пока пуст'} description="Фиксируйте каждый значимый шаг: первая оплата, подписанный договор, запуск. Это топливо на длинной дистанции." action={<Button onClick={() => open({ kind: 'result' })}><Plus /> Записать результат</Button>} />
      )}
    </div>
  )
}
