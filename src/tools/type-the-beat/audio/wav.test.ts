import { describe, expect, it } from 'vitest'
import { encodeWav, framesFor } from './wav'

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())
const ascii = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, at + n))
const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer).getUint32(at, true)
const u16 = (b: Uint8Array, at: number) => new DataView(b.buffer).getUint16(at, true)
const i16 = (b: Uint8Array, at: number) => new DataView(b.buffer).getInt16(at, true)

const silence = (n: number) => new Float32Array(n)

describe('the header', () => {
  it('declares itself a PCM WAVE', async () => {
    const b = await bytesOf(encodeWav([silence(10), silence(10)], 44100))
    expect(ascii(b, 0, 4)).toBe('RIFF')
    expect(ascii(b, 8, 4)).toBe('WAVE')
    expect(ascii(b, 12, 4)).toBe('fmt ')
    expect(ascii(b, 36, 4)).toBe('data')
    expect(u32(b, 16)).toBe(16) // fmt chunk length
    expect(u16(b, 20)).toBe(1) // uncompressed
    expect(u16(b, 34)).toBe(16) // bits per sample
  })

  it('agrees with itself about every size', async () => {
    // Three numbers have to match or a player either truncates or reads noise off
    // the end. This is the check that a hand-written header earns.
    const frames = 512
    const b = await bytesOf(encodeWav([silence(frames), silence(frames)], 48000))
    const data = frames * 2 * 2
    expect(u32(b, 40)).toBe(data) // data chunk length
    expect(u32(b, 4)).toBe(36 + data) // RIFF length: the file minus 8
    expect(b.length).toBe(44 + data)
  })

  it('carries the channel count and rate it was given', async () => {
    for (const [count, rate] of [[1, 22050], [2, 44100], [2, 48000]] as const) {
      const b = await bytesOf(encodeWav(Array.from({ length: count }, () => silence(8)), rate))
      expect(u16(b, 22)).toBe(count)
      expect(u32(b, 24)).toBe(rate)
      expect(u16(b, 32)).toBe(count * 2) // bytes per frame
      expect(u32(b, 28)).toBe(rate * count * 2) // bytes per second
    }
  })
})

describe('the samples', () => {
  it('interleaves the channels, frame by frame', async () => {
    const left = new Float32Array([1, 0, -1])
    const right = new Float32Array([0, 1, 0])
    const b = await bytesOf(encodeWav([left, right], 44100))
    // L R L R L R, so the second slot is the first frame's right channel.
    expect(i16(b, 44)).toBe(0x7fff)
    expect(i16(b, 46)).toBe(0)
    expect(i16(b, 48)).toBe(0)
    expect(i16(b, 50)).toBe(0x7fff)
    expect(i16(b, 52)).toBe(-0x8000)
  })

  it('clamps rather than wrapping', async () => {
    /*
     * The bug this exists to stop. A float of 1.4 cast straight to an integer
     * overflows to a large negative — full-scale of the *opposite* sign — so an
     * overdriven step comes back as a click rather than as distortion, and only on
     * the loudest step of the bar.
     */
    const hot = new Float32Array([1.4, -1.9, 12, -50])
    const b = await bytesOf(encodeWav([hot], 44100))
    expect(i16(b, 44)).toBe(0x7fff)
    expect(i16(b, 46)).toBe(-0x8000)
    expect(i16(b, 48)).toBe(0x7fff)
    expect(i16(b, 50)).toBe(-0x8000)
  })

  it('uses the full range in both directions', async () => {
    // Two's complement has one more step below zero than above. Using 0x8000 for
    // both would clip every positive peak by one bit.
    const b = await bytesOf(encodeWav([new Float32Array([1, -1])], 44100))
    expect(i16(b, 44)).toBe(32767)
    expect(i16(b, 46)).toBe(-32768)
  })

  it('writes a valid, empty file for no samples', async () => {
    const b = await bytesOf(encodeWav([new Float32Array(0)], 44100))
    expect(b.length).toBe(44)
    expect(u32(b, 40)).toBe(0)
    expect(u32(b, 4)).toBe(36)
  })
})

describe('the length a caller has to agree on', () => {
  it('rounds up, so the last sample is never cut', () => {
    expect(framesFor(1, 44100)).toBe(44100)
    expect(framesFor(0.5, 44100)).toBe(22050)
    // 0.10001s is not a whole number of frames; flooring would drop the tail.
    expect(framesFor(0.10001, 44100)).toBe(4411)
  })
})
