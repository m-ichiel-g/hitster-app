// Dunne wrapper rond html5-qrcode: camera aan, éénmalig een QR lezen, camera weer uit.

import { Html5Qrcode } from 'html5-qrcode'

const ELEMENT_ID = 'qr-scanner-view'

export interface ScannerHandle {
  stop: () => Promise<void>
}

// Start de achtercamera in het element met id ELEMENT_ID (moet al in de DOM staan).
// Roept onScan precies één keer aan (bij de eerste herkenning) en stopt de camera daarna zelf.
export async function startScanner(
  onScan: (decodedText: string) => void,
  onError: (message: string) => void,
): Promise<ScannerHandle> {
  const scanner = new Html5Qrcode(ELEMENT_ID, { verbose: false })
  let stopped = false

  const stop = async () => {
    if (stopped) return
    stopped = true
    try {
      await scanner.stop()
    } catch {
      // was al gestopt of nooit volledig gestart; niets te doen
    }
    scanner.clear()
  }

  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (stopped) return
        // Debounce: meteen stoppen zodat dezelfde QR niet nog eens triggert
        // terwijl de camera nog een frame aan het verwerken is.
        stop().then(() => onScan(decodedText))
      },
      () => {
        // Decodeerpoging zonder resultaat op dit frame — normaal, geen actie nodig.
      },
    )
  } catch (err) {
    stopped = true
    const message = err instanceof Error ? err.message : String(err)
    if (/NotAllowedError|Permission/i.test(message)) {
      onError('Geen toestemming voor de camera. Zet cameratoegang aan voor deze site in je browserinstellingen en probeer opnieuw.')
    } else if (/NotFoundError/i.test(message)) {
      onError('Geen camera gevonden op dit apparaat.')
    } else {
      onError(`Camera kon niet starten: ${message}`)
    }
  }

  return { stop }
}
