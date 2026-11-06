import { useRef, useState } from 'react'
import { Download, FlaskConical, RotateCcw, Trash2, Upload } from 'lucide-react'
import { Dialog, DialogBody, DialogContent } from '@/components/ui/dialog'
import { Button, Field, Input } from '@/components/ui/primitives'
import { useAppStore, selectData } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { isAppData } from '@/data/storage/migrations'
import { storage } from '@/data/storage'
import { todayString } from '@/lib/dates'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-b py-4 first:pt-0 last:border-0">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function SettingsDialog() {
  const { settingsOpen, setSettingsOpen, confirm } = useUi()
  const store = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const demoCount = [store.projects, store.tasks, store.events, store.notes, store.results].reduce((a, l) => a + l.filter((x) => x.isDemo).length, 0)
  const wd = store.settings.workday

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(selectData(useAppStore.getState()), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `founder-os-backup-${todayString()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (!isAppData(parsed)) throw new Error('format')
      if (!(await confirm({ title: 'Заменить текущие данные?', description: 'Все текущие записи будут заменены данными из файла. Рекомендуем сначала сделать экспорт.', confirmLabel: 'Заменить' }))) return
      store.importData(parsed)
      setMsg('Данные импортированы')
    } catch {
      setMsg('Файл не похож на резервную копию Founder OS')
    }
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent title="Настройки и данные" description={`Хранилище: ${storage.name} (данные остаются в этом браузере)`}>
        <DialogBody>
          <Section title="Рабочий день по умолчанию" description="Используется планировщиком дня. Для конкретной даты можно задать своё расписание в календаре.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Начало">
                <Input type="time" value={wd.start} onChange={(e) => store.setDefaultWorkday({ ...wd, start: e.target.value })} />
              </Field>
              <Field label="Окончание">
                <Input type="time" value={wd.end} onChange={(e) => store.setDefaultWorkday({ ...wd, end: e.target.value })} />
              </Field>
              <Field label="Перерыв, мин">
                <Input type="number" min={0} step={15} value={wd.breakMinutes} onChange={(e) => store.setDefaultWorkday({ ...wd, breakMinutes: Math.max(0, Number(e.target.value)) })} />
              </Field>
              <Field label="Перерыв с">
                <Input type="time" value={wd.breakStart} onChange={(e) => store.setDefaultWorkday({ ...wd, breakStart: e.target.value })} />
              </Field>
            </div>
            <Field label="Проект без активности, дней" className="max-w-[200px]">
              <Input type="number" min={1} value={store.settings.inactivityDays} onChange={(e) => useAppStore.setState((s) => ({ settings: { ...s.settings, inactivityDays: Math.max(1, Number(e.target.value)) } }))} />
            </Field>
          </Section>

          <Section title="Демонстрационные данные" description="Помечены бейджем «Демо». Не смешиваются с реальными данными и удаляются одной кнопкой.">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => store.loadDemo()} disabled={demoCount > 0}>
                <FlaskConical /> Загрузить демо
              </Button>
              <Button variant="outline" onClick={() => store.clearDemo()} disabled={!demoCount}>
                <Trash2 /> Удалить демо ({demoCount})
              </Button>
            </div>
          </Section>

          <Section title="Резервная копия" description="localStorage привязан к браузеру — делайте экспорт регулярно, пока не подключён Supabase.">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportJson}>
                <Download /> Экспорт JSON
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload /> Импорт JSON
              </Button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0]).finally(() => (e.target.value = ''))} />
            </div>
            {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          </Section>

          <Section title="Сброс">
            <Button
              variant="ghost"
              className="w-fit text-destructive hover:text-destructive"
              onClick={async () => {
                if (await confirm({ title: 'Удалить все данные?', description: 'Будут удалены все проекты, задачи, события, заметки и результаты. Действие необратимо.', confirmLabel: 'Удалить всё' })) store.resetAll()
              }}
            >
              <RotateCcw /> Сбросить все данные
            </Button>
          </Section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
