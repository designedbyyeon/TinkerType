/**
 * Hand a file to the browser.
 *
 * Three exporters were each carrying their own copy of this — an anchor, a click,
 * a timeout before revoking — and the third one is what makes it worth a file of
 * its own. The tick matters: revoke the URL in the same turn and the download
 * never starts.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
