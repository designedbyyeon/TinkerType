import { useEffect } from 'react'
import { isTyping } from '../../shared/ui/typing'
import { useStore } from './store'

/** Undo and redo, at the window level so they work wherever focus sits. */
export function useToolShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      // The line is typed into a field that keeps its own undo. Stealing it
      // while someone is writing the building's text would be maddening.
      if (isTyping(e.target)) return

      e.preventDefault()
      if (e.shiftKey) useStore.getState().redo()
      else useStore.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
