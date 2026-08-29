import { useEffect, useState } from 'react'

/** What the tab says on the index. Inside a tool the tab says the tool. */
export const SITE_NAME = 'Tinkertype'

/**
 * Hash routing, deliberately.
 *
 * Not to avoid a dependency — because `#/tool` needs no server rewrite rules,
 * the same build runs from a subdirectory or a domain root without one. That
 * keeps the hosting decision open instead of baking one in now.
 *
 * Not `file://` though: Plastic Type fetches its TTFs, and a null origin has no
 * CORS to satisfy. `npm run preview` is the way to open a build locally.
 */
function currentRoute(): string {
  return window.location.hash.replace(/^#\/?/, '')
}

export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const sync = () => setRoute(currentRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return route
}

export const HOME_HREF = '#/'
export const toolHref = (id: string) => `#/${id}`
