import type { Rect } from './vec'

export interface CoverInput {
  naturalWidth: number
  naturalHeight: number
  /** Multiplier on top of "just covers". 1 = exactly cover. */
  scale: number
  /** Offset from centred, in view px. */
  x: number
  y: number
}

/**
 * Place an image so that scale 1 exactly covers the view, then apply the
 * designer's scale and offset on top.
 *
 * The rect is computed rather than left to `preserveAspectRatio`, because a
 * browser-fitted image gives no honest coordinates to offset from — nudging it
 * would move by an amount that depends on the crop.
 */
export function coverRect(view: { width: number; height: number }, image: CoverInput): Rect {
  const natW = Math.max(1, image.naturalWidth)
  const natH = Math.max(1, image.naturalHeight)
  const cover = Math.max(view.width / natW, view.height / natH) * Math.max(0.01, image.scale)

  const width = natW * cover
  const height = natH * cover

  return {
    x: (view.width - width) / 2 + image.x,
    y: (view.height - height) / 2 + image.y,
    width,
    height,
  }
}
