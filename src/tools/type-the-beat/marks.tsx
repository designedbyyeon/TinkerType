/**
 * Miniatures beside the labels that need them.
 *
 * One cell, 26x14, `currentColor` only, so a rail of them reads as one set of
 * drawings rather than as decoration. Each one draws **the thing the value
 * changes**, and moves with the drag.
 *
 * **Rows deliberately left bare, and why.** A mark on every row would be
 * decoration, and then none of them would carry any weight.
 *
 *   Repeats · Bar · Display · Lane · Radius — a count and four lengths. The number
 *     is the drawing; a circle that gets bigger next to `RADIUS 92` says nothing
 *     the numeral has not already said.
 *   Ink · Disc · Panel · Playhead — the swatch already shows the answer.
 *   Tune — `+7` semitones. A pitch is the one musical quantity a designer reads
 *     off a number without help, and a stave drawn at 26x14 is illegible.
 *   Kit rows — the options are the jamo themselves. Drawing a picture of a letter
 *     beside a letter is the definition of decoration.
 *
 * The one that was hardest to justify keeping is `Drive`, because the name is
 * nearly self-explanatory. It stayed because the *amount* is not: the drawing
 * shows the wave flattening, which is the difference between warmth and a square.
 */

const BOX = { width: 26, height: 14, viewBox: '0 0 26 14' } as const
const LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Steps crowding together as the tempo rises. */
export function TempoMark({ bpm }: { bpm: number }) {
  // 60..200 mapped to a wide spacing and a tight one.
  const t = Math.min(1, Math.max(0, (bpm - 60) / 140))
  const pitch = 8 - t * 5.4
  return (
    <svg {...BOX}>
      <g {...LINE}>
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${2 + i * pitch} 3V11`} />
        ))}
      </g>
    </svg>
  )
}

/**
 * How much of a bar one syllable takes: one cell of four, of eight, of sixteen.
 *
 * The only one of these used as a **per-option icon** rather than as a row mark,
 * because Step is a choice and not a number: drawing the result inside each of the
 * three buttons is the site's own rule for a choice, and a single mark beside the
 * label could only ever show the option already picked.
 */
export function StepMark({ division }: { division: number }) {
  const n = division === 4 ? 4 : division === 8 ? 8 : 16
  const w = 22 / n
  return (
    <svg {...BOX}>
      <rect x={2} y={4} width={22} height={6} {...LINE} />
      <rect x={2} y={4} width={w} height={6} fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Every other step pushed late. Flat at zero, limping at one. */
export function SwingMark({ swing }: { swing: number }) {
  const push = swing * 2.6
  return (
    <svg {...BOX}>
      <g {...LINE}>
        <path d="M2 3V11" />
        <path d={`M${8 + push} 4.5V9.5`} />
        <path d="M14 3V11" />
        <path d={`M${20 + push} 4.5V9.5`} />
      </g>
    </svg>
  )
}

/** The platters closing up as the gap goes to nothing. */
export function GapMark({ gap }: { gap: number }) {
  const r = 3.2
  // At gap 0 the discs touch; the drawing has to reach that, or the control looks
  // like it stops short of its own end.
  const half = r + (gap / 1.5) * (5.6 - r)
  return (
    <svg {...BOX}>
      <g {...LINE}>
        <circle cx={13} cy={7 - half} r={r} />
        <circle cx={13} cy={7 + half} r={r} />
      </g>
    </svg>
  )
}

/** The transient: a spike that grows out of the front of the sound. */
export function AttackMark({ attack }: { attack: number }) {
  const h = 1 + Math.min(1, attack / 2) * 8
  return (
    <svg {...BOX}>
      <g {...LINE}>
        <path d="M2 11h22" />
        <path d={`M5 11 6.5 ${11 - h} 8 11`} />
      </g>
    </svg>
  )
}

/** How long it rings. The decay curve stretching out. */
export function TailMark({ tail }: { tail: number }) {
  const reach = 4 + Math.min(1, tail / 2) * 18
  return (
    <svg {...BOX}>
      <g {...LINE}>
        <path d="M2 11h22" />
        <path d={`M3 3C${3 + reach * 0.35} 3 ${3 + reach * 0.4} 11 ${3 + reach} 11`} />
      </g>
    </svg>
  )
}

/** Brightness: the corner of the filter sliding along. */
export function ToneMark({ tone }: { tone: number }) {
  const knee = 6 + ((tone + 1) / 2) * 13
  return (
    <svg {...BOX}>
      <path d={`M2 4h${knee - 2}L24 11`} {...LINE} />
    </svg>
  )
}

/** The wave flattening as it is pushed. */
export function DriveMark({ drive }: { drive: number }) {
  // Zero is a sine; one is nearly a square. Drawn as a clipped sine.
  const cap = 4.6 - drive * 3.4
  const y = (a: number) => 7 - Math.max(-cap, Math.min(cap, Math.sin(a) * 4.6))
  const points = Array.from({ length: 25 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2
    return `${(2 + (i / 24) * 22).toFixed(2)} ${y(a).toFixed(2)}`
  })
  return (
    <svg {...BOX}>
      <path d={`M${points.join('L')}`} {...LINE} />
    </svg>
  )
}

/** The machined edge round a platter: fine graduations and the mark at the top. */
export function TicksMark({ on }: { on: boolean }) {
  const r = 4.2
  return (
    <svg {...BOX}>
      <circle cx={13} cy={8} r={r} fill="currentColor" stroke="none" />
      {on && (
        <g {...LINE}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2
            return (
              <path
                key={i}
                opacity={0.55}
                d={`M${13 + (r + 1) * Math.sin(a)} ${8 - (r + 1) * Math.cos(a)}L${
                  13 + (r + 2.3) * Math.sin(a)
                } ${8 - (r + 2.3) * Math.cos(a)}`}
              />
            )
          })}
        </g>
      )}
    </svg>
  )
}
