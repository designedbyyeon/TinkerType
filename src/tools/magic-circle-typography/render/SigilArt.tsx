import { useMemo } from 'react'
import type { Vec2 } from '../../../shared/geometry/vec'
import { applyAxes, outlineData, type Face } from '../../../shared/media/type/measure'
import { arcRun, matrixAttr, outlineOf } from '../geometry/ring'
import type { Sigil } from '../geometry/sigil'
import type { MagicDoc } from '../types'

/**
 * The plate, drawn.
 *
 * Every mark is a real path — the letters are outlines, the star is a closed
 * subpath per cycle, the ticks are one path of many subpaths. Nothing is a
 * filter and nothing is live text, so what a designer opens in Illustrator is
 * what they were looking at, with points on it.
 *
 * The one place presentation goes past geometry is how a course arrives: circles
 * and the star are **drawn on** with a dash offset rather than faded up, which is
 * what makes a settling plate read as being inscribed. The attributes are
 * dropped the moment a course is complete, so a finished file carries none of the
 * machinery that got it there.
 */

export interface SigilArtProps {
  doc: MagicDoc
  /** Laid out by the stage, which also needs to read what did not fit. */
  sigil: Sigil
  face: Face
}

const round = (n: number) => Math.round(n * 100) / 100

const polygonData = (points: Vec2[]): string =>
  `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join('')}Z`

const segmentsData = (segments: { a: Vec2; b: Vec2 }[]): string =>
  segments
    .map((s) => `M${round(s.a.x)} ${round(s.a.y)}L${round(s.b.x)} ${round(s.b.y)}`)
    .join('')

function perimeter(points: Vec2[]): number {
  let total = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

/** Dash attributes that draw a path on, or nothing at all once it is on. */
function drawOn(length: number, reveal: number) {
  if (reveal >= 1 || length <= 0) return undefined
  return { strokeDasharray: round(length), strokeDashoffset: round(length * (1 - reveal)) }
}

export function SigilArt({ doc, sigil, face }: SigilArtProps) {
  /*
   * Setting the axes and pulling the outlines, in one memo.
   *
   * Not a tidiness preference — `measure.ts` spells out why. `variation.set`
   * moves the parsed font, which is shared, so anything that measures or draws
   * has to do it immediately after setting the axes. Split across two hooks the
   * last one to run wins and the other is describing a font that no longer
   * exists.
   */
  const bands = useMemo(() => {
    const unit = applyAxes(face, { wght: doc.wght, wdth: 100 })
    const key = `${face.id}|${doc.wght}`
    const get = (char: string) => outlineOf(face, key, char)

    return sigil.bands.map((band) =>
      arcRun(band.text, get, {
        radius: band.radius,
        // The em size that draws a cap of this band's own size on *this* face at
        // *this* weight. Per band, not per document: the taper gives each line
        // inward a smaller cap, and the layout already reserved room for it.
        fontSize: band.size / (unit || 0.7),
        tracking: doc.tracking,
        // The band's own turn already carries the document's spin and however
        // far this course is still turned back from where it settles.
        start: band.spin,
        face: band.face,
        fill: doc.fill,
        joiner: doc.joiner,
        reveal: band.reveal,
      }),
    )
  }, [sigil.bands, face, doc.wght, doc.tracking, doc.fill, doc.joiner])

  return (
    <g transform={`translate(${round(doc.cx * doc.width)} ${round(doc.cy * doc.height)})`}>
      {doc.plate !== 'none' && (
        <circle
          r={round(sigil.radius)}
          fill={doc.plate}
          // The disc arrives ahead of the plate on it, so the ink always has
          // something to sit on rather than appearing over bare footage first.
          opacity={round(doc.plateOpacity * Math.min(1, doc.bloom * 2.5))}
        />
      )}

      <g fill="none" stroke={doc.ink} strokeWidth={doc.rule}>
        {sigil.rings.map((ring, i) => (
          <circle
            key={`ring-${i}`}
            r={round(ring.r)}
            // A circle's path starts at three o'clock, so an ink that is drawing
            // on starts there too — which looks like the plate is being drawn
            // from the side. Turned back a quarter, it starts at twelve, where a
            // hand would start it. Free on a circle, and only present while
            // there is a dash to place.
            transform={ring.reveal < 1 ? 'rotate(-90)' : undefined}
            {...drawOn(2 * Math.PI * ring.r, ring.reveal)}
          />
        ))}

        {sigil.ticks.segments.length > 0 && sigil.ticks.reveal > 0.004 && (
          <path
            d={segmentsData(sigil.ticks.segments)}
            opacity={round(sigil.ticks.reveal)}
            transform={`rotate(${round(sigil.ticks.spin)})`}
          />
        )}

        {sigil.spokes.segments.length > 0 && sigil.spokes.reveal > 0.004 && (
          <path
            d={segmentsData(sigil.spokes.segments)}
            opacity={round(sigil.spokes.reveal)}
            transform={`rotate(${round(sigil.spokes.spin)})`}
          />
        )}

        {sigil.star.reveal > 0.004 && (
          <g transform={`rotate(${round(sigil.star.spin)})`}>
            {sigil.star.cycles.map((cycle, i) => (
              <path
                key={`star-${i}`}
                d={polygonData(cycle)}
                {...drawOn(perimeter(cycle), sigil.star.reveal)}
              />
            ))}
          </g>
        )}
      </g>

      <g fill={doc.ink} stroke="none">
        {bands.map((run, i) => (
          // Named with its own line, so the exported file says which ring is
          // which without anyone having to read the coordinates.
          <g key={`band-${i}`} data-line={sigil.bands[i].text}>
            {run.glyphs.map((glyph, j) => (
              <path
                key={j}
                d={outlineData(glyph.commands)}
                transform={matrixAttr(glyph.matrix)}
                opacity={glyph.opacity < 1 ? round(glyph.opacity) : undefined}
              />
            ))}
          </g>
        ))}
      </g>
    </g>
  )
}
