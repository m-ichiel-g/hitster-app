// Screen Wake Lock: houdt het scherm wakker tijdens het afspelen. Faalt stil op browsers/
// versies zonder ondersteuning (o.a. oudere iOS) — het scherm moet dan soms handmatig
// wakker gehouden worden, wat een geaccepteerde beperking is (PRD §11).

let sentinel: WakeLockSentinel | null = null

export async function requestWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return
  try {
    sentinel = await navigator.wakeLock.request('screen')
  } catch {
    sentinel = null
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await sentinel?.release()
  } catch {
    // al vrijgegeven (bv. door de browser bij het naar de achtergrond gaan); niets te doen
  }
  sentinel = null
}
