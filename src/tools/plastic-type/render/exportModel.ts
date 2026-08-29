import { Mesh, Vector3 } from 'three'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import type { Face } from '../geometry/layout'
import type { PlasticDoc } from '../types'
import { buildSolid } from './build'
import { sheetOf } from './plan'

/**
 * The sheet as a solid model — OBJ.
 *
 * The flat form of this tool exports the artwork it is showing, because there the
 * screen and the file are the same SVG. The solid form renders rather than draws,
 * so a picture is all a canvas could hand over — and a picture would make this an
 * image generator. The **model** makes it a generator of an object: the thing a
 * designer would actually take into a scene, a render, or a printer, which for a
 * sheet of parts is the whole point of drawing it as parts.
 *
 * Built fresh from the document rather than lifted out of the live scene, for the
 * reason in `build.ts`: the lights, the camera and the person's own view angle
 * belong to looking at it, and a file that came out of a different pipeline than
 * the picture is a file nobody can trust.
 */

/**
 * Millimetres across the finished model's longest side.
 *
 * The sheet is laid out in pixels of artwork, which mean nothing to a modelling
 * application and less to a printer. A real runner is a couple of hundred
 * millimetres on its long side — the sprue out of a 1/144 kit — so it goes out at
 * that, and arrives the size of the thing it is a drawing of.
 */
const TARGET_MM = 200

export interface ModelOptions {
  doc: PlasticDoc
  face: Face
  filename: string
}

export function buildModelFile(doc: PlasticDoc, face: Face): Blob {
  const sheet = sheetOf(face, doc)
  if (!sheet) throw new Error('Nothing to mould')

  const built = buildSolid(sheet.plan, sheet.style, doc)
  try {
    const size = built.bounds.getSize(new Vector3())
    const scale = TARGET_MM / Math.max(0.001, Math.max(size.x, size.y))

    // Centred on the origin with its flat back on z = 0, so it arrives placed
    // rather than wherever the layout's own coordinates happened to leave it.
    built.group.scale.setScalar(scale)
    built.group.position.set(
      (-(built.bounds.min.x + built.bounds.max.x) / 2) * scale,
      (-(built.bounds.min.y + built.bounds.max.y) / 2) * scale,
      -built.bounds.min.z * scale,
    )
    built.group.updateMatrixWorld(true)

    return new Blob([new OBJExporter().parse(built.group)], { type: 'model/obj' })
  } finally {
    built.dispose()
    built.group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose()
    })
  }
}

export function saveModel({ doc, face, filename }: ModelOptions): void {
  const url = URL.createObjectURL(buildModelFile(doc, face))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // A tick for the browser to start the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
