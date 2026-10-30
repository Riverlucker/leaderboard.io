import { Star } from "lucide-react"

export function PlayerStars({stars, enabled, onColor = false}: {stars?: number | null; enabled?: boolean; onColor?: boolean}) {
  if (!enabled || !stars || stars < 1 || !Number.isFinite(stars)) return null
  const count = Math.floor(stars)
  return <span aria-label={`${count} Sterne`} className={`hidden landscape:inline-flex lg:inline-flex shrink-0 items-center gap-px ${onColor ? "text-amber-200" : "text-amber-600"}`}>
    {Array.from({length:count}, (_, i) => <Star key={i} size={10} aria-hidden="true" className="fill-current" />)}
  </span>
}
