import { EditSessionProvider } from '../../shared/ui/editSession'
import { Panel } from './Panel'
import { useToolShortcuts } from './shortcuts'
import { useStore } from './store'

/**
 * Wires the shared control primitives to this tool's undo stack and quality
 * switch, and installs the window-level shortcuts. The Panel itself stays a
 * plain component.
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

