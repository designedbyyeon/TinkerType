import { useEffect } from 'react'
import { Home } from './Home'
import { SITE_NAME, useRoute } from './router'
import { TOOLS } from './tools'

export default function App() {
  const route = useRoute()
  const tool = TOOLS.find((t) => t.id === route)

  // The tab is part of the interface: inside a tool it says which tool, because
  // that is what you need when six of them are open at once.
  useEffect(() => {
    document.title = tool ? tool.name : SITE_NAME
  }, [tool])

  if (!tool) return <Home />

  // The shell is only the frame. Everything inside it belongs to the tool,
  // including its own keyboard shortcuts and paste handling.
  return (
    <div className="app">
      <tool.Panel />
      <tool.Stage />
    </div>
  )
}
