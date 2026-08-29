import type { Attack, VoiceSpec } from './voice'

/**
 * `VoiceSpec` → actual nodes.
 *
 * Takes a `BaseAudioContext`, never an `AudioContext`, and that is the whole
 * point: **the live output and the exported file call this same function.** Tools
 * 02 and 03 hand their exporter the document and rebuild from it rather than
 * lifting geometry out of the running renderer, for the reason that a file made by
 * a second pipeline is a file nobody can trust. A recorded tap off the live graph
 * would be exactly that second pipeline, and it would also carry whatever the
 * speaker was doing at the time.
 *
 * Nothing in here reads the store or the DOM. It is handed numbers and a time.
 */

/** One second of white noise, built once and shared by every hit. */
function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/**
 * A soft-clip curve for the drive control. Built once per context.
 *
 * Typed against `ArrayBuffer` explicitly: `WaveShaperNode.curve` will not take a
 * `Float32Array<ArrayBufferLike>`, which is what the bare constructor infers now
 * that `SharedArrayBuffer` is in the union.
 */
function makeCurve(): Float32Array<ArrayBuffer> {
  const n = 1024
  const curve = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2)
  }
  return curve
}

export interface Kit {
  ctx: BaseAudioContext
  /** Where voices land. Everything downstream of here is the master chain. */
  bus: GainNode
  noise: AudioBuffer
  curve: Float32Array<ArrayBuffer>
}

/**
 * The master chain, and the noise buffer.
 *
 * The buffer is made here rather than per hit because tool 04 already paid for
 * that lesson in the other direction: the expensive part of a real-time graph is
 * the first call, not the steady state. Forty-four thousand `Math.random()` calls
 * on the first kick is a first kick that arrives late.
 */
export function makeKit(ctx: BaseAudioContext, destination: AudioNode = ctx.destination): Kit {
  const bus = ctx.createGain()
  bus.gain.value = 0.9

  const shaper = ctx.createWaveShaper()
  const curve = makeCurve()
  shaper.curve = curve

  // A little headroom off the top: eight tracks of unreleased stops can land on
  // the same sample, and clipping a beat is not a musical decision.
  const master = ctx.createGain()
  master.gain.value = 0.55

  bus.connect(shaper)
  shaper.connect(master)
  master.connect(destination)

  return { ctx, bus, noise: makeNoise(ctx), curve }
}

/** Exponential ramps cannot reach zero, so silence is this. */
const FLOOR = 0.0005

/** How long this voice occupies, so the offline render knows where to stop. */
export function voiceLength(spec: VoiceSpec): number {
  const flam = spec.hits === 2 ? Math.min(0.075, spec.tail * 0.45) : 0
  const rolls = spec.roll * Math.min(0.05, spec.tail * 0.3)
  // The body's late start counts: an affricate holds its vowel back by 55ms, and a
  // render that did not know that would cut 55ms off the end of every 추.
  return spec.attack.delay + spec.tail + flam + rolls + 0.05
}

/**
 * The transient.
 *
 * `tint` is doing all of the work, and it does it by splitting the burst between
 * **tone and noise**. A 순음 release has no cavity in front of it, so it is almost
 * all tone and it lands on the fundamental — a kick. A 설음 release is half tone
 * and half noise and lands three octaves up — a snare. A 치음 is noise and nothing
 * else — a hat. **Nowhere does anything name a kick or a snare:** the instrument
 * is a consequence of where the mouth closed.
 *
 * The split is why it is one number and not a table of drums. It was measured
 * before it was believed: the first version moved only the burst's pitch sweep,
 * and ㅂ, ㄱ and ㄷ came out of the render within 7% of each other on every band —
 * arithmetic that ran and produced one grey. The lesson from tool 02's occlusion
 * pass, in a medium where you cannot see it.
 */
