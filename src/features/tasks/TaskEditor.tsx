import { useMemo, useState } from 'react'
import { Link2, Search, Trash2 } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button, Checkbox, DemoBadge, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from '@/domain/constants'
import { newTask } from '@/domain/factories'
import type { Task } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi, type EditorRequest } from '@/store/useUiStore'
import { createsCycle } from '@/services/tasks'
import { fmt, fmtDate } from '@/lib/dates'
import { ProjectSelect, fromHoursInput, toHoursInput } from '@/features/common/ProjectSelect'
import { StatusBadge } from '@/features/common/bits'

const REMINDER_OPTIONS = [
  { v: 15, l: 'за 15 минут' },
  { v: 60, l: 'за 1 час' },
  { v: 180, l: 'за 3 часа' },
  { v: 1440, l: 'за 1 день' },
  { v: 4320, l: 'за 3 дня' },
]

export function TaskEditor({ req, onOpenChange }: { req: Extract<EditorRequest, { kind: 'task' }>; onOpenChange: (v: boolean) => void }) {
  const { tasks, sprints, settings, upsertTask, deleteTask } = useAppStore()
  const confirm = useUi((s) => s.confirm)
  const existing = req.id ? tasks.find((t) => t.id === req.id) : undefined
  const [t, setT] = useState<Task>(() => existing ?? newTask(req.initial))
  const [planned, setPlanned] = useState(toHoursInput(t.plannedMinutes))
  const [actual, setActual] = useState(toHoursInput(t.actualMinutes))
  const [depQuery, setDepQuery] = useState('')
  const [error, setError] = useState('')
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setT((x) => ({ ...x, [k]: v }))

  const sprint = sprints.find((s) => s.id === (t.sprintId ?? settings.activeSprintId))

  const depCandidates = useMemo(() => {
    const q = depQuery.trim().toLowerCase()
    return tasks
      .filter((x) => x.id !== t.id)
      .filter((x) => !q || x.title.toLowerCase().includes(q) || t.dependsOn.includes(x.id))
      .sort((a, b) => Number(t.dependsOn.includes(b.id)) - Number(t.dependsOn.includes(a.id)) || Number(a.status === 'done') - Number(b.status === 'done'))
      .slice(0, 40)
  }, [tasks, t.id, t.dependsOn, depQuery])

  const save = () => {
    if (!t.title.trim()) return setError('Укажите название задачи')
    if (t.startDate && t.deadline && t.startDate > t.deadline) return setError('Дата начала позже дедлайна')
    upsertTask({ ...t, title: t.title.trim(), plannedMinutes: fromHoursInput(planned), actualMinutes: fromHoursInput(actual) })
    onOpenChange(false)
  }

  const remove = async () => {
    if (!existing) return
    const dependents = tasks.filter((x) => x.dependsOn.includes(existing.id)).length
    const ok = await confirm({
      title: 'Удалить задачу?',
      description: dependents ? `От неё зависят задачи (${dependents}). Связи будут сняты.` : 'Действие нельзя отменить.',
    })
    if (ok) {
      deleteTask(existing.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={
          <span className="flex items-center gap-2">
            {existing ? 'Задача' : 'Новая задача'} {existing?.isDemo && <DemoBadge />}
          </span>
        }
        description={existing ? `Создана ${fmt(existing.createdAt, 'd MMM yyyy, HH:mm')}${existing.completedAt ? ` · выполнена ${fmtDate(existing.completedAt)}` : ''}` : undefined}
      >
        <DialogBody className="grid gap-4">
          <Input autoFocus placeholder="Что нужно сделать?" value={t.title} onChange={(e) => set('title', e.target.value)} className="h-10 text-base font-medium" onKeyDown={(e) => e.key === 'Enter' && save()} />
          <Textarea placeholder="Описание, критерий готовности" value={t.description} onChange={(e) => set('description', e.target.value)} />

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Проект">
              <ProjectSelect value={t.projectId} onChange={(v) => set('projectId', v)} />
            </Field>
            <Field label="Приоритет">
              <Select value={t.priority} onChange={(e) => set('priority', e.target.value as Task['priority'])}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Статус">
              <Select value={t.status} onChange={(e) => set('status', e.target.value as Task['status'])}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Начало">
              <Input type="date" value={t.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
            </Field>
            <Field label="Дедлайн">
              <Input type="date" value={t.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />
            </Field>
            <Field label="Напоминание">
              <Select
                value={t.reminder.enabled ? String(t.reminder.offsetMinutes) : ''}
                onChange={(e) => set('reminder', e.target.value ? { enabled: true, offsetMinutes: Number(e.target.value) } : { ...t.reminder, enabled: false })}
                disabled={!t.deadline}
              >
                <option value="">Не напоминать</option>
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="План, часов">
              <Input inputMode="decimal" placeholder="1.5" value={planned} onChange={(e) => setPlanned(e.target.value)} />
            </Field>
            <Field label="Факт, часов">
              <Input inputMode="decimal" placeholder="—" value={actual} onChange={(e) => setActual(e.target.value)} />
            </Field>
          </div>

          {sprint && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={t.sprintId === sprint.id} onChange={(v) => setT((x) => ({ ...x, sprintId: v ? sprint.id : null, sprintWeek: v ? x.sprintWeek : null }))} />
                Входит в {sprint.name}
              </label>
              {t.sprintId === sprint.id && (
                <Select className="mt-2" value={t.sprintWeek ?? ''} onChange={(e) => set('sprintWeek', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Без недельного этапа</option>
                  {sprint.weeks.map((w) => (
                    <option key={w.index} value={w.index}>
                      Неделя {w.index} · {fmt(w.startDate, 'd MMM')}–{fmt(w.endDate, 'd MMM')}
                      {w.goal ? ` · ${w.goal}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" /> Зависит от задач {t.dependsOn.length > 0 && `(${t.dependsOn.length})`}
            </div>
            {tasks.length > (existing ? 1 : 0) ? (
              <div className="rounded-lg border">
                <div className="relative border-b">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input value={depQuery} onChange={(e) => setDepQuery(e.target.value)} placeholder="Найти задачу" className="h-9 w-full bg-transparent pl-8 pr-3 text-sm outline-none" />
                </div>
                <div className="max-h-40 overflow-y-auto p-1 scrollbar-thin">
                  {depCandidates.map((x) => {
                    const checked = t.dependsOn.includes(x.id)
                    const cycle = !checked && createsCycle(t.id, x.id, tasks)
                    return (
                      <label key={x.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent" title={cycle ? 'Создаст циклическую зависимость' : undefined}>
                        <Checkbox
                          checked={checked}
                          disabled={cycle}
                          onChange={(v) => set('dependsOn', v ? [...t.dependsOn, x.id] : t.dependsOn.filter((d) => d !== x.id))}
                        />
                        <span className={x.status === 'done' ? 'truncate text-muted-foreground line-through' : 'truncate'}>{x.title}</span>
                        <span className="ml-auto">
                          <StatusBadge status={x.status} />
                        </span>
                      </label>
                    )
                  })}
                  {!depCandidates.length && <p className="px-2 py-2 text-xs text-muted-foreground">Ничего не найдено</p>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Других задач пока нет.</p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          {existing && (
            <Button variant="ghost" className="mr-auto text-destructive hover:text-destructive" onClick={remove}>
              <Trash2 /> Удалить
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={save}>{existing ? 'Сохранить' : 'Создать задачу'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
