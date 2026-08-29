import { useEffect, useRef, useState } from 'react'
import { useCopy } from '../../shared/i18n/lang'
import { COPY } from './copy'

/** Knob travel, in the pad's own 100-unit coordinate space. */
const TRAVEL = 30
/** Below this deflection nothing moves, so a resting hand does not drift. */
const DEAD_ZONE = 0.09
/** Poster px per frame at full deflection. */
const MAX_SPEED = 9
/**
 * Speed curve. Squaring the deflection means the first third of the throw is
 * a slow crawl — that is what lets one stick do both pixel nudges and fast
 * travel across the page.
 */
const CURVE = 2.2

interface JoystickProps {
  /** Called every frame while held, with a poster-space delta. */
  onNudge: (dx: number, dy: number) => void
  onStart: () => void
  onEnd: () => void
}

export function Joystick({ onNudge, onStart, onEnd }: JoystickProps) {
  const c = useCopy(COPY)
  const padRef = useRef<SVGSVGElement>(null)
  // Normalised deflection, -1..1 on each axis.
  const vector = useRef({ x: 0, y: 0 })
  const frame = useRef<number | null>(null)
  const nudgeRef = useRef(onNudge)
  nudgeRef.current = onNudge

  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [held, setHeld] = useState(false)
  // Held-ness drives a running animation frame, so the gesture logic reads a
  // ref, never the state. A release that lands before React commits would
  // otherwise bail out early and leave the stick pushing forever.
  const heldRef = useRef(false)

  useEffect(() => {
    // A pointer released outside the pad — or a window that loses focus
    // mid-push — must still stop the stick.
    const stop = () => releaseRef.current()
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  function readVector(e: React.PointerEvent) {
    const pad = padRef.current
    if (!pad) return { x: 0, y: 0 }
    const box = pad.getBoundingClientRect()
    // Half the box maps to full deflection.
    const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2)
    const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2)
    const magnitude = Math.hypot(dx, dy)
    if (magnitude <= 1) return { x: dx, y: dy }
    return { x: dx / magnitude, y: dy / magnitude }
  }

  function tick() {
    const { x, y } = vector.current
    const magnitude = Math.hypot(x, y)
    if (magnitude > DEAD_ZONE) {
      const throttle = (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE)
      const speed = MAX_SPEED * Math.pow(throttle, CURVE)
      nudgeRef.current((x / magnitude) * speed, (y / magnitude) * speed)
    }
    frame.current = requestAnimationFrame(tick)
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    vector.current = readVector(e)
    setKnob(vector.current)
    heldRef.current = true
    setHeld(true)
    onStart()
    if (frame.current === null) frame.current = requestAnimationFrame(tick)
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!heldRef.current) return
    vector.current = readVector(e)
    setKnob(vector.current)
  }

  function release() {
    if (!heldRef.current) return
    // Spring back to centre, the way a stick does when you let go.
    heldRef.current = false
    vector.current = { x: 0, y: 0 }
    setKnob({ x: 0, y: 0 })
    setHeld(false)
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    onEnd()
  }

  const releaseRef = useRef(release)
  releaseRef.current = release

  const ticks = Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2)

  return (
    <svg
      ref={padRef}
      className={`joystick${held ? ' is-held' : ''}`}
      viewBox="0 0 100 100"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      role="application"
      aria-label={c.objectPosition}
    >
      {ticks.map((a, i) => {
        const long = i % 6 === 0
        const inner = long ? 38 : 41
        return (
          <line
            key={i}
            x1={50 + Math.cos(a) * inner}
            y1={50 + Math.sin(a) * inner}
            x2={50 + Math.cos(a) * 45}
            y2={50 + Math.sin(a) * 45}
            className={long ? 'joystick-tick is-long' : 'joystick-tick'}
          />
        )
      })}

      <circle cx="50" cy="50" r="33" className="joystick-well" />
      <path d="M50 44v12M44 50h12" className="joystick-cross" />

      <circle
        cx={50 + knob.x * TRAVEL}
        cy={50 + knob.y * TRAVEL}
        r="11"
        className="joystick-knob"
      />
    </svg>
  )
}
