import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismRepository } from '../lib/db/repositories/prismRepository.js'
import { buildIdentity } from '../lib/buildIdentity.js'
import { authentication, requireRole } from './auth/entra.js'
import type { CrossAppClients } from './clients/contracts.js'
import type { AppConfig } from './config.js'
import { aiRoutes } from './routes/ai.js'
import { conversationRoutes } from './routes/conversations.js'
import { promptRoutes } from './routes/prompts.js'
import './types.js'

export function createApp(config: AppConfig, repository: PrismRepository, clients: CrossAppClients) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: config.limits.jsonBytes }))
  app.use((req, _res, next) => { req.repository = repository; next() })

  app.get('/api/live', (_req, res) => res.json({ status: 'live', app: buildIdentity.app }))
  app.get(['/api/version', '/version.json'], (_req, res) => res.json(buildIdentity))
  app.get('/api/ready', async (_req, res) => {
    try {
      res.json({ status: 'ready', lifecycle: 'running', authority: config.dbPath, schema: buildIdentity.schema, build: buildIdentity, database: await repository.readiness() })
    } catch {
      res.status(503).json({ status: 'not-ready', lifecycle: 'running', schema: buildIdentity.schema, build: buildIdentity })
    }
  })

  app.use('/api', authentication(config), requireRole('member'))
  app.use('/api', conversationRoutes(config), promptRoutes(), aiRoutes(config, clients))
  app.get('/api/settings', async (req, res) => res.json(await repository.settings(req.identity!)))
  app.put('/api/settings', async (req, res) => { await repository.saveSettings(req.identity!, req.body); res.json({ success: true }) })
  app.get('/api/admin/audit', requireRole('admin'), (_req, res) => res.status(501).json({ code: 'NOT_IMPLEMENTED', error: 'Use the recovery export for immutable audit review' }))

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next
    console.error('request_failed', error instanceof Error ? error.message : 'unknown')
    if (typeof error === 'object' && error && 'type' in error && error.type === 'entity.too.large') {
      return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', error: 'The request exceeds Prism input limits' })
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', error: 'The request could not be completed' })
  })

  if (config.deployed) {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist')
    app.use(express.static(dist, { index: false }))
    app.get('*splat', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
  }
  return app
}
