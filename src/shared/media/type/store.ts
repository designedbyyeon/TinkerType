import { useEffect, useState } from 'react'
import * as opentype from 'opentype.js'
import { faceUrl, FACES, type FaceId } from './faces'

export interface LoadedFace {
  id: FaceId
  font: opentype.Font
}

/**
 * Outlines come from the font file itself, not from rendered text, so faces are
 * fetched and parsed rather than declared with `@font-face`. There is no CSS side
 * to this at all — nothing on the page is set in any of these faces.
 *
 * Which is the whole distinction in `media/`: `fonts/` holds the one webfont the
 * *interface* is set in, `type/` holds the faces the *tools draw with*. Two tools
 * ask for these now, so they belong to the site rather than to either.
 */
const cache = new Map<FaceId, Promise<LoadedFace>>()

function load(id: FaceId): Promise<LoadedFace> {
  const hit = cache.get(id)
  if (hit) return hit

  /*
   * Two awaits, not one. A Hangul face keeps its URL behind a dynamic import so
   * that the front page never mentions a three-megabyte file — so finding out
   * *where* the font is can itself be a fetch, and it has to happen here rather
   * than in the registry, which has no business doing I/O.
   */
  const pending = faceUrl(FACES[id])
    .then((url) => fetch(url))
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status}`)
      return res.arrayBuffer()
    })
    .then((buffer) => ({ id, font: opentype.parse(buffer) }))

  cache.set(id, pending)
  // A failed fetch must not be cached as a permanent answer.
  pending.catch(() => cache.delete(id))
  return pending
}

export interface FaceState {
  face: LoadedFace | null
  loading: boolean
  error: string | null
}

export function useFace(id: FaceId): FaceState {
  const [face, setFace] = useState<LoadedFace | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setError(null)
    load(id)
      .then((loaded) => live && setFace(loaded))
      .catch(() => live && setError(`Could not load ${FACES[id].name}`))
    return () => {
      live = false
    }
  }, [id])

  return {
    face: face && face.id === id ? face : null,
    loading: (!face || face.id !== id) && !error,
    error,
  }
}
