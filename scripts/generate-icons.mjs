/**
 * Genereert placeholder PNG-iconen voor de PWA.
 * Alleen Node.js built-ins nodig (geen extra packages).
 * Vervang de uitvoer in Fase 5 door de echte goose-kop iconen.
 *
 * Gebruik: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'fs'
import { deflateSync } from 'zlib'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// CRC32 voor geldige PNG-chunks
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[i] = c
}
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([len, typeBytes, data, crcVal])
}

function solidColorPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // kleurtype: RGB

  // Één scanline: filterbyte + breedte × 3 bytes; herhaal voor elke rij
  const row = Buffer.alloc(1 + size * 3)
  row[0] = 0 // filter: geen
  for (let x = 0; x < size; x++) {
    row[1 + x * 3 + 0] = r
    row[1 + x * 3 + 1] = g
    row[1 + x * 3 + 2] = b
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const idat = deflateSync(raw)

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// Licht-navyblauw: #4A6FA5
const [r, g, b] = [0x4a, 0x6f, 0xa5]

writeFileSync(join(outDir, 'apple-touch-icon.png'), solidColorPNG(180, r, g, b))
writeFileSync(join(outDir, 'icon-192.png'),         solidColorPNG(192, r, g, b))
writeFileSync(join(outDir, 'icon-512.png'),         solidColorPNG(512, r, g, b))

console.log('✓ Iconen aangemaakt in public/icons/')
