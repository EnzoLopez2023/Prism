import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { buildIdentity } from '../buildIdentity.js'
import { openDatabase } from '../db/connection.js'
import { acquireExclusiveClaim } from '../concurrency/exclusiveClaim.js'

interface ArtifactEvidence {
  objectKey: string
  sha256: string
  bytes: number
  contentType: string
}

export interface RecoveryManifest {
  contract: 'prism.recovery-generation.v1'
  createdAt: string
  creationIdentity: Record<string, unknown>
  database: { file: 'prism.db'; bytes: number; sha256: string }
  artifacts: ArtifactEvidence[]
  counts: Record<string, number>
}

function sha256File(filename: string): string {
  const hash = createHash('sha256')
  const fd = fs.openSync(filename, 'r')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  try {
    while (true) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null)
      if (!read) break
      hash.update(buffer.subarray(0, read))
    }
  } finally { fs.closeSync(fd) }
  return hash.digest('hex')
}

function artifactPath(root: string, objectKey: string): string {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(root, path.normalize(objectKey))
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`Unsafe artifact key: ${objectKey}`)
  return resolved
}

function tableCounts(databasePath: string): Record<string, number> {
  const db = openDatabase(databasePath, true)
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]
  const counts = Object.fromEntries(tables.map(({ name }) => [name, Number((db.prepare(`SELECT COUNT(*) AS count FROM "${name.replaceAll('"', '""')}"`).get() as { count: number }).count)]))
  db.close()
  return counts
}

function referencedArtifacts(databasePath: string): ArtifactEvidence[] {
  const db = openDatabase(databasePath, true)
  const rows = db.prepare('SELECT object_key AS objectKey,sha256,file_size AS bytes,file_type AS contentType FROM conversation_images ORDER BY object_key').all() as ArtifactEvidence[]
  db.close()
  return rows
}

function assertDatabaseChecks(databasePath: string): void {
  const db = openDatabase(databasePath, true)
  const quick = db.pragma('quick_check') as { quick_check: string }[]
  const integrity = db.pragma('integrity_check') as { integrity_check: string }[]
  const foreignKeys = db.pragma('foreign_key_check') as unknown[]
  db.close()
  if (quick.some(row => row.quick_check !== 'ok')) throw new Error('Recovery database quick_check failed')
  if (integrity.some(row => row.integrity_check !== 'ok')) throw new Error('Recovery database integrity_check failed')
  if (foreignKeys.length) throw new Error(`Recovery database has ${foreignKeys.length} foreign-key violations`)
}

function verifyArtifacts(databasePath: string, artifactRoot: string, expected: ArtifactEvidence[]): void {
  const referenced = referencedArtifacts(databasePath)
  if (JSON.stringify(referenced) !== JSON.stringify(expected)) throw new Error('Recovery artifact reference set does not match immutable manifest')
  const actualKeys: string[] = []
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(filename)
      else actualKeys.push(path.relative(artifactRoot, filename).split(path.sep).join('/'))
    }
  }
  if (fs.existsSync(artifactRoot)) visit(artifactRoot)
  const expectedKeys = expected.map(item => item.objectKey).sort()
  if (JSON.stringify(actualKeys.sort()) !== JSON.stringify(expectedKeys)) throw new Error('Recovery artifact file set does not match immutable manifest')
  for (const item of expected) {
    const filename = artifactPath(artifactRoot, item.objectKey)
    if (!fs.existsSync(filename)) throw new Error(`Missing recovery artifact: ${item.objectKey}`)
    const bytes = fs.statSync(filename).size
    if (bytes !== item.bytes) throw new Error(`Recovery artifact byte mismatch: ${item.objectKey}`)
    if (sha256File(filename) !== item.sha256) throw new Error(`Recovery artifact hash mismatch: ${item.objectKey}`)
  }
}

