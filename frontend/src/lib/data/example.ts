import { createLocalDataSource } from './local'
import { createDemoWorkspace } from './seed'
import { DataError, type DataSource } from './source'

/** Methods that only read. Every other method is refused. */
const READS = new Set<keyof DataSource>(['health', 'getWorkspace', 'getProfile'])

export const EXAMPLE_READ_ONLY_MESSAGE = 'This is a view-only example. Nothing here can be changed.'

/**
 * The sample workspace as a view-only source. It lives in memory only: it never reads or writes
 * the browser's demo data, and every write is refused with a clear message.
 */
export function createExampleDataSource(now = new Date()): DataSource {
  const base = createLocalDataSource({ storage: null, initialWorkspace: createDemoWorkspace(now) })
  const refuse = () => Promise.reject(new DataError(403, EXAMPLE_READ_ONLY_MESSAGE))
  const source = {} as Record<keyof DataSource, unknown>
  for (const key of Object.keys(base) as (keyof DataSource)[]) {
    if (key === ('resetDemo' as keyof DataSource)) continue
    source[key] = READS.has(key) ? (base[key] as (...args: unknown[]) => unknown).bind(base) : refuse
  }
  return source as unknown as DataSource
}
