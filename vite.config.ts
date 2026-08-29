import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so one build runs from a domain root or from a
  // subdirectory — the hosting decision stays open. (Not from file://:
  // Plastic Type fetches its TTFs and a null origin has no CORS to satisfy.)
  base: './',
  // The hand model is a MediaPipe `.task` bundle, which Vite has no opinion
  // about. Declared as an asset so tool 04 can import it with `?url` and get a
  // fingerprinted, lazily-fetched file — the same way the faces are loaded.
  // The task runtime's own wasm cannot come through here: its loader builds the
  // `.wasm` path from the `.js` path by string surgery, which a content hash
  // breaks. That pair lives in `public/vision/` instead.
  assetsInclude: ['**/*.task'],
  // The launcher assigns a free port through PORT rather than a flag, so two
  // sessions can serve this repo at once. Vite does not read that variable by
  // itself; without these two lines it takes 5173/4173 and collides.
  server: { port: Number(process.env.PORT) || undefined },
  preview: { port: Number(process.env.PORT) || undefined },
  plugins: [react()],
})
