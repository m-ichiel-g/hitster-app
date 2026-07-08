import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GooseMascot from '../components/GooseMascot'
import HelpButton from '../components/HelpButton'
import ExplainOverlay from '../components/ExplainOverlay'

const MODE_KEY = 'goose-hitster-mode'
const SEEN_INTRO_KEY = 'goose-hitster-seen-intro'

export default function Welcome() {
  const navigate = useNavigate()
  const lastMode = localStorage.getItem(MODE_KEY) as 'deck' | 'player' | null
  const [showExplain, setShowExplain] = useState(() => !localStorage.getItem(SEEN_INTRO_KEY))

  function chooseMode(mode: 'deck' | 'player') {
    localStorage.setItem(MODE_KEY, mode)
    navigate(`/${mode}`)
  }

  function closeExplain() {
    localStorage.setItem(SEEN_INTRO_KEY, '1')
    setShowExplain(false)
  }

  return (
    <div className="relative min-h-svh bg-white flex flex-col items-center justify-center px-6 py-12">
      <HelpButton onClick={() => setShowExplain(true)} />
      {showExplain && <ExplainOverlay onClose={closeExplain} />}

      <GooseMascot className="text-9xl leading-none mb-6 drop-shadow-lg block" />

      <h1 className="text-4xl font-bold text-gh-navy-dark mb-2 tracking-tight">
        Goose Hitster
      </h1>
      <p className="text-gray-500 mb-12 text-center text-base">
        Raad het jaar — de Top 2000 editie
      </p>

      <div className="w-full max-w-xs flex flex-col gap-4">
        <button onClick={() => chooseMode('deck')} className="w-full btn-hero-navy">
          🃏 Ik toon de kaartjes
          <span className="block text-sm font-normal opacity-75 mt-0.5">Deck-modus</span>
        </button>

        <button onClick={() => chooseMode('player')} className="w-full btn-hero-yellow">
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