function transient(kit: Kit, a: Attack, spec: VoiceSpec, at: number, level: number) {
  const { ctx, bus, noise } = kit
  if (a.hit === 'none') return

  // Tense finals are shorter as well as harder; aspirated ones are longer.
  const punch = 0.012 + a.air * 0.05
  const force = 0.25 + a.bite * 0.75

  /*
   * How the release divides. A stop's own place decides it; the other mechanisms
   * are told what they are, because a nasal has no release to divide and a
   * fricative never closes in the first place.
   */
  const tone =
    // A nasal has no release, so it has no burst at all — its murmur *is* the
    // body's swell, and drawing one here on top of that doubled every ㅁ and ㄴ.
    a.hit === 'noise' || a.hit === 'breath' || a.hit === 'hum' ? 0 : 1 - a.tint * 0.85
  const hiss =
    a.hit === 'noise' || a.hit === 'breath'
      ? 1
      : a.hit === 'hum'
        ? 0
        : // Lifted off the floor, because a recorded ㅂ and a recorded ㄷ differ by
        // under a factor of two and the bare `tint` put them six apart. Where they
        // really separate is the *pitch* of the burst, which is a few lines down.
        Math.max(0.32 + a.tint * 0.55, a.air * 0.6)

  if (tone > 0.02) {
    const gain = ctx.createGain()
    gain.connect(bus)
    const osc = ctx.createOscillator()
    osc.type = a.tint < 0.3 ? 'sine' : 'triangle'
    // Held back so the body can be the peak. The burst is still the thing that
    // marks the beat; it no longer has to be the loudest part of the syllable.
    const peak = Math.max(FLOOR, level * force * tone * 0.78)

    /*
     * Where the burst starts and where it lands.
     *
     * Both are multiples of the vowel's own note, so a drum stays the same drum
     * across the whole keyboard. A dark place falls a long way and lands on the
     * fundamental — that fall *is* a kick. A bright place barely falls and stops
     * well above it, which is a rimshot.
     */
    const land = spec.pitch * (1 + a.tint * 7)
    const start = land * (2 + (1 - a.tint) * 6) * (0.6 + a.bite)
    osc.frequency.setValueAtTime(start, at)
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, land), at + punch * 2.4)

    gain.gain.setValueAtTime(peak, at)
    gain.gain.exponentialRampToValueAtTime(FLOOR, at + punch * 3)
    osc.connect(gain)
    osc.start(at)
    osc.stop(at + punch * 4)
  }

  // The friction: how much from the split above, how bright from the place.
  if (hiss > 0.02) {
    const src = ctx.createBufferSource()
    src.buffer = noise
    // A different slice each hit, so a run of hats is not one sample repeated.
    const offset = Math.random() * 0.9

    const band = ctx.createBiquadFilter()
    band.type = a.hit === 'breath' ? 'bandpass' : 'highpass'
    band.frequency.value = 200 + a.tint * a.tint * 9000
    band.Q.value = a.hit === 'breath' ? 1.4 : 0.9

    const hissGain = ctx.createGain()
    const hissPeak = Math.max(FLOOR, level * hiss * force * 0.9)
    /*
     * How long the friction lasts — **by manner, not by one formula.**
     *
     * It used to be `punch * (2 + air * 6)`, which for an aspirated affricate came
     * out at three hundred and twenty milliseconds. That is not a ㅊ, it is a
     * cymbal, and it outlived every final: 춤 and 춥 and 충 were all one long hiss
     * with the release buried under it. An affricate is a stop released into
     * friction and it is over in under a tenth of a second.
     */
    const hissLen =
      a.hit === 'breath'
        ? Math.max(0.1, spec.tail * 0.5)
        : a.hit === 'chirp'
          ? 0.05 + a.air * 0.045
          : a.hit === 'noise'
            ? 0.06 + a.air * 0.07
            : punch * 1.6

    if (a.hit === 'breath') {
      hissGain.gain.setValueAtTime(FLOOR, at)
      hissGain.gain.linearRampToValueAtTime(hissPeak, at + hissLen * 0.35)
    } else {
      hissGain.gain.setValueAtTime(hissPeak, at)
    }
    hissGain.gain.exponentialRampToValueAtTime(FLOOR, at + hissLen)

    src.connect(band)
    band.connect(hissGain)
    hissGain.connect(bus)
    src.start(at, offset, hissLen + 0.02)
  }
}

