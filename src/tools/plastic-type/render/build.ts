import {
  Box3,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three'
import type { RunnerPlan, RunnerStyle } from '../geometry/runner'
import { frontOf, lumpsOf, type Depths, type Lump } from '../geometry/solid'
import { depthsFor, runnerLetter, type PlasticDoc } from '../types'
import { shapesOfLump } from './shapes'

/**
 * The sheet as a solid object.
 *
 * Built fresh rather than lifted out of the running scene, and called by both the
 * view and the export for the same reason tool 03 does it: the lights, the
 * camera, the post-processing chain belong to *looking* at the sheet, not to
 * being it, and reaching into a live renderer to strip those out is how a file
 * and the picture of it quietly drift apart. This function is the single
 * description of the object.
 */

export interface Built {
  group: Group
  bounds: Box3
  dispose: () => void
}

/**
 * Roughness, from the one control a designer actually judges plastic by.
 *
 * Neither end is allowed to be absolute. A perfectly matte surface loses the
 * environment altogether and reads as paper; a mirror reads as metal, and this is
 * polystyrene either way.
 */
const roughnessOf = (gloss: number) => 0.92 - Math.max(0, Math.min(1, gloss)) * 0.74

/*
 * **One mesh per lump, and merging by colour was measured and thrown away.**
 *
 * A sentence is a couple of hundred separate bodies, and batching them into one
 * geometry per plastic is the obvious thing to reach for — two hundred draw calls
 * down to two. Measured on a forty-five character line it cost thirteen
 * milliseconds per rebuild to do the merging and saved nothing at all: a frame
 * was 4.7ms either way, because nothing here moves except the camera and the
 * scene is redrawn only when something changes. So the sheet stays as separate
 * bodies, which is also what the file wants — a part that arrives as its own
 * object can be pulled off the sprue in whatever opens it.
 */
export function buildSolid(
  plan: RunnerPlan,
  style: RunnerStyle,
  doc: PlasticDoc,
): Built {
  const group = new Group()
  const depths: Depths = depthsFor(doc)
  const roughness = roughnessOf(doc.gloss)
  const cycling = doc.colourMode === 'cycle'

  const materials = new Map<string, Material>()
  const material = (colour: string) => {
    const held = materials.get(colour)
    if (held) return held
    const made = new MeshStandardMaterial({
      color: new Color(colour),
      roughness,
      metalness: 0,
    })
    materials.set(colour, made)
    return made
  }

  /*
   * A runner and its parts are one shot of one plastic, so in cycle mode a frame
   * and everything it holds share a colour. Colouring the parts against their own
   * frame is the first thing that would give the sheet away — the same rule the
   * flat drawing follows, kept here rather than re-derived.
   */
  const colourOf = (lump: Lump) => {
    if (cycling) return doc.palette[lump.frame % doc.palette.length]
    return lump.role === 'part' ? doc.partColour : doc.runnerColour
  }

  const depthOf = (lump: Lump) =>
    lump.role === 'part' ? depths.part : lump.role === 'gate' ? depths.gate : depths.runner

  /*
   * Every body is named, and the names are the ones a kit uses: sprue letter,
   * what the piece is, then its number on that sprue. It costs nothing here and
   * it is the difference between a model file a designer can work with and two
   * hundred objects called nothing — `OBJExporter` writes `mesh.name` straight
   * out as the object name.
   */
  const counted = new Map<string, number>()
  const nameOf = (lump: Lump) => {
    const stem = lump.kind === 'bridge' ? 'bridge' : `${runnerLetter(lump.frame)}-${lump.kind}`
    const n = (counted.get(stem) ?? 0) + 1
    counted.set(stem, n)
    return lump.kind === 'frame' || lump.kind === 'tab' ? stem : `${stem}-${n}`
  }

  for (const lump of lumpsOf(plan, style)) {
    const depth = depthOf(lump)
    // Nothing to mould. A role turned down to nothing is a role that is not on
    // the sheet, which is a legitimate thing to ask for.
    if (depth < 0.02) continue

    /*
     * The chamfer, and the two clamps that keep it from turning the solid inside
     * out.
     *
     * A perfectly sharp edge is the one thing no moulded part has, and putting
     * that line of light back is most of what stops the render reading as a
     * render. But a chamfer wider than half of what it cuts crosses its own
     * inset walls and the body comes back with inverted faces — black patches on
     * screen, a non-manifold mess in the file. So it is held under a quarter of
     * the depth and a quarter of the narrowest member the lump knows about, which
     * for a gate is its neck: a couple of pixels wide by design, where the wall
     * beside it is twelve.
     */
    const bevel = Math.min(doc.bevel, depth * 0.24, lump.thin * 0.24)
    const bevelled = bevel > 1e-3
    const colour = colourOf(lump)

    for (const shape of shapesOfLump(lump)) {
      const geometry = new ExtrudeGeometry(shape, {
        depth: depth - (bevelled ? bevel * 2 : 0),
        bevelEnabled: bevelled,
        bevelThickness: bevel,
        bevelSize: bevel,
        // Negative, so the chamfer is cut *into* the outline instead of grown
        // out of it. Without this every part comes out a bevel wider than the
        // drawing said, and the flat and solid forms stop being the same sheet.
        bevelOffset: -bevel,
        bevelSegments: 1,
        curveSegments: 1,
        steps: 1,
      })
      // Extrusion runs [-bevel, depth-bevel]; shifting it puts the flat back on
      // z = 0, which is what makes one sheet out of three depths.
      if (bevelled) geometry.translate(0, 0, bevel)

      const mesh = new Mesh(geometry, material(colour))
      mesh.name = nameOf(lump)
      group.add(mesh)
    }
  }

  const bounds = new Box3().setFromObject(group)
  // An empty sheet still has to answer for its size, or the camera has nothing
  // to frame and comes back with a NaN.
  if (bounds.isEmpty()) {
    bounds.set(
      new Vector3(plan.bounds.x, -(plan.bounds.y + plan.bounds.height), 0),
      new Vector3(plan.bounds.x + plan.bounds.width, -plan.bounds.y, frontOf(depths)),
    )
  }

  return {
    group,
    bounds,
    dispose: () => {
      for (const m of materials.values()) m.dispose()
      group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose()
      })
    },
  }
}
