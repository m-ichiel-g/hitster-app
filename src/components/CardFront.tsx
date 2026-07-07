import { QRCodeSVG } from 'qrcode.react'

interface CardFrontProps {
  trackId: string
  cardNumber: number
  total: number
}

export default function CardFront({ trackId, cardNumber, total }: CardFrontProps) {
  return (
    <div className="w-full max-w-xs flex flex-col items-center gap-4">
      <p className="text-sm font-medium text-gray-500">
        Kaart {cardNumber} van {total}
      </p>
      <div className="bg-white p-5 rounded-2xl shadow-lg border-2 border-gh-navy/20">
        <QRCodeSVG value={trackId} size={220} level="M" />
      </div>
    </div>
  )
}
