import { useState } from 'react'
import { HOME_HREF } from '../../app/router'
import { exportSvg } from '../../shared/export/svg'
import { resolveStyle } from './geometry/nodes'
import { useStore } from './store'
import { bitmapFor, ImageImportError, importImageFile } from '../../shared/media/images'
import type { Style } from './types'
import { ChoiceRow, Disclosure, Group, Note, Scrub, Swatch, Switch } from '../../shared/ui/controls'
import { Joystick } from './Joystick'
import { PresetBar } from './PresetBar'
import {
  CloseIcon,
  DownloadIcon,
  PasteIcon,
  PauseIcon,
  PictureIcon,
  PlayIcon,
  RotateIcon,
  SkipEndIcon,
} from '../../shared/ui/icons'
import {
  BrushIcon,
  CircleIcon,
  EaseBackIcon,
  EaseLinearIcon,
  EaseOutIcon,
  FilletIcon,
  MetaballIcon,
  RoundSquareIcon,
  SelectIcon,
  SquareIcon,
  VarNoneIcon,
  VarRampIcon,
  VarRandomIcon,
  VarWaveIcon,
} from './icons'
import { useCopy } from '../../shared/i18n/lang'
import { LangSwitch } from '../../shared/i18n/LangSwitch'
import { SITE } from '../../shared/i18n/site'
import { COPY } from './copy'
import {
  CornerMark,
  CyclesMark,
  FillerCountMark,
  FillerSizeMark,
  SmoothMark,
  SpreadMark,
  StartMark,
  TangentMark,
} from './marks'

type Scope = 'all' | 'path'

