import { BookOpen, CalendarPlus, CheckSquare, FolderPlus, Plus, Trophy } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown'
import { Button } from '@/components/ui/primitives'
import { useUi } from '@/store/useUiStore'

function Items() {
  const open = useUi((s) => s.open)
  return (
    <>
      <DropdownMenuLabel>Быстро добавить</DropdownMenuLabel>
      <DropdownMenuItem onSelect={() => open({ kind: 'task' })}>
        <CheckSquare /> Задача <kbd className="ml-auto text-[10px] text-muted-foreground">N</kbd>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => open({ kind: 'event' })}>
        <CalendarPlus /> Событие
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => open({ kind: 'project' })}>
        <FolderPlus /> Проект
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => open({ kind: 'note' })}>
        <BookOpen /> Идея / заметка
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => open({ kind: 'result' })}>
        <Trophy /> Результат
      </DropdownMenuItem>
    </>
  )
}

export function QuickAddMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="w-full justify-start">
          <Plus /> Создать
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[216px]">
        <Items />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Глобальная кнопка «+» */
export function QuickAddFab() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Быстро добавить"
          className="fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-7 md:right-7"
        >
          <Plus className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <Items />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
