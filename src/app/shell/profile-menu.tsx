import { ChevronDown, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '../app-store'

/** Demo profile switcher. A profile is a data filter, not a login — the menu says so. */
export function ProfileMenu() {
  const profiles = useAppStore((s) => s.profiles)
  const activeId = useAppStore((s) => s.activeProfileId)
  const setActive = useAppStore((s) => s.setActiveProfile)
  const active = profiles.find((p) => p.id === activeId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Demo profile: ${active?.displayName ?? 'loading'}`}
          variant="outline"
          className="min-h-11 gap-2 bg-surface px-3"
          disabled={profiles.length === 0}
        >
          <UserRound className="size-4" aria-hidden="true" />
          <span className="hidden max-w-40 truncate md:inline">
            {active?.displayName ?? 'Loading…'}
          </span>
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-semibold text-ink">Demo profile</span>
          <span className="block text-xs text-ink-muted">
            Switches which sample data you see. This is not a sign-in.
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={activeId} onValueChange={(id) => setActive(id)}>
          {profiles.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id} className="min-h-11">
              <span>
                <span className="block text-sm text-ink">{p.displayName}</span>
                <span className="block text-xs text-ink-muted">{p.description}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
