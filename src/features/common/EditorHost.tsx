import { useUi } from '@/store/useUiStore'
import { TaskEditor } from '@/features/tasks/TaskEditor'
import { EventEditor } from '@/features/events/EventEditor'
import { ProjectEditor, CloseProjectDialog } from '@/features/projects/ProjectEditor'
import { NoteEditor } from '@/features/knowledge/NoteEditor'
import { ResultEditor } from '@/features/results/ResultEditor'
import { ConfirmDialog } from './ConfirmDialog'
import { SettingsDialog } from './SettingsDialog'

/** Единая точка рендера всех редакторов — открываются через useUi().open(...) из любого раздела */
export function EditorHost() {
  const editor = useUi((s) => s.editor)
  const close = useUi((s) => s.close)
  const onOpenChange = (v: boolean) => !v && close()
  const key = editor ? `${editor.kind}-${'id' in editor ? editor.id : 'new'}` : 'none'

  return (
    <>
      {editor?.kind === 'task' && <TaskEditor key={key} req={editor} onOpenChange={onOpenChange} />}
      {editor?.kind === 'event' && <EventEditor key={key} req={editor} onOpenChange={onOpenChange} />}
      {editor?.kind === 'project' && <ProjectEditor key={key} req={editor} onOpenChange={onOpenChange} />}
      {editor?.kind === 'closeProject' && <CloseProjectDialog key={key} id={editor.id} onOpenChange={onOpenChange} />}
      {editor?.kind === 'note' && <NoteEditor key={key} req={editor} onOpenChange={onOpenChange} />}
      {editor?.kind === 'result' && <ResultEditor key={key} req={editor} onOpenChange={onOpenChange} />}
      <ConfirmDialog />
      <SettingsDialog />
    </>
  )
}
