import { useCallback } from 'react'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import { useWorkspaceState } from '@/app/workspace-store'
import { useToast } from '@/components/toast-context'
import type { Change, Ctx } from '@/domain/service-core'
import type { WorkspaceStore } from '@/domain/workspace'
import { setViewAs } from '@/domain/workspace-logic'
import { useNow } from '@/hooks/use-now'
import { nameOf } from '@/selectors/workspace'

/**
 * The signed-in persona's view of Workspace. `actor` is the real CampusOS profile unless the viewer
 * has chosen to act as one of the FICTIONAL demo members (a labelled, single-browser simulation of
 * roles — not a second signed-in person).
 */
export function useWorkspace() {
  const ws = useWorkspaceState((s) => s.workspace)
  const status = useWorkspaceState((s) => s.status)
  const actAs = ws.viewAs ?? null
  const run = useWorkspaceState((s) => s.run)
  const setActAs = useCallback((id: string | null) => void run((s) => setViewAs(s, id)), [run])
  const profiles = useAppStore((s) => s.profiles)
  const profileId = useAppStore((s) => s.activeProfileId)
  const services = useServices()
  const now = useNow()
  const toast = useToast()
  const simulating = actAs !== null && ws.people.some((p) => p.id === actAs)
  const actor = simulating ? actAs : profileId
  const name = useCallback((id: string) => nameOf(ws, profiles, id), [ws, profiles])
  const isRealProfile = profiles.some((p) => p.id === actor)

  /** Runs one rule. A refusal is shown in plain words and nothing changes. */
  const act = useCallback(
    async <T>(rule: (s: WorkspaceStore, c: Ctx) => Change<WorkspaceStore, T>, success?: string) => {
      const r = await run(rule)
      if (!r.ok) toast.notify('error', r.error.message)
      else if (success) toast.notify('success', success)
      return r
    },
    [run, toast],
  )

  return {
    ws,
    status,
    actor,
    simulating,
    setActAs,
    act,
    name,
    profiles,
    profileId,
    isRealProfile,
    now,
    services,
    toast,
  }
}

export type WorkspaceApi = ReturnType<typeof useWorkspace>
