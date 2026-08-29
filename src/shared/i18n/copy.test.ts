import { describe, expect, it } from 'vitest'
import { SITE } from './site'
import { COPY as DIAGRAM } from '../../tools/diagram-typography/copy'
import { COPY as PLASTIC } from '../../tools/plastic-type/copy'
import { COPY as BILLBOARD } from '../../tools/billboard-typography/copy'
import { COPY as MAGIC } from '../../tools/magic-circle-typography/copy'
import { COPY as BEAT } from '../../tools/type-the-beat/copy'
import { TOOLS } from '../../app/tools'

/*
 * The dictionaries, checked for the one failure TypeScript cannot see.
 *
 * `type Copy = typeof en` already makes a *missing* Korean line a build error.
 * What it cannot catch is a Korean line that is still the English one — the
 * shape is right, the type is right, and the panel quietly shows English inside a
 * Korean interface. That is the whole class of bug this file exists for, and it
 * is the same reason the audio tests assert relationships rather than constants:
 * the thing worth checking is the thing that stays true whatever the wording is.
 *
 * Functions are called rather than compared, because half the copy is a template
 * with a number or a letter in it. One loose argument set is enough — every one
 * of them interpolates whatever it is handed.
 */

/** Strings that are the same in both languages on purpose. */
const SHARED = new Set<string>([
  // Nothing yet. A real one would be a name or a unit, and those live outside
  // the dictionaries — see rule nine.
])

type Dict = Record<string, unknown>

function walk(en: Dict, ko: Dict, path: string, visit: (a: string, b: string, at: string) => void) {
  for (const key of Object.keys(en)) {
    const at = path ? `${path}.${key}` : key
    const a = en[key]
    const b = ko[key]

    if (typeof a === 'string') {
      visit(a, b as string, at)
    } else if (typeof a === 'function') {
      const call = (fn: unknown) => String((fn as (...args: unknown[]) => unknown)(2, 'ㄱ', 'ㄴ'))
      visit(call(a), call(b), `${at}()`)
    } else if (a && typeof a === 'object') {
      walk(a as Dict, b as Dict, at, visit)
    }
  }
}

const DICTS: [string, { en: unknown; ko: unknown }][] = [
  ['site', SITE],
  ['diagram-typography', DIAGRAM],
  ['plastic-type', PLASTIC],
  ['billboard-typography', BILLBOARD],
  ['magic-circle-typography', MAGIC],
  ['type-the-beat', BEAT],
]

describe('the two languages', () => {
  it.each(DICTS)('%s says something in both, and not the same thing', (name, dict) => {
    const untranslated: string[] = []
    const empty: string[] = []

    walk(dict.en as Dict, dict.ko as Dict, '', (a, b, at) => {
      if (!a.trim() || !b.trim()) empty.push(`${name}.${at}`)
      else if (a === b && !SHARED.has(at)) untranslated.push(`${name}.${at}`)
    })

    expect(empty).toEqual([])
    expect(untranslated).toEqual([])
  })

  it('gives every registered tool a blurb and a spec in both', () => {
    for (const tool of TOOLS) {
      for (const lang of ['en', 'ko'] as const) {
        const copy = tool.copy[lang]
        expect(copy.blurb.trim(), `${tool.id} ${lang} blurb`).not.toBe('')
        expect(copy.spec.length, `${tool.id} ${lang} spec`).toBeGreaterThan(0)
        for (const [label, value] of copy.spec) {
          expect(label.trim(), `${tool.id} ${lang} spec label`).not.toBe('')
          expect(value.trim(), `${tool.id} ${lang} spec value`).not.toBe('')
        }
      }
      // The blurb is prose and turns over; the name is a name and does not.
      expect(tool.copy.en.blurb).not.toBe(tool.copy.ko.blurb)
    }
  })
})
