import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { RequestHandler } from 'express'
import type { AppConfig } from '../config.js'

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const devIdentity = { tenantId: '00000000-0000-4000-8000-000000000001', oid: '00000000-0000-4000-8000-000000000002', displayName: 'Local developer' }

export function authentication(config: AppConfig): RequestHandler {
  if (config.auth.mode === 'development') {
    return async (req, _res, next) => {
      req.identity = devIdentity
      await req.repository.touchIdentity(devIdentity, config.auth.bootstrapAdminOid || devIdentity.oid)
      req.roles = await req.repository.roles(devIdentity)
      next()
    }
  }
  const issuer = `https://login.microsoftonline.com/${config.auth.tenantId}/v2.0`
  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${config.auth.tenantId}/discovery/v2.0/keys`))
  return async (req, res, next) => {
    const match = /^Bearer (.+)$/.exec(req.header('authorization') || '')
    if (!match) return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'A Prism access token is required' })
    try {
      const { payload } = await jwtVerify(match[1]!, jwks, { issuer, audience: config.auth.audience })
      const oid = typeof payload.oid === 'string' ? payload.oid : ''
      const tenantId = typeof payload.tid === 'string' ? payload.tid : ''
      if (!guid.test(oid) || tenantId !== config.auth.tenantId) throw new Error('Invalid identity boundary')
      req.identity = { tenantId, oid, displayName: typeof payload.name === 'string' ? payload.name : undefined }
      await req.repository.touchIdentity(req.identity, config.auth.bootstrapAdminOid)
      req.roles = await req.repository.roles(req.identity)
      next()
    } catch {
      return res.status(401).json({ code: 'INVALID_TOKEN', error: 'The Prism access token is invalid or expired' })
    }
  }
}

export function requireRole(role: 'member' | 'admin'): RequestHandler {
  return async (req, res, next) => {
    if (!req.identity || !req.roles?.includes(role)) {
      await req.repository.audit(req.identity || null, 'authorize', 'role', role, 'denied')
      return res.status(403).json({ code: 'FORBIDDEN', error: `The ${role} role is required` })
    }
    next()
  }
}
