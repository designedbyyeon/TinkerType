import { useCopy, useLang } from '../../shared/i18n/lang'
import { COPY } from './copy'
import { presetsFor } from './presets/references'
import { BLANK_SLOT, blankDoc, useStore } from './store'

/**
 * Numbered starting points, each its own workspace. Thumbnails were dropped
 * deliberately: three tiny renders competed with the poster for attention,
 * and the names carry enough in a tooltip.
 *
 * The presets are built for the current language — a starting point whose job is
 * to show what the tool makes has to be readable by whoever is looking at it. The
 * ids are not translated, so switching language never loses a workspace.
 */
export function PresetBar() {
  const activeSlot = useStore((s) => s.activeSlot)
  const switchSlot = useStore((s) => s.switchSlot)
  const c = useCopy(COPY)
  const presets = presetsFor(useLang())
  // Presets are composed at a fixed size and fitted to the live work area, so
  // they land centred and in proportion whatever the window is.

  return (
    <div className="starts">
      <button
        type="button"
        className={`start is-blank${activeSlot === BLANK_SLOT ? ' is-active' : ''}`}
        title={c.emptyCanvas}
        onClick={() => switchSlot(BLANK_SLOT, blankDoc)}
      >
        {c.new}
      </button>
      {presets.map((preset, i) => (
        <button
          key={preset.id}
          type="button"
          className={`start${activeSlot === preset.id ? ' is-active' : ''}`}
          title={`${preset.name} — ${preset.note}`}
          onClick={() => switchSlot(preset.id, preset.build)}
        >
          {c.presetN(String(i + 1).padStart(2, '0'))}
        </button>
      ))}
    </div>
  )
}
