import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import modelUrl from '../models/hand_landmarker.task?url'
import { coverRect } from '../../../shared/geometry/coverFit'
import { registerBitmap } from '../../../shared/media/images'
import type { Frame } from '../types'
import { gripOf, readHand, smoothReading, type Grip, type HandReading } from './landmarks'
import { useLangStore } from '../../../shared/i18n/lang'
import { COPY } from '../copy'

/**
 * The half that talks to hardware: a camera, a wasm runtime, and a loop.
 *
 * Everything it works out is worked out in `landmarks.ts`, which knows nothing
 * about any of that. This file's whole job is to get points into stage
 * coordinates and hand them over.
 *
 * **Nothing here is fetched until a camera is switched on.** The tool's own chunk
 * is already split off in `index.ts` — that is the three.js lesson from tool 03 —
 * and this is a second split inside it, because the runtime and the model
 * together are twenty megabytes and a designer setting a plate on paper never
 * needs a byte of them.
 */

/**
 * Where the runtime's `.js`/`.wasm` pair is served from.
 *
 * `public/`, not a `?url` import, and not by choice: the loader builds the
 * `.wasm` path out of its own `.js` path by string surgery, so a content hash on
 * either one breaks it. `BASE_URL` keeps it working from a subdirectory. The
 * model has no such constraint and so lives with the tool — the whole
 * arrangement, and its licence, is written up in `../models/NOTICE.md`.
 */
const VISION_ROOT = `${import.meta.env.BASE_URL}vision`

/** Longest edge a captured frame keeps. A JPEG this size is a few hundred KB,
 *  and it goes into a registry nothing can be removed from. */
const CAPTURE_EDGE = 1600
const CAPTURE_QUALITY = 0.92

/** How many frames a hand may go missing before the plate lets go of it. */
const GRACE = 12

let landmarker: HandLandmarker | null = null
let loading: Promise<HandLandmarker> | null = null

/**
 * The model, loaded once per tab.
 *
 * Kept at module scope rather than in the hook so that stopping and starting the
 * camera does not fetch twenty megabytes again. `loading` is the guard for two
 * starts landing in the same tick, which is exactly what a double-click on the
 * camera button does.
 */
async function landmarkerFor(): Promise<HandLandmarker> {
  if (landmarker) return landmarker
  if (loading) return loading

  loading = (async () => {
    // The type import above is erased, so this is the only reference that
    // pulls the runtime — and it is behind a button. `modelUrl` is a string in
    // this chunk; the 7.8MB behind it is not fetched until the line below.
    const vision = await import('@mediapipe/tasks-vision')
    const fileset = await vision.FilesetResolver.forVisionTasks(VISION_ROOT)
    landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
      runningMode: 'VIDEO',
      // One hand. Two plates fighting over one document is not a feature, and
      // the second hand costs a whole inference pass.
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    /*
     * One inference on a blank frame before anyone is watching.
     *
     * Measured: the **first** call costs a hundred times the ones after it —
     * seconds, on a machine without GPU acceleration — because that is when the
     * graph's shaders get built. It also blocks the main thread, so paying it on
     * the first live frame means the tool appears to hang the moment the feed
     * appears. Paid here it lands inside "starting the camera", which is a state
     * the stage is already explaining.
     */
    const warm = document.createElement('canvas')
    warm.width = 256
    warm.height = 256
    try {
      // Timestamp zero, so the real loop's `performance.now()` is always later —
      // the task rejects a frame stamped before one it has already seen.
      landmarker.detectForVideo(warm, 0)
    } catch {
      // A refused warm-up is not a reason to refuse the camera.
    }

    return landmarker
  })()

  try {
    return await loading
  } finally {
    loading = null
  }
}

/*
 * The loader, reachable from the console in development.
 *
 * Same idea as the store hooks in the other tools, and needed more here: a
 * headless browser has no camera, so there is otherwise no way to prove the wasm
 * runtime and the model actually load and answer — the one part of this tool that
 * cannot be unit tested. `await window.__magicHand()` builds the landmarker; the
 * result will run `detect` on any canvas.
 *
 * The window guard is not decoration. A Node test importing anything that reaches
 * this module dies on `window` before a single assertion runs.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __magicHand?: typeof landmarkerFor }).__magicHand = landmarkerFor
}

export type CameraState = 'off' | 'starting' | 'live' | 'error'

export interface Camera {
  state: CameraState
  /** English, like everything else on screen. */
  error: string | null
  videoRef: RefObject<HTMLVideoElement | null>
  /** The latest smoothed reading, or null when no hand is in frame. */
  reading: HandReading | null
  grip: Grip
  start: () => void
  stop: () => void
  /** Freeze what the lens is seeing. Null if the video has no frame yet. */
  capture: () => Frame | null
}

