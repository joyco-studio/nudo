import { UNIVERSAL_PARAMS } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { describe, expect, it } from 'vitest'

import { searchNodes } from '@/features/add-node-menu/search-nodes'

import { localizeRegistry } from './localize-node'
import { localeFromLanguage, readInitialLocale, LOCALE_STORAGE_KEY } from './locale'
import { en } from './messages/en'
import { es } from './messages/es'
import { NODES_ES, UNIVERSAL_PARAMS_ES } from './nodes.es'
import { createTranslator, interpolate, isMessageKey, placeholdersOf, plural } from './translate'
import type { Messages } from './translate'

const sourceRegistry = createDefaultRegistry()

function typesFound(registry: ReturnType<typeof createDefaultRegistry>, query: string) {
  return searchNodes(registry.list(), query).flatMap((group) =>
    group.items.map((definition) => definition.type),
  )
}

/** A storage double that remembers what it is given. */
function memoryStorage(entries: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(entries))
  return {
    get length() {
      return values.size
    },
    clear: () => {
      values.clear()
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('messages', () => {
  it('es has every en key', () => {
    // Type-level: `es` is `satisfies Messages`; this assignment keeps that check in the tests too.
    const typed: Messages = es
    expect(Object.keys(typed).sort()).toEqual(Object.keys(en).sort())
  })

  it('keeps every placeholder of a message in its Spanish translation', () => {
    for (const key of Object.keys(en)) {
      if (!isMessageKey(key)) throw new Error(`Not a message key: ${key}`)
      expect(placeholdersOf(es[key]), key).toEqual(placeholdersOf(en[key]))
    }
  })

  it('has no empty message', () => {
    for (const [key, text] of [...Object.entries(en), ...Object.entries(es)]) {
      expect(text.trim(), key).not.toBe('')
    }
  })
})

describe('t', () => {
  it('t interpolates', () => {
    expect(interpolate('Connect {title}', { title: 'Sine › In' })).toBe('Connect Sine › In')
    expect(interpolate('{count} of {count}', { count: 2 })).toBe('2 of 2')
    expect(interpolate('Keeps {unknown}', {})).toBe('Keeps {unknown}')
  })

  it('looks a message up in its language and fills it in', () => {
    const t = createTranslator(es)
    expect(t('inspector.selection.other', { count: 3 })).toBe('3 nodos seleccionados')
    expect(createTranslator(en)('inspector.selection.other', { count: 3 })).toBe('3 nodes selected')
  })

  it('picks the singular only for exactly one', () => {
    const forms = { one: 'inspector.selection.one', other: 'inspector.selection.other' } as const
    expect(plural(1, forms)).toBe('inspector.selection.one')
    expect(plural(0, forms)).toBe('inspector.selection.other')
    expect(plural(2, forms)).toBe('inspector.selection.other')
  })
})

describe('locale', () => {
  it('defaults to Spanish for any Spanish browser language, English otherwise', () => {
    expect(localeFromLanguage('es')).toBe('es')
    expect(localeFromLanguage('es-AR')).toBe('es')
    expect(localeFromLanguage('en-US')).toBe('en')
    expect(localeFromLanguage('pt-BR')).toBe('en')
    expect(localeFromLanguage(undefined)).toBe('en')
  })

  it('prefers the saved locale, and ignores a value it does not know', () => {
    expect(readInitialLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: 'es' }), 'en-US')).toBe('es')
    expect(readInitialLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: 'fr' }), 'es-MX')).toBe('es')
    expect(readInitialLocale(undefined, 'en-GB')).toBe('en')
  })
})

describe('node texts', () => {
  it('translates every built-in node, port and visible param option', () => {
    for (const definition of sourceRegistry.list()) {
      const texts = NODES_ES[definition.type]
      expect(texts, definition.type).toBeDefined()
      for (const input of definition.inputs) {
        expect(texts?.inputs?.[input.id], `${definition.type} ${input.id}`).toBeDefined()
      }
      for (const output of definition.outputs) {
        expect(texts?.outputs?.[output.id], `${definition.type} ${output.id}`).toBeDefined()
      }
      for (const param of definition.params ?? []) {
        if ('hidden' in param && param.hidden) continue
        expect(texts?.params?.[param.id], `${definition.type} ${param.id}`).toBeDefined()
      }
    }
  })

  it('translates the universal params', () => {
    for (const param of UNIVERSAL_PARAMS) {
      expect(UNIVERSAL_PARAMS_ES[param.id], param.id).toBeDefined()
    }
  })

  it('keeps English for a node with no translation (a community node)', () => {
    const localized = localizeRegistry(sourceRegistry, {})
    const [, sample] = sourceRegistry.list()
    if (sample === undefined) throw new Error('The default registry has no nodes')
    expect(localized.get(sample.type)?.label).toBe(sample.label)
  })

  it('shows Spanish labels and ports, and keeps types and builds', () => {
    const localized = localizeRegistry(sourceRegistry, NODES_ES)
    const add = localized.list().find((definition) => definition.type === 'math/add')
    expect(add?.label).toBe('Sumar')
    expect(add?.outputs.map((output) => output.label)).toEqual(['Salida'])
    const noise = localized.list().find((definition) => definition.type === 'effects/noise')
    const kind = noise?.params?.find((param) => param.id === 'kind')
    expect(kind?.label).toBe('Tipo')
  })

  it('finds a node by its Spanish or its English words', () => {
    const localized = localizeRegistry(sourceRegistry, NODES_ES)
    expect(typesFound(localized, 'mezcla')).toContain('interpolation/lerp')
    expect(typesFound(localized, 'mix')).toContain('interpolation/lerp')
    expect(typesFound(localized, 'sumar')).toContain('math/add')
    expect(typesFound(localized, 'add')).toContain('math/add')
    expect(typesFound(localized, 'ruido')).toContain('effects/noise')
  })
})