export async function createRecoveryGeneration(options: { databasePath: string; artifactRoot: string; generationPath: string; creationIdentity?: Record<string, unknown> }): Promise<RecoveryManifest> {
  const destination = path.resolve(options.generationPath)
  if (fs.existsSync(destination)) throw new Error('Recovery generation already exists')
  const temporary = `${destination}.staging-${randomUUID()}`
  fs.mkdirSync(path.join(temporary, 'artifacts'), { recursive: true })
  try {
    const source = openDatabase(options.databasePath)
    await source.backup(path.join(temporary, 'prism.db'))
    source.close()
    const databasePath = path.join(temporary, 'prism.db')
    const artifacts = referencedArtifacts(databasePath)
    for (const item of artifacts) {
      const sourceFile = artifactPath(options.artifactRoot, item.objectKey)
      if (!fs.existsSync(sourceFile)) throw new Error(`Source artifact is missing: ${item.objectKey}`)
      if (fs.statSync(sourceFile).size !== item.bytes || sha256File(sourceFile) !== item.sha256) throw new Error(`Source artifact evidence mismatch: ${item.objectKey}`)
      const destinationFile = artifactPath(path.join(temporary, 'artifacts'), item.objectKey)
      fs.mkdirSync(path.dirname(destinationFile), { recursive: true })
      fs.copyFileSync(sourceFile, destinationFile, fs.constants.COPYFILE_EXCL)
    }
    assertDatabaseChecks(databasePath)
    verifyArtifacts(databasePath, path.join(temporary, 'artifacts'), artifacts)
    const manifest: RecoveryManifest = {
      contract: 'prism.recovery-generation.v1',
      createdAt: new Date().toISOString(),
      creationIdentity: options.creationIdentity || buildIdentity,
      database: { file: 'prism.db', bytes: fs.statSync(databasePath).size, sha256: sha256File(databasePath) },
      artifacts,
      counts: tableCounts(databasePath),
    }
    fs.writeFileSync(path.join(temporary, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.renameSync(temporary, destination)
    return manifest
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true })
    throw error
  }
}

export function verifyRecoveryGeneration(generationPath: string): RecoveryManifest {
  const root = path.resolve(generationPath)
  const manifestPath = path.join(root, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RecoveryManifest
  if (manifest.contract !== 'prism.recovery-generation.v1') throw new Error('Unsupported recovery manifest contract')
  const databasePath = path.join(root, manifest.database.file)
  if (fs.statSync(databasePath).size !== manifest.database.bytes) throw new Error('Recovery database byte mismatch')
  if (sha256File(databasePath) !== manifest.database.sha256) throw new Error('Recovery database hash mismatch')
  if (JSON.stringify(tableCounts(databasePath)) !== JSON.stringify(manifest.counts)) throw new Error('Recovery database counts do not match immutable manifest')
  assertDatabaseChecks(databasePath)
  verifyArtifacts(databasePath, path.join(root, 'artifacts'), manifest.artifacts)
  return manifest
}

export function restoreRecoveryGeneration(options: { generationPath: string; databasePath: string; artifactRoot: string }): RecoveryManifest {
  const manifest = verifyRecoveryGeneration(options.generationPath)
  const sourceDatabase = path.join(options.generationPath, manifest.database.file)
  if (fs.existsSync(options.databasePath)) {
    if (!fs.existsSync(options.artifactRoot) || sha256File(options.databasePath) !== manifest.database.sha256) throw new Error('Existing restore destination does not match this generation')
    assertDatabaseChecks(options.databasePath)
    verifyArtifacts(options.databasePath, options.artifactRoot, manifest.artifacts)
    return manifest
  }
  const token = randomUUID()
  const stagedDatabase = `${options.databasePath}.staging-${token}`
  const stagedArtifacts = `${options.artifactRoot}.staging-${token}`
  const claim = acquireExclusiveClaim(
    `${options.databasePath}.operation.claim`,
    'Prism recovery restore',
    { stagedDatabase, stagedArtifacts },
  )
  let existingArtifacts = false
  let promotedArtifacts = false
  try {
    existingArtifacts = fs.existsSync(options.artifactRoot)
    if (existingArtifacts) verifyArtifacts(sourceDatabase, options.artifactRoot, manifest.artifacts)
    fs.mkdirSync(path.dirname(options.databasePath), { recursive: true })
    fs.copyFileSync(sourceDatabase, stagedDatabase, fs.constants.COPYFILE_EXCL)
    if (!existingArtifacts) {
      fs.mkdirSync(stagedArtifacts, { recursive: false })
      for (const item of manifest.artifacts) {
        const source = artifactPath(path.join(options.generationPath, 'artifacts'), item.objectKey)
        const destination = artifactPath(stagedArtifacts, item.objectKey)
        fs.mkdirSync(path.dirname(destination), { recursive: true })
        fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL)
      }
    }
    if (sha256File(stagedDatabase) !== manifest.database.sha256) throw new Error('Staged database hash mismatch')
    assertDatabaseChecks(stagedDatabase)
    verifyArtifacts(stagedDatabase, existingArtifacts ? options.artifactRoot : stagedArtifacts, manifest.artifacts)
    if (!existingArtifacts) {
      fs.mkdirSync(path.dirname(options.artifactRoot), { recursive: true })
      fs.renameSync(stagedArtifacts, options.artifactRoot)
      promotedArtifacts = true
    }
    // The database is the authority marker and is promoted only after all artifacts.
    fs.renameSync(stagedDatabase, options.databasePath)
    return manifest
  } catch (error) {
    fs.rmSync(stagedDatabase, { force: true })
    fs.rmSync(stagedArtifacts, { recursive: true, force: true })
    if (promotedArtifacts) fs.rmSync(options.artifactRoot, { recursive: true, force: true })
    throw error
  } finally {
    claim.release()
  }
}
