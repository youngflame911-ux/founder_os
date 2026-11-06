import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button, Checkbox, DemoBadge, Field, Input, Textarea } from '@/components/ui/primitives'
import { EVENT_CATEGORY_COLOR, EVENT_CATEGORY_LABEL } from '@/domain/constants'
import { newEvent } from '@/domain/factories'
import type { CalendarEvent, EventCategory } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi, type EditorRequest } from '@/store/useUiStore'
import { atTime } from '@/lib/dates'
import { ProjectSelect } from '@/features/common/ProjectSelect'

const split = (iso: string) => {
  const d = parseISO(iso)
  return { date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') }
}

export function EventEditor({ req, onOpenChange }: { req: Extract<EditorRequest, { kind: 'event' }>; onOpenChange: (v: boolean) => void }) {
  const { events, upsertEvent, deleteEvent } = useAppStore()
  const confirm = useUi((s) => s.confirm)
  const existing = req.id ? events.find((e) => e.id === req.id) : undefined
  const [ev, setEv] = useState<CalendarEvent>(() => existing ?? newEvent(req.initial))
  const [start, setStart] = useState(() => split(ev.start))
  const [end, setEnd] = useState(() => split(ev.end))
  const [error, setError] = useState('')
  const set = <K extends keyof CalendarEvent>(k: K, v: CalendarEvent[K]) => setEv((x) => ({ ...x, [k]: v }))

  const changeStartDate = (date: string) => {
    // Сдвигаем окончание вместе с началом, если они были в один день
    if (end.date === start.date || end.date < date) setEnd((e) => ({ ...e, date }))
    setStart((s) => ({ ...s, date }))
  }

  const save = () => {
    if (!ev.title.trim()) return setError('Укажите название')
    if (!start.date) return setError('Укажите дату')
    const s = ev.allDay ? atTime(start.date, '00:00') : atTime(start.date, start.time || '09:00')
    const e = ev.allDay ? atTime(end.date || start.date, '23:59') : atTime(end.date || start.date, end.time || start.time)
    if (e <= s) return setError('Окончание должно быть позже начала')
    upsertEvent({ ...ev, title: ev.title.trim(), start: s.toISOString(), end: e.toISOString() })
    onOpenChange(false)
  }

  const remove = async () => {
    if (existing && (await confirm({ title: 'Удалить событие?', description: existing.title }))) {
      deleteEvent(existing.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={<span className="flex items-center gap-2">{existing ? 'Событие' : 'Новое событие'} {existing?.isDemo && <DemoBadge />}</span>}>
        <DialogBody className="grid gap-4">
          <Input autoFocus placeholder="Название" value={ev.title} onChange={(e) => set('title', e.target.value)} className="h-10 text-base font-medium" />
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EVENT_CATEGORY_LABEL) as EventCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('category', c)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors hover:bg-accent data-[on=true]:border-transparent data-[on=true]:bg-foreground data-[on=true]:text-background"
                data-on={ev.category === c}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: EVENT_CATEGORY_COLOR[c] }} />
                {EVENT_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={ev.allDay} onChange={(v) => set('allDay', v)} /> Весь день
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Начало">
              <div className="flex gap-2">
                <Input type="date" value={start.date} onChange={(e) => changeStartDate(e.target.value)} />
                {!ev.allDay && <Input type="time" className="w-28" value={start.time} onChange={(e) => setStart((s) => ({ ...s, time: e.target.value }))} />}
              </div>
            </Field>
            <Field label="Окончание">
              <div className="flex gap-2">
                <Input type="date" value={end.date} min={start.date} onChange={(e) => setEnd((x) => ({ ...x, date: e.target.value }))} />
                {!ev.allDay && <Input type="time" className="w-28" value={end.time} onChange={(e) => setEnd((x) => ({ ...x, time: e.target.value }))} />}
              </div>
            </Field>
          </div>
          <Field label="Проект">
            <ProjectSelect value={ev.projectId} onChange={(v) => set('projectId', v)} />
          </Field>
          <Textarea placeholder="Описание, ссылка на встречу, повестка" value={ev.description} onChange={(e) => set('description', e.target.value)} />
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
          <Button onClick={save}>{existing ? 'Сохранить' : 'Создать'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

