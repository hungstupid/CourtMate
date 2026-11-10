import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
} from 'react'
import type { ReactNode, ReactElement, FormEvent } from 'react'
import { Link } from 'react-router'

export function Icon({
  name = 'court',
  size = 20,
}: {
  name?: string
  size?: number
}) {
  const paths: Record<string, ReactNode> = {
    court: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M12 4v16M3 12h18M7 4v16M17 4v16" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    location: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 11h18m-12 4h2m3 0h2" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.court}
    </svg>
  )
}
export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children && <p className="muted">{children}</p>}
      </div>
      {action}
    </div>
  )
}
const statusLabels: Record<string, string> = {
  AVAILABLE: 'Trống',
  BOOKED: 'Đã đặt',
  BLOCKED: 'Bảo trì / Bị chặn',
  UNPUBLISHED: 'Chưa công bố',
  UNAVAILABLE: 'Không khả dụng',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  OPEN: 'Còn chỗ',
  FULL: 'Đầy',
  CLOSED: 'Đã đóng',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng nhận mới',
  SCHEDULED: 'Đã hẹn',
  DEACTIVATED: 'Đã tắt',
  EXPIRED: 'Hết hiệu lực',
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      {statusLabels[status] ? `${statusLabels[status]} · ${status}` : status}
    </span>
  )
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string
  retry?: () => void
}) {
  return (
    <div className="notice error" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="secondary" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  )
}
export function Loading({ children = 'Đang tải…' }: { children?: ReactNode }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {children}
    </div>
  )
}
export function Empty({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={30} />
      </span>
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) => {
        if (
          !isValidElement(child) ||
          !['input', 'textarea', 'select'].includes(String(child.type))
        )
          return child
        const input = child as ReactElement<{
          id?: string
          'aria-describedby'?: string
        }>
        return cloneElement(input, {
          id,
          'aria-describedby':
            [input.props['aria-describedby'], hint ? `${id}-hint` : '']
              .filter(Boolean)
              .join(' ') || undefined,
        })
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => {
      dialog?.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="icon-button secondary"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function ConfirmDialog({
  title,
  children,
  confirm,
  onClose,
  onConfirm,
  busy,
  error,
  danger = false,
}: {
  title: string
  children: ReactNode
  confirm: string
  onClose: () => void
  onConfirm: () => void
  busy: boolean
  error: string
  danger?: boolean
}) {
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <div className="dialog-copy">{children}</div>
      {error && <ErrorNotice message={error} />}
      <div className="actions">
        <button className="secondary" disabled={busy} onClick={onClose}>
          Giữ nguyên / Quay lại
        </button>
        <button
          className={danger ? 'danger' : ''}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? 'Đang lưu…' : confirm}
        </button>
      </div>
    </Modal>
  )
}
export function CourtImage({
  urls,
  name,
  sport,
}: {
  urls: string[]
  name: string
  sport: string
}) {
  const normalized = sport.toLocaleLowerCase()
  const illustration =
    normalized.includes('bóng đá') || normalized.includes('football')
      ? 'football'
      : normalized.includes('bóng rổ') || normalized.includes('basketball')
        ? 'basketball'
        : 'badminton'
  return urls[0] ? (
    <img className="court-image" src={urls[0]} alt={name} loading="lazy" />
  ) : (
    <div className="court-placeholder">
      <picture>
        {illustration === 'badminton' && (
          <source
            media="(max-width: 560px)"
            srcSet="/images/court-mobile.svg"
          />
        )}
        <img
          src={`/images/court-${illustration}.svg`}
          width="360"
          height="150"
          alt={`Hình minh họa ${sport}; chưa có ảnh sân thực tế`}
          loading="lazy"
        />
      </picture>
    </div>
  )
}
export function BackLink({
  to,
  children = 'Quay lại',
}: {
  to: string
  children?: ReactNode
}) {
  return (
    <Link className="back-link" to={to}>
      ← {children}
    </Link>
  )
}
export type FormSubmit = FormEvent<HTMLFormElement>