export function Panel() {
  const doc = useStore((s) => s.doc)
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const selectedPathId = useStore((s) => s.selectedPathId)
  const setDoc = useStore((s) => s.setDoc)
  const applyToAll = useStore((s) => s.applyToAll)
  const setImage = useStore((s) => s.setImage)
  const updateImage = useStore((s) => s.updateImage)
  const clearImage = useStore((s) => s.clearImage)
  const updatePath = useStore((s) => s.updatePath)
  const updatePathStyle = useStore((s) => s.updatePathStyle)
  const updatePathTransform = useStore((s) => s.updatePathTransform)
  const resetPathTransform = useStore((s) => s.resetPathTransform)
  const deletePath = useStore((s) => s.deletePath)
  const selectPath = useStore((s) => s.selectPath)
  const clearAll = useStore((s) => s.clearAll)
  const pushHistory = useStore((s) => s.pushHistory)
  const setInteracting = useStore((s) => s.setInteracting)
  const setAnim = useStore((s) => s.setAnim)
  const notice = useStore((s) => s.notice)
  const setNotice = useStore((s) => s.setNotice)
  const playing = useStore((s) => s.playing)
  const timeMs = useStore((s) => s.timeMs)
  const play = useStore((s) => s.play)
  const pause = useStore((s) => s.pause)
  const setTime = useStore((s) => s.setTime)

  const c = useCopy(COPY)
  const site = useCopy(SITE)

  const [scope, setScope] = useState<Scope>('all')
  const [embedFont, setEmbedFont] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageError(null)
    try {
      setImage(await importImageFile(file))
    } catch (err) {
      setImageError(err instanceof ImageImportError ? err.message : site.imgUnusable)
    }
  }

  const selected = doc.paths.find((p) => p.id === selectedPathId) ?? null
  const targetPath = scope === 'path' ? selected : null
  const style = resolveStyle(doc.defaults, targetPath?.style ?? {})

  /** Route a style change to the selected path, or genuinely to everything. */
  function set<K extends keyof Style>(key: K, value: Style[K]) {
    if (targetPath) updatePathStyle(targetPath.id, { [key]: value } as Partial<Style>)
    else applyToAll({ [key]: value } as Partial<Style>)
  }

  /**
   * The joystick fires every frame, so the current position is read straight
   * from the store rather than from this render's closure.
   */
  function nudge(dx: number, dy: number) {
    const state = useStore.getState()
    const path = state.doc.paths.find((p) => p.id === state.selectedPathId)
    if (!path) return
    const limitX = state.doc.width
    const limitY = state.doc.height
    state.updatePathTransform(path.id, {
      x: Math.max(-limitX, Math.min(limitX, path.transform.x + dx)),
      y: Math.max(-limitY, Math.min(limitY, path.transform.y + dy)),
    })
  }

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      await exportSvg({ embedFont, filename: 'diagram-typography.svg' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <aside className="panel">
      <header className="masthead">
        {/* The site over the tool, and the stack is the way back out. The tool
            names are one word each and carry no 'type' of their own — the line
            above them is where the site says it, once, in every tool. */}
        <a className="wordmark" href={HOME_HREF} title={site.allTools}>
          <span>TINKERTYPE</span>
          <span>SLITHER</span>
        </a>
        <span className="masthead-side">
          <span className="masthead-meta">{String(doc.paths.length).padStart(2, '0')} OBJ</span>
          <LangSwitch />
        </span>
      </header>

      <div className="toolbar">
        <button
          type="button"
          className={tool === 'brush' ? 'is-active' : ''}
          onClick={() => setTool('brush')}
        >
          <BrushIcon />
          <span>{c.draw}</span>
        </button>
        <button
          type="button"
          className={tool === 'select' ? 'is-active' : ''}
          onClick={() => setTool('select')}
        >
          <SelectIcon />
          <span>{c.select}</span>
        </button>
      </div>

      {/* Paste sits with the other way of getting a path in, not buried in a
          text section — pasting an SVG makes a path, not words. */}
      <div className="paste-hint">
        <PasteIcon />
        <span>{notice ?? c.pasteHint}</span>
        {notice && (
          <button type="button" className="icon-btn" title={c.dismiss} onClick={() => setNotice(null)}>
            <CloseIcon />
          </button>
        )}
      </div>

      {/* 1 — set up the page: where to begin, and what colour it sits on. */}
      <Group title={c.groups.page}>
        <PresetBar />
        <Swatch label={c.ground} value={doc.background} onChange={(v) => setDoc({ background: v })} />

        {/* The photo is the ground, so it lives here rather than in a section
            of its own. */}
        {doc.image ? (
          <>
            <div className="image-row">
              <span className="image-thumb">
                <img src={bitmapFor(doc.image.id)} alt="" />
              </span>
              <span className="image-name">{doc.image.name}</span>
              <button type="button" className="icon-btn" title={c.removeImage} onClick={clearImage}>
                <CloseIcon />
              </button>
            </div>
            <Scrub label={c.scale} value={doc.image.scale} min={0.2} max={4} step={0.01} unit="×" onChange={(v) => updateImage({ scale: v })} />
            <Scrub label={c.shiftX} value={doc.image.x} min={-doc.width} max={doc.width} unit="px" onChange={(v) => updateImage({ x: v })} />
            <Scrub label={c.shiftY} value={doc.image.y} min={-doc.height} max={doc.height} unit="px" onChange={(v) => updateImage({ y: v })} />
            <Scrub label={c.dim} value={doc.image.dim} min={0} max={1} step={0.01} onChange={(v) => updateImage({ dim: v })} />
          </>
        ) : (
          <label className="image-drop">
            <PictureIcon />
            <span>{imageError ?? c.dropImage}</span>
            <input type="file" accept="image/*" onChange={onPickImage} />
          </label>
        )}
      </Group>

      {/* 2 — draw the line, then say what it reads. */}
      <Group title={c.groups.text}>
        <textarea
          className="text-input"
          rows={2}
          value={selected?.text ?? ''}
          placeholder={selected ? '' : c.drawFirst}
          disabled={!selected}
          onFocus={pushHistory}
          onChange={(e) => selected && updatePath(selected.id, { text: e.target.value })}
        />
        <ChoiceRow
          label={c.count}
          value={style.countMode}
          options={[
            { value: 'spacing', label: c.byGap },
            { value: 'text', label: c.fitText },
          ]}
          onChange={(v) => set('countMode', v)}
        />
        <Scrub
          label={c.start}
          value={style.textStart}
          min={0}
          max={100}
          unit="%"
          mark={<StartMark value={style.textStart} min={0} max={100} />}
          onChange={(v) => set('textStart', v)}
        />
      </Group>

      {/* With a single object "all" and "selected" are the same thing, so the
          choice only appears once it can actually mean something. */}
      {doc.paths.length > 1 && (
        <div className="scope">
          <span className="scope-label">{c.apply}</span>
          <div className="scope-options">
            <button
              type="button"
              className={scope === 'all' ? 'is-active' : ''}
              onClick={() => setScope('all')}
            >
              {c.all}
            </button>
            <button
              type="button"
              className={scope === 'path' ? 'is-active' : ''}
              disabled={!selected}
              onClick={() => setScope('path')}
            >
              {c.selected}
            </button>
          </div>
        </div>
      )}

      {/* 3 — the rhythm of the chain. */}
      <Group title={c.groups.shape}>
        <ChoiceRow
          iconOnly
          value={style.shape}
          options={[
            { value: 'circle', label: c.circle, icon: <CircleIcon /> },
            { value: 'square', label: c.square, icon: <SquareIcon /> },
            { value: 'roundSquare', label: c.rounded, icon: <RoundSquareIcon /> },
          ]}
          onChange={(v) => set('shape', v)}
        />
        <Scrub emphasis label={c.size} value={style.size} min={4} max={300} unit="px" onChange={(v) => set('size', v)} />
        {style.countMode === 'spacing' && (
          <Scrub emphasis label={c.gap} value={style.spacing} min={2} max={400} unit="px" onChange={(v) => set('spacing', v)} />
        )}
        {style.shape === 'roundSquare' && (
          <Scrub
            label={c.corner}
            value={style.cornerRadius}
            min={0}
            max={1}
            step={0.01}
            mark={<CornerMark value={style.cornerRadius} />}
            onChange={(v) => set('cornerRadius', v)}
          />
        )}
      </Group>

      {/* 4 — the signature move. */}
      <Group title={c.groups.join}>
        <ChoiceRow
          iconOnly
          value={style.blendMode}
          options={[
            { value: 'fillet', label: c.fillet, icon: <FilletIcon /> },
            { value: 'metaball', label: c.metaball, icon: <MetaballIcon /> },
          ]}
          onChange={(v) => set('blendMode', v)}
        />
        <Scrub
          emphasis
          label={style.blendMode === 'fillet' ? c.radius : c.swell}
          value={style.blend}
          min={0}
          max={120}
          unit="px"
          onChange={(v) => set('blend', v)}
        />
        <Note>{style.blendMode === 'fillet' ? c.filletNote : c.metaballNote}</Note>
      </Group>

      {/* 5 — colour it before refining it. Light shapes on dark read heavier
          than dark on light, so judging size and gap comes after this. */}
      <Group title={c.groups.paint}>
        <Swatch label={c.fill} value={style.fill} onChange={(v) => set('fill', v)} allowNone />
        <Swatch label={c.stroke} value={style.stroke} onChange={(v) => set('stroke', v)} allowNone />
        {style.stroke !== 'none' && (
          <Scrub label={c.line} value={style.strokeWidth} min={0.25} max={30} step={0.25} unit="px" onChange={(v) => set('strokeWidth', v)} />
        )}
      </Group>

      {/* 6 — break the regularity. */}
      <Group title={c.groups.variation}>
        <ChoiceRow
          iconOnly
          value={style.sizeVariation}
          options={[
            { value: 'none', label: c.uniform, icon: <VarNoneIcon /> },
            { value: 'ramp', label: c.ramp, icon: <VarRampIcon /> },
            { value: 'wave', label: c.wave, icon: <VarWaveIcon /> },
            { value: 'random', label: c.random, icon: <VarRandomIcon /> },
          ]}
          onChange={(v) => set('sizeVariation', v)}
        />
        {style.sizeVariation !== 'none' && (
          <Scrub
            label={c.amount}
            value={style.sizeAmount}
            min={0}
            max={0.95}
            step={0.01}
            mark={<SpreadMark value={style.sizeAmount} min={0} max={0.95} />}
            onChange={(v) => set('sizeAmount', v)}
          />
        )}
        {style.sizeVariation === 'wave' && (
          <Scrub
            label={c.cycles}
            value={style.sizeFrequency}
            min={0.5}
            max={12}
            step={0.5}
            mark={<CyclesMark value={style.sizeFrequency} min={0.5} max={12} />}
            onChange={(v) => set('sizeFrequency', v)}
          />
        )}
        {style.sizeVariation === 'random' && (
          <Scrub label={c.seed} value={style.sizeSeed} min={1} max={999} onChange={(v) => set('sizeSeed', v)} />
        )}
        <Switch label={c.dotsBetween} value={style.fillerEnabled} onChange={(v) => set('fillerEnabled', v)} />
        {style.fillerEnabled && (
          <>
            <Scrub
              label={c.perGap}
              value={style.fillerCount}
              min={1}
              max={6}
              mark={<FillerCountMark value={style.fillerCount} />}
              onChange={(v) => set('fillerCount', v)}
            />
            <Scrub
              label={c.dotSize}
              value={style.fillerSize}
              min={1}
              max={80}
              unit="px"
              mark={<FillerSizeMark value={style.fillerSize} min={1} max={80} />}
              onChange={(v) => set('fillerSize', v)}
            />
          </>
        )}
      </Group>

      {/* 7 — fit the letters to the shapes that now exist. */}
      <Group title={c.groups.letters}>
        <Scrub emphasis label={c.size} value={style.fontSize} min={4} max={200} unit="px" onChange={(v) => set('fontSize', v)} />
        <Scrub label={c.weight} value={style.fontWeight} min={100} max={900} step={50} onChange={(v) => set('fontWeight', v)} />
        <Swatch label={c.colour} value={style.textColor} onChange={(v) => set('textColor', v)} />
        <Switch
          label={c.followPath}
          value={style.rotateToTangent}
          mark={<TangentMark on={style.rotateToTangent} />}
          onChange={(v) => set('rotateToTangent', v)}
        />
        <Disclosure title={c.baseline}>
          <Scrub label={c.shift} value={style.textOffset} min={-40} max={40} step={0.5} unit="px" onChange={(v) => set('textOffset', v)} />
        </Disclosure>
      </Group>

      {/* 8 — pick an object and place it. The list and the controls that act
          on the selection live together, so choosing does not mean scrolling
          somewhere else to adjust. */}
      <Group
        title={c.groups.objects}
        aside={
          doc.paths.length > 0 && (
            <button type="button" className="text-btn" onClick={clearAll}>
              {c.clear}
            </button>
          )
        }
      >
        {doc.paths.length === 0 ? (
          <Note>
            {tool === 'brush' ? c.drawCue : c.switchToDraw}
          </Note>
        ) : (
          <ul className="obj-list">
            {doc.paths.map((p, i) => (
              <li key={p.id} className={p.id === selectedPathId ? 'is-active' : ''}>
                <button type="button" className="obj-pick" onClick={() => selectPath(p.id)}>
                  <span className="obj-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="obj-text">{p.text || '—'}</span>
                </button>
                <button type="button" className="icon-btn" title={c.delete} onClick={() => deletePath(p.id)}>
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <>
            <div className="obj-divider">
              <span>{c.selected}</span>
              <button
                type="button"
                className="icon-btn"
                title={c.resetTransform}
                onClick={() => resetPathTransform(selected.id)}
              >
                <RotateIcon />
              </button>
            </div>
            <div className="stick-block">
              <Joystick
                onNudge={nudge}
                onStart={() => {
                  pushHistory()
                  setInteracting(true)
                }}
                onEnd={() => setInteracting(false)}
              />
              <div className="stick-readout">
                <span>X</span>
                <b>{Math.round(selected.transform.x)}</b>
                <span>Y</span>
                <b>{Math.round(selected.transform.y)}</b>
              </div>
            </div>
            <Scrub label={c.scale} value={selected.transform.scale} min={0.05} max={5} step={0.01} unit="×" onChange={(v) => updatePathTransform(selected.id, { scale: v })} />
            <Scrub label={c.rotate} value={selected.transform.rotation} min={-180} max={180} unit="°" onChange={(v) => updatePathTransform(selected.id, { rotation: v })} />
            <Scrub
              label={c.smooth}
              value={selected.smoothing}
              min={0}
              max={80}
              unit="px"
              mark={<SmoothMark value={selected.smoothing} min={0} max={80} />}
              onChange={(v) => updatePath(selected.id, { smoothing: v })}
            />
          </>
        )}
      </Group>

      {/* 9 — watch it build itself. */}
      <Group title={c.groups.motion}>
        <div className="transport">
          <button
            type="button"
            className={`transport-play${playing ? ' is-playing' : ''}`}
            onClick={() => (playing ? pause() : play())}
            disabled={doc.paths.length === 0}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
            <span>{playing ? c.pause : c.play}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            title={c.jumpToEnd}
            disabled={timeMs >= doc.anim.durationMs && !playing}
            onClick={() => {
              pause()
              setTime(doc.anim.durationMs)
            }}
          >
            <SkipEndIcon />
          </button>
          <span className={`transport-time${timeMs < doc.anim.durationMs ? ' is-partial' : ''}`}>
            {(timeMs / 1000).toFixed(2)}<i>s</i>
          </span>
        </div>
        {!playing && timeMs < doc.anim.durationMs && (
          <Note>{c.parkedNote}</Note>
        )}
        <Scrub
          label={c.playhead}
          value={timeMs}
          min={0}
          max={doc.anim.durationMs}
          unit="ms"
          onChange={(v) => {
            pause()
            setTime(v)
          }}
        />
        <Scrub label={c.duration} value={doc.anim.durationMs} min={200} max={8000} step={50} unit="ms" onChange={(v) => setAnim({ durationMs: v })} />
        <Scrub label={c.pop} value={doc.anim.popMs} min={60} max={2000} step={10} unit="ms" onChange={(v) => setAnim({ popMs: v })} />
        <ChoiceRow
          iconOnly
          value={doc.anim.easing}
          options={[
            { value: 'back', label: c.overshoot, icon: <EaseBackIcon /> },
            { value: 'out', label: c.soft, icon: <EaseOutIcon /> },
            { value: 'linear', label: c.even, icon: <EaseLinearIcon /> },
          ]}
          onChange={(v) => setAnim({ easing: v })}
        />
        <Switch label={c.loop} value={doc.anim.loop} onChange={(v) => setAnim({ loop: v })} />
      </Group>

      <Group title={c.groups.export}>
        <Switch label={c.embedFont} value={embedFont} onChange={setEmbedFont} />
        <button type="button" className="export-btn" disabled={exporting} onClick={handleExport}>
          <DownloadIcon />
          <span>{exporting ? c.working : 'SVG'}</span>
        </button>
        {error && <Note>{error}</Note>}
      </Group>
    </aside>
  )
}
