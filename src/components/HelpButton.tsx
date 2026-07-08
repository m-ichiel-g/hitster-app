interface HelpButtonProps {
  onClick: () => void
}

export default function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Spelregels"
      className="absolute top-4 right-4 w-11 h-11 rounded-full bg-gray-100 text-gray-600 text-lg font-bold shadow active:scale-95 transition-transform duration-100"
    >
      ?
    </button>
  )
}
