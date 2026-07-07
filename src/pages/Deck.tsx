import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DATASETS, loadDataset, type Dataset } from '../lib/datasets'
import DeckCard from '../components/DeckCard'
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

  function startGame() {
    const next: DeckSelection = { datasetId: pickedDatasetId, pond: pickedPond }
    clearDrawState()
    saveSelection(next)
    setSelection(next)
    setFlipped(false)
  }

  function changeSelection() {
    clearSelection()
    clearDrawState()
    setSelection(null)
    setDataset(null)
    setDrawState(null)
    setError(null)
    setFlipped(false)
  }

  function nextCard() {
    if (!drawState || pondDone) return
    const next: DrawState = { ...drawState, drawnCount: drawState.drawnCount + 1 }
    saveDrawState(next)
    setDrawState(next)
    setFlipped(false)
  }

  function newGame() {
    if (!selection) return
    setDrawState(resetDrawState(selection, pondTracks.map((t) => t.id)))
    setFlipped(false)
  }

  return (
    <div className="min-h-svh bg-white flex flex-col items-center justify-center px-6 py-12">
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

          <button
            onClick={startGame}
            className="w-full py-4 px-6 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
          >
            Start
          </button>
        </div>
      )}

      {selection && (
        <>
          {error && (
            <p className="text-red-600 text-center text-base max-w-xs">
              Fout bij laden: {error}
            </p>
          )}
          {!error && !dataset && (
            <p className="text-gray-500 text-center text-base max-w-xs">Dataset laden…</p>
          )}
          {dataset && drawState && !pondDone && currentTrack && (
            <div className="w-full max-w-xs flex flex-col items-center gap-4">
              <DeckCard
                track={currentTrack}
                cardNumber={drawState.drawnCount + 1}
                total={drawState.order.length}
                datasetName={dataset.name}
                flipped={flipped}
                onFlip={() => setFlipped(true)}
              />
              {!flipped ? (
                <button
                  onClick={() => setFlipped(true)}
                  className="w-full py-4 px-6 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
                >
                  Draai kaartje om
                </button>
              ) : (
                <button
                  onClick={nextCard}
                  className="w-full py-4 px-6 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
                >
                  Volgende kaart
                </button>
              )}
            </div>
          )}
          {dataset && pondDone && (
            <div className="w-full max-w-xs flex flex-col items-center gap-4">
              <p className="text-gh-navy-dark text-center text-lg font-semibold">
                Playlist op — nieuw spel?
              </p>
              <button
                onClick={newGame}
                className="w-full py-4 px-6 bg-gh-navy text-white text-lg font-semibold rounded-2xl shadow active:scale-95 transition-transform duration-100"
              >
                Nieuw spel
              </button>
            </div>
          )}
          {dataset && !pondDone && (
            <button
              onClick={newGame}
              className="mt-6 py-2 px-5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl active:scale-95 transition-transform duration-100"
            >
              Nieuw spel / reset
            </button>
          )}
          <button
            onClick={changeSelection}
            className="mt-2 py-2 px-5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl active:scale-95 transition-transform duration-100"
          >
            Andere playlist/vijver kiezen
          </button>
        </>
      )}

      <button
        onClick={() => navigate('/')}
        className="mt-4 py-3 px-8 bg-gray-100 text-gray-700 text-base font-medium rounded-xl active:scale-95 transition-transform duration-100"
      >
        ← Terug
      </button>
    </div>
  )
}
