import { useEffect, useMemo, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  OrthographicCamera,
  PCFSoftShadowMap,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { Parsed } from '../../../shared/media/type/measure'
import { layoutOf, type Layout } from '../geometry/layout'
import { PITCH, viewOf } from '../geometry/plan'
import { glyphCacheFor } from '../scene/glyphCache'
import { wordsOf } from '../scene/words'
import type { BillboardDoc } from '../types'
import { styleOf } from '../types'
import { buildBuilding } from './build'

/**
 * One WebGL view of one document. The stage and the index card both use it.
 *
 * Three decisions are the whole look, and all three were arrived at by holding
 * the first pass against a photograph of a physical model and asking what was
 * different.
 *
 * **Orthographic, fixed, shallow.** Not a control: under perspective the
 * verticals splay as the building grows and the framing needs refitting every
 * time a word is typed. Shallow because a 45° isometric shows both walls equally
 * and then neither is the facade — the reference is nearly frontal, a little
 * above and a little to the side.
 *
 * **The ambient is an environment, not a light.** `RoomEnvironment` through PMREM
 * gives every surface a gradient that varies with its orientation, which is what
 * a photographed model actually receives, and it does properly the job a
 * hemisphere light only mimes. It is also why the materials are `MeshStandard`:
 * Lambert cannot take an environment at all.
 *
 * **Depth comes from contact occlusion, not from cast shadows.** A strong key
 * throwing hard shadows is most of what makes a render read as a render. The
 * reference has no key: its depth is in the darkening under every sign, behind
 * every air conditioner, in every reveal. A directional light cannot produce
 * that — it produces one hard shadow per object. GTAO produces it everywhere,
 * which is why the sun here is turned almost off.
 */

const RAD = Math.PI / 180

export interface ViewProps {
  doc: BillboardDoc
  face: Parsed
  /** How the canvas sizes itself. The stage fills; the index card is fixed. */
  className?: string
  /** Rendered once and left alone, for the index still. */
  still?: boolean
}

export function View({ doc, face, className, still }: ViewProps) {
  const holder = useRef<HTMLDivElement>(null)

  const layout = useMemo<Layout>(() => layoutOf(wordsOf(face, doc.text), styleOf(doc)), [face, doc])

  const glyphs = useMemo(() => glyphCacheFor(face, layout.signs), [face, layout])

  useEffect(() => {
    const node = holder.current
    if (!node) return

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.domElement.style.display = 'block'
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFSoftShadowMap
    // Filmic, not linear: the reference is a photograph and its highlights roll
    // off. Clipped whites are most of what makes a render read as plastic.
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.95
    node.appendChild(renderer.domElement)

    /*
     * **The canvas is transparent and the ground colour is CSS.**
     *
     * Painting the ground into the scene put it through the tone mapper, so the
     * same `#f4f3f0` the other two tools sit on came out a shade off — close
     * enough to look like a mistake and impossible to match by eye. Letting the
     * page's own background show through makes it exactly the site's paper, and
     * exactly what the panel beside it is standing on.
     */
    const scene = new Scene()
    renderer.setClearAlpha(0)

    const room = new RoomEnvironment()
    const pmrem = new PMREMGenerator(renderer)
    const env = pmrem.fromScene(room, 0.04)
    scene.environment = env.texture
    scene.environmentIntensity = 0.82

    const sun = new DirectionalLight(0xfff3e2, doc.key)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.03
    sun.shadow.radius = 4
    scene.add(sun)
    scene.add(sun.target)

    const built = buildBuilding(layout, glyphs, doc.detail, doc.seed, { wall: doc.wall, bevel: doc.bevel })
    scene.add(built.group)

    const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 500)
    camera.up.set(0, 1, 0)
    const centre = built.bounds.getCenter(new Vector3())
    const { form } = layout

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const gtao = new GTAOPass(scene, camera, 1, 1)
    gtao.updateGtaoMaterial({
      radius: PITCH * 0.55,
      distanceExponent: 1.1,
      thickness: 1.6,
      scale: 1.35,
      samples: 16,
    })
    gtao.blendIntensity = doc.occlusion
    composer.addPass(gtao)
    composer.addPass(new OutputPass())

    const fit = () => {
      const w = Math.max(1, node.clientWidth)
      const h = Math.max(1, node.clientHeight)
      renderer.setSize(w, h)
      composer.setSize(w, h)

      // The same function the packer used, so the picture and the arrangement
      // cannot disagree about where the camera is.
      const view = viewOf(doc.azimuth)
      const a = view.azimuth * RAD
      const e = view.elevation * RAD
      const reach = form.height * 8 + 40
      camera.position.set(
        centre.x + Math.sin(a) * Math.cos(e) * reach,
        centre.y + Math.sin(e) * reach,
        centre.z + Math.cos(a) * Math.cos(e) * reach,
      )
      camera.lookAt(centre)
      camera.updateMatrixWorld()

      sun.position.set(centre.x - form.height, centre.y + form.height * 1.6, centre.z + form.height)
      sun.target.position.copy(centre)
      sun.target.updateMatrixWorld()
      const shadow = form.height * 1.3
      Object.assign(sun.shadow.camera, {
        left: -shadow,
        right: shadow,
        top: shadow,
        bottom: -shadow,
        near: 1,
        far: reach * 2,
      })
      sun.shadow.camera.updateProjectionMatrix()

      /*
       * Frame the model by projecting its eight corners into camera space. The
       * view direction is fixed, so this only ever changes the zoom and the
       * offset — the composition itself cannot drift, which is the requirement,
       * and it has to hold as the building grows with the sentence.
       */
      const inv = camera.matrixWorldInverse
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      const corner = new Vector3()
      for (let i = 0; i < 8; i++) {
        corner
          .set(
            i & 1 ? built.bounds.max.x : built.bounds.min.x,
            i & 2 ? built.bounds.max.y : built.bounds.min.y,
            i & 4 ? built.bounds.max.z : built.bounds.min.z,
          )
          .applyMatrix4(inv)
        minX = Math.min(minX, corner.x)
        maxX = Math.max(maxX, corner.x)
        minY = Math.min(minY, corner.y)
        maxY = Math.max(maxY, corner.y)
      }

      const aspect = w / h
      const span = Math.max((maxY - minY) / 2, (maxX - minX) / 2 / aspect) * 1.08
      camera.left = (minX + maxX) / 2 - span * aspect
      camera.right = (minX + maxX) / 2 + span * aspect
      camera.top = (minY + maxY) / 2 + span
      camera.bottom = (minY + maxY) / 2 - span
      camera.updateProjectionMatrix()
    }

    /*
     * Drawn on demand, never in a loop. Nothing in the scene moves, so a standing
     * animation frame would burn a GPU to redraw the same picture — the same rule
     * the SVG tools follow for the same reason.
     */
    let raf = 0
    const draw = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        fit()
        composer.render()
      })
    }

    draw()
    const observer = still ? null : new ResizeObserver(draw)
    observer?.observe(node)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      built.dispose()
      env.texture.dispose()
      pmrem.dispose()
      room.dispose()
      composer.dispose()
      renderer.dispose()
      node.removeChild(renderer.domElement)
    }
  }, [layout, glyphs, doc, still])

  return <div ref={holder} className={className ?? 'billboard-view'} />
}
