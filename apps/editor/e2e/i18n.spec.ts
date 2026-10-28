import { expect, test, type Locator, type Page } from '@playwright/test'

import { TIME_TO_SINE, seedAutosaveOnce } from './support/seed-graph'

/** Mirrors `LOCALE_STORAGE_KEY` in src/i18n/locale.ts. */
const LOCALE_STORAGE_KEY = 'nudo-tsl:locale'
const PALETTE_CHORD = 'ControlOrMeta+k'

function header(page: Page): Locator {
  return page.getByRole('banner')
}

function languageTrigger(page: Page): Locator {
  return header(page).getByRole('button', { name: /^(Language|Idioma)/ })
}

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

async function openEditor(page: Page): Promise<void> {
  await seedAutosaveOnce(page, TIME_TO_SINE)
  await page.goto('/')
  await expect(page.locator('.react-flow__edge-path').first()).toBeVisible()
}

async function chooseLanguage(page: Page, name: 'English' | 'Español'): Promise<void> {
  await languageTrigger(page).click()
  await page.getByRole('menuitemradio', { name }).click()
}

async function expectSpanishHeader(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(header(page).getByRole('button', { name: 'Agregar nodo' })).toBeVisible()
  await expect(header(page).getByRole('button', { name: 'Nuevo grafo' })).toBeVisible()
  await expect(languageTrigger(page)).toHaveAccessibleName('Idioma: ES')
}

test.describe('English and Spanish UI', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  test('switching to ES translates header, panels, node labels and add-node search (search matches Spanish and English keywords)', async ({
    page,
  }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(languageTrigger(page)).toHaveAccessibleName('Language: EN')

    await chooseLanguage(page, 'Español')
    await expectSpanishHeader(page)

    // Panels: their landmarks, headings and toggles.
    await expect(page.getByRole('region', { name: 'Propiedades' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Vista previa principal' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Panel Código', exact: true })).toBeVisible()
    await expect(page.getByText('Ajustes del grafo')).toBeVisible()

    // Node labels and ports.
    await expect(graphNode(page, 'Tiempo')).toBeVisible()
    await expect(graphNode(page, 'Seno')).toBeVisible()
    await expect(graphNode(page, 'Seno').getByText('Entrada', { exact: true })).toBeVisible()
    await expect(page.getByRole('main', { name: 'Lienzo de nodos' })).toBeVisible()

    // The add-node search: Spanish headings and names, matched by Spanish and English words.
    await header(page).getByRole('button', { name: 'Agregar nodo' }).click()
    const dialog = page.getByRole('dialog', { name: 'Agregar nodo' })
    const search = dialog.getByRole('combobox', { name: 'Buscar nodos' })
    await expect(dialog.getByRole('group', { name: 'Matemática' })).toBeVisible()
    for (const [query, expected] of [
      ['mezcla', 'Lerp'],
      ['mix', 'Lerp'],
      ['sumar', 'Sumar'],
      ['add', 'Sumar'],
      ['ruido', 'Ruido'],
      ['noise', 'Ruido'],
    ] as const) {
      await search.fill(query)
      await expect(dialog.getByRole('option', { name: new RegExp(`^${expected}`) })).toBeVisible()
    }
    await search.fill('zzz')
    await expect(
      dialog.getByText('Ningún nodo coincide con "zzz".', { exact: false }),
    ).toBeVisible()
  })

  test('locale persists', async ({ page }) => {
    await chooseLanguage(page, 'Español')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    expect(await page.evaluate((key) => localStorage.getItem(key), LOCALE_STORAGE_KEY)).toBe('es')

    await page.reload()
    await expectSpanishHeader(page)
    await expect(graphNode(page, 'Seno')).toBeVisible()

    await chooseLanguage(page, 'English')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(header(page).getByRole('button', { name: 'Add node' })).toBeVisible()
  })

  test('the language menu works from the keyboard and returns focus to its button', async ({
    page,
  }) => {
    const trigger = languageTrigger(page)
    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu', { name: 'Language' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitemradio', { name: 'English' })).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitemradio', { name: 'Español' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expectSpanishHeader(page)
    await expect(languageTrigger(page)).toBeFocused()
  })

  test('the command palette switches the language', async ({ page }) => {
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press(PALETTE_CHORD)
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.getByRole('combobox').fill('spanish')
    await expect(palette.getByRole('option', { name: /Español/ })).toBeVisible()
    await page.keyboard.press('Enter')
    await expectSpanishHeader(page)

    await page.keyboard.press(PALETTE_CHORD)
    const paleta = page.getByRole('dialog', { name: 'Paleta de comandos' })
    // Both languages' words find it: "inglés" and "english".
    await paleta.getByRole('combobox').fill('english')
    await expect(paleta.getByRole('option', { name: /English/ })).toBeVisible()
    await paleta.getByRole('combobox').fill('inglés')
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

test.describe('a narrow header', () => {
  test.use({ locale: 'es-AR', viewport: { width: 360, height: 700 } })

  test('keeps the language switch, as an icon, and the whole Spanish graph name', async ({
    page,
  }) => {
    await openEditor(page)
    await expect(languageTrigger(page)).toBeInViewport({ ratio: 1 })
    const crumb = page.getByRole('navigation', { name: 'Grafo' }).getByText('Grafo sin título')
    const { scrollWidth, clientWidth } = await crumb.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
})

test.describe('a Spanish browser', () => {
  test.use({ locale: 'es-AR' })

  test('opens in Spanish until another language is chosen', async ({ page }) => {
    await openEditor(page)
    await expectSpanishHeader(page)
  })
})
