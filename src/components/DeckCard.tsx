import type { Track } from '../lib/datasets'
import CardFront from './CardFront'
import CardBack from './CardBack'

interface DeckCardProps {
  track: Track
  cardNumber: number
  total: number
  datasetName: string
  flipped: boolean
}

export default function DeckCard({ track, cardNumber, total, datasetName, flipped }: DeckCardProps) {
  return (
    <div className="w-full max-w-xs" style={{ perspective: 1200 }}>
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
