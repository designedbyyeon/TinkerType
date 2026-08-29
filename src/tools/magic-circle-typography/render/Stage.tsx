import { useEffect, useMemo, useRef } from 'react'
import { coverRect } from '../../../shared/geometry/coverFit'
import { bitmapFor } from '../../../shared/media/images'
import { useFace } from '../../../shared/media/type/store'
import { missingFrom } from '../../../shared/media/type/measure'
import { isTyping } from '../../../shared/ui/typing'
import { CameraIcon, ShutterIcon, StopIcon } from '../icons'
import { handPatch } from '../hand/drive'
import { useCamera } from '../hand/tracker'
import { sigilFor, type MagicDoc } from '../types'
import { useStore } from '../store'
import { useCopy } from '../../../shared/i18n/lang'
import { COPY } from '../copy'
import { SigilArt } from './SigilArt'

/**
 * The work area: a lens, a frozen frame, or bare ground — and the plate on top.
 *
 * The live feed is a real `<video>` behind a transparent SVG rather than frames
 * pushed through a canvas, because the alternative is a `toDataURL` per frame and
 * the whole reason the plate can follow a hand is that nothing per-frame is
 * expensive. It also keeps the artwork SVG exactly what gets exported — the
 * video is not in it. The shutter is what puts a picture *into* the document, as
 * an `<image>` whose pixels sit behind an id.
 */

