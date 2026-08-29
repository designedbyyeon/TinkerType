import { EditSessionProvider } from '../../shared/ui/editSession'
import { Panel } from './Panel'
import { useToolShortcuts } from './shortcuts'
import { useStore } from './store'

/**
 * Connects the shared controls to this tool's undo stack, and installs the
 * window-level shortcuts. The Panel stays a plain component.
 *
 * `setInteracting` earns its keep differently here than in the other tools: they
 * use it to drop to draft quality mid-drag, and this one uses it to stop the hand
 * from moving the plate while a control is being dragged.
 */
export function ToolPanel() {
  useToolShortcuts()
  const snapshot = useStore((s) => s.pushHistory)
  const setBusy = useStore((s) => s.setInteracting)

  return (
    <EditSessionProvider snapshot={snapshot} setBusy={setBusy}>
      <Panel />
    </EditSessionProvider>
  )
}
