import { useNavigate } from 'react-router-dom'

const MODE_KEY = 'goose-hitster-mode'

export default function Welcome() {
  const navigate = useNavigate()
  const lastMode = localStorage.getItem(MODE_KEY) as 'deck' | 'player' | null

  function chooseMode(mode: 'deck' | 'player') {
    localStorage.setItem(MODE_KEY, mode)
    navigate(`/${mode}`)
  }

  return (
    <div className="min-h-svh bg-white flex flex-col items-center justify-center px-6 py-12">
      {/* Placeholder gans — wordt in Fase 5 vervangen door de echte SVG */}
      <div className="w-32 h-32 rounded-full bg-gh-navy flex items-center justify-center text-7xl mb-8 shadow-lg select-none">
        🪿
      </div>

      <h1 className="text-4xl font-bold text-gh-navy-dark mb-2 tracking-tight">
        Goose Hitster
      </h1>
      <p className="text-gray-500 mb-12 text-center text-base">
        Raad het jaar — de Top 2000 editie
      </p>

      <div className="w-full max-w-xs flex flex-col gap-4">
        <button
          onClick={() => chooseMode('deck')}
          className="w-full py-5 px-6 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
        >
          🃏 Ik toon de kaartjes
          <span className="block text-sm font-normal opacity-75 mt-0.5">Deck-modus</span>
        </button>

        <button
          onClick={() => chooseMode('player')}
          className="w-full py-5 px-6 bg-gh-yellow text-gh-navy-dark text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
        >
          🎵 Ik scan &amp; speel
          <span className="block text-sm font-normal opacity-60 mt-0.5">Player-modus</span>
        </button>
      </div>

      {lastMode && (
        <p className="mt-10 text-sm text-gray-400">
          Vorige sessie: <span className="font-medium">{lastMode === 'deck' ? 'Deck' : 'Player'}</span>
        </p>
      )}
    </div>
  )
}
