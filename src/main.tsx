import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'

// Order matters: tokens define the variables the rest read, and tool sheets
// come last so a tool can lean on the shared language and then depart from it.
import './shared/styles/tokens.css'
import './shared/styles/controls.css'
import './app/app.css'
import './tools/diagram-typography/tool.css'
import './tools/plastic-type/tool.css'
import './tools/billboard-typography/tool.css'
import './tools/magic-circle-typography/tool.css'
import './tools/type-the-beat/tool.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
