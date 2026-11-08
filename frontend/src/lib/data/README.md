# Frontend data API

Mount `<DataProvider>` above the router. Import the hooks and contract types from `lib/data`. The provider creates the QueryClient, loads `lockin.session.v1`, selects the adapter, and wakes the remote backend. No changes to `main.tsx` are included in this slice.

## Hooks

```ts
useAuth(): {
  state: AuthState
  signIn(input: Credentials): Promise<void>
  signUp(input: Credentials & { repeatPassword?: string }): Promise<void>
  startDemo(): Promise<void>
  signOut(): void
}
useWorkspace(): UseQueryResult<Workspace, DataError>

useCourseMutations(): {
  create(input: CourseInput): Promise<Course>
  update(id: string, patch: Partial<CourseInput>): Promise<Course>
  remove(id: string): Promise<void>
}
useTopicMutations(): {
  create(input: TopicInput): Promise<Topic>
  createMany(inputs: TopicInput[]): Promise<Topic[]>
  update(id: string, patch: TopicPatch): Promise<Topic>
  remove(id: string): Promise<void>
}
useAssessmentMutations(): {
  create(input: AssessmentInput): Promise<Assessment>
  createMany(inputs: AssessmentInput[]): Promise<Assessment[]>
  update(id: string, patch: AssessmentPatch): Promise<Assessment>
  remove(id: string): Promise<void>
}
useEventMutations(): {
  create(input: EventInput): Promise<CalendarEvent>
  update(id: string, patch: Partial<EventInput>): Promise<CalendarEvent>
  remove(id: string): Promise<void>
}
useSessionMutations(): {
  create(input: SessionInput): Promise<StudySession>
  remove(id: string): Promise<void>
}
useRateTopic(): {
  rate(input: RateInput): Promise<{ undo(): Promise<void> }>
}
useAccount(): {
  changePassword(currentPassword: string, newPassword: string): Promise<void>
  deleteAccount(): Promise<void>
  exportData(): Promise<Blob>
  resetDemo(): Promise<Workspace>
}
```

All write functions throw `DataError`, an `Error` with `status: number` and the server's `message`. Status `0` means a transport failure. Catch the promise to show a toast. `rate` returns an undo function tied to that particular server review. Undoing an older review rejects with status `409`.

Workspace writes update `WORKSPACE_QUERY_KEY`, exactly `['workspace']`, before the request settles. A successful response replaces temporary records, including resource IDs. A provider-scoped ID map resolves queued entity IDs and foreign keys when each write starts. A failed request restores the previous cache. The provider serializes writes across hooks and checks the session after every asynchronous preparation step and before sending a request. Signing out clears both the cache and the ID map.

An explicit `plannedDate`, including null, is preserved when a time block changes. When a payload includes `plannedStart` without `plannedDate`, both adapters derive the date in the browser's local timezone. The remote adapter includes that derived date in its request so the server does not need the browser's timezone.

Bulk creation accepts 1 to 300 parent records per call. A topic bulk request can contain at most 2,000 resources in total. An assessment bulk request can contain at most 2,000 topic links in total. Demo mode checks these budgets before allocating IDs or changing storage and returns the backend's error messages with status 400.

## Provider and adapters

```ts
DataProvider(props: {
  children: ReactNode
  dataSource?: DataSource
  initialSession?: StoredSession | null
  queryClient?: QueryClient
  wakeBackend?: boolean // default true
}): JSX.Element

createRemoteDataSource(options?: RemoteOptions): DataSource
// RemoteOptions: { baseUrl?, token?: string | (() => string | null),
//                  onUnauthorized?: () => void, fetch?: typeof fetch }
createLocalDataSource(options?: LocalOptions): LocalDataSource
// LocalOptions: { storage?, initialWorkspace?, now?: () => Date,
//                 makeId?: () => string, reviewPreviousDates? }
// LocalDataSource extends DataSource with resetDemo(): Promise<Workspace>.
createDemoWorkspace(now?: Date): Workspace
loadSession(storage?: StorageLike | null): StoredSession | null
asDataError(error: unknown): DataError
new DataError(status: number, message: string): DataError
```

The full `DataSource` interface is in `source.ts`. It covers workspace reads, auth, CRUD for every entity, bulk topics and assessments, rating, and review undo. Direct adapter methods have the same payloads and return types as the HTTP contract. The remote adapter retains the existing `/api/me`, `/api/me/password`, and `/api/me` DELETE auth endpoints. It accepts `VITE_API_BASE_URL` as an origin or an existing URL ending in `/api`.

The index also exports `SESSION_STORAGE_KEY`, `DEMO_STORAGE_KEY`, `WORKSPACE_QUERY_KEY`, all contract types, and the adapter/provider option types. Required dependency: `@tanstack/react-query@5`.

Demo data stays under `lockin.demo.v1` when the learner signs out. Reset replaces it with a new relative-date seed. Internal `_reviewPreviousDates`, `_reviewSequences`, and `_nextReviewSequence` metadata persist alongside the workspace. Undo restores the prior review date and uses insertion order even if the clock moves backwards. Existing saved demos receive sequence numbers from their retained insertion order. Reads and exports return only the contract's Workspace fields. Every storage operation tolerates unavailable or full storage and continues in memory.
