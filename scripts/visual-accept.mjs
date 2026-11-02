import process from 'node:process'
import { Buffer } from 'node:buffer'
import console from 'node:console'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repository = 'joyco-studio/nudo'
const [runId, ...cases] = process.argv.slice(2)
const knownCases = new Set(['ink-swirl', 'pencil', 'poster'])
if (
  !/^\d+$/.test(runId ?? '') ||
  cases.length === 0 ||
  cases.some((name) => !knownCases.has(name))
) {
  throw new Error(
    'Usage: node scripts/visual-accept.mjs RUN_ID CASE [CASE...]\nReview the expected/actual/diff report first. Only the named cases will be accepted.',
  )
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim()
const root = git('rev-parse', '--show-toplevel')
process.chdir(root)
const head = git('rev-parse', 'HEAD')
const run = JSON.parse(gh('api', `repos/${repository}/actions/runs/${runId}`))
if (
  run.status !== 'completed' ||
  run.path !== '.github/workflows/visual.yml' ||
  run.head_sha !== head ||
  run.repository?.full_name !== repository
) {
  throw new Error(
    'Use a completed Visual snapshots run for this exact local HEAD in joyco-studio/nudo. Fetch and check out its commit first; stale or unrelated runs cannot be accepted.',
  )
}
function isSymlink(path) {
  return lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ?? false
}
const baselineDirectory = 'apps/editor/visual/__screenshots__'
if (git('status', '--porcelain', '--', baselineDirectory)) {
  throw new Error(
    'Baseline files have local changes. Commit or stash them before accepting another run.',
  )
}
const temporary = mkdtempSync(join(tmpdir(), 'nudo-visual-'))
try {
  gh(
    'run',
    'download',
    runId,
    '--repo',
    repository,
    '--name',
    'visual-candidates',
    '--dir',
    temporary,
  )
  const manifest = JSON.parse(readFileSync(join(temporary, 'manifest.json'), 'utf8'))
  if (
    manifest.version !== 1 ||
    manifest.repository !== repository ||
    manifest.commit !== head ||
    manifest.runId !== runId
  ) {
    throw new Error('Candidate provenance does not match this run and commit.')
  }
  // Validate every requested image before changing any baseline.
  const files = [...new Set(cases)].map((name) => {
    const image = manifest.images?.[name]
    if (image?.filename !== `${name}.png`) throw new Error(`No rendered candidate for ${name}.`)
    const source = join(temporary, image.filename)
    if (!lstatSync(source).isFile() || lstatSync(source).isSymbolicLink())
      throw new Error('Candidate is not a regular file.')
    const data = readFileSync(source)
    if (!data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      throw new Error('Candidate is not PNG.')
    if (createHash('sha256').update(data).digest('hex') !== image.sha256)
      throw new Error('Candidate hash mismatch.')
    return { name, source }
  })
  for (const path of ['apps', 'apps/editor', 'apps/editor/visual', baselineDirectory]) {
    if (isSymlink(path)) throw new Error('Baseline path must not contain symlinks.')
  }
  const target = resolve(baselineDirectory)
  // Preflight all destinations before writing any selected baseline, including dangling links.
  for (const { name } of files) {
    if (isSymlink(join(target, `${name}.png`))) throw new Error('Baseline must not be a symlink.')
  }
  mkdirSync(target, { recursive: true })
  for (const { name, source } of files) copyFileSync(source, join(target, `${name}.png`))
  console.log(
    `Accepted ${files.map(({ name }) => name).join(', ')} from run ${runId}.\nReview git diff, then commit the selected PNGs on your PR branch. No commit or push was performed.`,
  )
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
