import { useEffect, useState, type ReactNode } from 'react'
import { ConfirmProvider } from '@/components/confirm-provider'
import { Toaster } from '@/components/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppStoreContext, createAppStore } from './app-store'
import { ChillStateContext, createChillStateStore } from './chill-store'
import { EssStateContext, createEssStateStore } from './ess-store'
import { AdminStateContext, createAdminStateStore } from './admin-store'
import { AcademicsStateContext, createAcademicsStateStore } from './academics-store'
import { CommunityStateContext, createCommunityStateStore } from './community-store'
import { SharedStateContext, createSharedStateStore } from './shared-store'
import { SportsStateContext, createSportsStateStore } from './sports-store'
import { EssWatcher } from './ess-watcher'
import { createDataStore, DataStoreContext } from './data-store'
import { createServices, ServicesContext, type Services } from './services'

export function AppProviders({ children, services }: { children: ReactNode; services?: Services }) {
  const [resolved] = useState(() => services ?? createServices())
  const [store] = useState(() => createAppStore(resolved))
  const [dataStore] = useState(() => createDataStore(resolved))
  const [chillStore] = useState(() => createChillStateStore(resolved))
  const [essStore] = useState(() => createEssStateStore(resolved))
  const [sportsStore] = useState(() => createSportsStateStore(resolved))
  const [adminStore] = useState(() => createAdminStateStore(resolved))
  const [sharedStore] = useState(() => createSharedStateStore(resolved))
  const [academicsStore] = useState(() => createAcademicsStateStore(resolved))
  const [communityStore] = useState(() => createCommunityStateStore(resolved))

  useEffect(() => {
    void store.getState().init()
    void chillStore.getState().refresh()
    void essStore.getState().refresh()
    void sportsStore.getState().refresh()
    void adminStore.getState().refresh()
    void sharedStore.getState().refresh()
    void academicsStore.getState().refresh()
    void communityStore.getState().refresh()
  }, [
    store,
    chillStore,
    essStore,
    sportsStore,
    adminStore,
    sharedStore,
    academicsStore,
    communityStore,
  ])

  // Keep the data store in step with the active demo profile.
  useEffect(() => {
    const sync = () => {
      const { status, activeProfileId } = store.getState()
      if (status === 'ready' && dataStore.getState().profileId !== activeProfileId) {
        void dataStore.getState().load(activeProfileId)
      }
    }
    sync()
    return store.subscribe(sync)
  }, [store, dataStore])

  return (
    <ServicesContext.Provider value={resolved}>
      <AppStoreContext.Provider value={store}>
        <DataStoreContext.Provider value={dataStore}>
          <ChillStateContext.Provider value={chillStore}>
            <EssStateContext.Provider value={essStore}>
              <SportsStateContext.Provider value={sportsStore}>
                <AdminStateContext.Provider value={adminStore}>
                  <SharedStateContext.Provider value={sharedStore}>
                    <AcademicsStateContext.Provider value={academicsStore}>
                      <CommunityStateContext.Provider value={communityStore}>
                        <TooltipProvider delayDuration={300}>
                          <Toaster>
                            <ConfirmProvider>
                              <EssWatcher />
                              {children}
                            </ConfirmProvider>
                          </Toaster>
                        </TooltipProvider>
                      </CommunityStateContext.Provider>
                    </AcademicsStateContext.Provider>
                  </SharedStateContext.Provider>
                </AdminStateContext.Provider>
              </SportsStateContext.Provider>
            </EssStateContext.Provider>
          </ChillStateContext.Provider>
        </DataStoreContext.Provider>
      </AppStoreContext.Provider>
    </ServicesContext.Provider>
  )
}
