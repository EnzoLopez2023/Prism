import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import { createApp } from '../server/app.js'
import { loadConfig } from '../server/config.js'
import { buildIdentity } from '../lib/buildIdentity.js'
import type { CrossAppClients } from '../server/clients/contracts.js'
import type { PrismRepository } from '../lib/db/repositories/prismRepository.js'

function mockRepository(): PrismRepository {
  return { readiness: async () => ({ ok: true }) } as unknown as PrismRepository
}

function mockClients(): CrossAppClients {
  return { hearth: {}, lantern: {}, watchtower: {}, marquee: {} } as unknown as CrossAppClients
}

function devConfig(overrides: Partial<ReturnType<typeof loadConfig>> = {}) {
  const base = loadConfig({ PRISM_AUTH_MODE: 'development' })
  return { ...base, ...overrides }
}

async function request(app: express.Express, path: string) {
  const { createServer } = await import('node:http')
  return new Promise<{ status: number; body: Record<string, unknown> | null; headers: Record<string, string | string[] | undefined> }>((resolve, reject) => {
    const server = createServer(app)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      fetch(`http://127.0.0.1:${addr.port}${path}`)
        .then(async (res) => {
          const body = await res.json().catch(() => null)
          server.close()
          resolve({ status: res.status, body, headers: Object.fromEntries(res.headers.entries()) })
        })
        .catch((err) => { server.close(); reject(err) })
    })
  })
}

test('/api/config returns auth config without secrets in development mode', async () => {
  const config = devConfig()
  const app = createApp(config, mockRepository(), mockClients())
  const res = await request(app, '/api/config')
  assert.equal(res.status, 200)
  assert.equal(res.body.entraConfigured, 'false')
  assert.equal(res.headers['cache-control'], 'no-store')
  // Must not leak server-side secrets
  assert.equal(res.body.audience, undefined)
  assert.equal(res.body.dbPath, undefined)
})

test('/api/config returns Entra settings in entra mode', async () => {
  const config = devConfig({
    auth: {
      mode: 'entra',
      tenantId: '00000000-0000-4000-8000-000000000001',
      clientId: '00000000-0000-4000-8000-000000000002',
      audience: 'api://prism',
      apiScope: 'api://prism/.default',
      bootstrapAdminOid: undefined,
    },
  })
  const app = createApp(config, mockRepository(), mockClients())
  const res = await request(app, '/api/config')
  assert.equal(res.status, 200)
  assert.equal(res.body.entraConfigured, 'true')
  assert.equal(res.body.tenantId, '00000000-0000-4000-8000-000000000001')
  assert.equal(res.body.clientId, '00000000-0000-4000-8000-000000000002')
  assert.equal(res.body.apiScope, 'api://prism/.default')
  // Audience is server-only, must not appear
  assert.equal(res.body.audience, undefined)
})

test('/api/live returns live status', async () => {
  const app = createApp(devConfig(), mockRepository(), mockClients())
  const res = await request(app, '/api/live')
  assert.equal(res.status, 200)
  assert.equal(res.body.status, 'live')
  assert.equal(res.body.app, 'prism')
})

test('/api/version returns build identity', async () => {
  const app = createApp(devConfig(), mockRepository(), mockClients())
  const res = await request(app, '/api/version')
  assert.equal(res.status, 200)
  assert.equal(res.body.app, buildIdentity.app)
  assert.equal(res.body.schema, buildIdentity.schema)
  assert.ok(res.body.version)
  assert.ok(res.body.build)
  assert.ok(res.body.commit)
})

test('/api/ready returns readiness with build identity', async () => {
  const app = createApp(devConfig(), mockRepository(), mockClients())
  const res = await request(app, '/api/ready')
  assert.equal(res.status, 200)
  assert.equal(res.body.status, 'ready')
  assert.ok(res.body.build)
  assert.equal(res.body.build.app, 'prism')
})

test('/api/ready returns 503 when repository is not ready', async () => {
  const repo = { readiness: async () => { throw new Error('db gone') } } as unknown as PrismRepository
  const app = createApp(devConfig(), repo, mockClients())
  const res = await request(app, '/api/ready')
  assert.equal(res.status, 503)
  assert.equal(res.body.status, 'not-ready')
})
