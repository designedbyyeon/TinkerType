import { createContext, useContext } from 'react'

/**
 * The one thing shared controls need from a tool: somewhere to send "an edit is
 * starting" and "I am mid-drag".
 *
 * Without this the control primitives would import a specific tool's store,
 * which is exactly the coupling that stops a second tool from reusing them.
 * Deliberately two functions and nothing more — it exists to break a
 * dependency, not to become a framework.
 */
export interface EditSession {
  /** Called once as a continuous edit begins, so the tool can snapshot undo. */
  snapshot: () => void
  /** True while a drag is in flight, so the tool can drop to draft quality. */
  setBusy: (busy: boolean) => void
}

const NO_SESSION: EditSession = { snapshot: () => {}, setBusy: () => {} }

export const EditSessionContext = createContext<EditSession>(NO_SESSION)

export function useEditSession(): EditSession {
  return useContext(EditSessionContext)
}
