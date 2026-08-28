import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { test } from 'node:test'
import { acquireExclusiveClaim, recoverExclusiveClaim } from '../lib/concurrency/exclusiveClaim.js'

const fixture = path.resolve('test/fixtures/claimProcess.ts')
const crashFixture = path.resolve('test/fixtures/crashClaimProcess.ts')

function contender(claimPath: string, holdMs = 0) {
  return spawn(process.execPath, ['--import', 'tsx', fixture, claimPath, String(holdMs)], { stdio: ['ignore', 'pipe', 'pipe'] })
}

test('exclusive claim serializes real processes without deleting a live claim', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-claim-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const claimPath = path.join(root, 'prism.db.operation.claim')
  const first = contender(claimPath, 500)
  await new Promise<void>((resolve, reject) => {
    first.stdout.on('data', chunk => { if (String(chunk).includes('acquired:')) resolve() })
    first.once('error', reject)
  })
  const original = fs.readFileSync(claimPath, 'utf8')
  const second = contender(claimPath)
  const [secondCode] = await once(second, 'exit')
  assert.equal(secondCode, 2)
  assert.equal(fs.readFileSync(claimPath, 'utf8'), original)
  const [firstCode] = await once(first, 'exit')
  assert.equal(firstCode, 0)
  assert.equal(fs.existsSync(claimPath), false)
})

test('dead-PID claim still blocks a real process and remains byte-for-byte unchanged', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-stale-claim-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const claimPath = path.join(root, 'prism.db.operation.claim')
  const stale = `${JSON.stringify({ token: 'recorded', pid: 2_147_483_647, operation: 'old import', createdAt: new Date(0).toISOString(), payload: {} })}\n`
  fs.writeFileSync(claimPath, stale)
  const processAttempt = contender(claimPath)
  const [code] = await once(processAttempt, 'exit')
  assert.equal(code, 2)
  assert.equal(fs.readFileSync(claimPath, 'utf8'), stale)
})

test('SIGKILL between exclusive create and claim write leaves evidence-recoverable malformed claim', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-crash-claim-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const claimPath = path.join(root, 'prism.db.operation.claim')
  const crashing = spawn(process.execPath, ['--import', 'tsx', crashFixture, claimPath], { stdio: ['ignore', 'pipe', 'pipe'] })
  await new Promise<void>((resolve, reject) => {
    crashing.stdout.on('data', chunk => { if (String(chunk).includes('created')) resolve() })
    crashing.once('error', reject)
  })
  crashing.kill('SIGKILL')
  await once(crashing, 'exit')
  const raw = fs.readFileSync(claimPath)
  assert.equal(raw.length, 0)
  const blocked = contender(claimPath)
  const [blockedCode] = await once(blocked, 'exit')
  assert.equal(blockedCode, 2)
  assert.equal(fs.readFileSync(claimPath).length, 0)
  const sha256 = createHash('sha256').update(raw).digest('hex')
  assert.throws(() => recoverExclusiveClaim({
    claimPath,
    archiveDirectory: path.join(root, 'evidence'),
    confirmation: 'RECOVER MALFORMED PRISM OPERATION CLAIM',
    rawBytes: 1,
    rawSha256: sha256,
  }), /does not match/)
  const archive = recoverExclusiveClaim({
    claimPath,
    archiveDirectory: path.join(root, 'evidence'),
    confirmation: 'RECOVER MALFORMED PRISM OPERATION CLAIM',
    rawBytes: 0,
    rawSha256: sha256,
  })
  const evidence = JSON.parse(fs.readFileSync(archive, 'utf8')) as { claim: unknown; claimRawBase64: string; claimBytes: number; claimSha256: string }
  assert.equal(evidence.claim, null)
  assert.equal(evidence.claimRawBase64, '')
  assert.equal(evidence.claimBytes, 0)
  assert.equal(evidence.claimSha256, sha256)
  assert.equal(fs.existsSync(claimPath), false)
  fs.writeFileSync(claimPath, raw)
  const secondArchive = recoverExclusiveClaim({
    claimPath,
    archiveDirectory: path.join(root, 'evidence'),
    confirmation: 'RECOVER MALFORMED PRISM OPERATION CLAIM',
    rawBytes: 0,
    rawSha256: sha256,
  })
  assert.notEqual(secondArchive, archive)
  assert.equal(fs.existsSync(secondArchive), true)
  assert.equal(fs.readdirSync(path.join(root, 'evidence')).length, 2)
})

