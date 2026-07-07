import { useRef } from 'react'
import type { Track } from '../lib/datasets'
import CardFront from './CardFront'
import CardBack from './CardBack'

interface DeckCardProps {
  track: Track
  cardNumber: number
  total: number
  datasetName: string
  flipped: boolean
  onFlip: () => void
}

// Minimale swipe-drempel; alleen duidelijk horizontale gebaren tellen, zodat
// gewoon verticaal scrollen op de pagina niet per ongeluk als flip wordt gezien.
const SWIPE_THRESHOLD = 40

export default function DeckCard({ track, cardNumber, total, datasetName, flipped, onFlip }: DeckCardProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || flipped) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onFlip()
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full max-w-xs"
      style={{ perspective: 1200 }}
    >
      <div
        className="relative w-full min-h-[420px] transition-transform duration-500 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <CardFront trackId={track.id} cardNumber={cardNumber} total={total} />
        </div>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <CardBack track={track} datasetName={datasetName} />
        </div>
      </div>
    </div>
  )
}
