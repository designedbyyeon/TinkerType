import { useState } from 'react'
import { ChoiceRow, Group, Note, Scrub, Swatch, Switch } from '../../shared/ui/controls'
import { DownloadIcon } from '../../shared/ui/icons'
import { HOME_HREF } from '../../app/router'
import { FACE_NAME } from '../../shared/media/type/hangul/face'
import { STEP_COUNTS, fitLanes, isEmpty } from './geometry/sequence'
import {
  AttackMark,
  DriveMark,
  GapMark,
  StepMark,
  SwingMark,
  TailMark,
  TempoMark,
  TicksMark,
  ToneMark,
} from './marks'
import { useStore } from './store'
import { useCopy } from '../../shared/i18n/lang'
import { LangSwitch } from '../../shared/i18n/LangSwitch'
import { SITE } from '../../shared/i18n/site'
import { COPY } from './copy'
import { CHO_RIM, JONG_RIM, JUNG_RIM } from './geometry/deck'
import type { Division } from './types'

/*
 * The panel, in the order the bar gets made: the page it plays on, how the
 * syllables are set, the machine that dials them, the colour, and last the trim on
 * the sound.
 *
 * **Tempo, swing, step length and bar length are in `Page`**, not in a group of
 * their own and not down beside the voice. They apply to the whole document —
 * there is no such thing as one lane at a different tempo — and that is the same
 * test the ground colour passes. Rule seven: document decisions and style decisions
 * do not share a group.
 *
 * **There is no `Text` group, and that is the change.** The beat is built by turning
 * the discs and tapping steps, so there is no field to type into. The type did not
 * leave — it moved into the machine, which is what `Type` here sets: the read-out
 * that says what is in your hand, and the lane headers that name each sound. Every
 * letter on the screen is a jamo doing a job.
 *
 * **The arrangement is not a control either.** This machine stacks, because a
 * stacked syllable is what the reference is. The medial wheel therefore holds five
 * vowels and there is nothing here to set the layout with.
 *
 * **The transport is not here.** It is on the stage, because an empty stage is the
 * thing that has to say what to do next — and because an `AudioContext` needs a
 * gesture, so that button has to be the gesture.
 */

