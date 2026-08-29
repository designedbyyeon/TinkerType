import { useState } from 'react'
import { ChoiceRow, Group, Note, Scrub, Swatch, Switch } from '../../shared/ui/controls'
import { DownloadIcon } from '../../shared/ui/icons'
import { exportSvg } from '../../shared/export/svg'
import { HOME_HREF } from '../../app/router'
import { FACE_LIST, FACES } from '../../shared/media/type/faces'
import { clampSkip } from './geometry/sigil'
import {
  FaceAlternateIcon,
  FaceInIcon,
  FaceOutIcon,
  FillNaturalIcon,
  FillRepeatIcon,
  FillRingIcon,
} from './icons'
import {
  ArcMark,
  BandRuleMark,
  BloomMark,
  GapMark,
  RimMark,
  RingsMark,
  RuleMark,
  SpokesMark,
  StarMark,
  TaperMark,
  TicksMark,
} from './marks'
import { useStore } from './store'
import { useCopy } from '../../shared/i18n/lang'
import { LangSwitch } from '../../shared/i18n/LangSwitch'
import { SITE } from '../../shared/i18n/site'
import { COPY } from './copy'
import { drawsRules, linesOf, sigilFor, type BandStyleChoice, type FaceId, type Fill } from './types'

/*
 * The panel, in the order the plate gets made: the page it sits on, the words,
 * the circle they go round, the colour, the furniture, and last the hand that
 * drives it.
 *
 * Colour comes before the furniture and not after, for the reason the other three
 * tools put it there: every thickness below Paint is really the question "is this
 * rule lighter than the letters", and the same 1.4px answers it differently in
 * near-black on paper than in white over footage.
 *
 * The camera is **not** in the panel. It is switched on from the stage, because an
 * empty stage is the thing that has to say what to do — the group down at the
 * bottom is only what the hand is allowed to touch once it is on.
 *
 * **Text is the biggest group, and that is the point.** Everything in Sigil is off
 * until it is asked for; everything in Text is doing something from the first
 * second. If the two ever swap weight, this has stopped being a typography tool.
 */

