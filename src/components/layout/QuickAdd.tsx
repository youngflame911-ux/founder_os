import { BookOpen, CalendarPlus, CheckSquare, FolderPlus, Plus, Sparkles, Trophy } from 'lucide-react'
import { useAssistantAvailable } from '@/features/assistant/AssistantPanel'
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

/** Глобальные кнопки: ассистент и «+» */
export function QuickAddFab() {
  const { sample } = useAssistantAvailable()
  const setAssistant = useUi((s) => s.setAssistant)
  return (
    <>
    {sample && (
      <button
        onClick={() => setAssistant(true)}
        aria-label="Ассистент"
        className="fos-press fixed bottom-5 right-[76px] z-30 flex h-12 items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium shadow-lg shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-7 md:right-[92px]"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">Спросить ИИ</span>
      </button>
    )}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Быстро добавить"
          className="fos-press fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full bg-foreground text-background shadow-lg shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-7 md:right-7"
        >
          <Plus className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <Items />
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  )
}
