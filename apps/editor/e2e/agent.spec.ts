import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  connectAgent,
  credentialsFromCommand,
  E2E_AGENT_NAME,
  imageOf,
  textOf,
  type AgentClient,
} from './support/agent-client'
import { tabUntilFocused } from './support/focus-indicators'
import { graphNode } from './support/graph-keyboard'
import { imageStats } from './support/image-stats'

/**
 * These specs run the real MCP Worker (`wrangler dev`, see playwright.config.ts) between an MCP
 * SDK client in this Node process and the editor tab, the way Claude Code would drive nudo.
 */

const MASTER_TYPE = 'master/stack'
const BASE_COLOR_PORT = 'baseColor'
const CHECK_STEP = 'Checking the preview'
/** An encoded PNG of a blank 512 px canvas is a few hundred bytes; any shader is far above it. */
const MIN_PREVIEW_PNG_BYTES = 2_000
/** A rendered noise varies across the image; a blank or cleared canvas has (almost) none. */
const MIN_PREVIEW_LUMA_STD_DEV = 2

interface NodeTypeSummary {
  type: string
  label: string
  outputs: { id: string }[]
}

interface GraphSummary {
  nodes: { id: string; type: string }[]
  edges: { id: string }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asNodeTypes(value: unknown): NodeTypeSummary[] {
  if (!Array.isArray(value)) throw new Error('list_node_types did not return a list')
  return value.filter(
    (item): item is NodeTypeSummary =>
      isRecord(item) &&
      typeof item.type === 'string' &&
      typeof item.label === 'string' &&
      Array.isArray(item.outputs),
  )
}

function asGraph(value: unknown): GraphSummary {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error('get_graph did not return a graph')
  }
  const nodes = value.nodes.flatMap((node: unknown) =>
    isRecord(node) && typeof node.id === 'string' && typeof node.type === 'string'
      ? [{ id: node.id, type: node.type }]
      : [],
  )
  const graphEdges = value.edges.flatMap((edge: unknown) =>
    isRecord(edge) && typeof edge.id === 'string' ? [{ id: edge.id }] : [],
  )
  return { nodes, edges: graphEdges }
}

function nodeIdOf(value: unknown): string {
  if (isRecord(value) && typeof value.nodeId === 'string') return value.nodeId
  throw new Error('add_node did not return a node id')
}

function codeOf(value: unknown): string {
  if (isRecord(value) && typeof value.code === 'string') return value.code
  throw new Error('get_code did not return code')
}

function agentChip(page: Page): Locator {
  return page.getByRole('banner').getByRole('button', { name: new RegExp(E2E_AGENT_NAME) })
}

function activityPanel(page: Page): Locator {
  return page.getByRole('region', { name: `${E2E_AGENT_NAME} activity` })
}

/**
 * Moves focus into the activity panel the way a keyboard user does from the toolbar control (where
 * focus went back when the connect dialog closed): one Enter. The panel opened by itself when the
 * task started, so the press takes focus into it instead of hiding it.
 */
async function focusActivityPanel(page: Page): Promise<void> {
  const chip = agentChip(page)
  await expect(chip).toBeFocused()
  await expect(activityPanel(page)).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(activityPanel(page)).toBeFocused()
  await expect(chip).toHaveAttribute('aria-expanded', 'true')
}

function edges(page: Page): Locator {
  return page.locator('.react-flow__edge-path')
}

/**
 * Opens the connect dialog with Tab and Enter, waits until the bridge is ready, reads the URL and
 * key back from the command, closes the dialog with Escape and connects an MCP client with them.
 */
async function connectFromDialog(page: Page): Promise<AgentClient> {
  await page.goto('/')
  await expect(graphNode(page, 'Master Stack')).toBeVisible()
  await tabUntilFocused(page, page.getByRole('button', { name: 'Connect an agent' }))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Connect an agent' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Ready. Your agent can edit this tab.' }),
  ).toBeVisible()
  const command = await dialog.locator('code').innerText()
  expect(command).toContain('claude mcp add --scope user ')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  // Focus goes back to the control that opened the dialog.
  await expect(page.getByRole('button', { name: 'Agent connected' })).toBeFocused()
  return connectAgent(credentialsFromCommand(command))
}

/** The command the connect dialog shows, read by opening the dialog and closing it again. */
async function connectCommandOf(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Agent connected' }).click()
  const dialog = page.getByRole('dialog', { name: 'Connect an agent' })
  const command = await dialog.locator('code').innerText()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  return command
}

async function masterId(agent: AgentClient): Promise<string> {
  const graph = asGraph(await agent.callJson('get_graph'))
  const master = graph.nodes.find((node) => node.type === MASTER_TYPE)
  if (master === undefined) throw new Error('The graph has no master node')
  return master.id
}

async function firstNoiseType(agent: AgentClient): Promise<NodeTypeSummary> {
  const [noise] = asNodeTypes(await agent.callJson('list_node_types', { query: 'noise' }))
  if (noise === undefined) throw new Error('list_node_types found no noise node')
  return noise
}

/** Adds a noise node and wires its first output into the master's base color. */
async function addNoiseToBaseColor(agent: AgentClient): Promise<NodeTypeSummary> {
  const noise = await firstNoiseType(agent)
  const [output] = noise.outputs
  if (output === undefined) throw new Error(`${noise.type} has no output`)
  const nodeId = nodeIdOf(await agent.callJson('add_node', { type: noise.type }))
  await agent.callJson('connect', {
    from: { nodeId, portId: output.id },
    to: { nodeId: await masterId(agent), portId: BASE_COLOR_PORT },
  })
  return noise
}

let agent: AgentClient | null = null

test.afterEach(async () => {
  await agent?.close()
  agent = null
})

