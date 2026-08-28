import path from 'node:path'

export interface AppConfig {
  port: number
  host: string
  environment: string
  deployed: boolean
  dbPath: string
  artifactRoot: string
  operationClaimPath: string
  auth: {
    mode: 'development' | 'entra'
    tenantId?: string
    clientId?: string
    audience?: string
    bootstrapAdminOid?: string
  }
  limits: {
    jsonBytes: number
    providerTimeoutMs: number
    maxPromptChars: number
    maxOutputTokens: number
    maxImageBytes: number
    maxProviderResponseBytes: number
  }
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = env.NODE_ENV || 'development'
  const deployedEnvironment = !['development', 'test', 'local'].includes(environment.toLowerCase()) ||
    Boolean(env.WEBSITE_INSTANCE_ID || env.WEBSITE_SITE_NAME || env.WEBSITE_HOSTNAME)
  const entraComplete = Boolean(env.PRISM_ENTRA_TENANT_ID && env.PRISM_ENTRA_AUDIENCE)
  if (env.PRISM_AUTH_MODE && env.PRISM_AUTH_MODE !== 'development' && env.PRISM_AUTH_MODE !== 'entra') {
    throw new Error('PRISM_AUTH_MODE must be development or entra')
  }
  if (!env.PRISM_AUTH_MODE && !entraComplete) {
    throw new Error('Set PRISM_AUTH_MODE=development explicitly or configure the complete Prism Entra tenant and audience')
  }
  const mode = env.PRISM_AUTH_MODE === 'development' ? 'development' : 'entra'
  if (mode === 'development' && deployedEnvironment) {
    throw new Error('Development authentication is forbidden in deployed environments; configure complete Prism Entra authentication')
  }
  if (mode === 'entra' && (!env.PRISM_ENTRA_TENANT_ID || !env.PRISM_ENTRA_AUDIENCE)) {
    throw new Error('Entra mode requires PRISM_ENTRA_TENANT_ID and PRISM_ENTRA_AUDIENCE')
  }
  const dbPath = env.PRISM_DB_PATH || (deployedEnvironment ? '/home/data/prism.db' : path.resolve('data/prism.db'))
  return {
    port: positiveInt(env.PORT, 3000),
    host: mode === 'development' ? '127.0.0.1' : (env.HOST || '0.0.0.0'),
    environment,
    deployed: deployedEnvironment,
    dbPath,
    artifactRoot: env.PRISM_ARTIFACT_ROOT || (deployedEnvironment ? '/home/data/prism-artifacts' : path.resolve('data/artifacts')),
    operationClaimPath: `${dbPath}.operation.claim`,
    auth: {
      mode,
      tenantId: env.PRISM_ENTRA_TENANT_ID,
      clientId: env.PRISM_ENTRA_CLIENT_ID,
      audience: env.PRISM_ENTRA_AUDIENCE,
      bootstrapAdminOid: env.PRISM_BOOTSTRAP_ADMIN_OID,
    },
    limits: {
      jsonBytes: positiveInt(env.PRISM_JSON_LIMIT_BYTES, 50 * 1024 * 1024),
      providerTimeoutMs: positiveInt(env.PRISM_PROVIDER_TIMEOUT_MS, 45_000),
      maxPromptChars: positiveInt(env.PRISM_MAX_PROMPT_CHARS, 32_000),
      maxOutputTokens: positiveInt(env.PRISM_MAX_OUTPUT_TOKENS, 8_192),
      maxImageBytes: positiveInt(env.PRISM_MAX_IMAGE_BYTES, 15_000_000),
      maxProviderResponseBytes: positiveInt(env.PRISM_MAX_PROVIDER_RESPONSE_BYTES, 24 * 1024 * 1024),
    },
  }
}