/**
 * The body and its tail — the vowel, shaped by both consonants.
 *
 * **How loud it is comes from the initial**, and that is the fix for everything
 * sounding alike. The body is the biggest thing in a syllable, and it used to play
 * at one level whatever was in front of it, so 츠 and 으 were the same sawtooth with
 * a different scratch on the front. Now a ㅅ barely voices, a ㅇ is nothing but
 * voice, and a plosive sits between.
 *
 * **How it ends comes from the final.** `close` shuts the filter over the tail by as
 * much as the mouth shuts — ㅁ dives dark because the lips seal at the very front,
 * ㅇ stays open and rings because the seal is at the back and everything ahead of it
 * is still a pipe. `cut` swaps the fade for a stop.
 */
function body(kit: Kit, spec: VoiceSpec, at: number, level: number) {
  const { ctx, bus } = kit
  const voiced = spec.attack.voiced
  if (voiced < 0.02) return

  // The vowel begins when the mouth lets it — after the friction, for an
  // affricate. Measured off recorded Korean: 우 peaks at 20ms, 붐 at 70, 추 at 105.
  const from = at + spec.attack.delay

  const osc = ctx.createOscillator()
  /*
   * Sawtooth, not triangle, and this is the line that makes `open` mean anything.
   *
   * A triangle's harmonics fall off as 1/n^2, so at a 55Hz ㅜ there is nothing above
   * 2kHz for a filter to keep or remove — an earlier version measured flat across
   * all eight vowels because the brightness control had no material to work on. A
   * sawtooth falls off as 1/n and gives the filter something to do.
   */
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(spec.pitch, from)
  if (spec.glide !== 0) {
    // A diphthong is two vowels in one space, so the note travels across the tail
    // rather than jumping.
    osc.frequency.exponentialRampToValueAtTime(
      spec.pitch * Math.pow(2, spec.glide / 12),
      from + spec.tail * 0.8,
    )
  }

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  /*
   * Brightness is the vowel's, resonance and closing are the final's.
   *
   * **The cutoff is mostly absolute, and getting there took being wrong twice.**
   * First it was a fixed frequency with a triangle underneath it, and the filter had
   * no harmonics to work on — every vowel measured the same. Then it became a pure
   * multiple of the note, which passed harmonics but put the cutoff at 157Hz on a
   * 55Hz kick: a sawtooth filtered down to its own fundamental is a sine, and the
   * recordings came back with ten times the high content of anything this made.
   *
   * A vowel's identity **is** its formants, and formants are absolute — that is why
   * the same ㅜ is the same ㅜ sung high or low. So the cutoff is a formant-like
   * frequency, floored against the note so that a very low one never has its own
   * fundamental filtered away.
   */
  const open = Math.min(16000, Math.max(spec.pitch * 2.4, 230 + spec.open * 1700))
  /*
   * **The closing is an event, not a fade.** A coda happens at the *end* of a
   * syllable: the vowel is open for its own length and then the mouth shuts. Ramped
   * across the whole tail instead, the shut is spread so thin that 붐 and 부 measured
   * within two percent of each other over their first 150ms — the lips were closing
   * from the moment the vowel began, which is not a thing a mouth does.
   *
   * So the vowel is held open for the front of the tail, and the closing takes the
   * back of it. The more there is to close, the sooner it starts.
   */
  if (spec.close > 0.02) {
    const shut = spec.tail * (0.62 - spec.close * 0.34)
    filter.frequency.setValueAtTime(open, from)
    filter.frequency.setValueAtTime(open, from + shut)
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(60, open * (1 - spec.close * 0.88)),
      from + spec.tail,
    )
  } else {
    filter.frequency.setValueAtTime(open, from)
  }
  filter.Q.value = 0.7 + spec.ring * 8

  const gain = ctx.createGain()
  // Louder than it was, because in the recordings the **vowel** is the peak of a
  // syllable and the burst is a small click in front of it. An earlier balance had
  // every initial peaking on its transient, which is four different clicks over one
  // body — and four clicks is what "they all sound the same" sounds like.
  const peak = Math.max(FLOOR, level * voiced * (0.36 + spec.ring * 0.4))
  gain.gain.setValueAtTime(FLOOR, from)
  // Struck or swelled. A release is its own onset; a nasal or a silent initial has
  // none, so the voice comes up instead — which is what makes 웅 hum.
  gain.gain.linearRampToValueAtTime(peak, from + Math.max(0.003, spec.attack.onset))

  if (spec.cut) {
    // Unreleased: the closure is made and never opened. Held, then stopped. The
    // stop is measured from the syllable, not from the vowel — a closure does not
    // wait for a late-starting body.
    gain.gain.setValueAtTime(peak, at + Math.max(0.006, spec.tail - 0.008))
    gain.gain.linearRampToValueAtTime(0, at + spec.tail)
  } else {
    gain.gain.exponentialRampToValueAtTime(FLOOR, from + spec.tail)
  }

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(bus)
  osc.start(from)
  osc.stop(from + spec.tail + 0.02)
}

