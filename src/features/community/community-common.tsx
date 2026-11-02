import { ImageOff } from 'lucide-react'
import { categoryLabel, type ItemCategory } from '@/domain/community'

/** A stable placeholder. It is never presented as a picture of the item. */
export function ItemIcon({ category }: { category: ItemCategory }) {
  return (
    <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-md border border-border-strong bg-mist text-xs text-ink-muted">
      <ImageOff className="size-5" aria-hidden="true" />
      <span className="sr-only">No picture. Category: </span>
      {categoryLabel[category]}
    </span>
  )
}
