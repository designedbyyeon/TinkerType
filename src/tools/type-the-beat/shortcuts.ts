import { useEffect } from 'react'
import { isTyping } from '../../shared/ui/typing'
import { useStore } from './store'

/**
 * Undo and redo, at the window level so they work wherever focus sits.
 *
 * The transport is not here. It belongs to the stage, which is the only thing
 * that holds an audio context — see the note beside it.
 */
export function useToolShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return

      // Text fields keep their own undo — stealing it while someone is typing the
      // pattern would be maddening.
      if (isTyping(e.target)) return

      e.preventDefault()
      if (e.shiftKey) useStore.getState().redo()
      else useStore.getState().undo()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
