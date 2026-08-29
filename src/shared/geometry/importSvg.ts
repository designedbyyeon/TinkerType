import { polylineLength } from './polyline'
import type { Vec2 } from './vec'
import { siteWords } from '../i18n/site'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Arc-length step when sampling, px in the source's own units. */
const SAMPLE_STEP = 2
const MAX_POINTS_PER_PIECE = 3000
const MAX_PIECES = 400
/** Shorter than this and it is a stray anchor, not a stroke. */
const MIN_PIECE_LENGTH = 10
/** How much of the poster the imported artwork fills. */
const FIT_FRACTION = 0.78

const GEOMETRY = 'path, line, polyline, polygon, circle, ellipse, rect'

export class SvgImportError extends Error {}

/**
 * Split a `d` attribute at each moveto so separate strokes stay separate.
 *
 * Without this, `getPointAtLength` walks a multi-subpath outline as one
 * continuous run and the sampled polyline jumps in a straight line from the
 * end of one stroke to the start of the next.
 */
export function splitSubpaths(d: string): string[] {
  const pieces: string[] = []
  const re = /[Mm][^Mm]*/g
  let match: RegExpExecArray | null
  while ((match = re.exec(d)) !== null) {
    const piece = match[0].trim()
    if (piece.length > 1) pieces.push(piece)
  }
  // A relative `m` after the first subpath continues from where the previous
  // one ended, so treating them independently would misplace it. Absolute-only
  // splitting is the safe subset; anything else stays whole.
  if (pieces.length > 1 && /[m]/.test(d.slice(1))) {
    const allAbsolute = pieces.every((p) => p[0] === 'M')
    if (!allAbsolute) return [d]
  }
  return pieces.length > 0 ? pieces : [d]
}

/** A hidden but laid-out host — getScreenCTM needs the element rendered. */
function createHost(): SVGSVGElement {
  const host = document.createElementNS(SVG_NS, 'svg')
  host.setAttribute('width', '0')
  host.setAttribute('height', '0')
  host.style.position = 'absolute'
  host.style.left = '-10000px'
  host.style.visibility = 'hidden'
  document.body.appendChild(host)
  return host
}

function samplePiece(el: SVGGeometryElement, toRoot: DOMMatrix): Vec2[] {
  let total = 0
  try {
    total = el.getTotalLength()
  } catch {
    return []
  }
  if (!Number.isFinite(total) || total <= 0) return []

  const steps = Math.min(MAX_POINTS_PER_PIECE, Math.max(2, Math.ceil(total / SAMPLE_STEP)))
  const out: Vec2[] = []
  for (let i = 0; i <= steps; i++) {
    const p = el.getPointAtLength((i / steps) * total)
    const t = new DOMPoint(p.x, p.y).matrixTransform(toRoot)
    out.push({ x: t.x, y: t.y })
  }
  return out
}

/**
 * Parse an SVG document and return its geometry as polylines in poster space.
 *
 * Rather than implementing a path parser, every shape is handed to the
 * browser's own `getPointAtLength`, which covers path/line/polyline/polygon/
 * circle/ellipse/rect identically. Transforms come from comparing each
 * element's screen matrix with the root's, so nested groups and the source's
 * own viewBox are both accounted for.
 */
export function parseSvgToPolylines(source: string, canvas: { width: number; height: number }): Vec2[][] {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new SvgImportError(siteWords().svgUnreadable)

  const root = doc.documentElement
  if (root.localName !== 'svg') throw new SvgImportError(siteWords().svgNotAnSvg)

  const host = createHost()
  try {
    host.appendChild(doc.importNode(root, true))
    const hostMatrix = host.getScreenCTM()
    if (!hostMatrix) throw new SvgImportError(siteWords().svgUnmeasurable)
    const fromScreen = hostMatrix.inverse()

    const pieces: Vec2[][] = []

    for (const el of Array.from(host.querySelectorAll<SVGGeometryElement>(GEOMETRY))) {
      if (pieces.length >= MAX_PIECES) break

      const screen = el.getScreenCTM()
      if (!screen) continue
      const toRoot = fromScreen.multiply(screen)

      if (el.localName === 'path') {
        const d = el.getAttribute('d') ?? ''
        for (const sub of splitSubpaths(d)) {
          const temp = document.createElementNS(SVG_NS, 'path')
          temp.setAttribute('d', sub)
          el.parentNode?.appendChild(temp)
          pieces.push(samplePiece(temp, toRoot))
          temp.remove()
          if (pieces.length >= MAX_PIECES) break
        }
      } else {
        pieces.push(samplePiece(el, toRoot))
      }
    }

    const kept = pieces.filter((p) => p.length >= 2 && polylineLength(p) >= MIN_PIECE_LENGTH)
    if (kept.length === 0) throw new SvgImportError(siteWords().svgNoOutlines)

    return fitToCanvas(kept, canvas)
  } finally {
    host.remove()
  }
}

/** Uniformly scale and centre the whole import inside the poster. */
export function fitToCanvas(pieces: Vec2[][], canvas: { width: number; height: number }): Vec2[][] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const piece of pieces) {
    for (const p of piece) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }

  const width = Math.max(1e-6, maxX - minX)
  const height = Math.max(1e-6, maxY - minY)
  const scale = Math.min(
    (canvas.width * FIT_FRACTION) / width,
    (canvas.height * FIT_FRACTION) / height,
  )

  const offsetX = canvas.width / 2 - ((minX + maxX) / 2) * scale
  const offsetY = canvas.height / 2 - ((minY + maxY) / 2) * scale

  return pieces.map((piece) =>
    piece.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY })),
  )
}

/** Pull SVG markup out of a paste, from either the text or the svg flavour. */
export function svgFromClipboard(data: DataTransfer | null): string | null {
  if (!data) return null
  const candidates = [data.getData('image/svg+xml'), data.getData('text/plain')]
  for (const raw of candidates) {
    const text = raw?.trim()
    if (text && text.includes('<svg')) return text
  }
  return null
}
