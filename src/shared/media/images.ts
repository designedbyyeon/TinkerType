import { siteWords } from '../i18n/site'

/**
 * A background photograph. The pixels live outside the document — see
 * `store/images.ts` — because the undo stack snapshots the whole document and
 * a data URI would put megabytes into every step.
 */
export interface DocImage {
  /** Key into the bitmap registry. */
  id: string
  naturalWidth: number
  naturalHeight: number
  /** 1 = exactly covers the view. */
  scale: number
  x: number
  y: number
  /** 0..1 wash of the ground colour over the photo, for legibility. */
  dim: number
  /** Shown in the panel so you know which file is loaded. */
  name: string
}


/**
 * Bitmaps live here rather than in the document.
 *
 * The undo stack snapshots the document with `structuredClone`, so a data URI
 * on the document would be copied into every history step — sixty steps of a
 * 2MB photo is 120MB. The document carries an id; the pixels stay in this
 * session-lived registry, and the rendered SVG carries the real href, which is
 * what export clones.
 */
const bitmaps = new Map<string, string>()

let counter = 0

export function bitmapFor(id: string): string | undefined {
  return bitmaps.get(id)
}

/**
 * Put a bitmap in the registry that did not come from a file.
 *
 * Tool 04's frames come off a camera, so they never pass through the importer —
 * but they belong in the same registry for the same reason, and the renderer and
 * the export already know how to find an id here.
 */
export function registerBitmap(href: string): string {
  const id = `img-${++counter}`
  bitmaps.set(id, href)
  return id
}

/*
 * There is no way to drop one. The undo stack holds documents, and a document
 * holds an id — so an entry that looks superseded is still the one an undo would
 * reach for. Which is why the camera caps what it puts in here (see tool 04's
 * `capture`) rather than tidying up after itself.
 */

/** Longest edge an imported image is allowed to keep. */
const MAX_EDGE = 2000
const JPEG_QUALITY = 0.9


export class ImageImportError extends Error {}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new ImageImportError(siteWords().imgUnreadable))
    reader.readAsDataURL(file)
  })
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImageImportError(siteWords().imgUnopenable))
    img.src = src
  })
}

/**
 * Resample down to MAX_EDGE and re-encode.
 *
 * Without this the data URI is the original file, and since export embeds the
 * SVG's own href, a 12MP photo would become a 12MP export.
 */
function shrink(img: HTMLImageElement, keepAlpha: boolean): { href: string; width: number; height: number } | null {
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  if (longest <= MAX_EDGE) return null

  const k = MAX_EDGE / longest
  const width = Math.round(img.naturalWidth * k)
  const height = Math.round(img.naturalHeight * k)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  context.imageSmoothingQuality = 'high'
  context.drawImage(img, 0, 0, width, height)

  const href = keepAlpha
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', JPEG_QUALITY)

  return { href, width, height }
}

/** Turn a dropped or pasted file into a document-ready background image. */
export async function importImageFile(file: File): Promise<DocImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageImportError(siteWords().imgNotAnImage)
  }
  if (file.type === 'image/svg+xml') {
    throw new ImageImportError(siteWords().imgSvgInstead)
  }

  const original = await readAsDataUrl(file)
  const element = await load(original)

  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp'
  const reduced = shrink(element, keepAlpha)

  return {
    id: registerBitmap(reduced?.href ?? original),
    naturalWidth: reduced?.width ?? element.naturalWidth,
    naturalHeight: reduced?.height ?? element.naturalHeight,
    scale: 1,
    x: 0,
    y: 0,
    dim: 0,
    name: file.name || 'image',
  }
}

/** First image file in a drop or paste, if there is one. */
export function imageFileFrom(data: DataTransfer | null): File | null {
  if (!data) return null
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') return file
  }
  return null
}
