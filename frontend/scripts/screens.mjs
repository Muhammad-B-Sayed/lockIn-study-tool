// Add states here. setup runs after the route loads and before the capture waits.
// Example: { name: 'palette', path: '/app', setup: page => page.keyboard.press('ControlOrMeta+k') }
export const screens = [
  { name: 'landing', path: '/', signedOut: true, full: true },
  { name: 'today', path: '/app', full: true },
  { name: 'courses', path: '/app/courses', full: true },
  { name: 'course', path: '/app/courses/course-csc369', full: true },
  { name: 'topic', path: '/app', setup: page => openFirstLink(page, '/app/topics/'), full: true },
  { name: 'review', path: '/app/review', full: true },
  { name: 'review-groups', path: '/app/review?view=groups', full: true },
  { name: 'review-pass', path: '/app/review', setup: page => page.getByRole('button', { name: 'Start a review pass' }).click() },
  { name: 'calendar', path: '/app/calendar' },
  { name: 'calendar-month', path: '/app/calendar?view=month', full: true },
  { name: 'focus', path: '/app/focus' },
  { name: 'focus-running', path: '/app/focus', setup: async page => { await page.keyboard.press('Enter'); await page.waitForTimeout(1500) } },
  { name: 'palette', path: '/app', setup: async page => { await page.keyboard.press('ControlOrMeta+k'); await page.keyboard.type('csc369 midterm nov 12') } },
  { name: 'import', path: '/app/courses/course-csc369', setup: async page => { await page.getByRole('button', { name: 'Import syllabus' }).click(); await page.getByRole('button', { name: 'Try an example' }).click(); await page.getByRole('button', { name: 'Read syllabus' }).click() } },
  { name: 'settings', path: '/app/settings', full: true },
  { name: 'empty-course', path: '/app/courses', setup: async page => { await page.getByRole('button', { name: 'New course' }).click(); await page.getByLabel('Code').fill('PHL245'); await page.getByLabel('Name').fill('Modern Symbolic Logic'); await page.getByRole('button', { name: 'Add course' }).click(); await page.waitForURL(/courses\/(?!course-)/); await page.waitForTimeout(600) } },
  { name: 'review-hover', path: '/app/review', setup: async page => { await page.locator('.review-row').nth(1).hover(); await page.waitForTimeout(250) } },
  { name: 'rate-menu', path: '/app/review', setup: async page => { await page.locator('.review-row').first().locator('.rate-chip').click(); await page.waitForTimeout(250) } },
  { name: 'rated-toast', path: '/app/review', setup: async page => { await page.locator('.review-row').first().locator('.rate-chip').click(); await page.getByRole('menuitem', { name: /Solid/ }).click(); await page.waitForTimeout(400) } },
  { name: 'new-deadline', path: '/app/courses/course-csc369', setup: async page => { await page.getByRole('button', { name: 'More options' }).click(); await page.getByRole('menuitem', { name: 'Add deadline' }).click(); await page.waitForTimeout(300) } },
]


async function openFirstLink(page, prefix) {
  const link = page.locator(`a[href^="${prefix}"]`).first()
  if (await link.count()) await link.click()
  else console.warn(`No ${prefix} link yet; capturing the parent route.`)
}

