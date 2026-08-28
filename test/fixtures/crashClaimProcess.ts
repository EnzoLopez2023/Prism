import fs from 'node:fs'

const [claimPath] = process.argv.slice(2)
if (!claimPath) process.exit(3)
const descriptor = fs.openSync(claimPath, 'wx', 0o600)
process.stdout.write('created\n')
setInterval(() => {
  fs.fstatSync(descriptor)
}, 1_000)
