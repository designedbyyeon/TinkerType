/**
 * The live solid view, for whoever needs to photograph it.
 *
 * The rail asks for a PNG and the renderer is on the stage, so something has to
 * introduce them. This is that something, and it is deliberately the smallest
 * thing that works: one function, registered by the view while it is mounted.
 *
 * **It holds a closure, not the renderer.** Nothing here imports three, so the
 * panel — which is in the index chunk — can call it without dragging a renderer
 * onto the front page. And a photograph of the view is the one thing that cannot
 * be rebuilt from the document the way the model file is: the angle is the
 * person's, not the document's.
 */
export type LiveCapture = (longSide: number, background: string) => Promise<Blob>

let capture: LiveCapture | null = null

export function setLiveCapture(fn: LiveCapture | null): void {
  capture = fn
}

/** Null when the solid view is not on screen — the flat form has its own path. */
export function captureLive(longSide: number, background: string): Promise<Blob> | null {
  return capture ? capture(longSide, background) : null
}
