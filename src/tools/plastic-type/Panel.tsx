import { useState } from 'react'
import { ChoiceRow, Group, Note, Scrub, Swatch, Switch } from '../../shared/ui/controls'
import { DownloadIcon } from '../../shared/ui/icons'
import { exportSvg } from '../../shared/export/svg'
import { HOME_HREF } from '../../app/router'
import { useStore } from './store'
import { CycleIcon, FlatIcon, MonoIcon, SolidIcon } from './icons'
import {
  AcrossMark,
  BevelMark,
  CornerMark,
  DensityMark,
  DepthMark,
  GateMark,
  LatticeMark,
  PlateMark,
  RoundMark,
  TabMark,
  TieMark,
  TrackingMark,
  WallMark,
  WeightMark,
  WidthMark,
} from './marks'
import { FACE_LIST, FACES } from '../../shared/media/type/faces'
import { useFace } from '../../shared/media/type/store'
import type { Script } from '../../shared/media/type/faces'
import type { ColourMode, FaceId, PartUnit, RunnerUnit } from './types'
import { clampRunnerUnit } from './geometry/hangul'
import { useCopy, useLang } from '../../shared/i18n/lang'
import { LangSwitch } from '../../shared/i18n/LangSwitch'
import { SITE } from '../../shared/i18n/site'
import { COPY, type Copy } from './copy'

/** The deepest any role may stand off the back, px. Also the marks' scale. */
const MAX_DEPTH = 90

type Form = 'flat' | 'solid'

/*
 * What the two splits may be cut at, and it depends on the writing system.
 *
 * **Latin has no level below the letter.** Ask the splitter for jamo and it hands
 * back one part per character — the same answer the letter unit gives — so the
 * row would carry two buttons that do the same thing. Hangul does have that
 * level, and it is the whole reason the unit exists: a syllable is two or three
 * jamo, assembled, and a kit that comes apart at that seam is a different kit.
 *
 * The middle rung is renamed rather than relabelled per face. `Letter` and
 * `Syllable` are the same cut — one character — but calling a 음절 a letter is
 * wrong in the way that makes a tool feel written by someone who has not set the
 * language.
 */
const partUnits = (c: Copy): Record<Script, { value: PartUnit; label: string }[]> => ({
  latin: [
    { value: 'syllable', label: c.unitLetter },
    { value: 'word', label: c.unitWord },
    { value: 'sentence', label: c.unitLine },
  ],
  hangul: [
    { value: 'jamo', label: c.unitJamo },
    { value: 'syllable', label: c.unitSyllable },
    { value: 'word', label: c.unitWord },
    { value: 'sentence', label: c.unitLine },
  ],
})

const runnerUnits = (c: Copy): Record<Script, { value: RunnerUnit; label: string }[]> => ({
  latin: [
    { value: 'syllable', label: c.unitLetter },
    { value: 'word', label: c.unitWord },
    { value: 'sentence', label: c.unitLine },
    { value: 'all', label: c.unitAll },
  ],
  hangul: [
    { value: 'syllable', label: c.unitSyllable },
    { value: 'word', label: c.unitWord },
    { value: 'sentence', label: c.unitLine },
    { value: 'all', label: c.unitAll },
  ],
})

