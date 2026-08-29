import { useEffect, useMemo, useState } from 'react'
import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  OrthographicCamera,
  PMREMGenerator,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { pngScale } from '../../../shared/export/png'
import type { RunnerPlan, RunnerStyle } from '../geometry/runner'
import type { PlasticDoc } from '../types'
import { buildSolid } from './build'
import { setLiveCapture } from './live'

/**
 * The sheet as a moulded object, live.
 *
 * The look is the flat drawing's look, given a depth — the same ground, the same
 * two colours, the same sheet. What it is *not* is a picture of that drawing with
 * shading painted on. Three decisions carry it, and the first two are lifted
 * wholesale from tool 03 because they were settled there against a photograph of
 * a physical model.
 *
 * **The ambient is an environment, not a light.** `RoomEnvironment` through PMREM
 * gives every surface a gradient that varies with its orientation, which is what
 * a photographed object actually receives. It is also why the materials are
 * `MeshStandard`: Lambert cannot take an environment at all.
 *
 * **Depth comes from contact occlusion.** A part standing proud of its frame, a
 * gate sunk between them, a bar meeting a wall — every one of those reads from
 * the darkening in the crease, not from a cast shadow. GTAO produces it
 * everywhere; a key light produces one hard shadow per object. So the sun here is
 * a low fill that mostly serves to put a highlight on the chamfers.
 *
 * **The camera belongs to the person, not to the document.** This is the one
 * place this tool parts company with tool 03, where the composition *is* the
 * arrangement and a movable view could be moved wrong. A sprue is an object on a
 * table: the only way to see that the part stands proud and the gate is a recess
 * is to lean over it. So the view orbits freely — and it is deliberately kept out
 * of the document, so that a colour change or an undo does not put the sheet back
 * where the tool thought it should be.
 */

const RAD = Math.PI / 180

/**
 * The opening view: nearly square on, a little above and a little to the side.
 *
 * Nearly, and not exactly, on purpose. Dead-on would be the flat drawing again
 * and nothing would say the sheet has a thickness at all; a 45° three-quarter
 * would make the walls the subject and the letters hard to read. This is enough
 * tilt to see that the parts stand off the frame, and no more.
 */
const AZIMUTH = 17
const ELEVATION = 13

/** Air left around the sheet when the view is fitted to it. */
const FILL = 0.88

interface Rig {
  node: HTMLDivElement
  renderer: WebGLRenderer
  scene: Scene
  camera: OrthographicCamera
  controls: OrbitControls
  composer: EffectComposer
  gtao: GTAOPass
  sun: DirectionalLight
  draw: () => void
  /** The zoom a fit last asked for, so a hand-held zoom survives a rebuild. */
  fitted: { zoom: number }
  /** What is on the stage, so a resize can re-frame it. */
  bounds: Box3 | null
}

const directionOf = (azimuth: number, elevation: number) => {
  const a = azimuth * RAD
  const e = elevation * RAD
  return new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e))
}

export interface SolidViewProps {
  plan: RunnerPlan
  style: RunnerStyle
  doc: PlasticDoc
}

