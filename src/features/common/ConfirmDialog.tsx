import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/primitives'
import { useUi } from '@/store/useUiStore'

export function ConfirmDialog() {
  const req = useUi((s) => s.confirmReq)
  const resolve = useUi((s) => s.resolveConfirm)
  return (
    <Dialog open={!!req} onOpenChange={(v) => !v && resolve(false)}>
      {req && (
        <DialogContent title={req.title} size="sm">
          {req.description && (
            <DialogBody>
              <p className="text-sm text-muted-foreground">{req.description}</p>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => resolve(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={() => resolve(true)} autoFocus>
              {req.confirmLabel ?? 'Удалить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
