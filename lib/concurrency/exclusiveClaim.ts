import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export interface ClaimRecord {
  token: string
  pid: number
  operation: string
  createdAt: string
  payload: Record<string, unknown>
}

interface ExactFile {
  dev: number
  ino: number
  bytes: Buffer
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try { return new Date(value).toISOString() === value } catch { return false }
}

export function isClaimRecord(value: unknown): value is ClaimRecord {
  if (!isPlainRecord(value)) return false
  const keys = Object.keys(value).sort()
  if (JSON.stringify(keys) !== JSON.stringify(['createdAt', 'operation', 'payload', 'pid', 'token'])) return false
  return typeof value.token === 'string' && uuid.test(value.token) &&
    Number.isSafeInteger(value.pid) && Number(value.pid) > 0 &&
    typeof value.operation === 'string' && value.operation.trim().length > 0 && value.operation.length <= 200 &&
    isIsoTimestamp(value.createdAt) &&
    isPlainRecord(value.payload)
}

function exactFile(descriptor: number, bytes: Buffer): ExactFile {
  const stat = fs.fstatSync(descriptor)
  return { dev: stat.dev, ino: stat.ino, bytes }
}

function quarantineAndRemoveExact(claimPath: string, expected: ExactFile): void {
  const quarantine = `${claimPath}.quarantine-${randomUUID()}`
  fs.renameSync(claimPath, quarantine)
  const movedStat = fs.lstatSync(quarantine)
  const movedBytes = fs.readFileSync(quarantine)
  const matches = movedStat.dev === expected.dev && movedStat.ino === expected.ino && movedStat.isFile() && movedBytes.equals(expected.bytes)
  if (!matches) {
    try {
      fs.copyFileSync(quarantine, claimPath, fs.constants.COPYFILE_EXCL)
      if (!fs.readFileSync(claimPath).equals(movedBytes)) throw new Error('Restored claim bytes did not match quarantine')
      fs.rmSync(quarantine)
      throw new Error('Claim changed before quarantine; replacement was restored and not removed')
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'EEXIST') {
        throw new Error(`Claim changed before quarantine; a new claim was preserved and the prior replacement remains quarantined at ${quarantine}`)
      }
      throw error
    }
  }
  fs.rmSync(quarantine)
}

export function acquireExclusiveClaim(
  filename: string,
  operation: string,
  payload: Record<string, unknown> = {},
  releaseWithMutex = true,
): { release: () => void; token: string } {
  const claimPath = path.resolve(filename)
  fs.mkdirSync(path.dirname(claimPath), { recursive: true })
  const token = randomUUID()
  const record: ClaimRecord = { token, pid: process.pid, operation, createdAt: new Date().toISOString(), payload }
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`)
  let descriptor: number | null = null
  let owned: ExactFile | null = null
  try {
    descriptor = fs.openSync(claimPath, 'wx', 0o600)
    owned = exactFile(descriptor, bytes)
    fs.writeFileSync(descriptor, bytes)
    fs.fsyncSync(descriptor)
    owned = exactFile(descriptor, bytes)
    fs.closeSync(descriptor)
    descriptor = null
  } catch (error) {
    if (descriptor !== null) {
      try { fs.closeSync(descriptor) } catch { /* Preserve the original publication error. */ }
      descriptor = null
    }
    if (owned) {
      try {
        const current = fs.lstatSync(claimPath)
        if (current.dev === owned.dev && current.ino === owned.ino && current.isFile()) quarantineAndRemoveExact(claimPath, { ...owned, bytes: fs.readFileSync(claimPath) })
      } catch { /* Never remove a path whose invocation ownership cannot be proved. */ }
    } else if (typeof error === 'object' && error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`${operation} is already in progress; existing claims are never removed automatically`)
    }
    throw error
  }
  const published = owned
  let released = false
  return {
    token,
    release: () => {
      if (released) return
      const remove = () => quarantineAndRemoveExact(claimPath, published)
      if (releaseWithMutex) {
        const mutex = acquireExclusiveClaim(`${claimPath}.recovery`, 'Prism claim mutation', {}, false)
        try { remove() } finally { mutex.release() }
      } else {
        remove()
      }
      released = true
    },
  }
}

export function recoverExclusiveClaim(options: {
  claimPath: string
  recordedToken?: string
  rawBytes?: number
  rawSha256?: string
  archiveDirectory: string
  confirmation: string
  beforeQuarantine?: () => void
}): string {
  const claimPath = path.resolve(options.claimPath)
  const recoveryClaim = acquireExclusiveClaim(`${claimPath}.recovery`, 'Prism claim recovery', {}, false)
  try {
    const rawBefore = fs.readFileSync(claimPath)
    const stat = fs.statSync(claimPath)
    const expected: ExactFile = { dev: stat.dev, ino: stat.ino, bytes: rawBefore }
    const rawSha256 = createHash('sha256').update(rawBefore).digest('hex')
    let claim: ClaimRecord | null = null
    try {
      const parsed: unknown = JSON.parse(rawBefore.toString('utf8'))
      if (isClaimRecord(parsed)) claim = parsed
    } catch { /* Malformed claims use exact raw evidence instead of a token. */ }
    if (claim) {
      if (options.confirmation !== 'RECOVER PRISM OPERATION CLAIM') throw new Error('Exact operator recovery confirmation is required')
      if (!options.recordedToken || claim.token !== options.recordedToken) throw new Error('Recorded claim token does not match')
    } else {
      if (options.confirmation !== 'RECOVER MALFORMED PRISM OPERATION CLAIM') throw new Error('Exact malformed-claim recovery confirmation is required')
      if (options.rawBytes !== rawBefore.length || options.rawSha256 !== rawSha256) throw new Error('Recorded raw claim evidence does not match')
    }
    const recoveryId = randomUUID()
    const evidence = {
      contract: 'prism.operation-claim-recovery.v1',
      recoveryId,
      recoveredAt: new Date().toISOString(),
      recoveredByPid: process.pid,
      claimPath,
      claimSha256: rawSha256,
      claimBytes: stat.size,
      claim,
      claimRawBase64: rawBefore.toString('base64'),
      confirmation: options.confirmation,
    }
    fs.mkdirSync(options.archiveDirectory, { recursive: true })
    const identity = claim?.token || rawSha256.slice(0, 16)
    const archivePath = path.join(path.resolve(options.archiveDirectory), `${path.basename(claimPath)}-${identity}-${recoveryId}.recovery.json`)
    fs.writeFileSync(archivePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    const rawAfter = fs.readFileSync(claimPath)
    const statAfter = fs.statSync(claimPath)
    if (statAfter.dev !== stat.dev || statAfter.ino !== stat.ino || !rawAfter.equals(rawBefore)) {
      throw new Error('Claim changed during recovery; nothing was removed')
    }
    options.beforeQuarantine?.()
    quarantineAndRemoveExact(claimPath, expected)
    return archivePath
  } finally {
    recoveryClaim.release()
  }
}
