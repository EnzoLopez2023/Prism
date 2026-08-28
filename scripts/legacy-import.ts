import path from 'node:path'
import { importLegacy } from '../lib/migration/prismLegacy.js'

const [sourcePath, targetPath, artifactRoot] = process.argv.slice(2)
if (!sourcePath || !targetPath || !artifactRoot) {
  console.error('usage: npm run legacy:import -- <immutable-source.db> <empty-target.db> <artifact-root>')
  process.exit(2)
}
const result = await importLegacy({ sourcePath: path.resolve(sourcePath), targetPath: path.resolve(targetPath), artifactRoot: path.resolve(artifactRoot) })
console.log(JSON.stringify(result, null, 2))
