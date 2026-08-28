import path from 'node:path'
import { recoverExclusiveClaim } from '../lib/concurrency/exclusiveClaim.js'

const [claimArg, archiveArg, confirmation, ...flags] = process.argv.slice(2)
if (!claimArg || !archiveArg || !confirmation) {
  console.error('usage:\n  claim:recover <claim-path> <archive-dir> "RECOVER PRISM OPERATION CLAIM" --token <token>\n  claim:recover <claim-path> <archive-dir> "RECOVER MALFORMED PRISM OPERATION CLAIM" --raw-bytes <n> --raw-sha256 <hash>')
  process.exit(2)
}
const value = (name: string) => {
  const index = flags.indexOf(name)
  return index >= 0 ? flags[index + 1] : undefined
}
const rawBytes = value('--raw-bytes')
const archivePath = recoverExclusiveClaim({
  claimPath: path.resolve(claimArg),
  archiveDirectory: path.resolve(archiveArg),
  confirmation,
  recordedToken: value('--token'),
  rawBytes: rawBytes === undefined ? undefined : Number(rawBytes),
  rawSha256: value('--raw-sha256'),
})
console.log(JSON.stringify({ recovered: path.resolve(claimArg), evidence: archivePath }, null, 2))
