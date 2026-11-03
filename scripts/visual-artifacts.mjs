import process from 'node:process'
import console from 'node:console'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const results = 'apps/editor/test-results/visual'
const destination = 'apps/editor/test-results/visual-review'
const candidates = []
function collect(directory) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) collect(path)
    else if (entry.isFile() && entry.name.endsWith('-candidate.png')) candidates.push(path)
  }
}
collect(results)
mkdirSync(destination, { recursive: true })
const images = {}
for (const path of candidates) {
  const name = basename(path).replace(/-candidate\.png$/, '')
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`Invalid case name: ${name}`)
  if (images[name]) throw new Error(`Duplicate candidate: ${name}. Do not collect retries.`)
  const filename = `${name}.png`
  cpSync(path, join(destination, filename))
  images[name] = { filename, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }
}
writeFileSync(
  join(destination, 'manifest.json'),
  JSON.stringify(
    {
      version: 1,
      repository: 'joyco-studio/nudo',
      commit: execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      runId: process.env.GITHUB_RUN_ID ?? null,
      images,
    },
    null,
    2,
  ) + '\n',
)
console.log(`Prepared ${Object.keys(images).length} review candidates; none were approved.`)
