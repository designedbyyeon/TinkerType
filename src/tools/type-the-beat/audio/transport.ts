import { hitsAt, isEmpty } from '../geometry/sequence'
import { stepSeconds, swingOffset, type BeatDoc } from '../types'
import { makeKit, playVoice, type Kit } from './engine'
import { voiceFor } from './voice'

/**
 * The clock.
 *
 * **Nothing in here reads React state, and that is not a style preference.** A
 * gesture that reads stale state jumps once; a scheduler that reads stale state
 * books every step of the next bar against a pattern the designer has already
 * changed, so an edit lands two bars late or never — and unlike every other bug in
 * this repository, **you cannot screenshot it.** The document arrives through
 * `read()`, which is `useStore.getState`, called fresh on every poll.
 *
 * The timing itself is the standard two-clock arrangement: a coarse `setInterval`
 * that only ever *books* work, and the audio clock that actually performs it. The
 * interval may be late by tens of milliseconds and nothing moves, because every
 * note already has an exact `startTime` on the sample clock. Which is why the
 * drift measurement in `log` reads in microseconds rather than in frames.
 */

/** How often to wake up and book work, ms. */
const POLL = 25
/** How far ahead to book it, seconds. Comfortably more than two polls. */
const LOOKAHEAD = 0.12

interface Booked {
  tick: number
  time: number
}

export interface Transport {
  start: () => Promise<void>
  stop: () => void
  /**
   * Where the loop is right now, in fractional ticks — for the playhead.
   *
   * Read off the audio clock and interpolated between booked steps, never counted
   * by the poll. With swing on, steps are not evenly spaced, so interpolating
   * between what was actually booked is the only way the playhead lands on the
   * note you hear.
   */
  position: () => number
  /** Audition one syllable now, transport or no transport. A platter scrubbing. */
  audition: (syllable: string) => void
  dispose: () => void
  /**
   * Ideal against actual start time, per booked step. **Development only.**
   *
   * The one number that says whether this file works, and it cannot be had any
   * other way — a unit test has no audio clock and the ear cannot measure half a
   * millisecond.
   */
  log: Array<{ tick: number; ideal: number; actual: number }>
}

export function makeTransport(read: () => BeatDoc): Transport {
  let ctx: AudioContext | null = null
  let kit: Kit | null = null
  let poll: number | null = null

  /** The next step to book, and when it goes. */
  let nextTick = 0
  let nextTime = 0
  /** What has been booked, for the playhead to interpolate across. */
  let booked: Booked[] = []
  const log: Transport['log'] = []

  function ensure(): Kit {
    if (!ctx) {
      ctx = new AudioContext()
      kit = makeKit(ctx)
    }
    return kit!
  }

  function bookOne(k: Kit, doc: BeatDoc, tick: number, at: number) {
    if (isEmpty(doc)) return
    // Every lane that has this step lit, sounded together. A tail outlives its own
    // step at any tempo worth using, which is left alone rather than cut — that
    // overlap is what a ringing 종성 is for.
    for (const hit of hitsAt(doc, tick)) {
      const spec = voiceFor(hit.syllable, doc.trim)
      if (spec) playVoice(k, spec, at, hit.level)
    }
  }

  function tickOnce() {
    const k = kit
    if (!k || !ctx) return
    const doc = read()
    const step = stepSeconds(doc)

    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const at = nextTime + swingOffset(doc, nextTick)
      /*
       * Booked in the future, always. If the poll was late enough that this step's
       * moment has already gone, it is dropped rather than fired at once: a note
       * crammed in behind the beat is worse than a note missing, and it would
       * also make the drift log lie about what happened.
       */
      if (at > ctx.currentTime) {
        bookOne(k, doc, nextTick, at)
        booked.push({ tick: nextTick, time: at })
        if (import.meta.env.DEV) {
          log.push({ tick: nextTick, ideal: nextTime, actual: at })
          if (log.length > 4000) log.shift()
        }
      }
      nextTick++
      // The grid advances by the unswung step: swing displaces a note inside its
      // own slot, it does not accumulate. Adding the offset here instead would
      // drag the whole bar later and later.
      nextTime += step
    }

    // Keep enough history for the playhead to interpolate, and no more.
    if (booked.length > 64) booked = booked.slice(-32)
  }

  return {
    async start() {
      const k = ensure()
      // Suspended is what a context is until a gesture resumes it; the transport
      // button on the stage is that gesture.
      if (ctx!.state === 'suspended') await ctx!.resume()

      nextTick = 0
      nextTime = ctx!.currentTime + 0.08
      booked = []
      log.length = 0
      tickOnce()
      poll = window.setInterval(tickOnce, POLL)
      void k
    },

    stop() {
      if (poll !== null) {
        window.clearInterval(poll)
        poll = null
      }
      booked = []
      // The context stays open and the already-booked notes ring out. Closing it
      // would cut the tail of whatever was sounding, and reopening one costs the
      // whole graph again.
    },

    position() {
      if (!ctx || booked.length === 0) return 0
      const now = ctx.currentTime
      let last: Booked | null = null
      for (const b of booked) {
        if (b.time <= now) last = b
        else break
      }
      if (!last) return booked[0].tick
      const next = booked.find((b) => b.time > now)
      if (!next) return last.tick
      const span = next.time - last.time
      const through = span > 0 ? (now - last.time) / span : 0
      return last.tick + through * (next.tick - last.tick)
    },

    audition(syllable) {
      const k = ensure()
      if (ctx!.state === 'suspended') void ctx!.resume()
      const spec = voiceFor(syllable, read().trim)
      if (spec) playVoice(k, spec, ctx!.currentTime + 0.005)
    },

    dispose() {
      this.stop()
      void ctx?.close()
      ctx = null
      kit = null
    },

    log,
  }
}
