import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfig } from '../server/config.js'

test('authentication fails closed unless development identity is explicitly opted in', () => {
  assert.throws(() => loadConfig({}), /PRISM_AUTH_MODE=development/)
  assert.equal(loadConfig({ PRISM_AUTH_MODE: 'development' }).auth.mode, 'development')
})

test('complete Entra configuration fails closed to Entra when auth mode is omitted', () => {
  const config = loadConfig({
    PRISM_ENTRA_TENANT_ID: '00000000-0000-4000-8000-000000000001',
    PRISM_ENTRA_AUDIENCE: 'api://prism',
  })
  assert.equal(config.auth.mode, 'entra')
  assert.equal(config.deployed, false)
  assert.equal(config.host, '0.0.0.0')
})

test('development identity is forbidden in production-like and App Service environments', () => {
  for (const env of [
    { NODE_ENV: 'production', PRISM_AUTH_MODE: 'development' },
    { NODE_ENV: 'staging', PRISM_AUTH_MODE: 'development' },
    { NODE_ENV: 'development', PRISM_AUTH_MODE: 'development', WEBSITE_INSTANCE_ID: 'azure-instance' },
  ]) {
    assert.throws(() => loadConfig(env), /Development authentication is forbidden/)
  }
})

test('production accepts only complete Entra authentication', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production', PRISM_AUTH_MODE: 'entra' }), /requires PRISM_ENTRA_TENANT_ID/)
  assert.equal(loadConfig({
    NODE_ENV: 'production',
    PRISM_ENTRA_TENANT_ID: '00000000-0000-4000-8000-000000000001',
    PRISM_ENTRA_AUDIENCE: 'api://prism',
  }).auth.mode, 'entra')
})

test('App Service signals apply deployed storage/static defaults even without NODE_ENV', () => {
  const config = loadConfig({
    WEBSITE_INSTANCE_ID: 'azure-instance',
    PRISM_ENTRA_TENANT_ID: '00000000-0000-4000-8000-000000000001',
    PRISM_ENTRA_AUDIENCE: 'api://prism',
  })
  assert.equal(config.deployed, true)
  assert.equal(config.dbPath, '/home/data/prism.db')
  assert.equal(config.artifactRoot, '/home/data/prism-artifacts')
  assert.equal(config.host, '0.0.0.0')
})

test('explicit development auth binds loopback only', () => {
  assert.equal(loadConfig({ PRISM_AUTH_MODE: 'development' }).host, '127.0.0.1')
})
