import fs from 'node:fs'
import path from 'node:path'

const forbiddenPackages = new Set(['pg', 'postgres', 'drizzle-orm', '@neondatabase/serverless'])
const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const installed = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter(name => forbiddenPackages.has(name))
const forbidden = /\b(postgresql|postgres:\/\/|drizzle-orm|from ['"]pg['"]|from ['"]postgres['"])\b/i
const matches = []
for (const root of ['src', 'server', 'lib', 'scripts', 'test']) {
  if (!fs.existsSync(root)) continue
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (file !== path.join('scripts', 'check-no-postgres.mjs') && /\.(ts|tsx|js|mjs)$/.test(entry.name) && forbidden.test(fs.readFileSync(file, 'utf8'))) matches.push(file)
    }
  }
  visit(root)
}
if (installed.length || matches.length) {
  console.error(JSON.stringify({ installed, matches }, null, 2))
  process.exit(1)
}
console.log('No PostgreSQL packages or implementation code found.')