test('an agent builds a small graph live', async ({ page }) => {
  agent = await connectFromDialog(page)

  await agent.callJson('start_task', { prompt: 'dither' })
  await expect(agentChip(page)).toBeVisible()
  await expect(activityPanel(page)).toBeVisible()

  const noise = await addNoiseToBaseColor(agent)
  await expect(graphNode(page, noise.label)).toContainText(`by ${E2E_AGENT_NAME}`)
  await expect(edges(page)).toHaveCount(1)

  await agent.callJson('set_step', { label: CHECK_STEP })
  await expect(agentChip(page)).toContainText(CHECK_STEP)

  const image = imageOf(await agent.call('get_preview_image'))
  expect(image.mimeType).toBe('image/png')
  expect(Buffer.from(image.data, 'base64').byteLength).toBeGreaterThan(MIN_PREVIEW_PNG_BYTES)
  const stats = await imageStats(page, image.data)
  expect(stats.lumaStdDev).toBeGreaterThan(MIN_PREVIEW_LUMA_STD_DEV)

  const code = codeOf(await agent.callJson('get_code'))
  expect(code).toContain(noise.type.split('/').at(-1) ?? noise.type)

  await agent.callJson('finish_task', { summary: 'Wired a noise into the base color.' })
  await expect(activityPanel(page)).toBeHidden()
})

test('Stop blocks the next write', async ({ page }) => {
  agent = await connectFromDialog(page)
  await agent.callJson('start_task', { prompt: 'dither' })

  await focusActivityPanel(page)
  await tabUntilFocused(
    page,
    activityPanel(page).getByRole('button', { name: 'Stop', exact: true }),
  )
  await page.keyboard.press('Enter')
  await expect(agentChip(page)).toContainText('Stopped')

  const refused = await agent.call('add_node', { type: (await firstNoiseType(agent)).type })
  expect(refused.isError).toBe(true)
  expect(textOf(refused)).toContain('stopped_by_user')
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
})

test('Undo all returns to the empty graph in one step', async ({ page }) => {
  agent = await connectFromDialog(page)
  await agent.callJson('start_task', { prompt: 'dither' })
  await addNoiseToBaseColor(agent)
  await addNoiseToBaseColor(agent)
  await expect(page.locator('.react-flow__node')).toHaveCount(3)

  await focusActivityPanel(page)
  await tabUntilFocused(
    page,
    activityPanel(page).getByRole('button', { name: 'Undo all', exact: true }),
  )
  // The person did not edit during the task, so nothing needs confirming.
  await page.keyboard.press('Enter')

  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  await expect(edges(page)).toHaveCount(0)
  const graph = asGraph(await agent.callJson('get_graph'))
  expect(graph.nodes.map((node) => node.type)).toEqual([MASTER_TYPE])
  expect(graph.edges).toEqual([])

  // It was one history entry: a single undo brings all of the agent's work back.
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.react-flow__node')).toHaveCount(3)
  await expect(edges(page)).toHaveCount(1)
})

test('a second tab shows "working in another tab"', async ({ page, context }) => {
  agent = await connectFromDialog(page)
  await expect(page.getByRole('button', { name: 'Agent connected' })).toBeVisible()

  // Same browser profile, so the same key: the newest tab to say hello becomes the active one.
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.getByRole('button', { name: 'Agent connected' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agent in another tab' })).toBeVisible()

  // Focusing the first tab takes the agent back; now the second one says so.
  await page.bringToFront()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('button', { name: 'Agent connected' })).toBeVisible()
  await expect(second.getByRole('button', { name: 'Agent in another tab' })).toBeVisible()

  await agent.callJson('start_task', { prompt: 'dither' })
  await expect(activityPanel(page)).toBeVisible()
  await expect(activityPanel(second)).toBeHidden()
})

test('another browser joins the same agent with the key pasted from the first', async ({
  page,
  browser,
}) => {
  agent = await connectFromDialog(page)
  const firstCommand = await connectCommandOf(page)

  // A separate browser profile: its own storage, so its own generated key at first.
  const otherBrowser = await browser.newContext()
  try {
    const other = await otherBrowser.newPage()
    await other.goto(new URL('/', page.url()).href)
    await expect(graphNode(other, 'Master Stack')).toBeVisible()
    await tabUntilFocused(other, other.getByRole('button', { name: 'Connect an agent' }))
    await other.keyboard.press('Enter')
    const dialog = other.getByRole('dialog', { name: 'Connect an agent' })
    await expect(dialog.locator('code')).not.toHaveText(firstCommand)

    await tabUntilFocused(other, dialog.getByRole('button', { name: 'I already have a key' }))
    await other.keyboard.press('Enter')
    const keyField = dialog.getByLabel('Your key')
    await expect(keyField).toBeVisible()
    await keyField.focus()
    await keyField.fill('not a key')
    await other.keyboard.press('Enter')
    await expect(dialog.getByText("That isn't a nudo key.")).toBeVisible()
    await expect(keyField).toBeFocused()

    await keyField.fill(firstCommand)
    await other.keyboard.press('Enter')
    await expect(dialog.getByRole('button', { name: 'Copy command' })).toBeFocused()
    await expect(dialog.locator('code')).toHaveText(firstCommand)
    await expect(dialog.getByRole('status').filter({ hasText: 'Key saved.' })).toBeVisible()

    // The agent Claude Code already has now reaches the newest tab, in the other browser.
    await expect(
      dialog.getByRole('status').filter({ hasText: 'Ready. Your agent can edit this tab.' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Agent in another tab' })).toBeVisible()
    await other.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(other.getByRole('button', { name: 'Agent connected' })).toBeFocused()
    await agent.callJson('start_task', { prompt: 'dither' })
    await expect(activityPanel(other)).toBeVisible()
  } finally {
    await otherBrowser.close()
  }
})
