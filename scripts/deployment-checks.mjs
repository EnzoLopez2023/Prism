#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DIAGNOSTICS_FOUNDATION = Object.freeze({
  contract: 'deployment-diagnostics-v1',
  repository: 'EnzoLopez2023/azure-infra',
  head: 'f45790e9df7c9fabbc53dd04e6055a59d6f28f39',
})

export const REQUIRED_APP_SETTING_NAMES = Object.freeze([
  'DOCKER_REGISTRY_SERVER_URL',
  'NODE_ENV',
  'PORT',
  'PRISM_ARTIFACT_ROOT',
  'PRISM_AUTH_MODE',
  'PRISM_DB_PATH',
  'PRISM_ENTRA_API_SCOPE',
  'PRISM_ENTRA_AUDIENCE',
  'PRISM_ENTRA_CLIENT_ID',
  'PRISM_ENTRA_TENANT_ID',
  'PRISM_IMAGE_DIGEST',
  'WEBSITES_ENABLE_APP_SERVICE_STORAGE',
  'WEBSITES_PORT',
])

function result(checkId, ok, observations, findingCodes = []) {
  return {
    ok,
    report: {
      schema_version: '1.0',
      check_id: checkId,
      status: ok ? 'pass' : 'finding',
      source: DIAGNOSTICS_FOUNDATION,
      observations,
      finding_codes: findingCodes,
    },
  }
}

function numberMatches(source, pattern) {
  return [...source.matchAll(pattern)].map(match => Number.parseInt(match[1], 10)).sort((a, b) => a - b)
}

function sameNumbers(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index])
}

export function inspectMigrations(root = process.cwd()) {
  const source = readFileSync(resolve(root, 'lib/db/migrations.ts'), 'utf8')
  const blocks = [...source.matchAll(/const migration(\d+)\s*=\s*`([\s\S]*?)`/g)]
  const declaredVersions = blocks.map(match => Number.parseInt(match[1], 10)).sort((a, b) => a - b)
  const guardedVersions = numberMatches(source, /if\s*\(\s*current\s*<\s*(\d+)\s*\)/g)
  const recordedVersions = numberMatches(
    source,
    /INSERT\s+INTO\s+schema_migrations\s*\(\s*version\s*,\s*name\s*\)\s*VALUES\s*\(\s*(\d+)\s*,\s*\?\s*\)/gi,
  )
  const latestVersion = declaredVersions.at(-1) ?? 0
  const expectedVersions = Array.from({ length: latestVersion }, (_value, index) => index + 1)

  const hazards = []
  const hazardPatterns = [
    ['drop-schema-object', /\bDROP\s+(?:TABLE|COLUMN|INDEX|TRIGGER|VIEW)\b/gi],
    ['alter-table', /\bALTER\s+TABLE\b/gi],
    ['rewrite-migration-history', /\b(?:DELETE\s+FROM|UPDATE)\s+schema_migrations\b/gi],
    ['writable-schema', /\bPRAGMA\s+writable_schema\b/gi],
  ]
  for (const block of blocks) {
    const version = Number.parseInt(block[1], 10)
    const sql = block[2]
    for (const [code, pattern] of hazardPatterns) {
      for (const match of sql.matchAll(pattern)) {
        hazards.push({ code, migration_version: version, line: sql.slice(0, match.index).split('\n').length })
      }
    }
  }

  const declarationsContiguous = declaredVersions.length > 0 && sameNumbers(declaredVersions, expectedVersions)
  const guardsMatch = sameNumbers(guardedVersions, expectedVersions)
  const recordsMatch = sameNumbers(recordedVersions, expectedVersions)
  const ok = declarationsContiguous && guardsMatch && recordsMatch && hazards.length === 0
  const findings = []
  if (!declarationsContiguous) findings.push('migration-versions-not-contiguous')
  if (!guardsMatch) findings.push('migration-guards-do-not-match')
  if (!recordsMatch) findings.push('migration-history-records-do-not-match')
  if (hazards.length > 0) findings.push('destructive-migration-operation')

  return result(
    'migration-compatibility-precheck',
    ok,
    {
      latest_schema_version: latestVersion,
      migration_versions: declaredVersions,
      versions_contiguous: declarationsContiguous,
      guards_match_versions: guardsMatch,
      history_records_match_versions: recordsMatch,
      destructive_operations: hazards,
    },
    findings,
  )
}

