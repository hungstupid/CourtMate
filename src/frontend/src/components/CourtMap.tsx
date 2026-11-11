import { useEffect, useId, useState } from 'react'

export function CourtMap({ name, address }: { name: string; address: string }) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'loading' | 'settled' | 'unavailable'>(
    'loading'
  )
  const helpId = useId()
  useEffect(() => {
    if (status !== 'loading') return
    const timer = setTimeout(() => setStatus('unavailable'), 10000)
    return () => clearTimeout(timer)
  }, [status, attempt])

  return (
    <>
      <iframe
        key={attempt}
        className="court-map"
        title={`Bản đồ ${name}`}
        aria-describedby={helpId}
        src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
        referrerPolicy="no-referrer-when-downgrade"
        // Cross-origin load can also fire for a blocked/error document. Never
        // interpret it as verified map content; keep recovery controls visible.
        onLoad={() => setStatus('settled')}
        onError={() => setStatus('unavailable')}
      />
      <p role="status" className="muted">
        {status === 'loading'
          ? 'Đang tải bản đồ…'
          : status === 'unavailable'
            ? 'Bản đồ tải chậm hoặc không khả dụng. Bạn vẫn có thể xem địa chỉ và nhập điểm đi.'
            : 'Bản đồ do Google Maps cung cấp.'}
      </p>
      <p id={helpId} className="muted">
        Nếu bản đồ trống hoặc không tải được, hãy thử tải lại hoặc dùng liên kết
        Xem vị trí trên bản đồ bên dưới để mở Google Maps ở tab mới.
      </p>
      <button
        className="secondary full"
        onClick={() => {
          setStatus('loading')
          setAttempt((value) => value + 1)
        }}
      >
        Thử tải lại bản đồ
      </button>
    </>
  )
}
