interface ExplainOverlayProps {
  onClose: () => void
}

export default function ExplainOverlay({ onClose }: ExplainOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      style={{ animation: 'fade-in 150ms ease-out' }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ animation: 'overlay-in 200ms ease-out' }}
      >
        <p className="text-4xl mb-2">🪿</p>
        <h2 className="text-2xl font-bold text-gh-navy-dark mb-4">Zo werkt het</h2>

        <ol className="space-y-3 text-base text-gray-700 list-decimal list-inside mb-6">
          <li>
            De <strong>Deck</strong>-telefoon toont een QR-kaartje.
          </li>
          <li>
            De <strong>Player</strong>-telefoon scant 'm en speelt het nummer blind af — niemand
            ziet welk nummer het is.
          </li>
          <li>
            Iedereen raadt op het gehoor het <strong>jaartal</strong> en plaatst het nummer op de
            papieren tijdlijn. Bonuspunt voor wie ook titel of artiest goed heeft.
          </li>
          <li>
            Klaar met raden? Deck draait het kaartje om: jaartal, titel, artiest en rang.
          </li>
          <li>
            Player op <strong>Stop</strong>, Deck op <strong>Volgende kaart</strong>, en verder
            naar de volgende ronde.
          </li>
        </ol>

        <button onClick={onClose} className="w-full btn-primary">
          Snap ik!
        </button>
      </div>
    </div>
  )
}
