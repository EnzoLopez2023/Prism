import path from 'node:path'
import { createRecoveryGeneration, restoreRecoveryGeneration, verifyRecoveryGeneration } from '../lib/recovery/generation.js'

const [command, ...args] = process.argv.slice(2)
if (command === 'backup' && args.length === 3) {
  console.log(JSON.stringify(await createRecoveryGeneration({
    databasePath: path.resolve(args[0]!),
    artifactRoot: path.resolve(args[1]!),
    generationPath: path.resolve(args[2]!),
  }), null, 2))
} else if (command === 'verify' && args.length === 1) {
  console.log(JSON.stringify(verifyRecoveryGeneration(path.resolve(args[0]!)), null, 2))
} else if (command === 'restore' && args.length === 3) {
  console.log(JSON.stringify(restoreRecoveryGeneration({
    generationPath: path.resolve(args[0]!),
    databasePath: path.resolve(args[1]!),
    artifactRoot: path.resolve(args[2]!),
  }), null, 2))
} else {
  console.error('usage:\n  recovery backup <source.db> <artifact-root> <generation-dir>\n  recovery verify <generation-dir>\n  recovery restore <generation-dir> <destination.db> <artifact-root>')
  process.exit(2)
}
