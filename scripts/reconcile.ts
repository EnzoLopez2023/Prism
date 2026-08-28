import path from 'node:path'
import { reconcileLegacy } from '../lib/migration/reconcile.js'

const [sourcePath, targetPath, artifactRoot] = process.argv.slice(2)
if (!sourcePath || !targetPath || !artifactRoot) {
  console.error('usage: npm run legacy:reconcile -- <immutable-source.db> <target.db> <artifact-root>')
  process.exit(2)
}
const result = reconcileLegacy({ sourcePath: path.resolve(sourcePath), targetPath: path.resolve(targetPath), artifactRoot: path.resolve(artifactRoot) })
console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exitCode = 1
