// Spotify-login voor de Player: Authorization Code + PKCE, volledig client-side (geen secret).

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = `${window.location.origin}/player`
const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize'
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ')

const VERIFIER_KEY = 'goose-hitster-sp-verifier'
const ACCESS_TOKEN_KEY = 'goose-hitster-sp-access-token'
const REFRESH_TOKEN_KEY = 'goose-hitster-sp-refresh-token'
const EXPIRES_AT_KEY = 'goose-hitster-sp-expires-at'

// Ververs iets vóór het echte verlopen, zodat een track niet halverwege een aanvraag hapert.
const REFRESH_MARGIN_MS = 60_000

interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(64))
  return base64UrlEncode(bytes)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

function loadTokens(): StoredTokens | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  const expiresAtRaw = localStorage.getItem(EXPIRES_AT_KEY)
  if (!accessToken || !refreshToken || !expiresAtRaw) return null
  const expiresAt = Number(expiresAtRaw)
  if (Number.isNaN(expiresAt)) return null
  return { accessToken, refreshToken, expiresAt }
}

function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  localStorage.setItem(EXPIRES_AT_KEY, String(tokens.expiresAt))
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(EXPIRES_AT_KEY)
}

export function isLoggedIn(): boolean {
  return loadTokens() !== null
}

// Stap 1 van de login: bouwt de Spotify-authorize-URL en stuurt de browser daarheen.
export async function startLogin(): Promise<void> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  localStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.assign(`${AUTHORIZE_ENDPOINT}?${params.toString()}`)
}

// Stap 2: wisselt de `code` uit de callback-URL in voor tokens.
export async function handleAuthCallback(code: string): Promise<void> {
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) {
    throw new Error('Login-sessie verlopen (geen code_verifier gevonden). Probeer opnieuw in te loggen.')
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  localStorage.removeItem(VERIFIER_KEY)

  if (!response.ok) {
    throw new Error(`Inloggen mislukt (${response.status}). Probeer opnieuw.`)
  }

  const data = await response.json()
  saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  })
}

async function refreshAccessToken(refreshToken: string): Promise<StoredTokens> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Token verversen mislukt (${response.status}).`)
  }

  const data = await response.json()
  const tokens: StoredTokens = {
    accessToken: data.access_token,
    // Spotify geeft niet altijd een nieuw refresh-token terug; behoud dan het oude.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  saveTokens(tokens)
  return tokens
}

// Geeft een geldig access-token terug (ververst zo nodig stil), of null als opnieuw inloggen nodig is.
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadTokens()
  if (!tokens) return null

  if (Date.now() < tokens.expiresAt - REFRESH_MARGIN_MS) {
    return tokens.accessToken
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refreshToken)
    return refreshed.accessToken
  } catch {
    clearTokens()
    return null
  }
}
