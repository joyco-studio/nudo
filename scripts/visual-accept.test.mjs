import process from 'node:process'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const script = resolve('scripts/visual-accept.mjs')
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'nudo-accept-test-'))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  git('init')
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--allow-empty',
    '-m',
    'fixture',
  )
  const sha = git('rev-parse', 'HEAD')
  const bin = join(root, 'bin')
  mkdirSync(bin)
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('fs'); const path = require('path');
const args = process.argv.slice(2);
if (args[0] === 'api') console.log(JSON.stringify({status:'completed',path:process.env.TEST_WORKFLOW || '.github/workflows/visual.yml',head_sha:process.env.TEST_SHA,repository:{full_name:'joyco-studio/nudo'}}));
else {
 const target=args[args.indexOf('--dir')+1];
 const images={};
 for (const name of ['ink-swirl','pencil','poster']) {
  fs.writeFileSync(path.join(target,name+'.png'),Buffer.from(${JSON.stringify([...png])}));
  images[name]={filename:name === 'ink-swirl' && process.env.TEST_FILENAME ? process.env.TEST_FILENAME : name+'.png',sha256:process.env.TEST_HASH};
 }
 fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({version:1,repository:'joyco-studio/nudo',commit:process.env.TEST_SHA,runId:'123',images}));
}
`,
  )
  chmodSync(join(bin, 'gh'), 0o755)
  return {
    root,
    sha,
    git,
    run: (args, env = {}) =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          TEST_SHA: git('rev-parse', 'HEAD'),
          TEST_HASH: createHash('sha256').update(png).digest('hex'),
          ...env,
        },
      }),
  }
}

for (const scenario of ['accept', 'stale', 'hash', 'unknown']) {
  test(`visual acceptance: ${scenario}`, () => {
    const f = fixture()
    try {
      const result = f.run(
        ['123', scenario === 'unknown' ? '../escape' : 'ink-swirl'],
        scenario === 'stale'
          ? { TEST_SHA: '0'.repeat(40) }
          : scenario === 'hash'
            ? { TEST_HASH: 'wrong' }
            : {},
      )
      const target = join(f.root, 'apps/editor/visual/__screenshots__/ink-swirl.png')
      if (scenario === 'accept') {
        assert.equal(result.status, 0, result.stderr)
        assert.deepEqual(readFileSync(target), png)
      } else {
        assert.notEqual(result.status, 0)
        assert.equal(existsSync(target), false)
      }
    } finally {
      rmSync(f.root, { recursive: true, force: true })
    }
  })
}

for (const [scenario, env] of [
  ['wrong workflow path', { TEST_WORKFLOW: '.github/workflows/unrelated.yml' }],
  ['manifest path traversal', { TEST_FILENAME: '../ink-swirl.png' }],
]) {
  test(`visual acceptance rejects ${scenario}`, () => {
    const f = fixture()
    try {
      const result = f.run(['123', 'ink-swirl'], env)
      assert.notEqual(result.status, 0)
      assert.equal(existsSync(join(f.root, 'apps/editor/visual/__screenshots__')), false)
    } finally {
      rmSync(f.root, { recursive: true, force: true })
    }
  })
}

test('visual acceptance copies only explicitly selected candidates', () => {
  const f = fixture()
  try {
    const result = f.run(['123', 'ink-swirl'])
    assert.equal(result.status, 0, result.stderr)
    const directory = join(f.root, 'apps/editor/visual/__screenshots__')
    assert.deepEqual(readFileSync(join(directory, 'ink-swirl.png')), png)
    assert.equal(existsSync(join(directory, 'pencil.png')), false)
    assert.equal(existsSync(join(directory, 'poster.png')), false)
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})

for (const dangling of [false, true]) {
  test(`visual acceptance preflights ${dangling ? 'dangling' : 'existing'} destination symlink before any writes`, () => {
    const f = fixture()
    try {
      const directory = join(f.root, 'apps/editor/visual/__screenshots__')
      mkdirSync(directory, { recursive: true })
      const external = join(f.root, 'outside.png')
      if (!dangling) writeFileSync(external, 'unchanged')
      symlinkSync(external, join(directory, 'pencil.png'))
      // A clean, tracked symlink reaches the destination guard instead of the dirty-tree guard.
      f.git('add', 'apps')
      f.git(
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.com',
        'commit',
        '-m',
        'symlink fixture',
      )
      const result = f.run(['123', 'ink-swirl', 'pencil'])
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /Baseline must not be a symlink/)
      assert.equal(existsSync(join(directory, 'ink-swirl.png')), false)
      if (dangling) assert.equal(existsSync(external), false)
      else assert.equal(readFileSync(external, 'utf8'), 'unchanged')
    } finally {
      rmSync(f.root, { recursive: true, force: true })
    }
  })
}
