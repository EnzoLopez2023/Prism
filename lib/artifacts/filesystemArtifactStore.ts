import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ArtifactStore, StoredArtifact } from './artifactStore.js'

function safePath(root: string, objectKey: string): string {
  const normalized = path.normalize(objectKey).replace(/^(\.\.(\/|\\|$))+/, '')
  const resolved = path.resolve(root, normalized)
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Invalid artifact key')
  return resolved
}

export class FilesystemArtifactStore implements ArtifactStore {
  constructor(private readonly root: string) {}

  async put(input: { objectKey: string; bytes: Buffer; contentType: string; replaceMismatched?: boolean }): Promise<StoredArtifact> {
    const target = safePath(this.root, input.objectKey)
    await fs.mkdir(path.dirname(target), { recursive: true })
    const sha256 = createHash('sha256').update(input.bytes).digest('hex')
    const temporary = `${target}.staging-${randomUUID()}`
    await fs.writeFile(temporary, input.bytes, { flag: 'wx' })
    let created = false
    try {
      let existing: Buffer | null = null
      try { existing = await fs.readFile(target) } catch (error) {
        if (!(typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT')) throw error
      }
      if (existing) {
        const matches = existing.length === input.bytes.length && createHash('sha256').update(existing).digest('hex') === sha256
        if (matches) return { objectKey: input.objectKey, sha256, bytes: input.bytes.length, contentType: input.contentType, created: false }
        if (!input.replaceMismatched) throw new Error(`Artifact key conflict: ${input.objectKey}`)
      }
      await fs.rename(temporary, target)
      created = true
    } finally {
      await fs.rm(temporary, { force: true })
    }
    return {
      objectKey: input.objectKey,
      sha256,
      bytes: input.bytes.length,
      contentType: input.contentType,
      created,
    }
  }

  async get(objectKey: string, contentType: string): Promise<{ bytes: Buffer; contentType: string }> {
    const target = safePath(this.root, objectKey)
    return { bytes: await fs.readFile(target), contentType }
  }

  async delete(objectKey: string): Promise<void> {
    const target = safePath(this.root, objectKey)
    await fs.rm(target, { force: true })
  }
}
