import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPath, nodeBounds, resolveStyle } from '../geometry/nodes'
import { polylineLength } from '../../../shared/geometry/polyline'
import { applyTransform, transformedOrigin } from '../../../shared/geometry/transform'
import type { Vec2 } from '../../../shared/geometry/vec'
import { coverRect } from '../../../shared/geometry/coverFit'
import { NEW_PATH_SMOOTHING, newPathText, useStore } from '../store'
import { bitmapFor, imageFileFrom, ImageImportError, importImageFile } from '../../../shared/media/images'
import type { PathObj, Transform } from '../types'
import { useCapRatio } from '../../../shared/media/metrics'
import { PathArtwork } from './PathArtwork'
import { useLangStore } from '../../../shared/i18n/lang'
import { siteWords } from '../../../shared/i18n/site'
import { COPY } from '../copy'

/** Read at the moment of the drop, not at the render that installed it. */
const words = () => COPY[useLangStore.getState().lang]

/** Field sampling step: coarse enough to keep the drag at 60fps, then fine. */
const DRAFT_CELL = 3
const FINAL_CELL = 0.9
/**
 * Playback rebuilds the contour every frame, so it gets the coarsest step.
 * Nobody inspects contour precision on a moving shape, and the fine pass
 * returns the moment it stops.
 */
const PLAY_CELL = 4

/** Largest time step a single animation frame may advance. */
const MAX_FRAME_MS = 100

/** Ignore pointer jitter below this, and discard accidental taps. */
const MIN_POINT_GAP = 1.5
const MIN_STROKE_LENGTH = 10

const MIN_SCALE = 0.05
const MAX_SCALE = 12

/**
 * Every drag is resolved against the state captured at pointerdown, never
 * against the last rendered value. React can batch several pointermoves into
 * one render, and an incremental delta would silently drop the ones in
 * between.
 */
type Drag =
  | { kind: 'draw' }
  | { kind: 'move'; pathId: string; startPointer: Vec2; startX: number; startY: number }
  | { kind: 'scale'; pathId: string; startDistance: number; startScale: number; origin: Vec2 }

