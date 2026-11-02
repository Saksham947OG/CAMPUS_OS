import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OPEN_ASSISTANT_EVENT } from '@/features/chat/campus-assistant'

/** Top-bar entry to the one Campus AI panel. It does not hold any assistant state of its own. */
export function CampusAi() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label="Open Campus AI"
      onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
    >
      <Sparkles className="size-5" aria-hidden="true" />
    </Button>
  )
}
