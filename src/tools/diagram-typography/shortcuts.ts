import { useEffect } from 'react'
import { parseSvgToPolylines, svgFromClipboard, SvgImportError } from '../../shared/geometry/importSvg'
import { imageFileFrom, ImageImportError, importImageFile } from '../../shared/media/images'
import { isTyping } from '../../shared/ui/typing'
import { useStore } from './store'
import { useLangStore } from '../../shared/i18n/lang'
import { siteWords } from '../../shared/i18n/site'
import { COPY } from './copy'

/** Read at the moment of the paste, not at the render that installed it. */
const words = () => COPY[useLangStore.getState().lang]

/**
 * Window-level input this tool owns: undo, play/pause, and paste.
 *
 * It lives with the tool rather than in the shell because the meanings are
 * this tool's — space plays *its* animation, and a pasted SVG becomes *its*
 * paths. A second tool will want different answers.
 */
export function useToolShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return

      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        const state = useStore.getState()
        if (e.shiftKey) state.redo()
        else state.undo()
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        const state = useStore.getState()
        if (state.playing) state.pause()
        else if (state.doc.paths.length > 0) state.play()
      }
    }

    async function onPaste(e: ClipboardEvent) {
      // Pasting into the text box should stay text.
      if (isTyping(e.target)) return

      // A bitmap becomes the ground; SVG markup becomes paths. Checked in this
      // order because a copied SVG can also arrive as a rendered bitmap.
      const markup = svgFromClipboard(e.clipboardData)
      if (!markup) {
        const file = imageFileFrom(e.clipboardData)
        if (!file) return
        e.preventDefault()

        const state = useStore.getState()
        try {
          state.setImage(await importImageFile(file))
          state.setNotice(words().groundImageSet)
        } catch (error) {
          state.setNotice(
            error instanceof ImageImportError ? error.message : siteWords().imgUnusable,
          )
        }
        return
      }

      e.preventDefault()

      const state = useStore.getState()
      try {
        const polylines = parseSvgToPolylines(markup, state.doc)
        state.addPaths(polylines)
        state.setNotice(words().cameIn(polylines.length))
      } catch (error) {
        state.setNotice(
          error instanceof SvgImportError ? error.message : siteWords().pasteUnusable,
        )
      }
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [])
}