/**
 * The closure itself, for an unreleased stop.
 *
 * 붑 · 춥 · 뭅 — the articulators meeting is audible, and it is the whole reason
 * those end with an exclamation mark rather than with a fade. A short dark thump
 * exactly where the sound stops, so the silence after it is heard as an event.
 */
function closure(kit: Kit, spec: VoiceSpec, at: number, level: number) {
  const { ctx, bus } = kit
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  // Where the closure is made: the lips are lower than the tongue.
  const f = spec.pitch * (1.6 + spec.attack.tint * 2.2)
  osc.frequency.setValueAtTime(f * 1.5, at)
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.7), at + 0.03)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(Math.max(FLOOR, level * 0.34), at)
  /*
   * Eighteen milliseconds, and that number is the difference between a stop and a
   * thud. The first version rang for forty-five and made 붑 come out *longer* than
   * 붐 — an unreleased stop has to be the shortest ending there is, and a closure
   * you can hear decaying is not a closure.
   */
  gain.gain.exponentialRampToValueAtTime(FLOOR, at + 0.018)

  osc.connect(gain)
  gain.connect(bus)
  osc.start(at)
  osc.stop(at + 0.03)
}

/**
 * One syllable, at one moment.
 *
 * Everything about *when* is arithmetic on `at`, which comes from the audio
 * clock. Nothing here asks what time it is.
 */
export function playVoice(kit: Kit, spec: VoiceSpec, at: number, level = 1): void {
  const taps = spec.hits === 2 ? [0, Math.min(0.075, spec.tail * 0.45)] : [0]

  for (const offset of taps) {
    // A y-glide's second articulation is the lighter of the two.
    const weight = offset === 0 ? level : level * 0.7
    transient(kit, spec.attack, spec, at + offset, weight)
    body(kit, spec, at + offset, weight)
    if (spec.cut) closure(kit, spec, at + offset + spec.tail, weight)

    // ㄹ taps more than once. The repeats are transient only — the body is
    // already running underneath them.
    const gap = Math.min(0.05, spec.tail * 0.3)
    for (let i = 1; i <= spec.roll; i++) {
      transient(kit, spec.attack, spec, at + offset + i * gap, weight * (0.65 - i * 0.1))
    }
  }

  // The letter 자음군 단순화 drops, made audible inside the tail. It is the
  // reason a 겹받침 is worth typing on a machine like this.
  if (spec.ghost) {
    transient(kit, spec.ghost, spec, at + spec.tail * 0.55, level * 0.4)
  }
}
