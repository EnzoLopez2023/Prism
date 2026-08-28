import { acquireExclusiveClaim } from '../../lib/concurrency/exclusiveClaim.js'

const [claimPath, holdArg] = process.argv.slice(2)
if (!claimPath) process.exit(3)
try {
  const claim = acquireExclusiveClaim(claimPath, 'multi-process test')
  process.stdout.write(`acquired:${claim.token}\n`)
  setTimeout(() => {
    claim.release()
    process.exit(0)
  }, Number(holdArg) || 0)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'claim failed'}\n`)
  process.exit(2)
}
