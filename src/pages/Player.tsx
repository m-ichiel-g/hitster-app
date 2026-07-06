import { useNavigate } from 'react-router-dom'

export default function Player() {
  const navigate = useNavigate()

  return (
    <div className="min-h-svh bg-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-20 h-20 rounded-2xl bg-gh-yellow flex items-center justify-center text-5xl mb-6 shadow">
        🎵
      </div>
      <h1 className="text-3xl font-bold text-gh-navy-dark mb-3">Player</h1>
      <p className="text-gray-500 text-center text-base max-w-xs">
        Hier komt de scanner en de speler. Spotify-login, QR-scanner en blind afspelen
        worden gebouwd in Fase 3 en 4.
      </p>
      <button
        onClick={() => navigate('/')}
        className="mt-10 py-3 px-8 bg-gray-100 text-gray-700 text-base font-medium rounded-xl active:scale-95 transition-transform duration-100"
      >
        ← Terug
      </button>
    </div>
  )
}
