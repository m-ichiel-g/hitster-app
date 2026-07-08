import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearTokens, getValidAccessToken, handleAuthCallback, startLogin } from '../lib/spotifyAuth'
import { createPlayer } from '../lib/spotifySdk'
import { extractTrackId, playTrack, transferPlayback } from '../lib/spotifyApi'
import { startScanner, type ScannerHandle } from '../lib/scanner'
import { releaseWakeLock, requestWakeLock } from '../lib/wakeLock'

type Status = 'checking' | 'loggedOut' | 'loggingIn' | 'loggedIn' | 'error'
type DeviceStatus = 'idle' | 'connecting' | 'ready' | 'error'
type PlaybackStatus = 'idle' | 'starting' | 'playing' | 'error'
type ScanStatus = 'idle' | 'scanning' | 'error'

export default function Player() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [errorMessage, setErrorMessage] = useState('')
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('idle')
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [deviceError, setDeviceError] = useState('')
  const playerRef = useRef<Spotify.Player | null>(null)
  const [playback, setPlayback] = useState<PlaybackStatus>('idle')
  const [playbackError, setPlaybackError] = useState('')
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [scanError, setScanError] = useState('')
  const scannerRef = useRef<ScannerHandle | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    return () => {
      scannerRef.current?.stop()
    }
  }, [])

  // Wake Lock aan zodra er wordt afgespeeld; uit bij Stop/fout/ophalen van de pagina.
  useEffect(() => {
    if (playback !== 'playing') return
    requestWakeLock()
    return () => {
      releaseWakeLock()
    }
  }, [playback])

  // Wake locks vervallen automatisch als het tabblad naar de achtergrond gaat; opnieuw
  // aanvragen zodra de pagina weer zichtbaar wordt, maar alleen als er nog afgespeeld wordt.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && playback === 'playing') {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [playback])

  async function handleStartScan() {
    const player = playerRef.current
    if (!player) return

    setScanError('')
    setPlaybackError('')
    setPlayback('idle')
    setScanStatus('scanning')

    // Dit is de user-gesture: activateElement() ontgrendelt hier de iOS-audio, vóórdat de
    // camera opent. De track speelt pas later (na de scan-callback, buiten de gesture) —
    // zonder deze aanroep hier blijft afspelen op iPhone-Safari stil.
    try {
      await player.activateElement()
    } catch {
      // Op sommige browsers al actief/geen effect nodig; niet fataal.
    }

    try {
      const handle = await startScanner(
        (decodedText) => {
          scannerRef.current = null
          setScanStatus('idle')
          void playScannedTrack(decodedText)
        },
        (message) => {
          scannerRef.current = null
          setScanError(message)
          setScanStatus('error')
        },
      )
      scannerRef.current = handle
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scanner kon niet starten.')
      setScanStatus('error')
    }
  }

  async function playScannedTrack(rawPayload: string) {
    const id = extractTrackId(rawPayload)
    if (!id) {
      setScanError('Onherkenbare QR-code. Probeer opnieuw te scannen.')
      setScanStatus('error')
      return
    }

    const player = playerRef.current
    if (!player || !deviceId) return

    setPlayback('starting')
    setPlaybackError('')
    try {
      await transferPlayback(deviceId)
      await playTrack(deviceId, id)
      setIsPaused(false)
      setPlayback('playing')
    } catch (err) {
      setPlaybackError(err instanceof Error ? err.message : 'Afspelen mislukt.')
      setPlayback('error')
    }
  }

  async function handleCancelScan() {
    await scannerRef.current?.stop()
    scannerRef.current = null
    setScanStatus('idle')
  }

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
        player.addListener('player_state_changed', (state) => {
          if (!state) return
          setIsPaused(state.paused)
        })
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

  async function handleStop() {
    const player = playerRef.current
    try {
      await player?.pause()
    } catch {
      // Stop moet hoe dan ook teruggaan naar de scanknop, ook als de aanroep zelf faalt.
    }
    setIsPaused(false)
    setPlayback('idle')
  }

  async function handleTogglePause() {
    const player = playerRef.current
    if (!player) return
    try {
      await player.togglePlay()
    } catch {
      // player_state_changed corrigeert de knop-status vanzelf als dit toch niet lukte.
    }
  }

  async function handleRestart() {
    const player = playerRef.current
    if (!player) return
    try {
      await player.seek(0)
    } catch {
      // negeren; gebruiker kan het gewoon opnieuw proberen
    }
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
          {deviceStatus === 'ready' && playback !== 'playing' && (
            <p className="text-green-700 text-center text-base max-w-xs mb-2">
              🟢 Speler gereed
              <span className="block text-xs text-gray-400 mt-1">device: {deviceId}</span>
            </p>
          )}
          {deviceStatus === 'error' && (
            <p className="text-red-600 text-center text-base max-w-xs mb-8">{deviceError}</p>
          )}

          {deviceStatus === 'ready' && playback !== 'playing' && (
            <div className="w-full max-w-xs flex flex-col gap-3 mt-4 mb-6">
              <div
                id="qr-scanner-view"
                className={
                  scanStatus === 'scanning' ? 'w-full max-w-xs rounded-xl overflow-hidden' : 'hidden'
                }
              />
              {playback === 'starting' && (
                <p className="text-gray-500 text-center text-base">Bezig met afspelen…</p>
              )}
              {playback === 'idle' && scanStatus === 'idle' && (
                <button
                  onClick={handleStartScan}
                  className="py-4 px-8 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
                >
                  📷 Scan volgend nummer
                </button>
              )}
              {playback === 'idle' && scanStatus === 'scanning' && (
                <button
                  onClick={handleCancelScan}
                  className="py-3 px-6 bg-gray-100 text-gray-700 text-base font-medium rounded-xl active:scale-95 transition-transform duration-100"
                >
                  Annuleren
                </button>
              )}
              {playback === 'idle' && scanStatus === 'error' && (
                <>
                  <p className="text-red-600 text-center text-sm max-w-xs">{scanError}</p>
                  <button
                    onClick={handleStartScan}
                    className="py-4 px-8 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
                  >
                    Opnieuw proberen
                  </button>
                </>
              )}
              {playback === 'error' && (
                <>
                  <p className="text-red-600 text-center text-sm max-w-xs">{playbackError}</p>
                  <button
                    onClick={handleStartScan}
                    className="py-4 px-8 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
                  >
                    Opnieuw scannen
                  </button>
                </>
              )}
            </div>
          )}

          {playback === 'playing' && (
            <div className="w-full max-w-xs flex flex-col items-center gap-4 mt-4 mb-8">
              <p className="text-gh-navy-dark text-2xl font-semibold">
                {isPaused ? '⏸ gepauzeerd' : '🎵 speelt af…'}
              </p>
              <div className="w-full flex gap-3">
                <button
                  onClick={handleTogglePause}
                  className="flex-1 py-4 px-4 bg-gh-navy text-white text-base font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
                >
                  {isPaused ? '▶️ Hervat' : '⏸ Pauze'}
                </button>
                <button
                  onClick={handleRestart}
                  className="flex-1 py-4 px-4 bg-gh-navy text-white text-base font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
                >
                  ⏮ Opnieuw
                </button>
              </div>
              <button
                onClick={handleStop}
                className="w-full py-4 px-8 bg-gray-800 text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
              >
                ⏹ Stop
              </button>
            </div>
          )}

          {playback !== 'playing' && (
            <button
              onClick={handleLogout}
              className="py-3 px-6 bg-gray-100 text-gray-700 text-base font-medium rounded-xl active:scale-95 transition-transform duration-100"
            >
              Log uit
            </button>
          )}
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
