import type { Track } from '../lib/datasets'

interface CardBackProps {
  track: Track
  datasetName: string
}

export default function CardBack({ track, datasetName }: CardBackProps) {
  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-3 text-center">
      <p className="text-7xl font-black text-gh-navy-dark leading-none">{track.year}</p>
      <img
        src={track.cover}
        alt={`Albumhoes van ${track.title}`}
        className="w-32 h-32 rounded-xl shadow object-cover"
      />
      <div>
        <p className="text-lg font-semibold text-gh-navy-dark">{track.title}</p>
        <p className="text-base text-gray-500">{track.artist}</p>
      </div>
      <p className="text-sm text-gray-400">
        Nr. {track.rank} in {datasetName}
      </p>
      <a
        href={`https://open.spotify.com/track/${track.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-300 underline"
      >
        controleer in Spotify
      </a>
    </div>
  )
}
