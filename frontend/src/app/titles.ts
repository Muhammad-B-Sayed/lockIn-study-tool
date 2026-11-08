/** "CSC324 Assignment 2" shown next to a CSC324 tag reads better as "Assignment 2". */
export function withoutCode(title: string, code: string | undefined) {
  if (!code) return title
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const stripped = title.replace(new RegExp(`^${escaped}[\\s:·-]*`, 'i'), '').trim()
  return stripped || title
}
