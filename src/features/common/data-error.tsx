import { useContext } from 'react'
import { DataStoreContext } from '@/app/data-store'
import { useAppStore } from '@/app/app-store'
import { Button } from '@/components/ui/button'

/** Shown when the records for a profile could not be loaded. Never an empty page, never a stale mix. */
export function DataError({ message }: { message?: string }) {
  const store = useContext(DataStoreContext)
  const profileId = useAppStore((s) => s.activeProfileId)
  return (
    <div role="alert" className="max-w-xl rounded-lg border border-border-strong bg-surface p-5">
      <h2 className="text-lg font-semibold text-ink">Your records could not be loaded</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {message ?? 'Something went wrong reading this profile’s data.'} Nothing was changed or
        deleted.
      </p>
      <Button className="mt-3 min-h-11" onClick={() => void store?.getState().load(profileId)}>
        Try again
      </Button>
    </div>
  )
}
