import fontUrl from '../media/fonts/PretendardVariable.woff2?url'

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // Chunked: a single fromCharCode over ~2MB blows the argument limit.
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

let cachedFontCss: string | null = null

async function fontFaceCss(): Promise<string> {
  if (cachedFontCss) return cachedFontCss
  const res = await fetch(fontUrl)
  if (!res.ok) throw new Error(`The font could not be loaded (${res.status})`)
  const base64 = toBase64(await res.arrayBuffer())
  cachedFontCss = `@font-face{font-family:'Pretendard Variable';font-style:normal;font-weight:45 920;src:url(data:font/woff2;base64,${base64}) format('woff2');}`
  return cachedFontCss
}

export interface ExportOptions {
  embedFont: boolean
  /** Required: a shared module must not hand out one tool's filename. */
  filename: string
}

/**
 * Serialise the on-screen SVG.
 *
 * The artwork element *is* the document, so export is a clone with the
 * editor's own overlays stripped — there is no second rendering path that
 * could drift from what the designer is looking at.
 */
export async function buildSvgString({ embedFont }: ExportOptions): Promise<string> {
  const source = document.getElementById('artwork') as SVGSVGElement | null
  if (!source) throw new Error('No canvas to export')

  const clone = source.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('id')
  clone.removeAttribute('class')
  clone.querySelectorAll('[data-ui]').forEach((el) => el.remove())
  clone.querySelectorAll('[data-path-id]').forEach((el) => el.removeAttribute('data-path-id'))

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  if (embedFont) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = await fontFaceCss()
    clone.insertBefore(style, clone.firstChild)
  }

  const markup = new XMLSerializer().serializeToString(clone)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`
}

export async function exportSvg(options: ExportOptions): Promise<void> {
  const svg = await buildSvgString(options)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = options.filename
  document.body.appendChild(a)
  a.click()
  a.remove()

  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
