/**
 * Interleaved samples → a RIFF/WAVE file.
 *
 * Forty lines rather than a dependency, because a 16-bit PCM WAV is a 44-byte
 * header and the samples, and because this is the file the tool hands back — the
 * one thing a designer takes away. Its bytes are worth being able to read.
 */

const HEADER = 44

function writeAscii(view: DataView, at: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i))
}

/**
 * 16-bit PCM, little-endian, interleaved.
 *
 * Clamped before the conversion, not after. A float over 1.0 wrapped by the
 * integer cast comes back as full-scale *opposite* sign, which is not distortion
 * — it is a click, and it would appear only on the loudest step of the bar.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const count = channels.length
  const frames = channels[0]?.length ?? 0
  const bytes = frames * count * 2
  const buffer = new ArrayBuffer(HEADER + bytes)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  // Everything after this field, which is the file minus the first eight bytes.
  view.setUint32(4, HEADER - 8 + bytes, true)
  writeAscii(view, 8, 'WAVE')

  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // the fmt chunk's own length
  view.setUint16(20, 1, true) // 1 = uncompressed PCM
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * 2, true) // bytes per second
  view.setUint16(32, count * 2, true) // bytes per frame
  view.setUint16(34, 16, true) // bits per sample

  writeAscii(view, 36, 'data')
  view.setUint32(40, bytes, true)

  let at = HEADER
  for (let frame = 0; frame < frames; frame++) {
    for (let c = 0; c < count; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][frame]))
      // Asymmetric on purpose: two's complement has one more step below zero
      // than above it, and using 0x8000 for both clips the positive peak.
      view.setInt16(at, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      at += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/** Frames a WAV of this length will hold. The one number a caller has to agree on. */
export function framesFor(seconds: number, sampleRate: number): number {
  return Math.ceil(seconds * sampleRate)
}
