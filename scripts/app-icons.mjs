import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDirectory = path.join(projectRoot, 'public')
const masterPath = path.join(publicDirectory, 'prism-icon-1024.png')
const appleTouchPath = path.join(publicDirectory, 'apple-touch-icon.png')
const faviconPath = path.join(publicDirectory, 'favicon.ico')
const expectedMasterHash = '669b93ec6763a8ceec51434911dfa1c6fe31c9152c335f8468b3a973119942ce'
const faviconSizes = [16, 32, 48]
const checkMode = process.argv.includes('--check')

const unexpectedArguments = process.argv.slice(2).filter(argument => argument !== '--check')
if (unexpectedArguments.length) {
  throw new Error(`Unknown argument${unexpectedArguments.length === 1 ? '' : 's'}: ${unexpectedArguments.join(', ')}`)
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function validateOpaquePng(name, buffer, expectedSize) {
  let image
  try {
    image = PNG.sync.read(buffer, { checkCRC: true })
  } catch (error) {
    throw new Error(`${name} must be a valid PNG: ${error.message}`)
  }
  if (image.width !== expectedSize || image.height !== expectedSize) {
    throw new Error(`${name} must be an opaque ${expectedSize}x${expectedSize} PNG`)
  }

  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] !== 255) {
      throw new Error(`${name} must not contain transparent or translucent pixels`)
    }
  }
  return image
}

function lanczos(value) {
  const absoluteValue = Math.abs(value)
  if (absoluteValue < Number.EPSILON) return 1
  if (absoluteValue >= 3) return 0
  const piValue = Math.PI * value
  return (Math.sin(piValue) / piValue) * (Math.sin(piValue / 3) / (piValue / 3))
}

function createContributions(inputSize, outputSize) {
  const scale = outputSize / inputSize
  const filterScale = Math.min(1, scale)
  const support = 3 / filterScale

  return Array.from({ length: outputSize }, (_, outputIndex) => {
    const center = (outputIndex + 0.5) / scale - 0.5
    const firstInput = Math.ceil(center - support)
    const lastInput = Math.floor(center + support)
    const weightsByInput = new Map()

    for (let inputIndex = firstInput; inputIndex <= lastInput; inputIndex += 1) {
      const boundedInput = Math.max(0, Math.min(inputSize - 1, inputIndex))
      const weight = lanczos((inputIndex - center) * filterScale)
      weightsByInput.set(boundedInput, (weightsByInput.get(boundedInput) ?? 0) + weight)
    }

    const totalWeight = [...weightsByInput.values()].reduce((sum, weight) => sum + weight, 0)
    return [...weightsByInput].map(([inputIndex, weight]) => ({
      inputIndex,
      weight: weight / totalWeight,
    }))
  })
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return chunk
}

function createStoredZlib(data) {
  const blocks = [Buffer.from([0x78, 0x01])]
  for (let offset = 0; offset < data.length;) {
    const length = Math.min(65535, data.length - offset)
    const finalBlock = offset + length === data.length
    const header = Buffer.alloc(5)
    header.writeUInt8(finalBlock ? 1 : 0, 0)
    header.writeUInt16LE(length, 1)
    header.writeUInt16LE((~length) & 0xffff, 3)
    blocks.push(header, data.subarray(offset, offset + length))
    offset += length
  }

  let first = 1
  let second = 0
  for (const byte of data) {
    first = (first + byte) % 65521
    second = (second + first) % 65521
  }
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(((second << 16) | first) >>> 0)
  blocks.push(checksum)
  return Buffer.concat(blocks)
}

function encodeRgbPng(rgba, size) {
  const scanlines = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (1 + size * 3)
    scanlines[rowOffset] = 0
    for (let x = 0; x < size; x += 1) {
      const inputOffset = (y * size + x) * 4
      const outputOffset = rowOffset + 1 + x * 3
      scanlines[outputOffset] = rgba[inputOffset]
      scanlines[outputOffset + 1] = rgba[inputOffset + 1]
      scanlines[outputOffset + 2] = rgba[inputOffset + 2]
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.writeUInt8(8, 8)
  header.writeUInt8(2, 9)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    createPngChunk('IHDR', header),
    // Stored DEFLATE blocks keep committed bytes independent of the host zlib build.
    createPngChunk('IDAT', createStoredZlib(scanlines)),
    createPngChunk('IEND', Buffer.alloc(0)),
  ])
}