export function Panel() {
  const doc = useStore((s) => s.doc)
  const setDoc = useStore((s) => s.setDoc)
  const setPaletteColour = useStore((s) => s.setPaletteColour)
  const pushHistory = useStore((s) => s.pushHistory)
  const c = useCopy(COPY)
  const site = useCopy(SITE)
  const lang = useLang()

  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The panel needs the face only to export a model — the stage loads it anyway
  // and the store hands back the same parse, so this costs a subscription.
  const { face } = useFace(doc.face)

  /**
   * One button, two files, and the form decides which.
   *
   * The flat sheet exports itself: what is on screen is the SVG, so the shared
   * exporter clones the node and takes the editing overlay off it. The solid one
   * cannot work that way — a canvas can only hand over a picture — so it rebuilds
   * the sheet as geometry and writes an OBJ.
   *
   * **The model exporter is imported at the click, not at the top.** It reaches
   * three.js, and this panel is in the index chunk. A visitor who never turns the
   * form to solid must not pay for a renderer, which is the same seam
   * `render/Stage.tsx` draws for the stage.
   */
  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      if (!doc.solid) {
        await exportSvg({ embedFont: false, filename: 'plastic-type.svg' })
      } else {
        const { saveModel } = await import('./render/exportModel')
        if (!face) throw new Error(c.stillLoading)
        // A tick so the button repaints before the geometry is built; a long
        // line is a lot of extrusion and the click would look like it did
        // nothing.
        await new Promise((done) => setTimeout(done, 0))
        saveModel({ doc, face, filename: 'plastic-type.obj' })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : c.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  // Roughly how many frames the sheet has, for the arrangement mark. Counted
  // from the text rather than from the plan so the panel does not have to wait on
  // the font to draw its own controls.
  const frameCount = Math.max(
    1,
    doc.runnerUnit === 'all'
      ? 1
      : doc.runnerUnit === 'sentence'
        ? doc.text.split(/[.!?\n]+/).filter((s) => s.trim()).length
        : doc.runnerUnit === 'word'
          ? doc.text.split(/\s+/).filter(Boolean).length
          : doc.text.replace(/\s+/g, '').length,
  )

  const script = FACES[doc.face].script

  // A frame cannot hold less than one part, so the coarser choices drop out of
  // the row rather than sitting there greyed — the same rule the geometry uses.
  const runnerOptions = runnerUnits(c)[script].filter(
    (o) => clampRunnerUnit(doc.partUnit, o.value) === o.value,
  )

  return (
    <aside className="panel">
      <header className="masthead">
        <a className="wordmark" href={HOME_HREF} title={site.allTools}>
          <span>PLASTIC</span>
          <span>TYPE</span>
        </a>
        <span className="masthead-side">
          <span className="masthead-meta">SPRUE</span>
          <LangSwitch />
        </span>
      </header>

      {/* 1 — the page: which form of the sheet this document is, the ground it
          sits on, and how close you are. All three belong to the document rather
          than to a style, which is why the ground is here and not down in Paint —
          and why the form is here rather than beside the depths it turns on. It
          decides what the file is, not how the sheet looks. */}
      <Group title={c.groups.page}>
        <ChoiceRow
          label={c.form}
          value={doc.solid ? ('solid' as Form) : ('flat' as Form)}
          options={[
            { value: 'flat' as Form, label: c.flat, icon: <FlatIcon /> },
            { value: 'solid' as Form, label: c.solidForm, icon: <SolidIcon /> },
          ]}
          onChange={(v) => setDoc({ solid: v === 'solid' })}
        />
        <Swatch label={c.ground} value={doc.background} onChange={(v) => setDoc({ background: v })} />
        {/* Gone in the solid form, not greyed: there the view is the person's own
            and the wheel is the zoom. Hiding it is the same rule the width axis
            follows on a static cut. */}
        {!doc.solid && (
          <Scrub label={c.zoom} value={doc.zoom} min={0.2} max={2.4} step={0.01} unit="×" onChange={(v) => setDoc({ zoom: v })} />
        )}
      </Group>

      {/* 2 — the words, the face, and how much mass the parts carry. */}
      <Group title={c.groups.text}>
        <textarea
          className="text-input plastic-text"
          value={doc.text}
          spellCheck={false}
          rows={2}
          onFocus={pushHistory}
          onChange={(e) => setDoc({ text: e.target.value })}
        />
        {/* One choice, two banks. The scripts are not two flavours of the same
            list — a face here decides whether the sheet can be cut at the jamo
            at all, and mixing five names into one wrapped row hides that. Two
            labelled rows over one value: whichever script is in use holds the
            highlight, and the other reads as what else is available. */}
        {(['latin', 'hangul'] as const).map((script) => (
          <ChoiceRow
            key={script}
            label={script === 'latin' ? c.latin : c.hangul}
            className="is-faces"
            value={doc.face}
            options={FACE_LIST.filter((f) => f.script === script).map((f) => ({
              value: f.id as FaceId,
              label: f.name,
            }))}
            onChange={(v) =>
              setDoc({
                face: v,
                // Latin cannot be cut at the jamo, so a document carrying that
                // choice across from a Hangul face would leave the row showing
                // nothing selected while the geometry quietly did something else.
                partUnit:
                  FACES[v].script === 'latin' && doc.partUnit === 'jamo' ? 'syllable' : doc.partUnit,
              })
            }
          />
        ))}
        <Note>{FACES[doc.face].note[lang]}</Note>
        <Scrub label={c.size} value={doc.size} min={40} max={400} unit="px" emphasis onChange={(v) => setDoc({ size: v })} />
        {/* Hidden, not greyed, on a static cut — same rule as the width axis. */}
        {FACES[doc.face].wght && (
          <Scrub
            label={c.weight}
            value={doc.wght}
            min={FACES[doc.face].wght!.min}
            max={FACES[doc.face].wght!.max}
            mark={
              <WeightMark
                value={doc.wght}
                min={FACES[doc.face].wght!.min}
                max={FACES[doc.face].wght!.max}
              />
            }
            onChange={(v) => setDoc({ wght: Math.round(v) })}
          />
        )}
        {/* Hidden rather than greyed on a face with no width axis. */}
        {FACES[doc.face].wdth && (
          <Scrub
            label={c.width}
            value={doc.wdth}
            min={FACES[doc.face].wdth!.min}
            max={FACES[doc.face].wdth!.max}
            mark={<WidthMark value={doc.wdth} min={FACES[doc.face].wdth!.min} max={FACES[doc.face].wdth!.max} />}
            onChange={(v) => setDoc({ wdth: Math.round(v) })}
          />
        )}
        <Scrub
          label={c.tracking}
          value={doc.tracking}
          min={0}
          max={140}
          unit="px"
          mark={<TrackingMark value={doc.tracking} max={140} />}
          onChange={(v) => setDoc({ tracking: v })}
        />
      </Group>

      {/* 3 — the tool's own question: what comes apart, and what holds it. */}
      <Group title={c.groups.split}>
        <ChoiceRow
          label={c.part}
          value={doc.partUnit}
          options={partUnits(c)[script]}
          onChange={(v) =>
            setDoc({ partUnit: v, runnerUnit: clampRunnerUnit(v, doc.runnerUnit) })
          }
        />
        <ChoiceRow
          label={c.runner}
          value={clampRunnerUnit(doc.partUnit, doc.runnerUnit)}
          options={runnerOptions}
          onChange={(v) => setDoc({ runnerUnit: v })}
        />
        <Note>{c.splitNote}</Note>
      </Group>

      {/* 4 — colour, before anything that gets judged against it. Every
          thickness below this point is really the question "is the wall thinner
          than the letter", and the same 12px answers it differently in navy on
          cream than in white on black. */}
      <Group title={c.groups.paint}>
        <ChoiceRow
          value={doc.colourMode}
          options={[
            { value: 'mono' as ColourMode, label: c.onePlastic, icon: <MonoIcon /> },
            { value: 'cycle' as ColourMode, label: c.perRunner, icon: <CycleIcon /> },
          ]}
          onChange={(v) => setDoc({ colourMode: v })}
        />

        {doc.colourMode === 'mono' ? (
          <>
            <Swatch label={c.runner} value={doc.runnerColour} onChange={(v) => setDoc({ runnerColour: v })} />
            <Swatch label={c.part} value={doc.partColour} onChange={(v) => setDoc({ partColour: v })} />
          </>
        ) : (
          <>
            {doc.palette.map((colour, i) => (
              <Swatch
                key={i}
                label={c.sprue(String.fromCharCode(65 + i))}
                value={colour}
                onChange={(v) => setPaletteColour(i, v)}
              />
            ))}
            <Note>{c.cycleNote}</Note>
          </>
        )}
      </Group>

      {/* 5 — the third dimension, and only when there is one. After Paint for
          the same reason everything else is: a 34px part reads as a slab in navy
          and as a wafer in white, and the three depths are nothing but a
          judgement about each other. */}
      {doc.solid && (
        <Group title={c.groups.solid}>
          <Scrub
            label={c.part}
            value={doc.partDepth}
            min={1}
            max={MAX_DEPTH}
            unit="px"
            emphasis
            mark={
              <DepthMark
                part={doc.partDepth}
                runner={doc.runnerDepth}
                gate={doc.gateDepth}
                max={MAX_DEPTH}
                role="part"
              />
            }
            onChange={(v) => setDoc({ partDepth: v })}
          />
          <Scrub
            label={c.runner}
            value={doc.runnerDepth}
            min={1}
            max={MAX_DEPTH}
            unit="px"
            mark={
              <DepthMark
                part={doc.partDepth}
                runner={doc.runnerDepth}
                gate={doc.gateDepth}
                max={MAX_DEPTH}
                role="runner"
              />
            }
            onChange={(v) => setDoc({ runnerDepth: v })}
          />
          <Scrub
            label={c.gate}
            value={doc.gateDepth}
            min={1}
            max={MAX_DEPTH}
            unit="px"
            mark={
              <DepthMark
                part={doc.partDepth}
                runner={doc.runnerDepth}
                gate={doc.gateDepth}
                max={MAX_DEPTH}
                role="gate"
              />
            }
            onChange={(v) => setDoc({ gateDepth: v })}
          />
          <Note>{c.depthNote}</Note>
          <Scrub
            label={c.bevel}
            value={doc.bevel}
            min={0}
            max={4}
            step={0.1}
            unit="px"
            mark={<BevelMark value={doc.bevel} max={4} />}
            onChange={(v) => setDoc({ bevel: v })}
          />
          <Scrub
            label={c.gloss}
            value={doc.gloss}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setDoc({ gloss: v })}
          />
          <Note>{c.bevelNote}</Note>
        </Group>
      )}

      {/* 6 — the frame. Density moves the packing; the rest is its shape. */}
      <Group title={c.groups.runner}>
        <Scrub
          label={c.density}
          value={doc.density}
          min={0}
          max={1}
          step={0.01}
          emphasis
          mark={<DensityMark value={doc.density} />}
          onChange={(v) => setDoc({ density: v })}
        />
        <Scrub
          label={c.wall}
          value={doc.wall}
          min={2}
          max={40}
          unit="px"
          mark={<WallMark value={doc.wall} min={2} max={40} />}
          onChange={(v) => setDoc({ wall: v })}
        />
        <Scrub
          label={c.mouldRadius}
          value={doc.round}
          min={0}
          max={40}
          unit="px"
          mark={<RoundMark value={doc.round} min={0} max={40} />}
          onChange={(v) => setDoc({ round: v })}
        />
        <Scrub
          label={c.corner}
          value={doc.corner}
          min={0}
          max={40}
          unit="px"
          mark={<CornerMark value={doc.corner} min={0} max={40} />}
          onChange={(v) => setDoc({ corner: v })}
        />
        <Switch
          label={c.cellBars}
          value={doc.lattice}
          mark={<LatticeMark on={doc.lattice} />}
          onChange={(v) => setDoc({ lattice: v })}
        />
        <Switch
          label={c.tieFrames}
          value={doc.joined}
          mark={<TieMark on={doc.joined} />}
          onChange={(v) => setDoc({ joined: v })}
        />
      </Group>

      {/* 7 — how each part is held, and where you would cut it free. */}
      <Group title={c.groups.gate}>
        {/* Both rows draw the same trapezoid, so the pair reads as one object
            described from its two ends. */}
        <Scrub
          label={c.atRunner}
          value={doc.gate}
          min={1}
          max={30}
          unit="px"
          mark={<GateMark gate={doc.gate} neck={doc.neck} max={30} />}
          onChange={(v) => setDoc({ gate: v })}
        />
        <Scrub
          label={c.atPart}
          value={doc.neck}
          min={0.5}
          max={doc.gate}
          step={0.5}
          unit="px"
          mark={<GateMark gate={doc.gate} neck={doc.neck} max={30} />}
          onChange={(v) => setDoc({ neck: v })}
        />
        <Note>{c.gateNote}</Note>
      </Group>

      {/* 8 — the sheet as a whole: how the frames are laid out, and the
          furniture a real one carries. */}
      <Group title={c.groups.sheet}>
        <Scrub
          label={c.across}
          value={doc.perRow}
          min={0}
          max={12}
          unit={doc.perRow === 0 ? c.oneRow : undefined}
          mark={<AcrossMark perRow={doc.perRow} count={frameCount} />}
          onChange={(v) => setDoc({ perRow: Math.round(v) })}
        />
        <Switch
          label={c.injectionTab}
          value={doc.tab}
          mark={<TabMark on={doc.tab} />}
          onChange={(v) => setDoc({ tab: v })}
        />
        <Switch
          label={c.plate}
          value={doc.plates}
          mark={<PlateMark on={doc.plates} />}
          onChange={(v) => setDoc({ plates: v })}
        />
      </Group>

      <Group title={c.groups.export}>
        <button
          type="button"
          className="export-btn"
          disabled={exporting || (doc.solid && !face)}
          onClick={handleExport}
        >
          <DownloadIcon />
          <span>{exporting ? c.working : doc.solid ? 'OBJ' : 'SVG'}</span>
        </button>
        {doc.solid ? (
          <Note>{c.exportSolid}</Note>
        ) : (
          <Note>{c.exportFlat}</Note>
        )}
        {error && <Note>{error}</Note>}
      </Group>
    </aside>
  )
}
