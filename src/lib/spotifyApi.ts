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

export async function pausePlayback(deviceId: string): Promise<void> {
  await apiRequest(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
  })
}