function readIfPresent(filename) {
  return existsSync(filename) ? readFileSync(filename, 'utf8') : ''
}

export function inspectRecovery(root = process.cwd()) {
  const packagePath = resolve(root, 'package.json')
  const packageManifest = existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, 'utf8')) : {}
  const commandSource = readIfPresent(resolve(root, 'scripts/recovery.ts'))
  const implementationSource = readIfPresent(resolve(root, 'lib/recovery/generation.ts'))
  const documentation = readIfPresent(resolve(root, 'docs/migration-and-recovery.md'))
  const capabilities = {
    package_command: packageManifest.scripts?.recovery === 'tsx scripts/recovery.ts',
    backup: /command === 'backup'/.test(commandSource),
    verify: /command === 'verify'/.test(commandSource),
    restore: /command === 'restore'/.test(commandSource),
    complete_generation_contract: /prism\.recovery-generation\.v1/.test(implementationSource),
    operator_runbook: /## Recovery/.test(documentation),
  }
  const missingCapabilities = Object.entries(capabilities)
    .filter(entry => !entry[1])
    .map(([name]) => name)

  return result(
    'recovery-precondition-precheck',
    false,
    {
      durable_authority: 'sqlite-plus-filesystem-artifacts',
      required_off_host_format: 'prism-generation-backup-v1',
      local_recovery_capabilities: capabilities,
      missing_local_capabilities: missingCapabilities,
      production_freshness_evidence: 'unavailable',
      off_host_health_evidence: 'unavailable',
      disposable_restore_evidence: 'unavailable',
    },
    [
      ...(missingCapabilities.length > 0 ? ['local-recovery-capability-missing'] : []),
      'production-recovery-freshness-evidence-unavailable',
      'off-host-recovery-health-evidence-unavailable',
      'disposable-restore-evidence-unavailable',
    ],
  )
}

function requestFailureCode(error) {
  const name = typeof error === 'object' && error && 'name' in error ? String(error.name) : ''
  return name === 'AbortError' || name === 'TimeoutError' ? 'readiness-request-timeout' : 'readiness-request-failed'
}

export async function inspectReadiness({
  url,
  minimumSchemaVersion,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
}) {
  const target = new URL(url)
  if (target.protocol !== 'https:' || target.pathname !== '/api/ready') {
    throw new Error('readiness URL must be an HTTPS /api/ready endpoint')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetchImpl(target, {
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    })
  } catch (error) {
    const code = requestFailureCode(error)
    return result(
      'readiness-precondition-precheck',
      false,
      {
        endpoint: '/api/ready',
        request_completed: false,
        minimum_schema_version: minimumSchemaVersion,
      },
      [code],
    )
  } finally {
    clearTimeout(timer)
  }

  let body
  try {
    body = await response.json()
  } catch {
    return result(
      'readiness-precondition-precheck',
      false,
      {
        endpoint: '/api/ready',
        request_completed: true,
        http_status: response.status,
        response_is_json: false,
        minimum_schema_version: minimumSchemaVersion,
      },
      ['readiness-response-not-json'],
    )
  }

  const checks = {
    http_ok: response.ok,
    status_ready: body?.status === 'ready',
    app_prism: body?.build?.app === 'prism',
    schema_compatible:
      Number.isSafeInteger(body?.database?.schemaVersion) &&
      body.database.schemaVersion >= minimumSchemaVersion,
  }
  const findings = Object.entries(checks)
    .filter(entry => !entry[1])
    .map(([name]) => `readiness-${name.replaceAll('_', '-')}`)
  return result(
    'readiness-precondition-precheck',
    findings.length === 0,
    {
      endpoint: '/api/ready',
      request_completed: true,
      http_status: response.status,
      response_is_json: true,
      minimum_schema_version: minimumSchemaVersion,
      checks,
    },
    findings,
  )
}

export function runAzJson(args) {
  const completed = spawnSync(
    'az',
    [...args, '--only-show-errors', '--output', 'json'],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  )
  if (completed.error) throw new Error('Azure CLI query could not be started')
  if (completed.status !== 0) {
    throw new Error(`Azure CLI query failed with exit ${completed.status ?? 'unknown'}`)
  }
  try {
    return JSON.parse(completed.stdout)
  } catch {
    throw new Error('Azure CLI query returned malformed JSON')
  }
}

