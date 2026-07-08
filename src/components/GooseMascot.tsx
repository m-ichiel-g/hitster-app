interface GooseMascotProps {
  className?: string
}

export default function GooseMascot({ className }: GooseMascotProps) {
  return (
    <span className={className} role="img" aria-label="Goose Hitster mascotte">
      🪿
    </span>
  )
}
