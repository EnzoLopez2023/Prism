import 'dotenv/config'
import { createServer } from 'node:http'
import { FilesystemArtifactStore } from '../lib/artifacts/filesystemArtifactStore.js'
import { openDatabase } from '../lib/db/connection.js'
import { migrate } from '../lib/db/migrations.js'
import { PrismRepository } from '../lib/db/repositories/prismRepository.js'
import { createApp } from './app.js'
import { HttpContractClient, HttpMarqueeClient, ownedAppValidator } from './clients/httpContractClient.js'
import { AzureManagedIdentityTokenProvider, UnavailableTokenProvider } from './clients/workloadToken.js'
import { loadConfig } from './config.js'
import { acquireExclusiveClaim } from '../lib/concurrency/exclusiveClaim.js'

const config = loadConfig()
const operationClaim = acquireExclusiveClaim(config.operationClaimPath, 'Prism application runtime', { host: config.host, environment: config.environment })
const db = openDatabase(config.dbPath)
migrate(db)
const repository = new PrismRepository(db, new FilesystemArtifactStore(config.artifactRoot))
const resumedDeletions = await repository.resumePendingConversationDeletions()
if (resumedDeletions.completed || resumedDeletions.failed) console.log(`prism_artifact_cleanup completed=${resumedDeletions.completed} failed=${resumedDeletions.failed}`)
const tokens = process.env.IDENTITY_ENDPOINT ? new AzureManagedIdentityTokenProvider() : new UnavailableTokenProvider()
const clients = {
  hearth: new HttpContractClient(process.env.HEARTH_BASE_URL, process.env.HEARTH_AUDIENCE, tokens, ownedAppValidator('hearth')),
  lantern: new HttpContractClient(process.env.LANTERN_BASE_URL, process.env.LANTERN_AUDIENCE, tokens, ownedAppValidator('lantern')),
  watchtower: new HttpContractClient(process.env.WATCHTOWER_BASE_URL, process.env.WATCHTOWER_AUDIENCE, tokens, ownedAppValidator('watchtower')),
  marquee: new HttpMarqueeClient(process.env.MARQUEE_BASE_URL, process.env.MARQUEE_AUDIENCE, tokens),
}
const server = createServer(createApp(config, repository, clients))
server.listen(config.port, config.host, () => console.log(`prism_listening host=${config.host} port=${config.port}`))

function shutdown(signal: string) {
  console.log(`prism_shutdown signal=${signal}`)
  server.close(() => { db.close(); operationClaim.release(); process.exit(0) })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
