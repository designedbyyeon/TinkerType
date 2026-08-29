import { Mesh } from 'three'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import type { Parsed } from '../../../shared/media/type/measure'
import { layoutOf } from '../geometry/layout'
import { glyphCacheFor } from '../scene/glyphCache'
import { wordsOf } from '../scene/words'
import type { BillboardDoc } from '../types'
import { styleOf } from '../types'
import { buildBuilding } from './build'

/**
 * The building as a solid model — OBJ or STL.
 *
 * The tool renders rather than draws, so its output cannot be an editable SVG the
 * way the other two tools' is. Handing over a picture only would make it a
 * generator of images; handing over the **model** makes it a generator of an
 * object, which is what someone would actually want to take into a scene, a
 * render, or a printer.
 *
 * Built fresh rather than lifted out of the live scene. The lights, the camera,
 * the post-processing chain and the ground plate all belong to looking at it, not
 * to being it — and reaching into a running renderer to strip those out is how
 * the two quietly drift apart. `buildBuilding` is the single description of the
 * object, and both the view and this call it.
 */

/**
 * Millimetres of exported model per layout unit.
 *
 * The layout works in cap heights, which are unitless. Exporting at that scale
 * hands over a building twenty units tall and leaves the reader to guess; STL in
 * particular is conventionally read as millimetres and would arrive the size of a
 * grain of rice. So it goes out at roughly **200mm tall** — a desk model, the size
 * of the thing the references are photographs of.
 */
const TARGET_HEIGHT_MM = 200

export type ModelFormat = 'obj' | 'stl'

export interface ModelOptions {
  doc: BillboardDoc
  face: Parsed
  format: ModelFormat
  filename: string
}

export function buildModelFile({ doc, face, format }: Omit<ModelOptions, 'filename'>): Blob {
  const layout = layoutOf(wordsOf(face, doc.text), styleOf(doc))
  const built = buildBuilding(layout, glyphCacheFor(face, layout.signs), doc.detail, doc.seed, {
    ground: false,
    wall: doc.wall,
    bevel: doc.bevel,
  })

  // Sit it on the origin at model scale, so it arrives upright and usable rather
  // than wherever the layout's own coordinates happened to leave it.
  const scale = TARGET_HEIGHT_MM / Math.max(0.001, built.bounds.max.y - built.bounds.min.y)
  built.group.scale.setScalar(scale)
  built.group.position.set(
    (-(built.bounds.min.x + built.bounds.max.x) / 2) * scale,
    -built.bounds.min.y * scale,
    (-(built.bounds.min.z + built.bounds.max.z) / 2) * scale,
  )
  built.group.updateMatrixWorld(true)

  try {
    if (format === 'obj') {
      return new Blob([new OBJExporter().parse(built.group)], { type: 'model/obj' })
    }
    // Binary: an ASCII STL of this many triangles is tens of megabytes of text.
    const data = new STLExporter().parse(built.group, { binary: true }) as unknown as DataView
    return new Blob([new Uint8Array(data.buffer as ArrayBuffer)], { type: 'model/stl' })
  } finally {
    built.dispose()
    built.group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose()
    })
  }
}

export function saveModel(options: ModelOptions): void {
  const blob = buildModelFile(options)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = options.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // A tick for the browser to start the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
