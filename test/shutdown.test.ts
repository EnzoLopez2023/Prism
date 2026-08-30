import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createShutdownHandler, type ShutdownServer } from '../server/shutdown.js'

const logger = { log() {}, error() {} }

test('graceful shutdown releases resources once before exiting successfully', async () => {
  let closeCallback: ((error?: Error) => void) | undefined
  let forcedCloses = 0
  let releases = 0
  const server: ShutdownServer = {
    close(callback) { closeCallback = callback },
    closeAllConnections() { forcedCloses += 1 },
  }
  const exitCode = new Promise<number>(resolve => {
    const shutdown = createShutdownHandler({
      getServer: () => server,
      releaseResources: () => { releases += 1 },
      timeoutMs: 50,
      exit: resolve,
      logger,
    })
    shutdown('SIGTERM')
    shutdown('SIGINT')
    closeCallback?.()
  })

  assert.equal(await exitCode, 0)
  assert.equal(releases, 1)
  assert.equal(forcedCloses, 0)
})

test('forced shutdown closes active connections and releases resources before exiting', async () => {
  let forcedCloses = 0
  let releases = 0
  const server: ShutdownServer = {
    close() {},
    closeAllConnections() { forcedCloses += 1 },
  }
  const exitCode = new Promise<number>(resolve => {
    createShutdownHandler({
      getServer: () => server,
      releaseResources: () => { releases += 1 },
      timeoutMs: 5,
      exit: resolve,
      logger,
    })('SIGTERM')
  })

  assert.equal(await exitCode, 1)
  assert.equal(releases, 1)
  assert.equal(forcedCloses, 1)
})

test('cleanup failures make graceful shutdown fail closed', async () => {
  const cleanupError = new Error('claim release failed')
  const server: ShutdownServer = {
    close(callback) { callback() },
    closeAllConnections() {},
  }
  const exitCode = new Promise<number>(resolve => {
    createShutdownHandler({
      getServer: () => server,
      releaseResources: () => { throw cleanupError },
      timeoutMs: 50,
      exit: resolve,
      logger,
    })('SIGTERM')
  })

  assert.equal(await exitCode, 1)
})

test('shutdown during startup releases resources without waiting for a server', async () => {
  let releases = 0
  const exitCode = new Promise<number>(resolve => {
    createShutdownHandler({
      getServer: () => undefined,
      releaseResources: () => { releases += 1 },
      timeoutMs: 50,
      exit: resolve,
      logger,
    })('SIGTERM')
  })

  assert.equal(await exitCode, 0)
  assert.equal(releases, 1)
})

test('synchronous server close failures still release resources', async () => {
  let releases = 0
  const server: ShutdownServer = {
    close() { throw new Error('server close failed') },
    closeAllConnections() {},
  }
  const exitCode = new Promise<number>(resolve => {
    createShutdownHandler({
      getServer: () => server,
      releaseResources: () => { releases += 1 },
      timeoutMs: 50,
      exit: resolve,
      logger,
    })('SIGTERM')
  })

  assert.equal(await exitCode, 1)
  assert.equal(releases, 1)
})
