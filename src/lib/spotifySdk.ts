// Laadt de Spotify Web Playback SDK en maakt er een afspeelapparaat (device) van.

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js'

let sdkReadyPromise: Promise<void> | null = null

function loadSdkScript(): Promise<void> {
  if (sdkReadyPromise) return sdkReadyPromise

  sdkReadyPromise = new Promise((resolve) => {
    if (window.Spotify) {
      resolve()
      return
    }

    const previousCallback = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousCallback?.()
      resolve()
    }

    if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = SDK_SRC
      script.async = true
      document.body.appendChild(script)
    }
  })

  return sdkReadyPromise
}

export interface PlayerHandle {
  player: Spotify.Player
  deviceId: string
}

// Maakt de Spotify-player aan en wacht tot 'ready' een device_id oplevert.
export async function createPlayer(
  getOAuthToken: (callback: (token: string) => void) => void,
): Promise<PlayerHandle> {
  await loadSdkScript()

  return new Promise((resolve, reject) => {
    const player = new window.Spotify.Player({
      name: 'Goose Hitster',
      getOAuthToken,
      volume: 1,
    })

    player.addListener('ready', ({ device_id }) => {
      resolve({ player, deviceId: device_id })
    })

    player.addListener('initialization_error', ({ message }) => {
      reject(new Error(`Speler kon niet starten: ${message}`))
    })
    player.addListener('authentication_error', ({ message }) => {
      reject(new Error(`Inloggen bij de speler mislukt: ${message}`))
    })
    player.addListener('account_error', ({ message }) => {
      reject(new Error(`Spotify Premium is vereist om af te spelen: ${message}`))
    })

    player.connect()
  })
}
