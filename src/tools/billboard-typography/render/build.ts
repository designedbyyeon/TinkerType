import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector3,
  type Material,
} from 'three'
import { mulberry32 } from '../../../shared/geometry/vec'
import { boxOfSign, frameOf, type Layout } from '../geometry/layout'
import { blockWidth } from '../geometry/signs'
import { PITCH, PLINTH, rowTop, SKIN, SLAB_OUT, TILE_HEIGHT, TOP_INSET } from '../geometry/plan'
import { WALL_COLOUR } from '../geometry/types'

/**
 * The layout, as a model.
 *
 * Everything about **where a sign goes** was settled in `geometry/`, which knows
 * nothing about three.js. What happens here is the building the signs are fixed
 * to, and it is drawn from the Korean shop-building references — two of them,
 * mixed:
 *
 * - **From the banded one:** a sign band hanging from every storey line, a
 *   window course under it, and floor slabs that *actually project* so the
 *   storeys are physically separated rather than merely ruled.
 * - **From the grey diorama:** the windows. Few, large, and **cut through a
 *   facade skin** so they are holes with reveals and a sill, not frames stuck to
 *   a flat wall. That one difference is most of why the model reads as built.
 *
 * The wall is otherwise silent. Everything that was invented rather than
 * observed — rooftop huts, water tanks on legs, terrace railings, a busy
 * shopfront — is gone, because the roof and the ground floor were competing with
 * the signage and losing.
 */

/** How far sign lettering stands off its board. Thin, but never zero. */
const LETTER_RELIEF = 0.03

/** The dark inside an opening. Not black: a hole still catches some sky. */
const VOID = '#2b2b28'
const GLASS = '#494e4b'

export interface Built {
  group: Group
  bounds: Box3
  dispose: () => void
}

export interface BuildOptions {
  /** The display base plate. Off for the export: it is scenery, not building. */
  ground?: boolean
  /** The building's own colour. Everything else is a shade of it. */
  wall?: string
  /** Chamfer on every edge, in layout units. Zero for plain boxes. */
  bevel?: number
}

/**
 * A box with its edges taken off.
 *
 * A perfectly sharp edge is the one thing no manufactured object has, and it is
 * why an untouched `BoxGeometry` reads as a render however good the lighting is:
 * a real corner catches a line of light along it, and a mathematical one cannot.
 * A chamfer of a couple of millimetres at model scale puts that line back.
 *
 * **The clamp is the whole risk.** A bevel wider than half the smallest dimension
 * turns the profile inside out — the shape's inset walls cross each other and the
 * solid comes back with inverted faces, which shows up as black patches on
 * screen and as a non-manifold mess in the STL. Every box here is clamped to a
 * quarter of its own thinnest side, so a paper-thin floor slab gets a hairline
 * and a mass gets a proper chamfer.
 */
function chamfered(w: number, h: number, d: number, bevel: number): BufferGeometry {
  const b = Math.min(bevel, w * 0.24, h * 0.24, d * 0.24)
  if (b <= 1e-4) return new BoxGeometry(w, h, d)

  const shape = new Shape()
  shape.moveTo(b, b)
  shape.lineTo(w - b, b)
  shape.lineTo(w - b, h - b)
  shape.lineTo(b, h - b)
  shape.closePath()

  const geometry = new ExtrudeGeometry(shape, {
    depth: d - b * 2,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: 0,
    bevelSegments: 1,
    curveSegments: 1,
  })
  // Extrusion starts at z = 0 and the bevel pushes back by its thickness, so the
  // solid runs [-b, d-b]. Shift it to [0, d] and the box occupies exactly what
  // was asked for — which the bounds and the sign placement both depend on.
  geometry.translate(0, 0, b)
  return geometry
}

