import { useEffect } from 'react'
import { EditSessionProvider } from '../../shared/ui/editSession'
import { useLang } from '../../shared/i18n/lang'
import { Panel } from './Panel'
import { useToolShortcuts } from './shortcuts'
import { useStore } from './store'

/**
 * Connects the shared controls to this tool's undo stack and quality switch,
 * and installs the window-level shortcuts. The Panel stays a plain component.
 *
 * **It also puts up the language's sample sheet**, and this is the one place in
 * the tool where the language switch reaches into the document. It fires on mount
 * too — a Korean visitor should land on the Korean sample rather than watch it
 * change under them a moment later — and it is a no-op the instant the sheet
 * stops being a sample. See `sample.ts`.
 */
export function ToolPanel() {
  useToolShortcuts()
  const snapshot = useStore((s) => s.pushHistory)
  const setBusy = useStore((s) => s.setInteracting)
  const lang = useLang()

  useEffect(() => {
    useStore.getState().applyLang(lang)
  }, [lang])

  return (
    <EditSessionProvider snapshot={snapshot} setBusy={setBusy}>
      <Panel />
    </EditSessionProvider>
  )
}
