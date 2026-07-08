import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DATASETS, loadDataset, type Dataset } from '../lib/datasets'
import DeckCard from '../components/DeckCard'
import CardBack from '../components/CardBack'
import HelpButton from '../components/HelpButton'
import ExplainOverlay from '../components/ExplainOverlay'
import {
  clearDrawState,
  clearSelection,
  filterByPond,
  loadDrawState,
  loadSelection,
  resetDrawState,
  saveDrawState,
  saveSelection,
  type DeckSelection,
  type DrawState,
  type PondSize,
} from '../lib/deckState'

const POND_OPTIONS: { value: PondSize; label: string }[] = [
  { value: 500, label: 'Top 500' },
  { value: 1000, label: 'Top 1000' },
  { value: 'all', label: 'Alles' },
]

export default function Deck() {
  const navigate = useNavigate()
  const [selection, setSelection] = useState<DeckSelection | null>(() => loadSelection())
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExplain, setShowExplain] = useState(false)

  // Kiezer-formulier state (alleen relevant zolang er nog geen selectie is)
  const [pickedDatasetId, setPickedDatasetId] = useState(DATASETS[0].id)
  const [pickedPond, setPickedPond] = useState<PondSize>('all')

  useEffect(() => {
    if (!selection) return
    let cancelled = false
    setError(null)
    setDataset(null)
    loadDataset(selection.datasetId)
      .then((ds) => {
        if (!cancelled) setDataset(ds)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [selection])

  const pondTracks = useMemo(() => {
    if (!dataset || !selection) return []
    return filterByPond(dataset.tracks, selection.pond)
  }, [dataset, selection])

  const [drawState, setDrawState] = useState<DrawState | null>(null)

  useEffect(() => {
    if (!selection || pondTracks.length === 0) {
      setDrawState(null)
      return
    }
    setDrawState(loadDrawState(selection, pondTracks.map((t) => t.id)))
  }, [selection, pondTracks])

  const tracksById = useMemo(() => {
    const map = new Map(pondTracks.map((t) => [t.id, t]))
    return map
  }, [pondTracks])

  const currentTrack =
    drawState && drawState.drawnCount < drawState.order.length
      ? tracksById.get(drawState.order[drawState.drawnCount])
      : undefined
  const pondDone = drawState !== null && drawState.drawnCount >= drawState.order.length

  const [flipped, setFlipped] = useState(false)

  // Terugbladeren: null = de huidige (live) kaart; anders index in drawState.order
  // van een al-eerder-getrokken kaart, altijd getoond op de onthulling-kant.
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const browsedTrack = viewIndex !== null ? tracksById.get(drawState?.order[viewIndex] ?? '') : undefined

  function startGame() {
    const next: DeckSelection = { datasetId: pickedDatasetId, pond: pickedPond }
    clearDrawState()
    saveSelection(next)
    setSelection(next)
    setFlipped(false)
    setViewIndex(null)
  }

  function changeSelection() {
    clearSelection()
    clearDrawState()
    setSelection(null)
    setDataset(null)
    setDrawState(null)
    setError(null)
    setFlipped(false)
    setViewIndex(null)
  }

  function nextCard() {
    if (!drawState || pondDone) return
    const next: DrawState = { ...drawState, drawnCount: drawState.drawnCount + 1 }
    saveDrawState(next)
    setDrawState(next)
    setFlipped(false)
    setViewIndex(null)
  }

  function newGame() {
    if (!selection) return
    setDrawState(resetDrawState(selection, pondTracks.map((t) => t.id)))
    setFlipped(false)
    setViewIndex(null)
  }

  function goToPrevious() {
    if (!drawState) return
    if (viewIndex === null) {
      if (drawState.drawnCount > 0) setViewIndex(drawState.drawnCount - 1)
    } else if (viewIndex > 0) {
      setViewIndex(viewIndex - 1)
    }
  }

  function goToNext() {
    if (!drawState || viewIndex === null) return
    if (viewIndex + 1 >= drawState.drawnCount) {
      setViewIndex(null)
    } else {
      setViewIndex(viewIndex + 1)
    }
  }

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const SWIPE_THRESHOLD = 40

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) goToPrevious()
      else goToNext()
    }
  }

  return (
    <div className="relative min-h-svh bg-white flex flex-col items-center justify-center px-6 py-12">
      <HelpButton onClick={() => setShowExplain(true)} />
      {showExplain && <ExplainOverlay onClose={() => setShowExplain(false)} />}

      <div className="w-20 h-20 rounded-2xl bg-gh-navy flex items-center justify-center text-5xl mb-6 shadow">
        🃏
      </div>
      <h1 className="text-3xl font-bold text-gh-navy-dark mb-3">Deck</h1>

      {!selection && (
        <div className="w-full max-w-xs flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Playlist</p>
            <div className="flex flex-col gap-2">
              {DATASETS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setPickedDatasetId(d.id)}
                  className={`w-full py-3 px-4 rounded-xl text-left text-base font-medium border-2 transition-colors ${
                    pickedDatasetId === d.id
                      ? 'border-gh-navy bg-gh-navy/10 text-gh-navy-dark'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Vijver</p>
            <div className="flex gap-2">
              {POND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPickedPond(opt.value)}
                  className={`flex-1 py-3 px-2 rounded-xl text-center text-sm font-medium border-2 transition-colors ${
                    pickedPond === opt.value
                      ? 'border-gh-navy bg-gh-navy/10 text-gh-navy-dark'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startGame} className="w-full btn-primary">
            Start
          </button>
        </div>
      )}

      {selection && (
        <>
          {error && (
            <p className="text-red-600 text-center text-base max-w-xs">
              ⚠️ Dataset kon niet laden: {error}
            </p>
          )}
          {!error && !dataset && (
            <p className="text-gray-500 text-center text-base max-w-xs">Dataset laden…</p>
          )}
          {dataset && drawState && !pondDone && currentTrack && (
            <div
              className="w-full max-w-xs flex flex-col items-center gap-4"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {viewIndex === null ? (
                <>
                  <DeckCard
                    track={currentTrack}
                    cardNumber={drawState.drawnCount + 1}
                    total={drawState.order.length}
                    datasetName={dataset.name}
                    flipped={flipped}
                  />
                  {!flipped ? (
                    <button onClick={() => setFlipped(true)} className="w-full btn-primary">
                      Draai kaartje om
                    </button>
                  ) : (
                    <button onClick={nextCard} className="w-full btn-primary">
                      Volgende kaart
                    </button>
                  )}
                  {drawState.drawnCount > 0 && (
                    <button
                      onClick={goToPrevious}
                      className="text-sm text-gray-500 underline underline-offset-2"
                    >
                      ← Vorige kaart bekijken
                    </button>
                  )}
                </>
              ) : (
                browsedTrack && (
                  <>
                    <p className="text-sm font-medium text-gray-500">
                      Kaart {viewIndex + 1} van {drawState.order.length} · eerder getrokken
                    </p>
                    <CardBack track={browsedTrack} datasetName={dataset.name} />
                    <div className="w-full flex gap-3">
                      <button
                        onClick={goToPrevious}
                        disabled={viewIndex === 0}
                        className="btn-secondary flex-1 disabled:opacity-40"
                      >
                        ← Vorige
                      </button>
                      <button onClick={goToNext} className="btn-primary flex-1 text-base py-3">
                        {viewIndex + 1 >= drawState.drawnCount ? 'Naar huidige kaart →' : 'Volgende →'}
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
          )}
          {dataset && pondDone && (
            <div className="w-full max-w-xs flex flex-col items-center gap-4">
              <p className="text-gh-navy-dark text-center text-lg font-semibold">
                Playlist op — nieuw spel?
              </p>
              <button onClick={newGame} className="w-full btn-primary">
                Nieuw spel
              </button>
            </div>
          )}
          {dataset && !pondDone && (
            <button onClick={newGame} className="btn-secondary mt-6 py-2 px-5 text-sm text-gray-600">
              Nieuw spel / reset
            </button>
          )}
          <button
            onClick={changeSelection}
            className="btn-secondary mt-2 py-2 px-5 text-sm text-gray-600"
          >
            Andere playlist/vijver kiezen
          </button>
        </>
      )}

      <button onClick={() => navigate('/')} className="btn-secondary mt-4 px-8">
        ← Terug
      </button>
    </div>
  )
}