export function buildBuilding(
  layout: Layout,
  glyphs: Map<string, Shape[]>,
  detail: number,
  seed: number,
  options: BuildOptions = {},
): Built {
  const group = new Group()
  const bounds = new Box3()
  const rand = mulberry32(seed >>> 0)
  const kept: Material[] = []

  const base = new Color(options.wall ?? WALL_COLOUR)
  const tone = (k: number, rough = 0.9) => {
    const m = new MeshStandardMaterial({
      color: base.clone().multiplyScalar(k),
      roughness: rough,
      metalness: 0,
    })
    kept.push(m)
    return m
  }
  const flat = (colour: string, rough = 0.9) => {
    const m = new MeshStandardMaterial({ color: new Color(colour), roughness: rough, metalness: 0 })
    kept.push(m)
    return m
  }

  /*
   * Three shades of one colour and nothing else.
   *
   * The skin is lighter than the wall behind it, which is what makes an opening
   * read as depth rather than as a dark rectangle: you see a lit face, then a
   * shadowed reveal, then the recessed plane.
   */
  /*
   * The ground floor is a **different material**, not a darker shade.
   *
   * Every reference has it: a tiled or brick plinth under a concrete upper, and
   * the change of material is what separates the shop from the building above it.
   * A single hue at three brightnesses reads as one wall with a shadow on it.
   */
  const warm = (k: number, mix: number) =>
    base.clone().multiplyScalar(k).lerp(new Color('#a08256'), mix)

  const skinMat = tone(1.04)
  const wallMat = tone(0.88)
  const trimMat = tone(0.8)
  const plinthMat = flat(`#${warm(0.84, 0.55).getHexString()}`, 0.94)
  const darkMat = flat('#33383c', 0.6)
  const voidMat = flat(VOID, 0.95)
  const glassMat = flat(GLASS, 0.4)

  const bevel = Math.max(0, options.bevel ?? 0)
  const box = (
    size: [number, number, number],
    at: [number, number, number],
    mat: Material,
    parent: Group = group,
  ) => {
    const geometry = chamfered(size[0], size[1], size[2], bevel)
    const mesh = new Mesh(geometry, mat)
    // `chamfered` builds from the origin; `BoxGeometry` builds around its centre.
    const centred = geometry instanceof BoxGeometry
    mesh.position.set(
      at[0] + (centred ? size[0] / 2 : 0),
      at[1] + (centred ? size[1] / 2 : 0),
      at[2] + (centred ? size[2] / 2 : 0),
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    bounds.expandByPoint(new Vector3(at[0], at[1], at[2]))
    bounds.expandByPoint(new Vector3(at[0] + size[0], at[1] + size[1], at[2] + size[2]))
    return mesh
  }

  const { form } = layout
  const { wall } = form
  const W = wall.width
  const D = wall.depth

  // Base plate. The references are photographs of models and they all sit on
  // one. It belongs to looking at the thing, so the export leaves it behind.
  if (options.ground !== false) box([W + 4, 0.4, D + 4], [-2, -0.4, -2], plinthMat)

  /*
   * The core, set back by the skin's thickness on both visible faces.
   *
   * That inset is the whole trick. The skin's outer surface then lands exactly on
   * the wall plane the layout measures standoffs from, so nothing downstream has
   * to know the skin exists — and what shows through a gap in the skin is the
   * core's own face, a genuine recess with genuine reveals.
   */
  box([W - SKIN, form.height - PLINTH, D - SKIN], [0, PLINTH, 0], wallMat)

  /*
   * The parapet, **all four sides**.
   *
   * It used to be two, on the faces the camera happens to see head-on — which is
   * fine for a painting and wrong for a model. The camera looks *down*: the roof
   * deck is fully in view, so the far edges are as visible as the near ones, and
   * a deck that just stops reads as a cut-away. It also matters that the model
   * leaves as OBJ and STL, where "the back is not modelled" is not a shortcut,
   * it is a hole.
   */
  const PT = 0.28
  const PH = PITCH * 0.22
  const top = form.height
  box([W + PT * 2, PH, PT], [-PT, top, D], trimMat)
  box([W + PT * 2, PH, PT], [-PT, top, -PT], trimMat)
  box([PT, PH, D + PT * 2], [W, top, -PT], trimMat)
  box([PT, PH, D + PT * 2], [-PT, top, -PT], trimMat)

  // One stair head, sitting **on the deck** rather than floating at parapet
  // height, which is where it was.
  const hutW = Math.min(W * 0.3, 3.2)
  const hutD = Math.min(D * 0.42, 2.6)
  box([hutW, PITCH * 0.72, hutD], [W * 0.24, top, D * 0.22], tone(0.94))

  /**
   * The window course of a storey: where in y the openings sit.
   *
   * Everything the sign band and the floor slab do not take. It works out at
   * about a third of the storey, which is what makes an opening tall enough to
   * look into rather than a letterbox.
   */
  const courseOf = (row: number) => {
    const top = rowTop(form, row) - PITCH * TOP_INSET - PITCH * TILE_HEIGHT
    const bottom = rowTop(form, row) - PITCH + PITCH * 0.1
    return { y: bottom, h: Math.max(0.3, top - bottom - PITCH * 0.04) }
  }

  /*
   * The skin, and the holes in it.
   *
   * Emitted as the *solid* parts: a full-width panel over each storey's band, and
   * piers between the openings of each window course. Modelling the wall around
   * the openings rather than pasting frames onto it is the only way to get a
   * reveal that catches the occlusion, and the occlusion in the reveal is what
   * the eye is actually reading.
   */
  const openings: { s: number; w: number; y: number; h: number }[] = []
  const PIER = 0.85

  /*
   * Where the wall has to stay blank.
   *
   * A sign with no board is lettering laid straight on the facade, and the
   * facade is not blank — it has a window course cut through it at every storey.
   * The word ended up straddling a row of dark openings and stopped being a word.
   *
   * So the openings are **not** structural after all: they are cut everywhere
   * except behind a boardless sign, where the skin simply stays solid. A board
   * needs no such help, being opaque.
   */
  const blank = new Map<number, { a: number; b: number }[]>()
  for (const sign of layout.signs) {
    if (sign.board) continue
    const spanRows = sign.height > PITCH ? 2 : 1
    for (let r = sign.row; r < Math.min(form.rows, sign.row + spanRows); r++) {
      blank.set(r, [...(blank.get(r) ?? []), { a: sign.s0 - 0.35, b: sign.s1 + 0.35 }])
    }
  }
  const cuttable = (row: number, a: number, b: number) =>
    !(blank.get(row) ?? []).some((z) => b > z.a && a < z.b)

  for (let row = 0; row < form.rows; row++) {
    const course = courseOf(row)
    const bandTop = rowTop(form, row)
    const bandBottom = course.y + course.h

    // Skin above the course: covers the sign band's storey, full width. The top
    // row carries it right up to the parapet — otherwise a notch of bare core
    // showed under the coping, which read as a modelling slip because it was one.
    const skinTop = row === 0 ? form.height : bandTop
    box([W, skinTop - bandBottom, SKIN], [0, bandBottom, D - SKIN], skinMat)
    box([SKIN, skinTop - bandBottom, D - SKIN], [W - SKIN, bandBottom, 0], skinMat)
    // Skin below the course, down to the storey line.
    const floor = rowTop(form, row) - PITCH
    box([W, course.y - floor, SKIN], [0, floor, D - SKIN], skinMat)
    box([SKIN, course.y - floor, D - SKIN], [W - SKIN, floor, 0], skinMat)

    /*
     * The course itself: openings where the wall may be cut, solid skin over the
     * rest of it. Built as the **complement of the openings** rather than as a
     * run of piers, because a patch that must stay blank is then simply an
     * opening that was never cut, and the skin closes over it on its own.
     */
    const cut = (a: number, b: number) => cuttable(row, a, b)

    const front = Math.max(2, Math.round((W - PIER) / 2.15))
    const fw = (W - PIER * (front + 1)) / front
    const frontCuts: { a: number; b: number }[] = []
    for (let i = 0; i < front; i++) {
      const a = PIER + i * (PIER + fw)
      if (cut(a, a + fw)) frontCuts.push({ a, b: a + fw })
    }
    let at = 0
    for (const c of [...frontCuts, { a: W, b: W }]) {
      if (c.a - at > 1e-4) box([c.a - at, course.h, SKIN], [at, course.y, D - SKIN], skinMat)
      at = c.b
    }
    for (const c of frontCuts) {
      openings.push({ s: c.a, w: c.b - c.a, y: course.y, h: course.h })
    }

    /*
     * The side wall runs the other way: `s` grows as `z` shrinks. Generating its
     * cuts in `s` and converting back is what lets the blank-patch test be the
     * same test on both walls — the sign's own coordinates are `s`, and a second
     * convention here is how the two would drift apart.
     */
    const sideSpan = D - SKIN
    const side = Math.max(1, Math.round((D - PIER) / 2.15))
    const sw = (sideSpan - PIER * (side + 1)) / side
    const sideCuts: { a: number; b: number }[] = []
    for (let i = side - 1; i >= 0; i--) {
      const z = PIER + i * (PIER + sw)
      const a = W + (sideSpan - z - sw)
      if (cut(a, a + sw)) sideCuts.push({ a, b: a + sw })
    }
    at = W
    for (const c of [...sideCuts, { a: W + sideSpan, b: W + sideSpan }]) {
      if (c.a - at > 1e-4) {
        box([SKIN, course.h, c.a - at], [W - SKIN, course.y, sideSpan - (c.a - W)], skinMat)
      }
      at = c.b
    }
    for (const c of sideCuts) {
      openings.push({ s: c.a, w: c.b - c.a, y: course.y, h: course.h })
    }
  }

  // The recessed plane behind each opening, so a hole reads as a room and not as
  // a hole through the building.
  for (const o of openings) {
    if (o.s + o.w <= W) box([o.w, o.h, 0.06], [o.s, o.y, D - SKIN], voidMat)
    else box([0.06, o.h, o.w], [W - SKIN, o.y, D - (o.s - W) - o.w], voidMat)
  }

  /*
   * Floor slabs, projecting.
   *
   * Not a ruled line: a real lip with a top and an underside, so the storeys are
   * physically separated and the occlusion has something to catch under. It is
   * the single strongest thing the banded reference has that a flat facade does
   * not.
   */
  // Not the topmost one: the parapet is already the line there, and two lips a
  // few centimetres apart read as a mistake rather than as a cornice.
  for (let row = 0; row < form.rows; row++) {
    const y = form.panelBase + row * PITCH - PITCH * 0.05
    box([W + SLAB_OUT * 2, PITCH * 0.13, SLAB_OUT], [-SLAB_OUT, y, D], trimMat)
    box([SLAB_OUT, PITCH * 0.13, D + SLAB_OUT * 2], [W, y, -SLAB_OUT], trimMat)
  }

  /* The signs. Everything about where they are came from the engine. */
  const letters = new Group()
  group.add(letters)

  for (const sign of layout.signs) {
    const b = boxOfSign(wall, sign)
    const frame = frameOf(wall, sign)
    const len = sign.s1 - sign.s0
    const face = frame.facing === 'front'

    /*
     * The board, if this shopfitting has one.
     *
     * `channel` has none: its letters are fixed to the wall itself, which is what
     * makes it read as a different trade rather than as the same sign in another
     * colour. The others differ by polarity — coloured board with dark type, dark
     * board with the colour reversed out, pale board with a raised coloured edge.
     */
    if (sign.board) {
      box([b.w, b.h, b.d], [b.x, b.y, b.z], flat(sign.colour, 0.72))
    }

    if (sign.rule) {
      /*
       * The bar along the board's foot. It stands a little proud of the face so
       * it catches its own line of light — flush, it would read as paint, and the
       * point of it is that it is a strip screwed on.
       */
      const bar = flat(sign.rule, 0.7)
      const t = sign.foot
      const p = sign.thick * 0.45
      if (face) box([b.w, t, p], [b.x, b.y, b.z + b.d], bar)
      else box([p, t, b.d], [b.x + b.w, b.y, b.z], bar)
    }

    if (sign.block) {
      // The logo block: a square of the lettering's colour at one end of the
      // board. No two trades put the same mark there, and one square is enough
      // to say so.
      const w = Math.min(blockWidth(sign.cap), len * 0.42)
      const inset = b.h * 0.16
      const along = sign.block === 'start' ? 0 : len - w
      const p = sign.thick * 0.5
      if (face) {
        box([w, b.h - inset * 2, p], [b.x + along, b.y + inset, b.z + b.d], flat(sign.ink, 0.75))
      } else {
        box(
          [p, b.h - inset * 2, w],
          [b.x + b.w, b.y + inset, b.z + (len - w - along)],
          flat(sign.ink, 0.75),
        )
      }
    }

    // Steelwork, only when the board actually hangs off the wall. The big boards
    // in the references cantilever a long way out on visible brackets — the
    // standoff is part of the object, not a millimetre of relief.
    if (sign.out > 0.45) {
      for (const t of [0.2, 0.8]) {
        const along = len * t
        const arm = sign.out + sign.thick * 0.5
        if (frame.facing === 'front') {
          box([0.1, 0.1, arm], [sign.s0 + along, sign.y + sign.height * 0.74, D], darkMat)
          box(
            [0.09, sign.height * 0.45, 0.09],
            [sign.s0 + along, sign.y + sign.height * 0.2, D + sign.out * 0.5],
            darkMat,
          )
        } else {
          const z = D - (sign.s0 - W) - along
          box([arm, 0.1, 0.1], [W, sign.y + sign.height * 0.74, z], darkMat)
          box(
            [0.09, sign.height * 0.45, 0.09],
            [W + sign.out * 0.5, sign.y + sign.height * 0.2, z],
            darkMat,
          )
        }
      }
    }

    const ink = flat(sign.ink, 0.85)
    for (const letter of sign.letters) {
      for (const shape of glyphs.get(letter.char) ?? []) {
        /*
         * Extruded, not flat. Sign lettering is a raised panel in the references
         * so it catches the occlusion at its own edge — but the reason it *has*
         * to be a solid is the export: a zero-thickness plane is not a body, and
         * an STL of one is a shell with no inside.
         */
        const mesh = new Mesh(
          new ExtrudeGeometry(shape, {
            // Letters on the wall stand well proud; letters on a board are a
            // relief on it. Same reason a shop's channel letters are deep and a
            // painted fascia is flat.
            depth: (sign.board ? LETTER_RELIEF : LETTER_RELIEF * 4) / letter.cap,
            bevelEnabled: false,
            curveSegments: 5,
          }),
          ink,
        )
        mesh.scale.setScalar(letter.cap)
        if (frame.facing === 'right') mesh.rotation.y = Math.PI / 2
        mesh.position.set(
          frame.origin.x + frame.along.x * letter.along + (frame.facing === 'right' ? 0.01 : 0),
          frame.origin.y + letter.up,
          frame.origin.z + frame.along.z * letter.along + (frame.facing === 'front' ? 0.01 : 0),
        )
        letters.add(mesh)
      }
    }
  }

  /*
   * The ground floor: **plain**, on purpose.
   *
   * Glazing set well back, a slatted canopy over it, a door, a threshold. That is
   * everything the references show at street level once you stop looking at the
   * signs — and an earlier version's awnings, posts, railings and shop windows
   * added up to a busier storey than any of the signed ones above it, which is
   * exactly backwards. A quiet base lets the signage be the subject.
   */
  const sill = 0.34
  const head = PLINTH - PITCH * 0.32
  const jamb = 0.7
  /** Matches the floor slabs, so the shopfront head reads as the first of them. */
  const jut = 0.5

  /*
   * The shopfront is a **recess**, built the same way the windows are.
   *
   * The glazing sits on the core's own face and the surround projects past it —
   * head, threshold and jambs. An earlier attempt put a solid plinth in front of
   * the glass, so the whole ground floor came out as a blank grey block: the
   * glazing was inside the building. A later one had the surround hanging past
   * the building on both sides, which read as a shelf rather than as a storey.
   * **It projects forward only**; the left and back stay flush with the mass.
   */
  box([W - SKIN, PLINTH, D - SKIN], [0, 0, 0], plinthMat)
  box([W - SKIN - jamb * 2, head - sill, 0.1], [jamb, sill, D - SKIN], glassMat)
  box([0.1, head - sill, D - SKIN - jamb * 2], [W - SKIN, sill, jamb], glassMat)
  box([1.4, head - sill - 0.12, 0.14], [W * 0.55, sill, D - SKIN + 0.02], darkMat)

  box([W + jut, PLINTH - head, jut + SKIN], [0, head, D - SKIN], trimMat)
  box([jut + SKIN, PLINTH - head, D + jut], [W - SKIN, head, 0], trimMat)
  box([W + jut, sill, jut + SKIN], [0, 0, D - SKIN], trimMat)
  box([jut + SKIN, sill, D + jut], [W - SKIN, 0, 0], trimMat)
  box([jamb, head - sill, SKIN], [0, sill, D - SKIN], plinthMat)
  box([jamb, head - sill, SKIN], [W - SKIN - jamb, sill, D - SKIN], plinthMat)
  box([SKIN, head - sill, jamb], [W - SKIN, sill, 0], plinthMat)

  /*
   * The awning: a projecting slab with a **valance** hanging off its front edge.
   *
   * The lip is the whole thing. A flat shelf over a shopfront reads as a ledge;
   * the same shelf with a hand's width of fascia dropped from its nose reads as
   * an awning, because that is where a real one carries its lettering and its
   * scalloped edge.
   */
  const canopy = 1.2
  /*
   * The awning sits **immediately under the fascia**, not halfway down the glass.
   * It is the shopfront's brim: it belongs at the top of the opening, projecting
   * past the sign band above it.
   */
  const awningY = head - PITCH * 0.1
  box([W + jut, 0.14, canopy], [0, awningY, D + jut - 0.05], trimMat)
  box([jut + SKIN + canopy, 0.14, D + jut], [W - SKIN, awningY, 0], trimMat)
  box([W + jut, PITCH * 0.16, 0.12], [0, awningY - PITCH * 0.16, D + jut + canopy - 0.17], trimMat)
  box(
    [0.12, PITCH * 0.16, D + jut],
    [W - SKIN + canopy + jut - 0.17, awningY - PITCH * 0.16, 0],
    trimMat,
  )

  /*
   * The last of the dressing: a drainpipe on each wall, and air conditioners in
   * the window courses. Individually nothing; together they are most of what
   * makes a building read as built rather than as drawn.
   */
  if (detail > 0) {
    for (const o of openings) {
      if (rand() > 0.26 * detail) continue
      const y = o.y + o.h * 0.1
      if (o.s + o.w <= W) {
        box([0.62, 0.44, 0.3], [o.s + o.w - 0.66, y, D], flat('#d8d5cb', 0.9))
        box([0.5, 0.06, 0.24], [o.s + o.w - 0.6, y - 0.06, D], darkMat)
      } else {
        const z = D - (o.s - W) - o.w
        box([0.3, 0.44, 0.62], [W, y, z + 0.04], flat('#d8d5cb', 0.9))
        box([0.24, 0.06, 0.5], [W, y - 0.06, z + 0.1], darkMat)
      }
    }
    /*
     * Set in from the corner: a pipe on the silhouette edge reads as a seam in
     * the model rather than as a pipe on the building. And skipped entirely
     * where a boardless sign runs — the point of clearing the wall behind
     * lettering is lost if a drainpipe is left crossing it.
     */
    const pipes: [number, number, number][] = [
      [W - 1.1, D, W - 1.1],
      [W, 1.0, W + (D - 1.0)],
    ]
    const clearOfSigns = (at: number) =>
      ![...blank.values()].flat().some((b) => at > b.a && at < b.b)
    for (const [x, z] of pipes.filter(([, , at]) => clearOfSigns(at))) {
      box([0.11, form.height - PLINTH, 0.11], [x, PLINTH, z], trimMat)
      for (let y = PLINTH + PITCH; y < form.height - 0.5; y += PITCH) {
        box([0.2, 0.07, 0.2], [x - 0.05, y, z - 0.1], darkMat)
      }
    }
  }

  return {
    group,
    bounds,
    dispose: () => {
      for (const m of kept) m.dispose()
      group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose()
      })
    },
  }
}
