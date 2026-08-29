import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useCopy } from '../i18n/lang'
import { SITE } from '../i18n/site'
import { useEditSession } from './editSessionContext'
import { ChevronIcon, NoneIcon } from './icons'

/**
 * A parameter drag mutates the document continuously but should land in
 * history as one step, and should drop the canvas to draft quality while it
 * moves.
 */
function useDragCommit() {
  const { snapshot, setBusy } = useEditSession()
  const active = useRef(false)

  useEffect(() => {
    const end = () => {
      if (!active.current) return
      active.current = false
      setBusy(false)
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [setBusy])

  return useCallback(() => {
    if (active.current) return
    active.current = true
    snapshot()
    setBusy(true)
  }, [snapshot, setBusy])
}

/** Full-width travel of the drag, in pixels, to cross the whole range. */
const SCRUB_TRAVEL = 260
const FINE_FACTOR = 0.15
/** How far the numeral is allowed to lag behind your hand, px. */
const LEAN_LIMIT = 6

interface ScrubProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  /** Larger numerals for the two or three controls that carry the design. */
  emphasis?: boolean
  /**
   * A miniature of what this value does, drawn beside the label.
   *
   * For parameters whose name and number do not between them say what will
   * happen — the ones where a designer has to drag and watch to find out. Rows
   * that already explain themselves are left alone; a mark on every row would be
   * decoration, and then none of them would carry any weight.
   */
  mark?: ReactNode
}

/**
 * One parameter as a single data row: label left, value right, a hairline
 * underneath showing where it sits in range.
 *
 * Drag the row to scrub, hold shift for fine steps, or click the number and
 * type. A stack of these reads as a spec table rather than as a wall of
 * identical slider tracks, which is the whole point — twenty sliders all look
 * like the same control, twenty labelled values do not.
 */
export function Scrub({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  emphasis,
  mark,
}: ScrubProps) {
  const begin = useDragCommit()
  const origin = useRef<{ x: number; value: number } | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  /** How far the numeral leans with your hand, px. Springs back on release. */
  const [lean, setLean] = useState(0)

  const quantise = (v: number) => {
    const snapped = Math.round(v / step) * step
    const clamped = Math.min(max, Math.max(min, snapped))
    // Kill the float dust that 0.01 steps accumulate.
    return Math.round(clamped * 1000) / 1000
  }

  // A drag can end anywhere, including outside the window, and pointer
  // capture is not guaranteed — so the release is also watched globally.
  useEffect(() => {
    const release = () => {
      origin.current = null
      setDragging(false)
      setLean(0)
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [])

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    e.preventDefault()
    // Capture keeps the drag alive past the row's edges; it is an
    // enhancement, so a refusal must not swallow the gesture.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    begin()
    origin.current = { x: e.clientX, value }
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = origin.current
    if (!start) return
    // Resolved against the value at pointerdown, never the last rendered one:
    // React can batch several moves into a single render.
    const travelled = e.clientX - start.x
    const perPixel = ((max - min) / SCRUB_TRAVEL) * (e.shiftKey ? FINE_FACTOR : 1)
    onChange(quantise(start.value + travelled * perPixel))
    setLean(Math.max(-LEAN_LIMIT, Math.min(LEAN_LIMIT, travelled * 0.14)))
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!origin.current) return
    origin.current = null
    setDragging(false)
    setLean(0)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const fraction = max === min ? 0 : (value - min) / (max - min)
  const shown = draft ?? String(Math.round(value * 100) / 100)

  return (
    <div
      className={`scrub${emphasis ? ' is-emphasis' : ''}${dragging ? ' is-live' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="scrub-label">{label}</span>
      {mark && (
        <span className="row-mark" aria-hidden>
          {mark}
        </span>
      )}
      {/* The numeral is the handle. Ridges under it read as grip when still
          and as travel when moving — and they scroll 1:1 with the pointer, so
          the wheel really is turning under your hand. */}
      <span className="scrub-num" style={{ transform: `translateX(${lean}px)` }}>
        <input
          className="scrub-value"
          type="text"
          inputMode="decimal"
          value={shown}
          onFocus={(e) => {
            begin()
            setDraft(e.target.value)
          }}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            setDraft(e.target.value)
            const parsed = Number(e.target.value)
            if (Number.isFinite(parsed)) onChange(quantise(parsed))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span
          className="scrub-ridges"
          aria-hidden
          style={{ backgroundPositionX: `${-fraction * SCRUB_TRAVEL}px` }}
        />
      </span>
      {unit && <span className="scrub-unit">{unit}</span>}
    </div>
  )
}

export interface Choice<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface ChoiceProps<T extends string> {
  label?: string
  value: T
  options: Choice<T>[]
  onChange: (value: T) => void
  /** Icons only, with the label as a tooltip — for compact visual options. */
  iconOnly?: boolean
  /** For a row whose options need laying out differently, e.g. wrapping. */
  className?: string
}

export function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
  iconOnly,
  className,
}: ChoiceProps<T>) {
  const { snapshot } = useEditSession()
  return (
    <div className={`choice${iconOnly ? ' is-icons' : ''}${className ? ` ${className}` : ''}`}>
      {label && <span className="choice-label">{label}</span>}
      <div className="choice-options">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={opt.value === value}
            className={opt.value === value ? 'is-active' : ''}
            onClick={() => {
              snapshot()
              onChange(opt.value)
            }}
          >
            {opt.icon}
            {!iconOnly && <span>{opt.label}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

interface SwatchProps {
  label: string
  value: string
  onChange: (value: string) => void
  allowNone?: boolean
}

export function Swatch({ label, value, onChange, allowNone }: SwatchProps) {
  const { snapshot } = useEditSession()
  const site = useCopy(SITE)
  const isNone = value === 'none'

  return (
    <div className="swatch">
      <span className="swatch-label">{label}</span>
      <label className="swatch-chip">
        <span className="swatch-fill" style={{ background: isNone ? 'transparent' : value }} />
        <input
          type="color"
          value={isNone ? '#000000' : value}
          onFocus={snapshot}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <input
        className="swatch-hex"
        type="text"
        value={value}
        spellCheck={false}
        onFocus={snapshot}
        onChange={(e) => onChange(e.target.value)}
      />
      {/* The column is always reserved, even without a none toggle, so the
          swatch rows stay aligned as a table. */}
      <span className="swatch-slot">
        {allowNone && (
          <button
            type="button"
            className={`swatch-none${isNone ? ' is-active' : ''}`}
            title={isNone ? site.giveColour : site.setNone}
            aria-pressed={isNone}
            onClick={() => {
              snapshot()
              onChange(isNone ? '#ffffff' : 'none')
            }}
          >
            <NoneIcon />
          </button>
        )}
      </span>
    </div>
  )
}

export function Switch({
  label,
  value,
  onChange,
  mark,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  /** Drawn beside the label, showing what the switch turns on. */
  mark?: ReactNode
}) {
  const { snapshot } = useEditSession()
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={value}
      onClick={() => {
        snapshot()
        onChange(!value)
      }}
    >
      <span className="switch-label">{label}</span>
      {mark && (
        <span className="row-mark" aria-hidden>
          {mark}
        </span>
      )}
      <span className={`switch-track${value ? ' is-on' : ''}`}>
        <span className="switch-knob" />
      </span>
      {/* Not translated, and this is the rule rather than an oversight: the
          state reads in the same monospaced register as `px`, `bpm` and every
          numeral on the panel. That register is measurement, not English. */}
      <span className="switch-state">{value ? 'ON' : 'OFF'}</span>
    </button>
  )
}

export function Group({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="group">
      <h2 className="group-head">
        <span>{title}</span>
        {aside && <span className="group-aside">{aside}</span>}
      </h2>
      {children}
    </section>
  )
}

/** Rarely-touched settings stay folded away so the panel stays scannable. */
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`disclosure${open ? ' is-open' : ''}`}>
      <button type="button" className="disclosure-head" onClick={() => setOpen((v) => !v)}>
        <ChevronIcon className="disclosure-chevron" />
        <span>{title}</span>
      </button>
      {open && <div className="disclosure-body">{children}</div>}
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="note">{children}</p>
}
