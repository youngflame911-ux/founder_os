import { useState } from 'react'
import { Gantt, ViewMode, type Task as GanttTask } from 'gantt-task-react'
import { Segmented } from '@/components/ui/primitives'
import { fmt } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useUi } from '@/store/useUiStore'

export type { GanttTask }

/**
 * Обёртка над gantt-task-react с русской локалью и темой приложения.
 * Колонки списка и подсказка переопределены собственными компонентами.
 */
export function GanttChart({
  tasks,
  onDateChange,
  onOpen,
  listTitle = 'Задача',
}: {
  tasks: GanttTask[]
  onDateChange?: (t: GanttTask) => void
  onOpen?: (t: GanttTask) => void
  listTitle?: string
}) {
  const [mode, setMode] = useState<ViewMode>(ViewMode.Week)
  const dark = useUi((s) => s.theme === 'dark')
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const shown = tasks.map((t) => (t.type === 'project' ? { ...t, hideChildren: collapsed.has(t.id) } : t))

  const Header = ({ headerHeight }: { headerHeight: number }) => (
    <div className="flex items-end border-b border-r px-3 pb-2 text-xs font-medium text-muted-foreground" style={{ height: headerHeight, width: isMobile ? 160 : 260 }}>
      {listTitle}
    </div>
  )
  const Table = ({ rowHeight, tasks: rows }: { rowHeight: number; tasks: GanttTask[] }) => (
    <div className="border-r" style={{ width: isMobile ? 160 : 260 }}>
      {rows.map((t) => (
        <div
          key={t.id}
          className={cn('flex items-center gap-1.5 border-b border-border/60 px-3 text-xs', t.type === 'project' && 'bg-muted/40 font-semibold')}
          style={{ height: rowHeight }}
        >
          {t.type === 'project' ? (
            <button
              className="w-4 shrink-0 text-muted-foreground"
              onClick={() =>
                setCollapsed((s) => {
                  const n = new Set(s)
                  if (n.has(t.id)) n.delete(t.id)
                  else n.add(t.id)
                  return n
                })
              }
              aria-label="Свернуть"
            >
              {collapsed.has(t.id) ? '▸' : '▾'}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <button className="line-clamp-2 break-words text-left leading-tight hover:underline" onClick={() => onOpen?.(t)} title={t.name}>
            {t.name}
          </button>
        </div>
      ))}
    </div>
  )
  const Tooltip = ({ task }: { task: GanttTask }) => (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="mb-0.5 font-medium">{task.name}</p>
      <p className="text-muted-foreground">
        {fmt(task.start, 'd MMM')} – {fmt(new Date(task.end.getTime() - 1), 'd MMM yyyy')} · {Math.round(task.progress)}%
      </p>
    </div>
  )

  return (
    <div className="grid gap-3">
      <Segmented
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { value: ViewMode.Day, label: 'Дни' },
          { value: ViewMode.Week, label: 'Недели' },
          { value: ViewMode.Month, label: 'Месяцы' },
        ]}
        className="w-fit"
      />
      <div className="fos-gantt">
        <Gantt
          tasks={shown}
          viewMode={mode}
          locale="ru"
          viewDate={new Date()}
          preStepsCount={1}
          columnWidth={mode === ViewMode.Month ? 160 : mode === ViewMode.Week ? 110 : 44}
          rowHeight={40}
          headerHeight={52}
          barCornerRadius={4}
          barFill={62}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="12px"
          todayColor={dark ? 'rgba(125,152,255,0.10)' : 'rgba(35,70,224,0.06)'}
          arrowColor={dark ? '#71717a' : '#a1a1aa'}
          barBackgroundColor={dark ? '#3f3f46' : '#d4d4d8'}
          barBackgroundSelectedColor={dark ? '#52525b' : '#a1a1aa'}
          projectBackgroundColor={dark ? '#3f3f46' : '#c7c7cc'}
          TaskListHeader={Header}
          TaskListTable={Table}
          TooltipContent={Tooltip}
          onDateChange={onDateChange}
          onDoubleClick={onOpen}
          onExpanderClick={() => {}}
        />
      </div>
      <p className="text-xs text-muted-foreground">Перетащите полосу, чтобы сдвинуть сроки. Двойной клик — открыть запись.</p>
    </div>
  )
}
