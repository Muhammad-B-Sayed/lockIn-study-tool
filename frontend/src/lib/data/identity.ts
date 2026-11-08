/** A provider-scoped mapping retained until sign-out so queued writes can follow optimistic records. */
export function createIdRegistry() {
  const ids = new Map<string, string>()
  const idFields = new Set(['id', 'courseId', 'topicId', 'reviewId'])
  function visit(value: unknown, field?: string): unknown {
    if (typeof value === 'string') return field === undefined || idFields.has(field) || field === 'topicIds' ? ids.get(value) ?? value : value
    if (Array.isArray(value)) return value.map(item => visit(item, field))
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, key)]))
  }
  return {
    resolve: <T,>(value: T): T => visit(value) as T,
    register: (temporary: string, real: string) => { if (temporary.startsWith('temp-') && temporary !== real) ids.set(temporary, real) },
    clear: () => ids.clear(),
  }
}
export type IdRegistry = ReturnType<typeof createIdRegistry>
