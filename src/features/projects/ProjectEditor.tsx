import { useState } from 'react'
import { Archive, Check } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button, DemoBadge, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { PROJECT_COLORS, PROJECT_STATUS_LABEL } from '@/domain/constants'
import { newProject } from '@/domain/factories'
import type { Project, ProjectStatus } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi, type EditorRequest } from '@/store/useUiStore'
import { cn } from '@/lib/utils'

export function ProjectEditor({ req, onOpenChange }: { req: Extract<EditorRequest, { kind: 'project' }>; onOpenChange: (v: boolean) => void }) {
  const { projects, upsertProject } = useAppStore()
  const open = useUi((s) => s.open)
  const existing = req.id ? projects.find((p) => p.id === req.id) : undefined
  const [p, setP] = useState<Project>(() => existing ?? newProject(req.initial))
  const [error, setError] = useState('')
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP((x) => ({ ...x, [k]: v }))

  const save = () => {
    if (!p.name.trim()) return setError('Укажите название проекта')
    if (p.deadline && p.deadline < p.startDate) return setError('Дедлайн раньше даты старта')
    upsertProject({ ...p, name: p.name.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={<span className="flex items-center gap-2">{existing ? 'Проект' : 'Новый проект'} {existing?.isDemo && <DemoBadge />}</span>}>
        <DialogBody className="grid gap-4">
          <Input autoFocus placeholder="Название проекта" value={p.name} onChange={(e) => set('name', e.target.value)} className="h-10 text-base font-medium" />
          <Field label="Цель" hint="Измеримый результат, ради которого существует проект">
            <Input placeholder="Например: 10 платящих клиентов к марту" value={p.goal} onChange={(e) => set('goal', e.target.value)} />
          </Field>
          <Field label="Описание">
            <Textarea value={p.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Старт">
              <Input type="date" value={p.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Плановый дедлайн">
              <Input type="date" value={p.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />
            </Field>
            <Field label="Статус">
              {p.status === 'closed' ? (
                <Input disabled value="Закрыт (архив)" />
              ) : (
                <Select value={p.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
                  {(['idea', 'active', 'paused'] as ProjectStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label="Цвет">
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => set('color', c)} className={cn('grid h-7 w-7 place-items-center rounded-full ring-offset-2 ring-offset-popover', p.color === c && 'ring-2 ring-foreground/50')} style={{ background: c }} aria-label={`Цвет ${c}`}>
                  {p.color === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          {existing && existing.status !== 'closed' && (
            <Button variant="ghost" className="mr-auto" onClick={() => open({ kind: 'closeProject', id: existing.id })}>
              <Archive /> Закрыть проект
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={save}>{existing ? 'Сохранить' : 'Создать проект'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Закрытие проекта: причина и выводы обязательны, проект уходит в архив */
export function CloseProjectDialog({ id, onOpenChange }: { id: string; onOpenChange: (v: boolean) => void }) {
  const { projects, tasks, closeProject } = useAppStore()
  const p = projects.find((x) => x.id === id)
  const [reason, setReason] = useState('')
  const [lessons, setLessons] = useState('')
  const [touched, setTouched] = useState(false)
  if (!p) return null
  const open = tasks.filter((t) => t.projectId === id && t.status !== 'done').length
  const valid = reason.trim().length >= 3 && lessons.trim().length >= 3

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={`Закрыть «${p.name}»`} description="Проект переместится в архив. Его можно будет восстановить." size="sm">
        <DialogBody className="grid gap-4">
          {open > 0 && <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">Незавершённых задач в проекте: {open}. Они останутся в списке задач.</p>}
          <Field label="Причина закрытия *">
            <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Цель достигнута / гипотеза не подтвердилась / смена приоритетов…" />
          </Field>
          <Field label="Выводы *">
            <Textarea value={lessons} onChange={(e) => setLessons(e.target.value)} placeholder="Что сработало, что нет, что сделаю иначе" />
          </Field>
          {touched && !valid && <p className="text-sm text-destructive">Заполните причину и выводы</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (!valid) return
              closeProject(id, reason.trim(), lessons.trim())
              onOpenChange(false)
            }}
          >
            <Archive /> Закрыть и архивировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
