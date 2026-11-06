import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button, DemoBadge, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { NOTE_CATEGORY_LABEL } from '@/domain/constants'
import { newNote } from '@/domain/factories'
import type { Note, NoteCategory } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi, type EditorRequest } from '@/store/useUiStore'
import { ProjectSelect } from '@/features/common/ProjectSelect'

export const parseTags = (s: string) =>
  [...new Set(s.split(/[,#]/).map((t) => t.trim().toLowerCase()).filter(Boolean))]

export function NoteEditor({ req, onOpenChange }: { req: Extract<EditorRequest, { kind: 'note' }>; onOpenChange: (v: boolean) => void }) {
  const { notes, upsertNote, deleteNote } = useAppStore()
  const confirm = useUi((s) => s.confirm)
  const existing = req.id ? notes.find((n) => n.id === req.id) : undefined
  const [n, setN] = useState<Note>(() => existing ?? newNote(req.initial))
  const [tags, setTags] = useState(n.tags.join(', '))
  const [error, setError] = useState('')
  const set = <K extends keyof Note>(k: K, v: Note[K]) => setN((x) => ({ ...x, [k]: v }))

  const save = () => {
    if (!n.title.trim()) return setError('Укажите название')
    upsertNote({ ...n, title: n.title.trim(), tags: parseTags(tags) })
    onOpenChange(false)
  }
  const remove = async () => {
    if (existing && (await confirm({ title: 'Удалить запись?', description: existing.title }))) {
      deleteNote(existing.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={<span className="flex items-center gap-2">{existing ? 'Запись' : 'Новая запись'} {existing?.isDemo && <DemoBadge />}</span>}>
        <DialogBody className="grid gap-4">
          <Input autoFocus placeholder="Название" value={n.title} onChange={(e) => set('title', e.target.value)} className="h-10 text-base font-medium" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Категория">
              <Select value={n.category} onChange={(e) => set('category', e.target.value as NoteCategory)}>
                {(Object.keys(NOTE_CATEGORY_LABEL) as NoteCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {NOTE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Дата">
              <Input type="date" value={n.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Проект">
              <ProjectSelect value={n.projectId} onChange={(v) => set('projectId', v)} allowClosed />
            </Field>
          </div>
          <Textarea className="min-h-[200px]" placeholder="Содержание" value={n.content} onChange={(e) => set('content', e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Источник идеи">
              <Input placeholder="Книга, встреча, разговор с клиентом…" value={n.source} onChange={(e) => set('source', e.target.value)} />
            </Field>
            <Field label="Теги" hint="Через запятую">
              <Input placeholder="продажи, найм" value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
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
          <Button onClick={save}>{existing ? 'Сохранить' : 'Добавить'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
