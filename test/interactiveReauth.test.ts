import assert from 'node:assert/strict'
import { test } from 'node:test'
import { InteractiveReauthCoordinator } from '../src/auth/interactiveReauth.js'

test('interactive reauthentication is serialized and exposes recoverable state', async () => {
  const coordinator = new InteractiveReauthCoordinator()
  coordinator.require()
  assert.equal(coordinator.getSnapshot().status, 'required')
  let calls = 0
  let release!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  const first = coordinator.run(async () => { calls += 1; await blocked })
  const second = coordinator.run(async () => { calls += 1 })
  assert.equal(calls, 1)
  assert.equal(coordinator.getSnapshot().status, 'authenticating')
  release()
  await Promise.all([first, second])
  assert.equal(coordinator.getSnapshot().status, 'ready')
})

test('interactive reauthentication surfaces failure and permits a later retry', async () => {
  const coordinator = new InteractiveReauthCoordinator()
  await assert.rejects(coordinator.run(async () => { throw new Error('Popup blocked') }), /Popup blocked/)
  assert.deepEqual(coordinator.getSnapshot(), { status: 'error', message: 'Popup blocked' })
  await coordinator.run(async () => {})
  assert.equal(coordinator.getSnapshot().status, 'ready')
})