function resizePng(source, outputSize) {
  const horizontalContributions = createContributions(source.width, outputSize)
  const verticalContributions = createContributions(source.height, outputSize)
  const horizontal = new Float64Array(source.height * outputSize * 3)

  for (let inputY = 0; inputY < source.height; inputY += 1) {
    for (let outputX = 0; outputX < outputSize; outputX += 1) {
      const outputOffset = (inputY * outputSize + outputX) * 3
      for (const { inputIndex, weight } of horizontalContributions[outputX]) {
        const inputOffset = (inputY * source.width + inputIndex) * 4
        horizontal[outputOffset] += source.data[inputOffset] * weight
        horizontal[outputOffset + 1] += source.data[inputOffset + 1] * weight
        horizontal[outputOffset + 2] += source.data[inputOffset + 2] * weight
      }
    }
  }

  const output = Buffer.alloc(outputSize * outputSize * 4)
  for (let outputY = 0; outputY < outputSize; outputY += 1) {
    for (let outputX = 0; outputX < outputSize; outputX += 1) {
      const outputOffset = (outputY * outputSize + outputX) * 4
      let red = 0
      let green = 0
      let blue = 0
      for (const { inputIndex, weight } of verticalContributions[outputY]) {
        const inputOffset = (inputIndex * outputSize + outputX) * 3
        red += horizontal[inputOffset] * weight
        green += horizontal[inputOffset + 1] * weight
        blue += horizontal[inputOffset + 2] * weight
      }
      output[outputOffset] = Math.max(0, Math.min(255, Math.round(red)))
      output[outputOffset + 1] = Math.max(0, Math.min(255, Math.round(green)))
      output[outputOffset + 2] = Math.max(0, Math.min(255, Math.round(blue)))
      output[outputOffset + 3] = 255
    }
  }

  return encodeRgbPng(output, outputSize)
}

function createIco(frames) {
  const directoryLength = 6 + frames.length * 16
  const directory = Buffer.alloc(directoryLength)
  directory.writeUInt16LE(0, 0)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(frames.length, 4)

  let imageOffset = directoryLength
  frames.forEach(({ size, buffer }, index) => {
    const entryOffset = 6 + index * 16
    directory.writeUInt8(size, entryOffset)
    directory.writeUInt8(size, entryOffset + 1)
    directory.writeUInt8(0, entryOffset + 2)
    directory.writeUInt8(0, entryOffset + 3)
    directory.writeUInt16LE(1, entryOffset + 4)
    directory.writeUInt16LE(32, entryOffset + 6)
    directory.writeUInt32LE(buffer.length, entryOffset + 8)
    directory.writeUInt32LE(imageOffset, entryOffset + 12)
    imageOffset += buffer.length
  })

  return Buffer.concat([directory, ...frames.map(frame => frame.buffer)])
}

function deriveAssets(master) {
  const [appleTouch, ...faviconBuffers] = [
    resizePng(master, 180),
    ...faviconSizes.map(size => resizePng(master, size)),
  ]
  const faviconFrames = faviconSizes.map((size, index) => ({
    size,
    buffer: faviconBuffers[index],
  }))

  validateOpaquePng('apple-touch-icon.png', appleTouch, 180)
  faviconFrames.forEach(frame =>
    validateOpaquePng(`favicon.ico ${frame.size}x${frame.size} frame`, frame.buffer, frame.size),
  )

  return {
    appleTouch,
    favicon: createIco(faviconFrames),
  }
}

function assertCurrentFile(filePath, expected) {
  const relativePath = path.relative(projectRoot, filePath)
  if (!fs.existsSync(filePath)) {
    throw new Error(`${relativePath} is missing; run npm run icons:generate`)
  }
  if (!fs.readFileSync(filePath).equals(expected)) {
    throw new Error(`${relativePath} is stale; run npm run icons:generate`)
  }
}

function writeFileIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath).equals(contents)) return false
  fs.writeFileSync(filePath, contents)
  return true
}

function visitFiles(directory, callback) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === 'coverage') continue
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) visitFiles(filePath, callback)
    else callback(filePath)
  }
}

function validateIdentityReferences() {
  const allowedAssets = new Set([
    'public/apple-touch-icon.png',
    'public/favicon.ico',
    'public/prism-icon-1024.png',
  ])
  const competingAssets = []
  const identityAssetPattern = /(?:apple-touch|favicon|icon|logo).*\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i

  visitFiles(projectRoot, filePath => {
    const relativePath = path.relative(projectRoot, filePath)
    if (identityAssetPattern.test(relativePath) && !allowedAssets.has(relativePath)) {
      competingAssets.push(relativePath)
    }
  })
  if (competingAssets.length) {
    throw new Error(`Competing Prism identity artwork found: ${competingAssets.join(', ')}`)
  }

  const requiredReferences = new Map([
    ['index.html', ['href="/favicon.ico"', 'sizes="16x16 32x32 48x48"', 'href="/apple-touch-icon.png"']],
    ['src/app/App.tsx', ['src="/apple-touch-icon.png"']],
    ['src/auth/LandingPage.tsx', ['src="/apple-touch-icon.png"']],
  ])
  for (const [relativePath, references] of requiredReferences) {
    const contents = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
    for (const reference of references) {
      if (!contents.includes(reference)) {
        throw new Error(`${relativePath} must reference the canonical icon family with ${reference}`)
      }
    }
  }

  const activeRoots = [path.join(projectRoot, 'index.html'), path.join(projectRoot, 'src')]
  const allowedReferences = new Set(['/apple-touch-icon.png', '/favicon.ico', '/prism-icon-1024.png'])
  const identityReferencePattern = /["'`](\/?[^"'`\s]*(?:apple-touch|favicon|icon|logo)[^"'`\s]*\.(?:avif|gif|ico|jpe?g|png|svg|webp))["'`]/gi
  const competingReferences = []
  const inspectReferences = filePath => {
    if (!/\.(?:css|html|js|jsx|ts|tsx)$/.test(filePath)) return
    const contents = fs.readFileSync(filePath, 'utf8')
    for (const match of contents.matchAll(identityReferencePattern)) {
      if (!allowedReferences.has(match[1])) {
        competingReferences.push(`${path.relative(projectRoot, filePath)} -> ${match[1]}`)
      }
    }
  }
  for (const activeRoot of activeRoots) {
    if (fs.statSync(activeRoot).isDirectory()) visitFiles(activeRoot, inspectReferences)
    else inspectReferences(activeRoot)
  }
  if (competingReferences.length) {
    throw new Error(`Active Prism identity references must use the canonical icon family: ${competingReferences.join(', ')}`)
  }
}

function main() {
  const master = fs.readFileSync(masterPath)
  const masterHash = sha256(master)
  if (masterHash !== expectedMasterHash) {
    throw new Error(`public/prism-icon-1024.png SHA-256 must be ${expectedMasterHash}, received ${masterHash}`)
  }
  const masterImage = validateOpaquePng('prism-icon-1024.png', master, 1024)

  const derived = deriveAssets(masterImage)
  if (checkMode) {
    assertCurrentFile(appleTouchPath, derived.appleTouch)
    assertCurrentFile(faviconPath, derived.favicon)
  } else {
    writeFileIfChanged(appleTouchPath, derived.appleTouch)
    writeFileIfChanged(faviconPath, derived.favicon)
  }

  validateIdentityReferences()
  console.log(`${checkMode ? 'Validated' : 'Generated'} Prism app icons from ${expectedMasterHash}.`)
}

try {
  main()
} catch (error) {
  console.error(`Prism app icon ${checkMode ? 'check' : 'generation'} failed: ${error.message}`)
  process.exitCode = 1
}
