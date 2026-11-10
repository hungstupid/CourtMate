import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { DraftContext } from '../lib/draft-context'
import { ConfirmDialog } from './ui'

export function DraftProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, { dirty: boolean; busy: boolean }>())
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const update = useCallback(
    (id: string, patch: { dirty?: boolean; busy?: boolean } | null) => {
      if (patch === null) entries.current.delete(id)
      else
        entries.current.set(id, {
          dirty: false,
          busy: false,
          ...entries.current.get(id),
          ...patch,
        })
      setBusy([...entries.current.values()].some((e) => e.busy))
    },
    []
  )
  const protectedState = useCallback(
    () => [...entries.current.values()].some((e) => e.dirty || e.busy),
    []
  )
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      protectedState() &&
      `${currentLocation.pathname}${currentLocation.search}` !==
        `${nextLocation.pathname}${nextLocation.search}`
  )
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (protectedState()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [protectedState])
  const protect = useCallback(
    (action: () => void) => {
      if (protectedState()) setPending(() => action)
      else action()
    },
    [protectedState]
  )
  const complete = useCallback(
    (id: string) => {
      update(id, { dirty: false, busy: false })
      if (!protectedState()) {
        setPending(null)
        if (blocker.state === 'blocked') blocker.reset()
      }
    },
    [update, protectedState, blocker]
  )
  const context = useMemo(
    () => ({ update, protect, complete }),
    [update, protect, complete]
  )
  const keep = () => {
    setPending(null)
    if (blocker.state === 'blocked') blocker.reset()
  }
  return (
    <DraftContext value={context}>
      {children}
      {(pending || blocker.state === 'blocked') && (
        <ConfirmDialog
          title="Bỏ thay đổi chưa lưu?"
          confirm="Bỏ thay đổi và tiếp tục"
          busy={busy}
          allowKeepWhileBusy
          error=""
          onClose={keep}
          onConfirm={() => {
            if (busy) return
            entries.current.clear()
            setBusy(false)
            const action = pending
            setPending(null)
            if (blocker.state === 'blocked') blocker.proceed()
            else action?.()
          }}
        >
          {busy && (
            <p className="notice info" role="status">
              Đang lưu dữ liệu. Vui lòng chờ kết quả trước khi rời trang; bạn có
              thể quay lại biểu mẫu.
            </p>
          )}
          <p>
            Dữ liệu chưa lưu sẽ bị bỏ. Giữ nguyên để tiếp tục chỉnh sửa; thao
            tác này không công bố slot hoặc thay đổi lịch đã lưu.
          </p>
        </ConfirmDialog>
      )}
    </DraftContext>
  )
}
