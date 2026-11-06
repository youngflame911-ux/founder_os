import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button, DemoBadge, Field, Input, Textarea } from '@/components/ui/primitives'
import { newResult } from '@/domain/factories'
import type { Achievement } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi, type EditorRequest } from '@/store/useUiStore'
import { ProjectSelect } from '@/features/common/ProjectSelect'

export function ResultEditor({ req, onOpenChange }: { req: Extract<EditorRequest, { kind: 'result' }>; onOpenChange: (v: boolean) => void }) {
  const { results, upsertResult, deleteResult } = useAppStore()
  const confirm = useUi((s) => s.confirm)
  const existing = req.id ? results.find((r) => r.id === req.id) : undefined
  const [r, setR] = useState<Achievement>(() => existing ?? newResult(req.initial))
  const [metric, setMetric] = useState(r.metricValue == null ? '' : String(r.metricValue))
  const [error, setError] = useState('')
  const set = <K extends keyof Achievement>(k: K, v: Achievement[K]) => setR((x) => ({ ...x, [k]: v }))

  const save = () => {
    if (!r.title.trim()) return setError('Укажите название результата')
    const raw = metric.replace(/\s/g, '').replace(',', '.')
    const value = raw ? Number(raw) : null
    if (raw && !Number.isFinite(value)) return setError('Количественный результат должен быть числом')
    upsertResult({ ...r, title: r.title.trim(), metricValue: value })
    onOpenChange(false)
  }
  const remove = async () => {
    if (existing && (await confirm({ title: 'Удалить результат?', description: existing.title }))) {
      deleteResult(existing.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={<span className="flex items-center gap-2">{existing ? 'Результат' : 'Новый результат'} {existing?.isDemo && <DemoBadge />}</span>}>
        <DialogBody className="grid gap-4">
          <Input autoFocus placeholder="Например: первая оплата от клиента" value={r.title} onChange={(e) => set('title', e.target.value)} className="h-10 text-base font-medium" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Дата">
              <Input type="date" value={r.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Проект">
              <ProjectSelect value={r.projectId} onChange={(v) => set('projectId', v)} allowClosed />
            </Field>
          </div>
          <Field label="Описание достижения">
            <Textarea value={r.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Количественный результат (необязательно)">
            <div className="flex gap-2">
              <Input inputMode="decimal" placeholder="150000" value={metric} onChange={(e) => setMetric(e.target.value)} />
              <Input className="w-36" placeholder="₽, клиентов…" value={r.metricUnit} onChange={(e) => set('metricUnit', e.target.value)} />
            </div>
          </Field>
          <Field label="Личные выводы">
            <Textarea value={r.lessons} onChange={(e) => set('lessons', e.target.value)} placeholder="Что привело к результату, что повторить" />
          </Field>
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
          <Button onClick={save}>{existing ? 'Сохранить' : 'Добавить'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
