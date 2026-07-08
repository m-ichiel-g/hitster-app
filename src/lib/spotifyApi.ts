// Kleine wrapper rond de Spotify Web API die nodig is om playback te starten/stoppen.

import { getValidAccessToken } from './spotifyAuth'

const API_BASE = 'https://api.spotify.com/v1'

async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken()
  if (!token) {
    throw new Error('Niet (meer) ingelogd bij Spotify. Log opnieuw in.')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok && response.status !== 204) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.error?.message ?? ''
    } catch {
      // geen JSON-body (bv. lege 403/404)
    }
    if (response.status === 403) {
      throw new Error(`Spotify Premium is vereist om af te spelen.${detail ? ` (${detail})` : ''}`)
    }
    throw new Error(`Spotify-aanvraag mislukt (${response.status})${detail ? `: ${detail}` : ''}`)
  }

  return response
}

export async function transferPlayback(deviceId: string): Promise<void> {
  await apiRequest('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  })
}

export async function playTrack(deviceId: string, trackId: string): Promise<void> {
  await apiRequest(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
  })
}

// De QR bevat normaliter de kale track-id, maar we zijn defensief voor het geval er per
// ongeluk een volledige URI (spotify:track:<id>) of deel-URL (open.spotify.com/track/<id>) in staat.
export function extractTrackId(rawPayload: string): string | null {
  const trimmed = rawPayload.trim()

  const uriMatch = trimmed.match(/^spotify:track:([A-Za-z0-9]+)/)
  if (uriMatch) return uriMatch[1]

  const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/)
  if (urlMatch) return urlMatch[1]

  if (/^[A-Za-z0-9]+$/.test(trimmed)) return trimmed

  return null
}