export function inspectProtectedConfiguration({ resourceGroup, webappName, runAz = runAzJson }) {
  if (!resourceGroup || !webappName) throw new Error('resource group and web app name are required')

  const settingNames = runAz([
    'webapp',
    'config',
    'appsettings',
    'list',
    '--resource-group',
    resourceGroup,
    '--name',
    webappName,
    '--query',
    '[].name',
  ])
  const siteConfig = runAz([
    'webapp',
    'config',
    'show',
    '--resource-group',
    resourceGroup,
    '--name',
    webappName,
    '--query',
    '{alwaysOn:alwaysOn,numberOfWorkers:numberOfWorkers,ftpsState:ftpsState,http20Enabled:http20Enabled,minTlsVersion:minTlsVersion,healthCheckPath:healthCheckPath}',
  ])
  const webapp = runAz([
    'webapp',
    'show',
    '--resource-group',
    resourceGroup,
    '--name',
    webappName,
    '--query',
    '{httpsOnly:httpsOnly}',
  ])
  if (!Array.isArray(settingNames) || settingNames.some(name => typeof name !== 'string')) {
    throw new Error('Azure CLI app-setting name query returned an unexpected shape')
  }
  if (!siteConfig || typeof siteConfig !== 'object' || !webapp || typeof webapp !== 'object') {
    throw new Error('Azure CLI site invariant query returned an unexpected shape')
  }

  const presentNames = new Set(settingNames)
  const missingNames = REQUIRED_APP_SETTING_NAMES.filter(name => !presentNames.has(name))
  const invariants = {
    always_on: siteConfig.alwaysOn === true,
    single_worker: siteConfig.numberOfWorkers === 1,
    ftps_disabled: siteConfig.ftpsState === 'Disabled',
    http2_enabled: siteConfig.http20Enabled === true,
    minimum_tls_1_2: siteConfig.minTlsVersion === '1.2',
    liveness_path: siteConfig.healthCheckPath === '/api/live',
    https_only: webapp.httpsOnly === true,
  }
  const findings = []
  if (missingNames.length > 0) findings.push('required-app-setting-name-missing')
  for (const [name, matches] of Object.entries(invariants)) {
    if (!matches) findings.push(`site-invariant-${name.replaceAll('_', '-')}`)
  }

  return result(
    'protected-configuration-precheck',
    findings.length === 0,
    {
      comparison_scope: 'setting-names-and-non-secret-site-invariants',
      required_setting_names: REQUIRED_APP_SETTING_NAMES,
      present_required_setting_count: REQUIRED_APP_SETTING_NAMES.length - missingNames.length,
      missing_setting_names: missingNames,
      site_invariants: invariants,
      values_or_value_hashes_recorded: false,
    },
    findings,
  )
}

function parseOptions(tokens) {
  const options = {}
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index]
    const value = tokens[index + 1]
    if (!key?.startsWith('--') || value === undefined) throw new Error('options must be --name value pairs')
    const name = key.slice(2)
    if (name in options) throw new Error(`duplicate option --${name}`)
    options[name] = value
  }
  return options
}

function requiredOption(options, name) {
  const value = options[name]
  if (!value) throw new Error(`missing --${name}`)
  return value
}

export async function main(argv) {
  const [command, ...tokens] = argv
  const options = parseOptions(tokens)
  const root = options.root ? resolve(options.root) : process.cwd()
  let checkResult

  switch (command) {
    case 'migration':
      checkResult = inspectMigrations(root)
      break
    case 'recovery':
      checkResult = inspectRecovery(root)
      break
    case 'readiness': {
      const migration = inspectMigrations(root)
      checkResult = await inspectReadiness({
        url: requiredOption(options, 'url'),
        minimumSchemaVersion: migration.report.observations.latest_schema_version,
      })
      break
    }
    case 'protected-config':
      checkResult = inspectProtectedConfiguration({
        resourceGroup: requiredOption(options, 'resource-group'),
        webappName: requiredOption(options, 'webapp-name'),
      })
      break
    default:
      throw new Error('expected migration, recovery, readiness, or protected-config')
  }

  process.stdout.write(`${JSON.stringify(checkResult.report, null, 2)}\n`)
  return checkResult.ok ? 0 : 1
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (invokedDirectly) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown checker failure'
    process.stderr.write(`deployment checker execution failure: ${message}\n`)
    process.exitCode = 2
  }
}
