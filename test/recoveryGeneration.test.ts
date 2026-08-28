import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { createRecoveryGeneration, restoreRecoveryGeneration, verifyRecoveryGeneration } from '../lib/recovery/generation.js'
import { acquireExclusiveClaim, recoverExclusiveClaim } from '../lib/concurrency/exclusiveClaim.js'
import { testRepository } from './helpers.js'

test('recovery generation snapshots, verifies, and restores database plus artifacts as one immutable unit', async t => {
  const fixture = testRepository()
  t.after(() => fixture.close())
  const identity = { tenantId: '00000000-0000-4000-8000-000000000001', oid: '00000000-0000-4000-8000-000000000002' }
  const conversation = await fixture.repository.createConversation(identity, 'Recovery') as { id: number }
  await fixture.repository.addMessage(identity, conversation.id, { id: 'm1', type: 'assistant', content: 'image', timestamp: '2026-01-01', images: [`data:image/png;base64,${Buffer.from('artifact').toString('base64')}`] }, 1_000)
  const generation = path.join(fixture.root, 'generation')
  const manifest = await createRecoveryGeneration({
    databasePath: path.join(fixture.root, 'prism.db'),
    artifactRoot: path.join(fixture.root, 'artifacts'),
    generationPath: generation,
    creationIdentity: { app: 'prism', version: '0.9.0', source: { commit: 'older-release' } },
  })
  assert.equal(manifest.artifacts.length, 1)
  assert.equal(manifest.creationIdentity.version, '0.9.0')
  assert.equal(verifyRecoveryGeneration(generation).creationIdentity.version, '0.9.0')
  assert.equal(fs.existsSync(path.join(generation, 'artifacts', `${manifest.artifacts[0]!.objectKey}.meta.json`)), false)
  const restoredDb = path.join(fixture.root, 'restored', 'prism.db')
  const restoredArtifacts = path.join(fixture.root, 'restored-artifacts')
  restoreRecoveryGeneration({ generationPath: generation, databasePath: restoredDb, artifactRoot: restoredArtifacts })
  assert.equal(fs.readFileSync(path.join(restoredArtifacts, manifest.artifacts[0]!.objectKey), 'utf8'), 'artifact')

  const interruptedArtifacts = path.join(fixture.root, 'interrupted-artifacts')
  fs.cpSync(path.join(generation, 'artifacts'), interruptedArtifacts, { recursive: true })
  const retryDatabase = path.join(fixture.root, 'retry', 'prism.db')
  const staleDatabase = `${retryDatabase}.staging-stale`
  const staleArtifacts = `${interruptedArtifacts}.staging-stale`
  fs.mkdirSync(path.dirname(retryDatabase), { recursive: true })
  fs.writeFileSync(staleDatabase, 'interrupted database')
  fs.mkdirSync(staleArtifacts)
  fs.writeFileSync(path.join(staleArtifacts, 'partial'), 'private partial')
  const staleClaimPath = `${retryDatabase}.operation.claim`
  fs.writeFileSync(staleClaimPath, JSON.stringify({
    token: '11111111-1111-4111-8111-111111111111', pid: 2_147_483_647, operation: 'Prism recovery restore', createdAt: new Date(0).toISOString(),
    payload: { stagedDatabase: staleDatabase, stagedArtifacts: staleArtifacts },
  }))
  assert.throws(() => restoreRecoveryGeneration({ generationPath: generation, databasePath: retryDatabase, artifactRoot: interruptedArtifacts }), /never removed automatically/)
  assert.equal(fs.existsSync(staleClaimPath), true)
  assert.throws(() => recoverExclusiveClaim({
    claimPath: staleClaimPath,
    recordedToken: 'wrong-token',
    archiveDirectory: path.join(fixture.root, 'claim-evidence'),
    confirmation: 'RECOVER PRISM OPERATION CLAIM',
  }), /does not match/)
  const evidencePath = recoverExclusiveClaim({
    claimPath: staleClaimPath,
    recordedToken: '11111111-1111-4111-8111-111111111111',
    archiveDirectory: path.join(fixture.root, 'claim-evidence'),
    confirmation: 'RECOVER PRISM OPERATION CLAIM',
  })
  assert.equal(fs.existsSync(evidencePath), true)
  assert.equal(fs.existsSync(staleClaimPath), false)
  restoreRecoveryGeneration({ generationPath: generation, databasePath: retryDatabase, artifactRoot: interruptedArtifacts })
  assert.equal(fs.existsSync(retryDatabase), true)
  assert.equal(fs.existsSync(staleDatabase), true)
  assert.equal(fs.existsSync(staleArtifacts), true)

  const blockedDatabase = path.join(fixture.root, 'blocked', 'prism.db')
  const blockedArtifacts = path.join(fixture.root, 'blocked-artifacts')
  fs.cpSync(path.join(generation, 'artifacts'), blockedArtifacts, { recursive: true })
  const held = acquireExclusiveClaim(`${blockedDatabase}.operation.claim`, 'Prism recovery restore')
  assert.throws(() => restoreRecoveryGeneration({ generationPath: generation, databasePath: blockedDatabase, artifactRoot: blockedArtifacts }), /already in progress/)
  assert.equal(fs.readFileSync(path.join(blockedArtifacts, manifest.artifacts[0]!.objectKey), 'utf8'), 'artifact')
  held.release()

  const manifestPath = path.join(generation, 'manifest.json')
  const manifestBefore = fs.readFileSync(manifestPath, 'utf8')
  fs.writeFileSync(path.join(generation, 'artifacts', manifest.artifacts[0]!.objectKey), 'tampered')
  assert.throws(() => verifyRecoveryGeneration(generation), /byte mismatch|hash mismatch/)
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifestBefore)
})
