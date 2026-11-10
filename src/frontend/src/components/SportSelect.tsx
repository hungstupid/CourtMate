import { useEffect, useId, useRef, useState } from 'react'

export function SportSelect({
  value,
  onChange,
  sports,
}: {
  value: string
  onChange: (value: string) => void
  sports: string[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const id = useId()
  useEffect(() => {
    if (open) search.current?.focus()
    function outside(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])
  function choose(sport: string) {
    onChange(sport)
    setOpen(false)
    setQuery('')
    trigger.current?.focus()
  }
  return (
    <div
      className="field sport-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          setOpen(false)
          trigger.current?.focus()
        }
        if (['ArrowDown', 'ArrowUp'].includes(event.key) && open) {
          event.preventDefault()
          const controls = Array.from(
            root.current?.querySelectorAll<HTMLElement>(
              'input, [role="option"]'
            ) || []
          )
          const index = controls.indexOf(document.activeElement as HTMLElement)
          controls[
            (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) %
              controls.length
          ]?.focus()
        }
      }}
    >
      <span id={`${id}-label`}>Môn thể thao</span>
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
      >
        <span id={`${id}-value`}>{value || 'Tất cả môn'}</span>
        <img src="/images/chevron.svg" width="20" height="20" alt="" />
      </button>
      {open && (
        <div className="sport-menu">
          <input
            ref={search}
            aria-label="Tìm môn theo tiền tố"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
          <div id={id} role="listbox" aria-label="Môn thể thao">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => choose('')}
            >
              Tất cả môn
            </button>
            {sports
              .filter((sport) =>
                sport.toLocaleLowerCase().startsWith(query.toLocaleLowerCase())
              )
              .map((sport) => (
                <button
                  type="button"
                  key={sport}
                  role="option"
                  aria-selected={value === sport}
                  onClick={() => choose(sport)}
                >
                  {sport}
                </button>
              ))}
          </div>
          {!sports.some((sport) =>
            sport.toLocaleLowerCase().startsWith(query.toLocaleLowerCase())
          ) && <p>Không có môn phù hợp.</p>}
        </div>
      )}
    </div>
  )
}