test('synchronous claim fsync failure removes only the invocation-owned claim file', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-write-claim-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const claimPath = path.join(root, 'prism.db.operation.claim')
  const original = fs.fsyncSync
  fs.fsyncSync = () => { throw new Error('synthetic fsync failure') }
  try {
    assert.throws(() => acquireExclusiveClaim(claimPath, 'fsync test'), /synthetic fsync failure/)
  } finally {
    fs.fsyncSync = original
  }
  assert.equal(fs.existsSync(claimPath), false)
})

test('release quarantines and preserves a replacement claim instead of unlinking it', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-release-race-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const claimPath = path.join(root, 'prism.db.operation.claim')
  const claim = acquireExclusiveClaim(claimPath, 'release race')
  const replacement = `${JSON.stringify({ token: '22222222-2222-4222-8222-222222222222', pid: process.pid, operation: 'replacement', createdAt: new Date().toISOString(), payload: {} })}\n`
  fs.rmSync(claimPath)
  fs.writeFileSync(claimPath, replacement)
  assert.throws(() => claim.release(), /replacement was restored/)
  assert.equal(fs.readFileSync(claimPath, 'utf8'), replacement)
})

test('recovery routes token-shaped malformed records through raw evidence and preserves replacement races', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-recovery-race-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const claimPath = path.join(root, 'prism.db.operation.claim')
  const malformed = Buffer.from(JSON.stringify({ token: '33333333-3333-4333-8333-333333333333' }))
  fs.writeFileSync(claimPath, malformed)
  assert.throws(() => recoverExclusiveClaim({
    claimPath,
    recordedToken: '33333333-3333-4333-8333-333333333333',
    archiveDirectory: path.join(root, 'token-evidence'),
    confirmation: 'RECOVER PRISM OPERATION CLAIM',
  }), /malformed-claim recovery confirmation/)
  const malformedHash = createHash('sha256').update(malformed).digest('hex')
  const replacement = Buffer.from('replacement claim bytes')
  assert.throws(() => recoverExclusiveClaim({
    claimPath,
    rawBytes: malformed.length,
    rawSha256: malformedHash,
    archiveDirectory: path.join(root, 'raw-evidence'),
    confirmation: 'RECOVER MALFORMED PRISM OPERATION CLAIM',
    beforeQuarantine: () => {
      fs.rmSync(claimPath)
      fs.writeFileSync(claimPath, replacement)
    },
  }), /replacement was restored/)
  assert.deepEqual(fs.readFileSync(claimPath), replacement)
})

test('quarantine restore cannot clobber a new claimant that wins the no-clobber race', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-quarantine-race-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const claimPath = path.join(root, 'prism.db.operation.claim')
  const owner = acquireExclusiveClaim(claimPath, 'quarantine race')
  fs.rmSync(claimPath)
  fs.writeFileSync(claimPath, 'first replacement')
  const newClaim = 'new claimant must survive'
  const originalCopy = fs.copyFileSync
  fs.copyFileSync = (source, destination, mode) => {
    if (String(source).includes('.quarantine-') && path.resolve(String(destination)) === path.resolve(claimPath)) {
      fs.writeFileSync(claimPath, newClaim, { flag: 'wx' })
    }
    return originalCopy(source, destination, mode)
  }
  try {
    assert.throws(() => owner.release(), /new claim was preserved/)
  } finally {
    fs.copyFileSync = originalCopy
  }
  assert.equal(fs.readFileSync(claimPath, 'utf8'), newClaim)
  assert.equal(fs.readdirSync(root).filter(name => name.includes('.quarantine-')).length, 1)
})