export function Stage() {
  const doc = useStore((s) => s.doc)
  const tool = useStore((s) => s.tool)
  const selectedPathId = useStore((s) => s.selectedPathId)
  const interacting = useStore((s) => s.interacting)
  const addPath = useStore((s) => s.addPath)
  const selectPath = useStore((s) => s.selectPath)
  const updatePathTransform = useStore((s) => s.updatePathTransform)
  const setInteracting = useStore((s) => s.setInteracting)
  const pushHistory = useStore((s) => s.pushHistory)

  const playing = useStore((s) => s.playing)
  const timeMs = useStore((s) => s.timeMs)

  const capRatio = useCapRatio()
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const setDoc = useStore((s) => s.setDoc)

  // The work area is whatever the window gives us — there is no page inside
  // it to stay within, so the document simply is the view.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const measure = () => {
      const width = Math.max(1, Math.round(stage.clientWidth))
      const height = Math.max(1, Math.round(stage.clientHeight))
      const current = useStore.getState().doc
      if (current.width === width && current.height === height) return
      setDoc({ width, height })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [setDoc])
  const dragRef = useRef<Drag | null>(null)
  // The ref is the source of truth for the stroke; state only mirrors it so
  // the preview re-renders. Reading committed points from state would lose
  // whatever React has batched but not yet flushed.
  const pointsRef = useRef<Vec2[]>([])
  const [stroke, setStroke] = useState<Vec2[] | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const cell = playing ? PLAY_CELL : interacting || stroke ? DRAFT_CELL : FINAL_CELL

  // Playback clock. Reads the store directly each frame so a duration change
  // mid-run takes effect without restarting the loop.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let previous = performance.now()

    const step = (now: number) => {
      // Leaving the tab suspends animation frames entirely, so the first frame
      // back carries the whole absence. Clamping keeps the playhead from
      // teleporting to the end of the run.
      const delta = Math.min(MAX_FRAME_MS, now - previous)
      previous = now
      const state = useStore.getState()
      const total = state.doc.anim.durationMs
      const next = state.timeMs + delta

      if (next >= total) {
        if (state.doc.anim.loop) state.setTime(next % total)
        else {
          state.setTime(total)
          state.pause()
          return
        }
      } else {
        state.setTime(next)
      }
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  function toLocal(e: React.PointerEvent): Vec2 {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    // Capture keeps the gesture alive if the pointer leaves the poster; it is
    // an enhancement, so a device that refuses it should not break drawing.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    const point = toLocal(e)

    if (tool === 'brush') {
      dragRef.current = { kind: 'draw' }
      pointsRef.current = [point]
      setStroke(pointsRef.current.slice())
      return
    }

    const target = e.target as Element
    const path = doc.paths.find((p) => p.id === target.closest('[data-path-id]')?.getAttribute('data-path-id'))

    if (target.closest('[data-handle="scale"]') && selectedPathId) {
      const current = doc.paths.find((p) => p.id === selectedPathId)
      if (!current) return
      const origin = transformedOrigin(current.transform)
      pushHistory()
      setInteracting(true)
      dragRef.current = {
        kind: 'scale',
        pathId: current.id,
        origin,
        startScale: current.transform.scale,
        startDistance: Math.max(1, Math.hypot(point.x - origin.x, point.y - origin.y)),
      }
      return
    }

    if (path) {
      selectPath(path.id)
      pushHistory()
      setInteracting(true)
      dragRef.current = {
        kind: 'move',
        pathId: path.id,
        startPointer: point,
        startX: path.transform.x,
        startY: path.transform.y,
      }
      return
    }

    selectPath(null)
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const point = toLocal(e)

    if (drag.kind === 'draw') {
      const pts = pointsRef.current
      const last = pts[pts.length - 1]
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < MIN_POINT_GAP) return
      pts.push(point)
      setStroke(pts.slice())
      return
    }

    if (drag.kind === 'move') {
      // Translation is the outermost part of the transform, so a poster-space
      // delta goes straight in without any inverse mapping.
      updatePathTransform(drag.pathId, {
        x: drag.startX + (point.x - drag.startPointer.x),
        y: drag.startY + (point.y - drag.startPointer.y),
      })
      return
    }

    const distance = Math.hypot(point.x - drag.origin.x, point.y - drag.origin.y)
    const scale = (drag.startScale * distance) / drag.startDistance
    updatePathTransform(drag.pathId, {
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)),
    })
  }

  function onPointerUp(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    setInteracting(false)
    if (drag.kind !== 'draw') return

    const raw = pointsRef.current
    pointsRef.current = []
    setStroke(null)
    if (raw.length >= 2 && polylineLength(raw) >= MIN_STROKE_LENGTH) {
      addPath(raw)
    }
  }

  async function onDrop(e: React.DragEvent) {
    const file = imageFileFrom(e.dataTransfer)
    if (!file) return
    e.preventDefault()
    setDragOver(false)

    const state = useStore.getState()
    try {
      state.setImage(await importImageFile(file))
      state.setNotice(words().groundImageNamed(file.name))
    } catch (error) {
      state.setNotice(
        error instanceof ImageImportError ? error.message : siteWords().imgUnusable,
      )
    }
  }

  function onDragOver(e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.items).some((i) => i.kind === 'file')) return
    e.preventDefault()
    setDragOver(true)
  }

  // The in-progress stroke runs through the same pipeline as a committed one,
  // so shapes and letters appear as the line is drawn.
  const previewPath = useMemo<PathObj | null>(
    () =>
      stroke && stroke.length >= 2
        ? {
            id: '__preview',
            raw: stroke,
            smoothing: NEW_PATH_SMOOTHING,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, originX: 0, originY: 0 },
            text: newPathText(),
            style: {},
          }
        : null,
    [stroke],
  )

  const imageLayer = useMemo(() => {
    const image = doc.image
    if (!image) return null
    const href = bitmapFor(image.id)
    if (!href) return null
    return { href, dim: image.dim, rect: coverRect(doc, image) }
  }, [doc])

  const selected = doc.paths.find((p) => p.id === selectedPathId) ?? null
  const selectionBox = useMemo(() => {
    if (!selected || tool !== 'select') return null
    const style = resolveStyle(doc.defaults, selected.style)
    const bounds = nodeBounds(buildPath(selected, style).nodes, style.blend)
    if (!bounds) return null

    const t: Transform = selected.transform
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ].map((c) => applyTransform(t, c))

    return { corners, handle: corners[2] }
  }, [selected, tool, doc.defaults])

  const handleRadius = Math.max(doc.width, doc.height) * 0.011

  return (
    // The stage takes the poster's own ground, so the artboard has no visible
    // edge — the artwork simply sits on the page.
    <div
      ref={stageRef}
      className={`stage${dragOver ? ' is-drop' : ''}`}
      style={{ background: doc.background }}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <svg
        ref={svgRef}
        id="artwork"
        className={`artwork tool-${tool}`}
        xmlns="http://www.w3.org/2000/svg"
        width={doc.width}
        height={doc.height}
        viewBox={`0 0 ${doc.width} ${doc.height}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect x={0} y={0} width={doc.width} height={doc.height} fill={doc.background} />

        {/* The photo, and a wash of the ground colour over it. Both sit under
            the artwork, and both are plain SVG — so export carries them with
            no special handling. */}
        {imageLayer && (
          <>
            <image
              href={imageLayer.href}
              x={imageLayer.rect.x}
              y={imageLayer.rect.y}
              width={imageLayer.rect.width}
              height={imageLayer.rect.height}
              preserveAspectRatio="none"
            />
            {imageLayer.dim > 0 && (
              <rect
                x={0}
                y={0}
                width={doc.width}
                height={doc.height}
                fill={doc.background}
                opacity={imageLayer.dim}
              />
            )}
          </>
        )}

        {doc.paths.map((path) => (
          <PathArtwork
            key={path.id}
            path={path}
            defaults={doc.defaults}
            capRatio={capRatio}
            cell={cell}
            anim={doc.anim}
            timeMs={timeMs}
            playing={playing}
          />
        ))}

        {previewPath && (
          <PathArtwork
            path={previewPath}
            defaults={doc.defaults}
            capRatio={capRatio}
            cell={DRAFT_CELL}
            anim={doc.anim}
            timeMs={doc.anim.durationMs}
            playing={false}
          />
        )}

        {selectionBox && (
          <g data-ui="1">
            <polygon
              points={selectionBox.corners.map((c) => `${c.x},${c.y}`).join(' ')}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="6 4"
              opacity={0.85}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <circle
              data-handle="scale"
              cx={selectionBox.handle.x}
              cy={selectionBox.handle.y}
              r={handleRadius}
              fill="var(--accent)"
              stroke="var(--paper)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              className="scale-handle"
            />
          </g>
        )}
      </svg>
    </div>
  )
}
