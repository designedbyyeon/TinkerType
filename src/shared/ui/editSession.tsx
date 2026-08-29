import { useMemo, type ReactNode } from 'react'
import { EditSessionContext, type EditSession } from './editSessionContext'

export function EditSessionProvider({
  snapshot,
  setBusy,
  children,
}: EditSession & { children: ReactNode }) {
  const session = useMemo(() => ({ snapshot, setBusy }), [snapshot, setBusy])
  return <EditSessionContext.Provider value={session}>{children}</EditSessionContext.Provider>
}