export function Stage() {
  const doc = useStore((s) => s.doc)
  const setDoc = useStore((s) => s.setDoc)
  const pushHistory = useStore((s) => s.pushHistory)
  const setCameraLive = useStore((s) => s.setCameraLive)
  const interacting = useStore((s) => s.interacting)
  const stageRef = useRef<HTMLDivElement>(null)
  const c = useCopy(COPY)

  const { face, loading, error: faceError } = useFace(doc.face)
  const view = useMemo(() => ({ width: doc.width, height: doc.height }), [doc.width, doc.height])
  const camera = useCamera(view, doc.mirror)
  const live = camera.state === 'live'

  // The work area is whatever the window gives us. There is no page edge.
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

  // The panel needs to know the lens is open — see the note on `cameraLive`.
  useEffect(() => setCameraLive(live), [live, setCameraLive])

  /*
   * What the hand is doing to the document, right now.
   *
   * Kept in a ref as well as applied, and the ref is what gets drawn — for two
   * reasons. A hand that leaves the frame should leave the plate where it put it,
   * not drop it back to whatever the document last said, because hands leave
   * frames constantly and that would be a jump every time. And while a control is
   * being dragged the plate holds still, so tuning the gutter does not become a
   * game of chasing it.
   */
  const patchRef = useRef<Partial<MagicDoc>>({})
  if (live && camera.reading && !interacting) {
    patchRef.current = handPatch(camera.reading, view, doc)
  }
  const shown = live ? { ...doc, ...patchRef.current } : doc

  const capture = () => {
    const frame = camera.capture()
    pushHistory()
    // The frame and the hand's numbers are frozen together. Freezing one without
    // the other would land the plate somewhere the photograph does not show it.
    setDoc({ ...patchRef.current, ...(frame ? { photo: frame } : {}) })
    camera.stop()
  }

  /*
   * The shutter on the space bar, because that is where a shutter is.
   *
   * Through a ref rather than by re-binding the listener: this component renders
   * on every frame the camera delivers, and adding and removing a window
   * listener thirty times a second to keep a closure fresh is the wrong way to
   * keep it fresh.
   */
  const shutterRef = useRef<(() => void) | null>(null)
  shutterRef.current = live ? capture : null
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || isTyping(e.target)) return
      const fire = shutterRef.current
      if (!fire) return
      e.preventDefault()
      fire()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const frame = live ? null : doc.photo
  const frameRect = frame
    ? coverRect(view, {
        naturalWidth: frame.width,
        naturalHeight: frame.height,
        scale: 1,
        x: 0,
        y: 0,
      })
    : null

  /*
   * Built once, here, and handed down. The plate is wanted twice over — drawn,
   * and asked whether every line fitted — and laying it out twice per frame for
   * the second answer would be work for nothing.
   *
   * Not memoised, deliberately. While a hand drives it `shown` is a new object
   * on every frame, so a cache keyed on it could never hit; and the layout is a
   * few hundred operations against outlines that are the real cost.
   */
  const sigil = sigilFor(shown)
  const missing = face ? missingFrom(face, doc.text) : []
  const status =
    camera.error ??
    faceError ??
    (loading
      ? c.loading
      : camera.state === 'starting'
        ? c.startingCamera
        : missing.length > 0
          ? c.missing(missing.join(' '))
          : sigil.dropped > 0
            ? c.noRoom(sigil.dropped)
            : null)

  return (
    <div ref={stageRef} className="stage magic-stage" style={{ background: doc.background }}>
      <video
        ref={camera.videoRef}
        className={`magic-feed${doc.mirror ? ' is-mirrored' : ''}`}
        playsInline
        muted
        autoPlay
        style={{ display: live ? 'block' : 'none' }}
      />

      <svg
        id="artwork"
        className="artwork"
        xmlns="http://www.w3.org/2000/svg"
        width={doc.width}
        height={doc.height}
        viewBox={`0 0 ${doc.width} ${doc.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* No ground while the lens is open — the video is behind this. Which is
            also why the shutter has to fire before an export: the ground and a
            photograph are the two things that can stand in for the feed, and
            neither is here until it does. */}
        {!live && <rect x={0} y={0} width={doc.width} height={doc.height} fill={doc.background} />}

        {frame && frameRect && (
          <>
            <image
              href={bitmapFor(frame.id)}
              x={frameRect.x}
              y={frameRect.y}
              width={frameRect.width}
              height={frameRect.height}
            />
            {doc.dim > 0 && (
              <rect
                x={0}
                y={0}
                width={doc.width}
                height={doc.height}
                fill={doc.background}
                opacity={doc.dim}
              />
            )}
          </>
        )}

        {face && sigil.bands.length > 0 && <SigilArt doc={shown} sigil={sigil} face={face} />}

        {live && camera.reading && (
          // The read-out on the artwork itself: where the palm was found, and how
          // long it measured — which is the unit Reach multiplies.
          //
          // `data-ui`, so the export sheds it — which is also why `var(--accent)`
          // is allowed here. Artwork colours have to be literals because a
          // variable resolves to nothing once the file is opened elsewhere; this
          // group never reaches a file, so it can wear the interface's own accent.
          <g data-ui fill="none" stroke="var(--accent)" strokeWidth={1}>
            <circle cx={camera.reading.palm.x} cy={camera.reading.palm.y} r={4.5} />
            <circle
              cx={camera.reading.palm.x}
              cy={camera.reading.palm.y}
              r={camera.reading.span}
              strokeDasharray="3 4"
            />
            <path
              d={crosshair(camera.reading.palm.x, camera.reading.palm.y)}
            />
          </g>
        )}
      </svg>

      {/* The instrument's own controls, where the eyes already are. The camera is
          switched on from the stage rather than from the foot of the rail,
          because an empty stage is the thing that has to say what to do. */}
      <div className="stage-deck" data-ui>
        {live ? (
          <>
            <button type="button" className="magic-shutter" onClick={capture}>
              <ShutterIcon />
              <span>{c.capture}</span>
              <em>SPACE</em>
            </button>
            <button type="button" className="stage-chip" onClick={camera.stop}>
              <StopIcon />
              <span>{c.stop}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="stage-chip is-primary"
              disabled={camera.state === 'starting'}
              onClick={camera.start}
            >
              <CameraIcon />
              <span>
                {camera.state === 'starting'
                  ? c.starting
                  : doc.photo
                    ? c.cameraAgain
                    : c.turnOnCamera}
              </span>
            </button>
            {/* A way out of the wait. On a first visit this is twenty megabytes
                over whatever line the designer is on, and a start with no cancel
                is a tool that has taken the window hostage. */}
            {camera.state === 'starting' && (
              <button type="button" className="stage-chip" onClick={camera.stop}>
                <StopIcon />
                <span>{c.cancel}</span>
              </button>
            )}
          </>
        )}
      </div>

      {live && (
        <div className="magic-hud" data-ui>
          <span className={`magic-grip is-${camera.reading ? camera.grip : 'none'}`}>
            {camera.reading ? c.grip[camera.grip] : c.noHand}
          </span>
          <span className="magic-meter" aria-hidden>
            <span style={{ width: `${Math.round(shown.bloom * 100)}%` }} />
          </span>
          <span className="magic-figure">{Math.round(shown.bloom * 100)}%</span>
          <span className="magic-figure">R {Math.round(shown.radius)}</span>
        </div>
      )}

      {!live && camera.state !== 'starting' && !doc.photo && (
        <p className="magic-cue" data-ui>
          {c.cue}
        </p>
      )}

      {status && <p className="stage-status">{status}</p>}
    </div>
  )
}

/** Four ticks around a point, with the point itself left clear. */
function crosshair(x: number, y: number): string {
  return `M${x - 13} ${y}h9M${x + 4} ${y}h9M${x} ${y - 13}v9M${x} ${y + 4}v9`
}
