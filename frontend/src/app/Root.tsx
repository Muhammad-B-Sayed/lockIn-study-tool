import { useMemo } from 'react'
import { DataProvider } from '../lib/data'
import { createExampleDataSource } from '../lib/data/example'
import { ToastProvider } from '../ui/toast'
import { App } from './App'
import { exitExample, useExampleMode } from './exampleStore'

/**
 * The learner's own workspace, or the view-only example in its place. The example gets its own
 * provider, so it never shares cached data with the account and never writes the stored session.
 */
export function Root() {
  const example = useExampleMode()
  // A fresh example each time it opens, dated today.
  const exampleSource = useMemo(() => (example ? createExampleDataSource() : null), [example])
  if (example && exampleSource) {
    return (
      <DataProvider key="example" dataSource={exampleSource} initialSession={{ mode: 'demo' }} wakeBackend={false} persistSession={false} onSignOut={exitExample}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </DataProvider>
    )
  }
  return (
    <DataProvider key="own">
      <ToastProvider>
        <App />
      </ToastProvider>
    </DataProvider>
  )
}