/**
 * Run the camera and read the hand in it.
 *
 * `view` and `mirror` are handed in on every render and kept in a ref, because
 * the loop must never read React state — a frame callback holding a stale closure
 * maps points through a window size that is two resizes old, and the plate lands
 * somewhere the hand is not. Same rule as every gesture in this repository.
 */
export function useCamera(view: { width: number; height: number }, mirror: boolean): Camera {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const stampRef = useRef(-1)
  const smoothRef = useRef<HandReading | null>(null)
  const missRef = useRef(0)
  const gripRef = useRef<Grip>('fist')
  const runningRef = useRef(false)

  const liveRef = useRef({ view, mirror })
  liveRef.current = { view, mirror }

  const [state, setState] = useState<CameraState>('off')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<HandReading | null>(null)
  const [grip, setGrip] = useState<Grip>('fist')

  const teardown = useCallback(() => {
    runningRef.current = false
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    // The light on the camera goes out. Keeping the stream would make resuming
    // instant, and would leave a lens open on a page that is not looking.
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    stampRef.current = -1
    smoothRef.current = null
    missRef.current = 0
    setReading(null)
  }, [])

  const stop = useCallback(() => {
    teardown()
    setState('off')
  }, [teardown])

  const start = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    setError(null)
    setState('starting')
    ;(async () => {
      try {
        const model = await landmarkerFor()
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        })
        // Stopping while the permission dialog was open: honour that rather
        // than switching a camera on behind the designer's back.
        if (!runningRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream

        const video = videoRef.current
        if (!video) throw new Error(words().camNotReady)
        video.srcObject = stream
        await video.play()
        setState('live')

        const step = () => {
          if (!runningRef.current) return
          frameRef.current = requestAnimationFrame(step)

          const element = videoRef.current
          if (!element || element.readyState < 2 || !element.videoWidth) return
          // One inference per decoded frame. The loop runs at the display's
          // rate, which is usually faster than the camera's; asking the model
          // about a frame it has already answered for is pure heat.
          if (element.currentTime === stampRef.current) return
          stampRef.current = element.currentTime

          const result = model.detectForVideo(element, performance.now())
          const points = result.landmarks[0]
          if (!points) {
            // A hand does not vanish because one frame missed it. Letting go
            // immediately makes the plate blink at the edge of detection.
            if (++missRef.current > GRACE) {
              smoothRef.current = null
              setReading(null)
            }
            return
          }
          missRef.current = 0

          const { view: box, mirror: flipped } = liveRef.current
          const rect = coverRect(box, {
            naturalWidth: element.videoWidth,
            naturalHeight: element.videoHeight,
            scale: 1,
            x: 0,
            y: 0,
          })
          const screen = points.map((point) => {
            const x = rect.x + point.x * rect.width
            // The feed is mirrored by a CSS flip about the view's middle, so
            // the points have to be flipped about the same line — otherwise the
            // plate goes left when the hand on screen goes right.
            return { x: flipped ? box.width - x : x, y: rect.y + point.y * rect.height }
          })

          const raw = readHand(screen, result.worldLandmarks[0])
          if (!raw) return
          smoothRef.current = smoothReading(smoothRef.current, raw)
          setReading(smoothRef.current)
          gripRef.current = gripOf(smoothRef.current.openness, gripRef.current)
          setGrip(gripRef.current)
        }
        step()
      } catch (e) {
        teardown()
        setState('error')
        setError(cameraMessage(e))
      }
    })()
  }, [teardown])

  // A tool left by the back button must not keep a camera open.
  useEffect(() => teardown, [teardown])

  const capture = useCallback((): Frame | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null

    const shrink = Math.min(1, CAPTURE_EDGE / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * shrink)
    canvas.height = Math.round(video.videoHeight * shrink)
    const context = canvas.getContext('2d')
    if (!context) return null

    // Flipped here, not at display time, so the file is the thing that was on
    // screen. A frame that has to be un-mirrored by whoever opens the SVG is a
    // frame that does not match its own plate.
    if (liveRef.current.mirror) {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    return {
      id: registerBitmap(canvas.toDataURL('image/jpeg', CAPTURE_QUALITY)),
      width: canvas.width,
      height: canvas.height,
    }
  }, [])

  return { state, error, videoRef, reading, grip, start, stop, capture }
}

/**
 * The copy, read at the moment something goes wrong.
 *
 * Not `useCopy`: none of this runs inside a render. The store's getter is the
 * same rule the audio scheduler follows in tool 05 — read the live value, never
 * a value React handed you a render ago.
 */
const words = () => COPY[useLangStore.getState().lang]

/** What went wrong, in the words a designer can act on. */
function cameraMessage(e: unknown): string {
  const c = words()
  const name = e instanceof Error ? e.name : ''
  if (name === 'NotAllowedError') return c.camRefused
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return c.camNotFound
  if (name === 'NotReadableError') return c.camBusy
  if (e instanceof Error && e.message) return e.message
  return c.camFailed
}