export function Panel() {
  const doc = useStore((s) => s.doc)
  const setDoc = useStore((s) => s.setDoc)
  const pushHistory = useStore((s) => s.pushHistory)
  const live = useStore((s) => s.cameraLive)
  const c = useCopy(COPY)
  const site = useCopy(SITE)

  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setAngle = useStore((s) => s.setAngle)

  /** The lines, counted the way the plate counts them. */
  const lines = linesOf(doc.text)

  /*
   * Roughly how wide each line's arc comes out, for the composition diagram.
   *
   * The radii are exact — the plate layout is pure geometry and costs nothing to
   * run here. The letter widths are a guess at half a cap height each, because the
   * real answer needs the parsed face and **the panel must not wait on a font to
   * draw its own controls.** It is a 26×14 thumbnail; a guess that is right to
   * within a few degrees is right enough to see which arc covers which gap.
   */
  const sweeps = sigilFor(doc).bands.map((band) => {
    const n = [...band.text].length
    const arc = n * band.size * 0.5 + doc.tracking * Math.max(0, n - 1)
    return (arc / Math.max(1, band.radius)) * (180 / Math.PI)
  })

  /**
   * Which rows the hand has taken over.
   *
   * Hidden rather than greyed, which is rule four: a control that cannot do
   * anything is not shown at all. Radius is replaced by Reach rather than simply
   * removed, because the designer still owns *how big* — they just now own it as a
   * multiple of their own palm.
   */
  const driven = live && doc.followHand

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      await exportSvg({ embedFont: false, filename: 'magic-circle.svg' })
    } catch (e) {
      setError(e instanceof Error ? e.message : c.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  return (
    <aside className="panel">
      <header className="masthead">
        <a className="wordmark" href={HOME_HREF} title={site.allTools}>
          <span>MAGIC</span>
          <span>CIRCLE</span>
        </a>
        <span className="masthead-side">
          <span className="masthead-meta">RINGS</span>
          <LangSwitch />
        </span>
      </header>

      {/* 1 — the page. The ground and the frame on it: both belong to the
          document rather than to a style, which is why the ground is here and not
          down in Paint. */}
      <Group title={c.groups.page}>
        <Swatch label={c.ground} value={doc.background} onChange={(v) => setDoc({ background: v })} />
        <Switch label={c.mirror} value={doc.mirror} onChange={(v) => setDoc({ mirror: v })} />
        {doc.photo ? (
          <>
            <Scrub
              label={c.photoDim}
              value={doc.dim}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setDoc({ dim: v })}
            />
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                pushHistory()
                setDoc({ photo: null })
              }}
            >
              {c.clearFrame}
            </button>
          </>
        ) : (
          <Note>{c.mirrorNote}</Note>
        )}
      </Group>

      {/* 2 — the words. One line, one ring; the first line is the outermost, so
          the plate reads from the rim inward. */}
      <Group title={c.groups.text}>
        <textarea
          className="text-input magic-text"
          value={doc.text}
          spellCheck={false}
          rows={3}
          onFocus={pushHistory}
          onChange={(e) => setDoc({ text: e.target.value })}
        />
        {/* This tool is Latin only, and a Korean reader has no way of knowing
            that from a field with English in it. Said once, above the faces. */}
        <Note>
          {c.ringNote} {c.latinOnly}
        </Note>
        <ChoiceRow
          label={c.face}
          className="is-faces"
          value={doc.face}
          options={FACE_LIST.map((f) => ({ value: f.id as FaceId, label: f.name }))}
          onChange={(v) => setDoc({ face: v })}
        />
        {/* Hidden rather than greyed on a static cut — Poppins has no axis. */}
        {FACES[doc.face].wght && (
          <Scrub
            label={c.weight}
            value={doc.wght}
            min={FACES[doc.face].wght!.min}
            max={FACES[doc.face].wght!.max}
            onChange={(v) => setDoc({ wght: Math.round(v) })}
          />
        )}
        <Scrub
          label={c.size}
          value={doc.size}
          min={8}
          max={160}
          unit="px"
          emphasis
          onChange={(v) => setDoc({ size: v })}
        />
        {/* The size hierarchy, as one number. A single line has nothing to step
            down from, so the row is not there for it. */}
        {lines.length > 1 && (
          <Scrub
            label={c.step}
            value={doc.taper}
            min={0.4}
            max={1}
            step={0.01}
            unit="×"
            emphasis
            mark={<TaperMark value={doc.taper} />}
            onChange={(v) => setDoc({ taper: v })}
          />
        )}
        <ChoiceRow
          label={c.fill}
          value={doc.fill}
          iconOnly
          options={[
            { value: 'repeat' as Fill, label: c.fillRepeat, icon: <FillRepeatIcon /> },
            { value: 'ring' as Fill, label: c.fillRing, icon: <FillRingIcon /> },
            { value: 'natural' as Fill, label: c.fillNatural, icon: <FillNaturalIcon /> },
          ]}
          onChange={(v) => setDoc({ fill: v })}
        />
        {/* Spacing out to close solves the letterspacing itself, so the row for
            it goes — leaving it would be a number with no effect. Repeating still
            wants it: the tracking is what decides how many copies fit. */}
        {doc.fill !== 'ring' && (
          <Scrub
            label={c.tracking}
            value={doc.tracking}
            min={0}
            max={80}
            unit="px"
            onChange={(v) => setDoc({ tracking: v })}
          />
        )}
        {doc.fill === 'repeat' && (
          <div className="magic-joiner">
            <span className="scrub-label">{c.between}</span>
            <input
              className="swatch-hex"
              type="text"
              value={doc.joiner}
              spellCheck={false}
              maxLength={3}
              onFocus={pushHistory}
              onChange={(e) => setDoc({ joiner: e.target.value })}
            />
          </div>
        )}
      </Group>

      {/* 3 — the circle itself: how far it reaches, how far it has opened, and
          which side of each rule the letters stand on. */}
      <Group title={c.groups.circle}>
        {driven ? (
          <Scrub
            label={c.reach}
            value={doc.reach}
            min={1.2}
            max={7}
            step={0.05}
            unit={c.palms}
            emphasis
            onChange={(v) => setDoc({ reach: v })}
          />
        ) : (
          <Scrub
            label={c.radius}
            value={doc.radius}
            min={40}
            max={900}
            unit="px"
            emphasis
            onChange={(v) => setDoc({ radius: v })}
          />
        )}
        {/* Openness *is* the bloom while a hand is in frame, so the row for it
            steps aside. There is no switch for that pairing — a switch for it
            would be a switch for turning the tool off. */}
        {!live && (
          <Scrub
            label={c.bloom}
            value={doc.bloom}
            min={0}
            max={1}
            step={0.01}
            mark={<BloomMark value={doc.bloom} />}
            onChange={(v) => setDoc({ bloom: v })}
          />
        )}
        {!(live && doc.followSpin) && (
          <Scrub
            label={c.spin}
            value={doc.spin}
            min={-180}
            max={180}
            unit="°"
            onChange={(v) => setDoc({ spin: v })}
          />
        )}
        {/* Where each line's run is centred. One row per line, because composing
            a ring of type is deciding which arc covers the gap the one above it
            left — and no single step applied to all of them does that. A single
            line has only the plate's own spin, so the row would say Spin twice. */}
        {lines.length > 1 &&
          lines.map((_, i) => (
            <Scrub
              key={i}
              label={c.line(i + 1)}
              value={doc.angles[i] ?? 0}
              min={-180}
              max={180}
              unit="°"
              mark={<ArcMark index={i} count={lines.length} angles={doc.angles} sweeps={sweeps} />}
              onChange={(v) => setAngle(i, v)}
            />
          ))}
        <Scrub
          label={c.gutter}
          value={doc.gap}
          min={0}
          max={60}
          unit="px"
          mark={<GapMark value={doc.gap} max={60} />}
          onChange={(v) => setDoc({ gap: v })}
        />
        <ChoiceRow
          label={c.bands}
          value={doc.band}
          iconOnly
          options={[
            { value: 'out' as BandStyleChoice, label: c.bandOut, icon: <FaceOutIcon /> },
            { value: 'in' as BandStyleChoice, label: c.bandIn, icon: <FaceInIcon /> },
            {
              value: 'alternate' as BandStyleChoice,
              label: c.bandAlternate,
              icon: <FaceAlternateIcon />,
            },
          ]}
          onChange={(v) => setDoc({ band: v })}
        />
      </Group>

      {/* 4 — colour, before anything that gets judged against it. */}
      <Group title={c.groups.paint}>
        <Swatch label={c.ink} value={doc.ink} onChange={(v) => setDoc({ ink: v })} />
        <Swatch
          label={c.disc}
          value={doc.plate}
          allowNone
          onChange={(v) => setDoc({ plate: v })}
        />
        {doc.plate !== 'none' && (
          <Scrub
            label={c.discOpacity}
            value={doc.plateOpacity}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setDoc({ plateOpacity: v })}
          />
        )}
        <Note>{c.paintNote}</Note>
      </Group>

      {/* 5 — the furniture, and none of it is on.

          The reference photograph has no drawn line anywhere on it: a hand at the
          lens and three phrases running round it. So this group is a menu of what
          can be added rather than a description of what is there — and the
          line-weight row does not appear until something below it draws a line. */}
      <Group title={c.groups.sigil}>
        <Switch
          label={c.rim}
          value={doc.rim}
          mark={<RimMark on={doc.rim} />}
          onChange={(v) => setDoc({ rim: v })}
        />
        <Switch
          label={c.bandRules}
          value={doc.bandRules}
          mark={<BandRuleMark on={doc.bandRules} />}
          onChange={(v) => setDoc({ bandRules: v })}
        />
        {drawsRules(doc) && (
          <Scrub
            label={c.rule}
            value={doc.rule}
            min={0.4}
            max={6}
            step={0.1}
            unit="px"
            mark={<RuleMark value={doc.rule} max={6} />}
            onChange={(v) => setDoc({ rule: v })}
          />
        )}
        <Scrub
          label={c.ticks}
          value={doc.ticks}
          min={0}
          max={180}
          mark={<TicksMark value={doc.ticks} max={180} />}
          onChange={(v) => setDoc({ ticks: Math.round(v) })}
        />
        <Scrub
          label={c.innerRings}
          value={doc.rings}
          min={0}
          max={6}
          mark={<RingsMark value={doc.rings} />}
          onChange={(v) => setDoc({ rings: Math.round(v) })}
        />
        <Scrub
          label={c.starPoints}
          value={doc.starPoints}
          min={0}
          max={14}
          unit={doc.starPoints < 3 ? c.none : undefined}
          mark={<StarMark points={doc.starPoints} skip={doc.starSkip} />}
          onChange={(v) => setDoc({ starPoints: Math.round(v) })}
        />
        {/* A skip only means something once there is more than one way to join
            the points up: below five points every skip draws the same polygon. */}
        {doc.starPoints >= 5 && (
          <Scrub
            label={c.skip}
            value={clampSkip(doc.starPoints, doc.starSkip)}
            min={1}
            max={Math.max(1, Math.floor((doc.starPoints - 1) / 2))}
            mark={<StarMark points={doc.starPoints} skip={doc.starSkip} />}
            onChange={(v) => setDoc({ starSkip: Math.round(v) })}
          />
        )}
        <Scrub
          label={c.spokes}
          value={doc.spokes}
          min={0}
          max={24}
          mark={<SpokesMark value={doc.spokes} />}
          onChange={(v) => setDoc({ spokes: Math.round(v) })}
        />
        <Note>{c.sigilNote}</Note>
      </Group>

      {/* 6 — the instrument. What the hand is allowed to take over. */}
      <Group title={c.groups.hand}>
        <Switch
          label={c.followHand}
          value={doc.followHand}
          onChange={(v) => setDoc({ followHand: v })}
        />
        <Switch
          label={c.followSpin}
          value={doc.followSpin}
          onChange={(v) => setDoc({ followSpin: v })}
        />
        <Note>{c.handNote}</Note>
      </Group>

      <Group title={c.groups.export}>
        <button
          type="button"
          className="export-btn"
          disabled={exporting || live}
          onClick={handleExport}
        >
          <DownloadIcon />
          <span>{live ? c.captureFirst : exporting ? c.working : 'SVG'}</span>
        </button>
        <Note>{live ? c.exportLive : c.exportNote}</Note>
        {error && <Note>{error}</Note>}
      </Group>
    </aside>
  )
}
