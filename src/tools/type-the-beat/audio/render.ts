import { hitsAt, isEmpty } from '../geometry/sequence'
import { stepSeconds, swingOffset, type BeatDoc } from '../types'
import { makeKit, playVoice, voiceLength } from './engine'
import { voiceFor } from './voice'
import { encodeWav, framesFor } from './wav'

/**
 * The loop as a file.
 *
 * **Built from the document, not tapped off the live output** — the rule tools 02
 * and 03 arrived at for their models, in the medium where it matters most. A
 * recording of the speaker would carry whatever the transport happened to be doing
 * and whatever the browser's own output stage did to it, and it would be a second
 * pipeline that could drift from the first. So the file is rendered offline
 * through `playVoice`, which is the same function the transport calls. There is no
 * path by which the file and the sound can disagree.
 *
 * And it needs no gesture: an `OfflineAudioContext` is not the speaker, so Export
 * works whether or not anything has been played. Tool 04 had to say CAPTURE FIRST;
 * this one never does.
 */

export const SAMPLE_RATE = 44100

/** Seconds the exported file will run, tail included. */
export function loopLength(doc: BeatDoc): number {
  if (isEmpty(doc)) return 0

  const step = stepSeconds(doc)
  const body = doc.steps * doc.repeats * step

  /*
   * Room for the last step to finish.
   *
   * The longest voice in the pattern, not a constant: a bar ending on 두 rings for
   * four hundred milliseconds and a bar ending on 둑 for fifty, and a fixed
   * allowance would either clip the first or leave silence after the second.
   */
  let tail = 0
  for (const lane of doc.lanes) {
    if (!lane.steps.some(Boolean)) continue
    const spec = voiceFor(lane.syllable, doc.trim)
    if (spec) tail = Math.max(tail, voiceLength(spec))
  }
  return body + tail
}

export async function renderLoop(doc: BeatDoc): Promise<Blob> {
  if (isEmpty(doc)) throw new Error('Nothing to play — tap some steps in')

  const seconds = loopLength(doc)
  const ctx = new OfflineAudioContext(2, framesFor(seconds, SAMPLE_RATE), SAMPLE_RATE)
  const kit = makeKit(ctx)
  const step = stepSeconds(doc)

  const total = doc.steps * doc.repeats
  for (let tick = 0; tick < total; tick++) {
    // The grid advances by the unswung step and swing displaces a note inside its
    // own slot — the same arithmetic as the transport, for the same reason: added
    // to the grid it would drag the whole take later and later.
    const at = tick * step + swingOffset(doc, tick)
    for (const hit of hitsAt(doc, tick)) {
      const spec = voiceFor(hit.syllable, doc.trim)
      // The lane's level, the same one the transport uses — the file and the
      // speaker read the mix from the same place, as they do the notes.
      if (spec) playVoice(kit, spec, at, hit.level)
    }
  }

  const rendered = await ctx.startRendering()
  return encodeWav(
    [rendered.getChannelData(0), rendered.getChannelData(1)],
    rendered.sampleRate,
  )
}

/** Save it. The download pattern the other tools' exporters use. */
export async function saveLoop(doc: BeatDoc, filename: string): Promise<void> {
  const url = URL.createObjectURL(await renderLoop(doc))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // A tick for the browser to start the download before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
