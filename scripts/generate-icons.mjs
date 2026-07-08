/**
 * Genereert de PWA-iconen: de gans-emoji op een heel lichte gele achtergrond.
 * Rendert via een lokaal geïnstalleerde Chromium-browser (Edge of Chrome) in
 * headless-modus, zodat de emoji er exact zo uitziet als in de app zelf
 * (geen extra npm-dependency nodig voor emoji/lettertype-rendering).
 *
 * Kleine venstergroottes (180/192) selecteren in headless-modus soms geen
 * kleuren-emoji-lettertype (leeg "tofu"-vakje i.p.v. de gans), en het via de
 * browser zelf verkleinen van een grotere render bleek ook onbetrouwbaar
 * (verkeerd uitgesneden viewport). Daarom wordt altijd eerst op 512px
 * gerenderd — dat werkt betrouwbaar — en worden kleinere formaten daarvan
 * afgeleid met `sharp` (betrouwbare, veelgebruikte image-library), i.p.v.
 * nóg een browser-render.
 *
 * Gebruik: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync, existsSync, rmSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { tmpdir } from 'os'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]

function findBrowser() {
  const found = BROWSER_CANDIDATES.find((p) => existsSync(p))
  if (!found) {
    throw new Error(
      'Geen Edge of Chrome gevonden op de gebruikelijke paden. Pas BROWSER_CANDIDATES aan.',
    )
  }
  return found
}

// Heel lichte variant van ons geel (#F5E642)
const BG_LIGHT_YELLOW = '#FEFCE8'
const MASTER_SIZE = 512

function emojiHtml(fontSizeVh) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:100vw;height:100vh;background:${BG_LIGHT_YELLOW};overflow:hidden}
    .wrap{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center}
    .goose{font-size:${fontSizeVh}vh;line-height:1}
  </style></head><body><div class="wrap"><span class="goose">🪿</span></div></body></html>`
}

// Elke aanroep krijgt een eigen, verse --user-data-dir. Edge koppelt anders
// soms aan een al lopende sessie ("Opening in existing browser session"),
// waardoor venstergrootte/scroll-positie van een vorige aanroep blijft hangen
// en het volgende screenshot een verkeerd uitgesneden stukje toont.
function screenshot(browser, html, size, outPath) {
  const tag = `${size}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const tmpHtml = join(tmpdir(), `goose-icon-${tag}.html`)
  const profileDir = join(tmpdir(), `goose-icon-profile-${tag}`)
  writeFileSync(tmpHtml, html, 'utf8')
  try {
    execFileSync(browser, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=1000',
      `--user-data-dir=${profileDir}`,
      `--window-size=${size},${size}`,
      `--screenshot=${outPath}`,
      pathToFileURL(tmpHtml).href,
    ])
  } finally {
    rmSync(tmpHtml, { force: true })
    rmSync(profileDir, { recursive: true, force: true })
  }
}

async function buildVariant(browser, fontSizeVh, sizes, outDir, nameFor) {
  // 1. Render de master op 512px — hier werkt de kleuren-emoji betrouwbaar.
  const masterPath = join(outDir, `.master-${fontSizeVh}.png`)
  screenshot(browser, emojiHtml(fontSizeVh), MASTER_SIZE, masterPath)

  // 2. Elk gevraagd formaat: 512 is de master zelf, kleinere formaten worden
  //    van de master afgeleid door 'm te verkleinen (geen tekst meer nodig).
  for (const size of sizes) {
    const outPath = join(outDir, nameFor(size))
    if (size === MASTER_SIZE) {
      copyFileSync(masterPath, outPath)
    } else {
      await sharp(masterPath).resize(size, size).toFile(outPath)
    }
  }

  rmSync(masterPath, { force: true })
}

const browser = findBrowser()
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// "any"-iconen: emoji mag bijna tot de rand komen.
await buildVariant(browser, 62, [180, 192, 512], outDir, (size) =>
  size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`,
)

// "maskable"-iconen: kleinere emoji binnen Android's veilige cirkel (~80%).
await buildVariant(browser, 42, [192, 512], outDir, (size) => `icon-${size}-maskable.png`)

console.log('✓ Iconen aangemaakt in public/icons/')
