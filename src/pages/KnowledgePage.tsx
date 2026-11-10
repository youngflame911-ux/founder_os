import { useMemo, useState } from 'react'
import { BookOpen, Lightbulb, Plus, Search, X } from 'lucide-react'
import { Badge, Button, Card, DemoBadge, EmptyState, PageHeader, Select } from '@/components/ui/primitives'
import { NOTE_CATEGORY_LABEL } from '@/domain/constants'
import type { NoteCategory } from '@/domain/types'
import { useAppStore } from '@/store/useAppStore'
import { useUi } from '@/store/useUiStore'
import { fmtDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { ProjectTag } from '@/features/common/bits'

const CATS = Object.keys(NOTE_CATEGORY_LABEL) as NoteCategory[]

export default function KnowledgePage() {
  const { notes, projects } = useAppStore()
  const open = useUi((s) => s.open)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<NoteCategory | ''>('')
  const [tag, setTag] = useState('')
  const [project, setProject] = useState('')

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    notes.forEach((n) => n.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [notes])

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    return notes
      .filter(
        (n) =>
          (!query || [n.title, n.content, n.source, ...n.tags].some((x) => x.toLowerCase().includes(query))) &&
          (!cat || n.category === cat) &&
          (!tag || n.tags.includes(tag)) &&
          (!project || n.projectId === project),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [notes, q, cat, tag, project])

  const filtered = q || cat || tag || project

  return (
    <div>
      <PageHeader
        title="База знаний"
        description="Идеи, заметки, гипотезы, наблюдения и полезные материалы"
        actions={
          <Button onClick={() => open({ kind: 'note', initial: cat ? { category: cat } : undefined })}>
            <Plus /> Запись
          </Button>
        }
      />

      <div className="mb-4 grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по тексту, источнику, тегам" className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus:border-ring" />
          </div>
          <Select className="h-9 w-auto min-w-[160px]" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Все проекты</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => (setQ(''), setCat(''), setTag(''), setProject(''))}>
              <X /> Сбросить
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={!cat} onClick={() => setCat('')}>
            Все · {notes.length}
          </Chip>
          {CATS.map((c) => (
            <Chip key={c} on={cat === c} onClick={() => setCat(cat === c ? '' : c)}>
              {NOTE_CATEGORY_LABEL[c]} · {notes.filter((n) => n.category === c).length}
            </Chip>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(([t, n]) => (
              <button key={t} onClick={() => setTag(tag === t ? '' : t)} className={cn('rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground', tag === t && 'bg-primary/10 text-primary')}>
                #{t} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((n) => (
            <Card key={n.id} className="fos-lift cursor-pointer p-4" onClick={() => open({ kind: 'note', id: n.id })}>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant={n.category === 'idea' ? 'primary' : n.category === 'hypothesis' ? 'warning' : 'default'}>{NOTE_CATEGORY_LABEL[n.category]}</Badge>
                {n.isDemo && <DemoBadge />}
                <span className="ml-auto text-xs text-muted-foreground">{fmtDate(n.date)}</span>
              </div>
              <h3 className="font-medium leading-snug">{n.title}</h3>
              {n.content && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{n.content}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <ProjectTag projectId={n.projectId} />
                {n.source && <span>Источник: {n.source}</span>}
                {n.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : notes.length ? (
        <EmptyState icon={<Search />} title="Ничего не найдено" description="Попробуйте другой запрос или сбросьте фильтры" />
      ) : (
        <EmptyState icon={<Lightbulb />} title="База знаний пуста" description="Записывайте идеи сразу, как они приходят: потом их можно связать с проектом и превратить в задачи." action={<Button onClick={() => open({ kind: 'note' })}><BookOpen /> Первая запись</Button>} />
      )}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('h-7 rounded-full border px-3 text-xs transition-colors hover:bg-accent', on && 'border-transparent bg-foreground text-background hover:bg-foreground/90')}>
      {children}
    </button>
  )
}
