import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FilesystemArtifactStore } from '../lib/artifacts/filesystemArtifactStore.js'
import { openDatabase } from '../lib/db/connection.js'
import { migrate } from '../lib/db/migrations.js'
import { PrismRepository } from '../lib/db/repositories/prismRepository.js'

export function testRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-test-'))
  const db = openDatabase(path.join(root, 'prism.db'))
  migrate(db)
  return {
    root,
    db,
    repository: new PrismRepository(db, new FilesystemArtifactStore(path.join(root, 'artifacts'))),
    close() { db.close(); fs.rmSync(root, { recursive: true, force: true }) },
  }
}
