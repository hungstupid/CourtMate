import { createContext, useContext, useEffect, useId } from 'react'

export const DraftContext = createContext<{
  update: (
    id: string,
    patch: { dirty?: boolean; busy?: boolean } | null
  ) => void
  protect: (action: () => void) => void
  complete: (id: string) => void
} | null>(null)

export function useDraftGuard(busy = false) {
  const context = useContext(DraftContext)
  if (!context) throw new Error('Draft guard requires its provider.')
  const { update, protect } = context
  const id = useId()
  useEffect(() => {
    update(id, { busy })
  }, [id, busy, update])
  useEffect(() => () => update(id, null), [id, update])
  return {
    markDirty: () => update(id, { dirty: true }),
    markClean: () => context.complete(id),
    protect,
  }
}
