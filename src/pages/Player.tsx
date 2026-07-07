import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearTokens, getValidAccessToken, handleAuthCallback, startLogin } from '../lib/spotifyAuth'
import { createPlayer } from '../lib/spotifySdk'

type Status = 'checking' | 'loggedOut' | 'loggingIn' | 'loggedIn' | 'error'
type DeviceStatus = 'idle' | 'connecting' | 'ready' | 'error'

export default function Player() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [errorMessage, setErrorMessage] = useState('')
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('idle')
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [deviceError, setDeviceError] = useState('')
  const playerRef = useRef<Spotify.Player | null>(null)

  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const authError = params.get('error')

      if (authError) {
        setErrorMessage(`Spotify meldde een fout bij het inloggen: ${authError}`)
        setStatus('error')
        window.history.replaceState({}, '', '/player')
        return
      }

      if (code) {
        setStatus('loggingIn')
        try {
          await handleAuthCallback(code)
          window.history.replaceState({}, '', '/player')
          setStatus('loggedIn')
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Inloggen mislukt.')
          setStatus('error')
          window.history.replaceState({}, '', '/player')
        }
        return
      }

      const token = await getValidAccessToken()
      setStatus(token ? 'loggedIn' : 'loggedOut')
    }

    init()
  }, [])

  useEffect(() => {
    if (status !== 'loggedIn') return

    let cancelled = false
    setDeviceStatus('connecting')

    createPlayer((callback) => {
      getValidAccessToken().then((token) => {
        if (token) callback(token)
      })
    })
      .then(({ player, deviceId }) => {
        if (cancelled) {
          player.disconnect()
          return
        }
        playerRef.current = player
        setDeviceId(deviceId)
        setDeviceStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setDeviceError(err instanceof Error ? err.message : 'Speler kon niet starten.')
        setDeviceStatus('error')
      })

    return () => {
      cancelled = true
      playerRef.current?.disconnect()
      playerRef.current = null
      setDeviceStatus('idle')
      setDeviceId(null)
    }
  }, [status])

  async function handleLogin() {
    setStatus('loggingIn')
    await startLogin()
  }

  function handleLogout() {
    clearTokens()
    setStatus('loggedOut')
  }

  return (
    <div className="min-h-svh bg-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-20 h-20 rounded-2xl bg-gh-yellow flex items-center justify-center text-5xl mb-6 shadow">
        🎵
      </div>
      <h1 className="text-3xl font-bold text-gh-navy-dark mb-3">Player</h1>

      {status === 'checking' && <p className="text-gray-500 text-base">Even checken…</p>}

      {status === 'loggingIn' && <p className="text-gray-500 text-base">Bezig met inloggen…</p>}

      {status === 'loggedOut' && (
        <>
          <p className="text-gray-500 text-center text-base max-w-xs mb-8">
            Log in met je Spotify Premium-account om te kunnen afspelen.
          </p>
          <button
            onClick={handleLogin}
            className="py-4 px-8 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
          >
            Log in bij Spotify
          </button>
        </>
      )}

      {status === 'loggedIn' && (
        <>
          <p className="text-gh-navy-dark text-center text-base max-w-xs mb-2">✅ Ingelogd bij Spotify</p>

          {deviceStatus === 'connecting' && (
            <p className="text-gray-500 text-center text-base max-w-xs mb-8">Speler wordt gestart…</p>
          )}
          {deviceStatus === 'ready' && (
            <p className="text-green-700 text-center text-base max-w-xs mb-8">
              🟢 Speler gereed
              <span className="block text-xs text-gray-400 mt-1">device: {deviceId}</span>
            </p>
          )}
          {deviceStatus === 'error' && (
            <p className="text-red-600 text-center text-base max-w-xs mb-8">{deviceError}</p>
          )}

          <button
            onClick={handleLogout}
            className="py-3 px-6 bg-gray-100 text-gray-700 text-base font-medium rounded-xl active:scale-95 transition-transform duration-100"
          >
            Log uit
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <p className="text-red-600 text-center text-base max-w-xs mb-8">{errorMessage}</p>
          <button
            onClick={handleLogin}
            className="py-4 px-8 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
          >
            Opnieuw inloggen
          </button>
        </>
      )}

      <button
        onClick={() => navigate('/')}
        className="mt-10 py-3 px-8 bg-gray-100 text-gray-700 text-base font-medium rounded-xl active:scale-95 transition-transform duration-100"
      >
        ← Terug
      </button>
    </div>
  )
}
