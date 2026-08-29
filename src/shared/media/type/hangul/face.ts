import { useEffect, useState } from 'react'
import * as opentype from 'opentype.js'
import { unitHeight, type Parsed } from '../measure'
import url from './fonts/ChosunBg.ttf?url'

/**
 * The site's Hangul face.
 *
 * 조선일보 견고딕 — a shop-sign face: square, heavy, flat-sided. It arrived with
 * tool 03, where Korean signage is the whole premise, and it lived in that tool's
 * folder on the rule written down after the tool before it was scrapped: **move a
 * thing to `shared/` when a second consumer exists, not when one is expected.**
 * Tool 05 is that second consumer, so here it is.
 *
 * **Not in `faces.ts`.** That file is in the index's module graph, so a static
 * `?url` import from it drags 3.9MB into `dist` whether anything fetches it or
 * not — which is exactly the accident that put this font in a tool folder the
 * first time. This module is reachable only from the tools' lazy chunks, and the
 * check is simple: nothing in `app/` may import it.
 *
 * **It is 3.9MB.** Both tools defer it, so the index never sees it, but opening
 * either one downloads all of it — see `fonts/NOTICE.md`. Subsetting is still the
 * outstanding cost, and it is now worth twice as much as it was.
 */

export const FACE_NAME = '조선일보 견고딕'

/**
 * The syllable Size is measured on, for a tool that sets syllables.
 *
 * `한` rather than a Latin cap, and it has to be a syllable with a full-height
 * jamo stack — measure a bare `이` and every face reports a different height for
 * the same drawn size.
 */
export const REFERENCE = '한'

/**
 * And the letter Size is measured on for a tool that sets **jamo**.
 *
 * Tool 05 puts single letters on a turntable, not syllables, so `한` would be the
 * wrong ruler: a full stack is taller than any one of its parts, and Size would
 * quietly mean something a third smaller than the number says. `ㅁ` is the
 * squarest of them and has no ascending or descending detail to argue about.
 */
export const JAMO_REFERENCE = 'ㅁ'

/**
 * Parsed once, shared by both tools. A failure is not cached as a permanent
 * answer.
 *
 * `Parsed`, not `Face` — a `Face` carries an id into the shipped registry and
 * this font is not in it. Asking for the smaller type is what lets a tool bring
 * its own font without inventing a registry entry to satisfy a signature.
 */
let pending: Promise<Parsed> | null = null

function load(): Promise<Parsed> {
  if (pending) return pending
  pending = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status}`)
      return res.arrayBuffer()
    })
    .then((buffer) => ({ font: opentype.parse(buffer) }))
  pending.catch(() => {
    pending = null
  })
  return pending
}

/** Drawn height of the reference syllable at size 1. No axes: a static cut. */
export function signUnit(face: Parsed): number {
  return unitHeight(face, REFERENCE)
}

/** Drawn height of the reference jamo at size 1. */
export function jamoUnit(face: Parsed): number {
  return unitHeight(face, JAMO_REFERENCE)
}

export interface FaceState {
  face: Parsed | null
  loading: boolean
  error: string | null
}

export function useSignFace(): FaceState {
  const [face, setFace] = useState<Parsed | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    load()
      .then((loaded) => live && setFace(loaded))
      .catch(() => live && setError(`Could not load ${FACE_NAME}`))
    return () => {
      live = false
    }
  }, [])

  return { face, loading: !face && !error, error }
}