export function SolidView({ plan, style, doc }: SolidViewProps) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [rig, setRig] = useState<Rig | null>(null)

  // Built once and handed to both the view and, on demand, the exporter. The
  // renderer below never rebuilds it — a camera move must not cost geometry.
  const built = useMemo(() => ({ plan, style, doc }), [plan, style, doc])

  /*
   * The rig: renderer, camera, lights, controls. Created on mount and left
   * alone, which is the whole reason the camera can be the person's own — a
   * document change rebuilds the object inside a scene that is already looking
   * at it from wherever they left it.
   */
  useEffect(() => {
    if (!node) return

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'
    // Filmic, not linear: a moulded surface rolls its highlights off, and clipped
    // whites are most of what makes a render read as a render.
    renderer.toneMapping = ACESFilmicToneMapping
    /*
     * Exposure, environment and fill were set by reading the picture back against
     * the swatch. With the plastic at #3a34c8 the lit faces land on (96,80,216)
     * and the walls on (40,40,176) — the chosen colour bracketed above and below,
     * which is what a coloured object under a light actually does. Turned up, the
     * front faces drift off toward lavender and the designer's swatch stops
     * meaning anything.
     */
    renderer.toneMappingExposure = 0.88
    node.appendChild(renderer.domElement)

    /*
     * The canvas is transparent and the ground is CSS, exactly as in tool 03.
     * Painting the ground into the scene would put it through the tone mapper,
     * and the same `#f4f3f0` the flat sheet sits on comes out a shade off —
     * close enough to look like a mistake and impossible to match by eye.
     */
    const scene = new Scene()
    renderer.setClearAlpha(0)

    const room = new RoomEnvironment()
    const pmrem = new PMREMGenerator(renderer)
    const env = pmrem.fromScene(room, 0.04)
    scene.environment = env.texture
    scene.environmentIntensity = 0.78

    /*
     * A fill, and it casts nothing.
     *
     * There is no shadow map here, which is a measured decision rather than an
     * omission. A sprue is a flat plate lit from the front: a part stands proud
     * of its frame, but the frame is a ring *around* it and there is an opening
     * behind it, so there is almost nothing for a shadow to fall on. Switching
     * the map off changed 680 pixels out of 2.15 million, and cost the rebuild
     * about thirty milliseconds to produce them. The depth in this picture comes
     * from the contact darkening in every crease, which is GTAO's job, and from
     * the chamfers catching this light along every edge.
     */
    const sun = new DirectionalLight(0xfff4e8, 0.85)
    scene.add(sun)
    scene.add(sun.target)

    /*
     * Orthographic, and the frustum is the viewport in pixels — so zoom 1 draws
     * one unit of artwork per screen pixel and the solid opens at the same size
     * the flat sheet had. Orbit dolly then moves `zoom` and nothing else, which
     * is what makes the hand-held zoom a factor that can be carried across a
     * rebuild.
     */
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 4000)
    camera.up.set(0, 1, 0)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = false
    controls.zoomToCursor = true
    renderer.domElement.style.cursor = 'grab'

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const gtao = new GTAOPass(scene, camera, 1, 1)
    composer.addPass(gtao)
    composer.addPass(new OutputPass())

    /*
     * Drawn on demand, never in a loop. Nothing in the scene moves by itself, so
     * a standing animation frame would burn a GPU redrawing the same picture —
     * the rule every tool here follows. Orbiting is a change like any other: the
     * controls say so, and that schedules one frame.
     */
    let raf = 0
    const draw = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => composer.render())
    }
    controls.addEventListener('change', draw)

    const rig: Rig = {
      node,
      renderer,
      scene,
      camera,
      controls,
      composer,
      gtao,
      sun,
      draw,
      fitted: { zoom: 0 },
      bounds: null,
    }

    const resize = () => {
      const w = Math.max(1, node.clientWidth)
      const h = Math.max(1, node.clientHeight)
      renderer.setSize(w, h)
      composer.setSize(w, h)
      camera.left = -w / 2
      camera.right = w / 2
      camera.top = h / 2
      camera.bottom = -h / 2
      camera.updateProjectionMatrix()
      /*
       * Re-frame, not just re-shape. The frustum is the viewport in pixels, so a
       * new window changes what fits — and `frame` keeps the angle and the
       * hand-held zoom while it refits, which is the same thing it does when the
       * document changes. Without this the sheet keeps whatever zoom it was
       * given at the size it first mounted at, and a stage that was one pixel
       * wide for a frame leaves it there for good.
       */
      if (rig.bounds) frame(rig, rig.bounds)
      draw()
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(node)

    /*
     * A photograph of the view, at export size.
     *
     * Rendered again at a higher pixel ratio rather than scaled up from the
     * screen — the whole picture, chamfer highlights and contact shadows
     * included, is resolution-dependent, and an enlarged screenshot of it is a
     * blurred one. `preserveDrawingBuffer` is on for exactly this.
     *
     * **The ground is painted here.** The canvas is transparent so the site's
     * paper can show through it (see above); a file with a transparent hole
     * where the paper was would be a different picture from the one on screen.
     */
    setLiveCapture(async (longSide, background) => {
      const w = Math.max(1, node.clientWidth)
      const h = Math.max(1, node.clientHeight)
      const base = renderer.getPixelRatio()
      const scale = pngScale(w, h, longSide)

      renderer.setPixelRatio(scale)
      renderer.setSize(w, h)
      composer.setPixelRatio(scale)
      composer.render()

      const shot = document.createElement('canvas')
      shot.width = renderer.domElement.width
      shot.height = renderer.domElement.height
      const ctx = shot.getContext('2d')
      if (ctx) {
        if (background && background !== 'none') {
          ctx.fillStyle = background
          ctx.fillRect(0, 0, shot.width, shot.height)
        }
        ctx.drawImage(renderer.domElement, 0, 0)
      }

      // Back to the screen's own resolution, and redraw at it.
      renderer.setPixelRatio(base)
      renderer.setSize(w, h)
      composer.setPixelRatio(base)
      composer.render()

      return new Promise<Blob>((done, fail) => {
        shot.toBlob(
          (blob) => (blob ? done(blob) : fail(new Error('The image could not be encoded'))),
          'image/png',
        )
      })
    })

    /*
     * The rig, for the console. The only thing about this tool that cannot be
     * reached from a unit test is the renderer itself — frame cost, the camera's
     * actual matrices, what the composer is really doing — and measuring those
     * needs the same instance the page is using. A dynamic import would hand back
     * a second copy, so it goes on the window, in DEV only. Guarded on `window`
     * as well: a unit test importing this module runs in Node.
     */
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      ;(window as unknown as { __plasticSolid?: Rig }).__plasticSolid = rig
    }

    setRig(rig)

    return () => {
      setRig(null)
      setLiveCapture(null)
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        delete (window as unknown as { __plasticSolid?: Rig }).__plasticSolid
      }
      cancelAnimationFrame(raf)
      observer.disconnect()
      controls.removeEventListener('change', draw)
      controls.dispose()
      composer.dispose()
      env.texture.dispose()
      pmrem.dispose()
      room.dispose()
      renderer.dispose()
      node.removeChild(renderer.domElement)
    }
  }, [node])

  /* The object itself, rebuilt whenever the document changes. */
  useEffect(() => {
    if (!rig) return

    const solid = buildSolid(built.plan, built.style, built.doc)
    const holder = new Group()
    holder.add(solid.group)
    rig.scene.add(holder)

    rig.bounds = solid.bounds
    frame(rig, solid.bounds)
    rig.draw()

    return () => {
      rig.bounds = null
      rig.scene.remove(holder)
      solid.dispose()
    }
  }, [rig, built])

  return <div ref={setNode} className="plastic-view" />
}

