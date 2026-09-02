import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import {
  DIAGNOSTICS_FOUNDATION,
  REQUIRED_APP_SETTING_NAMES,
  inspectMigrations,
  inspectProtectedConfiguration,
  inspectReadiness,
  inspectRecovery,
} from '../scripts/deployment-checks.mjs'

const root = path.resolve(import.meta.dirname, '..')

function gitBlob(bytes: Buffer): string {
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex')
}

test('deployment diagnostics vendors the exact reviewed foundation artifacts', () => {
  const helper = fs.readFileSync(path.join(root, 'scripts/deployment-diagnostic.mjs'))
  const action = fs.readFileSync(path.join(root, '.github/actions/deployment-diagnostic/action.yml'))
  assert.equal(gitBlob(helper), 'd31a00faad5832832bf0b91e96387f5f77645700')
  assert.equal(gitBlob(action), 'ff7330e29f4f15abe61bf8c4f5520ff5f1674fc4')
  assert.equal(DIAGNOSTICS_FOUNDATION.head, 'f45790e9df7c9fabbc53dd04e6055a59d6f28f39')
})

test('workflow invokes every full-profile check and records exact provenance', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
  const expectedChecks = [
    'image-sbom',
    'image-vulnerability-scan',
    'migration-compatibility-precheck',
    'monitoring-precheck',
    'protected-configuration-precheck',
    'provenance-attestation-verification',
    'readiness-precondition-precheck',
    'recovery-precondition-precheck',
    'signature-verification',
    'source-dependency-audit',
    'source-sbom',
  ]
  const invoked = [...workflow.matchAll(/check-id:\s*([a-z0-9-]+)/g)]
    .map(match => match[1])
    .filter(checkId => checkId !== 'aggregate')
    .sort()
  assert.deepEqual(invoked, expectedChecks)
  assert.match(workflow, new RegExp(DIAGNOSTICS_FOUNDATION.head))
  assert.match(workflow, /az webapp config container set/)
  assert.match(workflow, /failure\(\) \|\| cancelled\(\)/)
})

test('migration precheck accepts the current contiguous additive schema history', () => {
  const inspected = inspectMigrations(root)
  assert.equal(inspected.ok, true)
  assert.equal(inspected.report.status, 'pass')
  assert.deepEqual(inspected.report.observations.migration_versions, [1, 2])
  assert.deepEqual(inspected.report.observations.destructive_operations, [])
})

test('recovery precheck reports missing production freshness without inventing a pass', () => {
  const inspected = inspectRecovery(root)
  assert.equal(inspected.ok, false)
  assert.equal(inspected.report.status, 'finding')
  assert.equal(inspected.report.observations.production_freshness_evidence, 'unavailable')
  assert.equal(inspected.report.observations.local_recovery_capabilities.backup, true)
  assert.equal(inspected.report.observations.local_recovery_capabilities.verify, true)
  assert.equal(inspected.report.observations.local_recovery_capabilities.restore, true)
})

test('readiness precheck keeps only contract fields from the endpoint response', async () => {
  const secret = 'do-not-copy-this-secret'
  const inspected = await inspectReadiness({
    url: 'https://app-prism-prod.example.azurewebsites.net/api/ready',
    minimumSchemaVersion: 2,
    fetchImpl: async () => new Response(JSON.stringify({
      status: 'ready',
      build: { app: 'prism' },
      database: { schemaVersion: 2, databaseHash: secret },
      token: secret,
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  })
  assert.equal(inspected.ok, true)
  assert.equal(inspected.report.status, 'pass')
  assert.equal(JSON.stringify(inspected.report).includes(secret), false)
})

test('protected-config precheck compares names and safe invariants without values', () => {
  const secret = 'do-not-copy-this-secret'
  const runAz = (args: string[]) => {
    if (args[0] === 'webapp' && args[1] === 'config' && args[2] === 'appsettings') {
      return [...REQUIRED_APP_SETTING_NAMES]
    }
    if (args[0] === 'webapp' && args[1] === 'config') {
      return {
        alwaysOn: true,
        numberOfWorkers: 1,
        ftpsState: 'Disabled',
        http20Enabled: true,
        minTlsVersion: '1.2',
        healthCheckPath: '/api/live',
        unrelatedValue: secret,
      }
    }
    return { httpsOnly: true, unrelatedValue: secret }
  }
  const inspected = inspectProtectedConfiguration({
    resourceGroup: 'rg-prism-prod',
    webappName: 'app-prism-prod',
    runAz,
  })
  assert.equal(inspected.ok, true)
  assert.equal(inspected.report.status, 'pass')
  assert.deepEqual(inspected.report.observations.missing_setting_names, [])
  assert.equal(inspected.report.observations.values_or_value_hashes_recorded, false)
  assert.equal(JSON.stringify(inspected.report).includes(secret), false)
})