export function Panel() {
  const doc = useStore((s) => s.doc)
  const setDoc = useStore((s) => s.setDoc)
  const c = useCopy(COPY)
  const site = useCopy(SITE)

  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setTrim = (patch: Partial<typeof doc.trim>) => setDoc({ trim: { ...doc.trim, ...patch } })

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      // Imported at the click, not at the top: the panel is in the tool's own
      // chunk and the renderer is only ever wanted once.
      const { saveLoop } = await import('./audio/render')
      await saveLoop(doc, 'type-the-beat.wav')
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
          <span>TYPE THE</span>
          <span>BEAT</span>
        </a>
        <span className="masthead-side">
          <span className="masthead-meta">BEATS</span>
          <LangSwitch />
        </span>
      </header>

      {/* 1 — the page, and the clock. Both are decisions about the whole
          document, which is why the tempo is up here and not beside the sound. */}
      <Group title={c.groups.page}>
        <Swatch label={c.ground} value={doc.background} onChange={(v) => setDoc({ background: v })} />
        <Scrub
          label={c.tempo}
          value={doc.bpm}
          min={40}
          max={200}
          unit="bpm"
          emphasis
          mark={<TempoMark bpm={doc.bpm} />}
          onChange={(v) => setDoc({ bpm: v })}
        />
        <ChoiceRow
          label={c.step}
          value={String(doc.division)}
          options={[
            { value: '4', label: '1/4', icon: <StepMark division={4} /> },
            { value: '8', label: '1/8', icon: <StepMark division={8} /> },
            { value: '16', label: '1/16', icon: <StepMark division={16} /> },
          ]}
          onChange={(v) => setDoc({ division: Number(v) as Division })}
        />
        <ChoiceRow
          label={c.bar}
          value={String(doc.steps)}
          options={STEP_COUNTS.map((n) => ({ value: String(n), label: `${n}` }))}
          onChange={(v) => {
            const steps = Number(v)
            // Every lane resized with the bar, in one patch. Growing keeps what
            // was placed and leaves the new tail empty; shrinking drops the tail.
            setDoc({ steps, lanes: fitLanes(doc.lanes, steps) })
          }}
        />
        <Scrub
          label={c.swing}
          value={doc.swing}
          min={0}
          max={1}
          step={0.01}
          mark={<SwingMark swing={doc.swing} />}
          onChange={(v) => setDoc({ swing: v })}
        />
        <Scrub
          label={c.repeats}
          value={doc.repeats}
          min={1}
          max={32}
          unit="x"
          onChange={(v) => setDoc({ repeats: v })}
        />
        <Note>{c.pageNote(doc.division, doc.steps)}</Note>
      </Group>

      {/* 2 — how the syllables are set. There is no text field: the read-out and
          the lane headers are the only type in the tool, so this is it. */}
      <Group title={c.groups.type}>
        <Scrub
          label={c.letter}
          value={doc.letter}
          min={22}
          max={96}
          unit="px"
          emphasis
          onChange={(v) => setDoc({ letter: v })}
        />
        <Scrub
          label={c.lane}
          value={doc.lane}
          min={16}
          max={64}
          unit="px"
          onChange={(v) => setDoc({ lane: v })}
        />
        <Note>{c.typeNote(FACE_NAME)}</Note>
      </Group>

      {/* 3 — the machine. What is on the wheels, and how big. Not where: this
          machine stacks, and the medial wheel is the five vowels that do. */}
      <Group title={c.groups.deck}>
        {/* The jamo themselves are content, not interface: they read the same
            in both languages, so only the sentence around them turns over. */}
        <Note>
          {c.wheelsHold(
            CHO_RIM.join(' '),
            JUNG_RIM.join(' '),
            JONG_RIM.filter(Boolean).join(' '),
          )}{' '}
          {c.deckNote}
        </Note>
        <Scrub
          label={c.radius}
          value={doc.radius}
          min={48}
          max={150}
          unit="px"
          onChange={(v) => setDoc({ radius: v })}
        />
        <Scrub
          label={c.spacing}
          value={doc.spacing}
          min={0.6}
          max={1.8}
          step={0.01}
          mark={<GapMark gap={doc.spacing} />}
          onChange={(v) => setDoc({ spacing: v })}
        />
        <Switch
          label={c.graduations}
          value={doc.ticks}
          mark={<TicksMark on={doc.ticks} />}
          onChange={(v) => setDoc({ ticks: v })}
        />
        <Note>{c.readNote}</Note>
        <Note>{c.vowelNote}</Note>
      </Group>

      {/* 4 — colour, before the trimming below it. A knocked-out letter reads one
          way on near-black and another on a mid grey, and every judgement in Voice
          is made by ear against what is on the screen. */}
      <Group title={c.groups.paint}>
        <Swatch label={c.ink} value={doc.ink} onChange={(v) => setDoc({ ink: v })} />
        <Swatch label={c.disc} value={doc.disc} onChange={(v) => setDoc({ disc: v })} />
        <Swatch label={c.panel} value={doc.panel} onChange={(v) => setDoc({ panel: v })} />
        <Swatch label={c.playhead} value={doc.playhead} onChange={(v) => setDoc({ playhead: v })} />
        <Note>{c.paintNote}</Note>
      </Group>

      {/* 5 — the trim. Every row leans on what the jamo already decided. */}
      <Group title={c.groups.voice}>
        <Scrub
          label={c.tune}
          value={doc.trim.tune}
          min={-24}
          max={24}
          unit="st"
          onChange={(v) => setTrim({ tune: v })}
        />
        <Scrub
          label={c.attack}
          value={doc.trim.attack}
          min={0}
          max={2}
          step={0.05}
          unit="x"
          mark={<AttackMark attack={doc.trim.attack} />}
          onChange={(v) => setTrim({ attack: v })}
        />
        <Scrub
          label={c.tail}
          value={doc.trim.tail}
          min={0.1}
          max={2}
          step={0.05}
          unit="x"
          mark={<TailMark tail={doc.trim.tail} />}
          onChange={(v) => setTrim({ tail: v })}
        />
        <Scrub
          label={c.tone}
          value={doc.trim.tone}
          min={-1}
          max={1}
          step={0.01}
          mark={<ToneMark tone={doc.trim.tone} />}
          onChange={(v) => setTrim({ tone: v })}
        />
        <Scrub
          label={c.drive}
          value={doc.trim.drive}
          min={0}
          max={1}
          step={0.01}
          mark={<DriveMark drive={doc.trim.drive} />}
          onChange={(v) => setTrim({ drive: v })}
        />
        <Note>{c.voiceNote}</Note>
      </Group>

      <Group title={c.groups.export}>
        <button
          type="button"
          className="export-btn"
          disabled={exporting || isEmpty(doc)}
          onClick={handleExport}
          title={isEmpty(doc) ? c.nothingPlaced : c.renderLoop}
        >
          <DownloadIcon />
          <span>{exporting ? c.rendering : 'WAV'}</span>
        </button>
        <Note>{c.exportNote(doc.repeats)}</Note>
        {error && <Note>{error}</Note>}
      </Group>
    </aside>
  )
}
