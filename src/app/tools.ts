import type { ComponentType } from 'react'
import type { Lang } from '../shared/i18n/lang'
import { billboardTypography } from '../tools/billboard-typography'
import { diagramTypography } from '../tools/diagram-typography'
import { magicCircleTypography } from '../tools/magic-circle-typography'
import { plasticType } from '../tools/plastic-type'
import { typeTheBeat } from '../tools/type-the-beat'

/** What the index says about a tool, in one language. */
export interface ToolCopy {
  /** One line, as it reads on the index. */
  blurb: string
  /** Label/value pairs for the index's spec table. */
  spec: [string, string][]
}

export interface Tool {
  id: string
  /**
   * The tool's name, and it does not translate.
   *
   * A name is a name — the same reason `Poppins` and `조선일보 견고딕` are printed
   * as they are in the colophon whichever language is on. `슬리더` would be a
   * transliteration of a word, not a translation of a meaning, and it would give
   * the site two names for one thing to keep in step forever.
   */
  name: string
  /** The prose, per language. */
  copy: Record<Lang, ToolCopy>
  /** A still of what this tool makes, drawn by the tool itself. */
  Preview: ComponentType
  /** The left control rail inside the tool. */
  Panel: ComponentType
  /** The work area inside the tool. */
  Stage: ComponentType
}

/**
 * The register. Order is the order on the index.
 *
 * A tool is just these fields — there is no plugin system. Four more tools have
 * arrived since it was written and **it took none of them to change it**: the
 * third renders with WebGL and loads its whole self on demand, the fourth holds
 * a camera and defers only half of itself, the fifth holds an audio clock and
 * makes a sound file rather than a drawing. All of them did it behind plain
 * components.
 *
 * **The sixth thing changed it, and it was not a tool.** Giving the site a second
 * language turned `blurb` and `spec` from strings into a string per language.
 * There was a version that kept the interface — a translation table in `shared/`
 * keyed by tool id — and it was worse: a tool's own words would have lived
 * somewhere other than the tool, which is the one rule `tools/<id>/` has. The
 * interface was right for five tools and it is still right; it was just never a
 * trophy.
 *
 * Only built tools are listed — a roadmap of names that do not exist would be
 * a promise the site cannot keep.
 */
export const TOOLS: Tool[] = [
  diagramTypography,
  plasticType,
  billboardTypography,
  magicCircleTypography,
  typeTheBeat,
]
