import type { VoiceTrim } from './audio/voice'

/** Which note length one step occupies. */
export type Division = 4 | 8 | 16

/**
 * One row of the sequencer: a syllable, and where in the bar it sounds.
 *
 * A lane *is* its syllable — there is no separate name, because the syllable is
 * the whole description of the sound. Which is the tool's premise arriving in the
 * document model: 초성 is the attack, 중성 the body, 종성 the release, so `'붐'` says
 * everything a drum machine's channel strip would have said.
 */
export interface Lane {
  syllable: string
  /** One flag per step. Length is kept equal to `BeatDoc.steps`. */
  steps: boolean[]
  /**
   * How loud this lane sits in the bar. 0..1, and 1 is the sound as written.
   *
   * **This is a mix, not a sound.** 가획 is still where a syllable's own force
   * comes from — 뚬 hits harder than 둠 because it has one more stroke and one
   * more puff of air, and no fader changes that. What this changes is how far
   * forward one lane sits against the others, which is a decision about a bar and
   * not about a letter. The two do not collide: a lane at half level plays the
   * same 뚬, quieter.
   */
  level: number
}

export interface BeatDoc {
  // ---- Page. Everything here is a document-scale decision.
  width: number
  height: number
  background: string
  /**
   * Tempo, swing and the step length live in `Page` and not in a style group,
   * for the reason the ground colour does: they apply to the whole document.
   * There is no such thing as one lane at a different tempo.
   */
  bpm: number
  division: Division
  /** 0..1. Pushes every other step late, the way a drummer does. */
  swing: number
  /** How long the bar is, in steps. */
  steps: number
  /** How many times round the loop the exported file goes. */
  repeats: number

  // ---- Sequence. Built by turning the discs, never typed.
  lanes: Lane[]
  /**
   * What the three discs are pointing at.
   *
   * The instrument in hand. It is not necessarily one of the lanes — dialling
   * through the wheels would otherwise litter the grid with empty rows — so the
   * sequencer shows it as a ghost row until a step is tapped into it.
   */
  dialed: string

  // ---- Type. There is no text field; the letters *are* the interface.
  /**
   * Drawn height of a letter on the machine, px.
   *
   * The three selected ones spell the syllable down the middle of the deck, so
   * this is the size the instrument reads at — and the reason there is no separate
   * read-out any more. An earlier version set a 132px syllable beside the machine
   * because the machine could not spell one; now it can.
   */
  letter: number
  /** Drawn height of a lane's syllable in the bar, px. */
  lane: number

  /*
   * ---- Deck. How big the wheels are.
   *
   * **What is *on* them is no longer a setting.** The kit is four initials, two
   * medials and four finals, fixed in `geometry/deck.ts` — so there is nothing here
   * to choose between, and rule four says a control with one option is not a
   * control.
   */
  radius: number
  /**
   * Space between the three selected letters, as a fraction of the radius.
   *
   * Sets the whole machine's height: the discs hang off it, so their centres end up
   * `2 * (0.58r + spacing)` apart. Floored in `deckOf` at the point where one disc
   * would sit inside the other.
   */
  spacing: number
  ticks: boolean

  // ---- Paint.
  ink: string
  /** The disc's own face — the letters on it are knocked out in this. */
  disc: string
  /** The sunk panels the machine sits on. */
  panel: string
  playhead: string

  // ---- Voice. Trims on what the jamo already decided, never replacements.
  trim: VoiceTrim
}

/** Seconds per step, from the tempo and the note length. */
export function stepSeconds(doc: BeatDoc): number {
  return 60 / doc.bpm / (doc.division / 4)
}

/**
 * How late an odd step runs, in seconds.
 *
 * A third of a step at full swing, which is the triplet feel — pushed further and
 * it stops being swing and becomes a different rhythm.
 */
export function swingOffset(doc: BeatDoc, tick: number): number {
  return tick % 2 === 1 ? stepSeconds(doc) * doc.swing * 0.33 : 0
}