/**
 * Point the camera at the object and fit it, without taking the view away.
 *
 * The direction is whatever the person last dragged it to — only the target, the
 * clipping range and the zoom are refitted, so typing another word re-frames the
 * sheet from the same angle rather than snapping back to the opening view. Their
 * own zoom survives as a factor on the fit, which is the only way both can be
 * true at once: the sheet is always framed, and the zoom they chose is still
 * theirs.
 */
function frame(rig: Rig, bounds: Box3): void {
  const { camera, controls, node, sun, gtao, fitted } = rig

  const centre = bounds.getCenter(new Vector3())
  const radius = Math.max(1, bounds.getBoundingSphere(new Sphere()).radius)

  const opening = fitted.zoom === 0
  const direction = opening
    ? directionOf(AZIMUTH, ELEVATION)
    : camera.position.clone().sub(controls.target).normalize()

  const distance = radius * 6
  controls.target.copy(centre)
  camera.position.copy(centre).addScaledVector(direction, distance)
  /*
   * Clipped close around the sheet rather than left wide.
   *
   * Under an orthographic camera the depth buffer is linear across near..far, so
   * a range of nothing-to-far-away spends almost all of its precision on empty
   * space — and the occlusion pass reads that buffer. Three radii of padding
   * keeps the whole object inside it at any orbit angle, since orbiting turns
   * around the centre at a fixed distance and the dolly moves the zoom, not the
   * camera.
   */
  const pad = radius * 3
  camera.near = Math.max(0.01, distance - pad)
  camera.far = distance + pad
  camera.lookAt(centre)
  camera.updateMatrixWorld()

  /*
   * Fit by projecting the eight corners into camera space. The bounding sphere
   * would be angle-independent and never crop — and would also frame a wide
   * sheet by its diagonal, leaving it a third of the size it could be. Fitting
   * the corners at the current angle is what a person would do by hand.
   */
  const inverse = camera.matrixWorldInverse
  const corner = new Vector3()
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < 8; i++) {
    corner
      .set(
        i & 1 ? bounds.max.x : bounds.min.x,
        i & 2 ? bounds.max.y : bounds.min.y,
        i & 4 ? bounds.max.z : bounds.min.z,
      )
      .applyMatrix4(inverse)
    minX = Math.min(minX, corner.x)
    maxX = Math.max(maxX, corner.x)
    minY = Math.min(minY, corner.y)
    maxY = Math.max(maxY, corner.y)
  }

  /*
   * A stage with no size yet is not a fit worth recording.
   *
   * A view can mount before the browser has laid it out, and for that one frame
   * the node is a pixel wide. Fitting to it hands the camera a zoom of a
   * thousandth — the sheet is drawn, correctly, far too small to see — and since
   * nothing refits afterwards it stays there. Leaving the zoom alone until there
   * is a real size to fit to costs one frame of a stale view.
   */
  const w = node.clientWidth
  const h = node.clientHeight
  if (w < 2 || h < 2) return

  const fit =
    Math.min(w / Math.max(1e-3, maxX - minX), h / Math.max(1e-3, maxY - minY)) * FILL
  // Their zoom, as a factor of the fit it was made against. On the opening frame
  // there is nothing to carry, so the factor is one.
  const held = opening ? 1 : camera.zoom / fitted.zoom
  fitted.zoom = fit
  camera.zoom = fit * held
  controls.minZoom = fit * 0.15
  controls.maxZoom = fit * 24
  camera.updateProjectionMatrix()
  controls.update()

  // Fixed to the sheet rather than to the camera, so orbiting turns the object
  // under a light that stays where it is — which is what looking at a thing on a
  // table does, and what makes the walls read as walls.
  const reach = radius * 1.6
  sun.position.copy(centre).add(new Vector3(-reach * 0.7, reach * 0.9, reach * 1.6))
  sun.target.position.copy(centre)
  sun.target.updateMatrixWorld()

  /*
   * **Both of these are distances in the artwork's own units, and that is the
   * trap.**
   *
   * They were copied over from tool 03 to start with — radius near one, thickness
   * 1.6 — where the scene is measured in cap heights and a sign is about one unit
   * tall. This sheet is measured in pixels and is a thousand units across, so
   * those numbers asked the pass to look for occluders within a pixel and a half
   * of each other. It answered honestly: the AO buffer came back **perfectly
   * flat**, 2.15 million pixels of the same grey, and the pass was running full
   * cost to contribute nothing. Read back against the buffer at scene scale it
   * darkens sixteen thousand pixels, which is what contact occlusion is — every
   * crease where a gate meets a wall and a part meets its frame.
   *
   * So both follow the depth of the sheet, which is the size of the step they
   * exist to darken.
   */
  const depth = Math.max(1, bounds.max.z - bounds.min.z)
  gtao.updateGtaoMaterial({
    radius: depth * 1.4,
    distanceExponent: 1.1,
    thickness: depth * 1.2,
    scale: 1.3,
    samples: 16,
  })
  gtao.blendIntensity = 1
}
