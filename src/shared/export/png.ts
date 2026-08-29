import { buildSvgString, type ExportOptions } from './svg'
import { saveBlob } from './download'

/**
 * The artwork as pixels.
 *
 * Rasterised from the same string the SVG export writes, rather than from a
 * second drawing of the document — the picture and the two files it can leave as
 * come from one place, which is the rule the whole site is built on. A vector
 * tool handing over a PNG is not a contradiction: a designer needs the thing in a
 * slide, a mail, a moodboard, and re-rendering an SVG somewhere else to get there
 * is the step this removes.
 *
 * **It goes out big.** The document is measured in screen pixels — the artwork is
 * fitted to the window — so exporting at that size would hand over an image whose
 * resolution is an accident of how wide the browser happened to be. A fixed long
 * side is the same decision the model export makes when it fixes 200mm.
 */

/** Pixels on the finished image's long side. */
export const PNG_LONG_SIDE = 2400

/**
 * Ceiling on the enlargement. A small window would otherwise ask for a tenfold
 * blow-up, and past a point the extra pixels are only the same edges again.
 */
const MAX_SCALE = 4

/**
 * How much to enlarge a drawing of this size, so that a canvas and an SVG asked
 * for the same picture come back the same size.
 */
export function pngScale(width: number, height: number, longSide = PNG_LONG_SIDE): number {
  return Math.min(MAX_SCALE, Math.max(1, longSide / Math.max(1, Math.max(width, height))))
}

export interface PngOptions extends ExportOptions {
  longSide?: number
}

export async function buildPngBlob({ longSide = PNG_LONG_SIDE, ...options }: PngOptions): Promise<Blob> {
  const source = document.getElementById('artwork') as SVGSVGElement | null
  if (!source) throw new Error('No canvas to export')

  const box = source.viewBox.baseVal
  const width = box?.width || source.clientWidth
  const height = box?.height || source.clientHeight
  if (!(width > 0 && height > 0)) throw new Error('The canvas has no size')

  const svg = await buildSvgString(options)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = new Image()
    await new Promise<void>((done, fail) => {
      image.onload = () => done()
      image.onerror = () => fail(new Error('The drawing could not be rasterised'))
      image.src = url
    })

    const scale = pngScale(width, height, longSide)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No 2D context')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((done, fail) => {
      canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('The image could not be encoded'))), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportPng(options: PngOptions): Promise<void> {
  saveBlob(await buildPngBlob(options), options.filename)
}
