import type { Track } from './datasets'

export type PondSize = 500 | 1000 | 'all'

export interface DeckSelection {
  datasetId: string
  pond: PondSize
}

const SELECTION_KEY = 'goose-hitster-deck-selection'

export function loadSelection(): DeckSelection | null {
  const raw = localStorage.getItem(SELECTION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const pondOk = parsed?.pond === 500 || parsed?.pond === 1000 || parsed?.pond === 'all'
    if (typeof parsed?.datasetId === 'string' && pondOk) {
      return parsed as DeckSelection
    }
  } catch {
    // corrupte/oude data: negeren, kiezer opnieuw tonen
  }
  return null
}

export function saveSelection(selection: DeckSelection): void {
  localStorage.setItem(SELECTION_KEY, JSON.stringify(selection))
}

export function clearSelection(): void {
  localStorage.removeItem(SELECTION_KEY)
}

export function filterByPond(tracks: Track[], pond: PondSize): Track[] {
  if (pond === 'all') return tracks
  return tracks.filter((t) => t.rank <= pond)
}

export interface DrawState {
  datasetId: string
  pond: PondSize
  order: string[] // geshuffelde track-id's van de volledige vijver
  drawnCount: number // hoeveel er al getrokken zijn (index in order)
}

const DRAW_KEY = 'goose-hitster-draw-state'

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function freshDrawState(selection: DeckSelection, trackIds: string[]): DrawState {
  const fresh: DrawState = {
    datasetId: selection.datasetId,
    pond: selection.pond,
    order: shuffle(trackIds),
    drawnCount: 0,
  }
  localStorage.setItem(DRAW_KEY, JSON.stringify(fresh))
  return fresh
}

// Laadt de shuffle-bag voor deze selectie. Bij een refresh met dezelfde playlist/vijver
// wordt de opgeslagen volgorde en voortgang hergebruikt; anders (of bij corrupte data)
// wordt een nieuwe shuffle gemaakt.
export function loadDrawState(selection: DeckSelection, trackIds: string[]): DrawState {
  const raw = localStorage.getItem(DRAW_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DrawState
      const idSet = new Set(trackIds)
      const sameSelection = parsed.datasetId === selection.datasetId && parsed.pond === selection.pond
      const sameTracks =
        Array.isArray(parsed.order) &&
        parsed.order.length === trackIds.length &&
        parsed.order.every((id) => idSet.has(id))
      if (sameSelection && sameTracks && typeof parsed.drawnCount === 'number') {
        return parsed
      }
    } catch {
      // corrupte data: hieronder een nieuwe shuffle maken
    }
  }
  return freshDrawState(selection, trackIds)
}

export function saveDrawState(state: DrawState): void {
  localStorage.setItem(DRAW_KEY, JSON.stringify(state))
}

export function resetDrawState(selection: DeckSelection, trackIds: string[]): DrawState {
  return freshDrawState(selection, trackIds)
}

export function clearDrawState(): void {
  localStorage.removeItem(DRAW_KEY)
}
