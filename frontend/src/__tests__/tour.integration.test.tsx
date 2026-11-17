import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { location, renderDemo } from './demoHarness'

describe('guided tour', () => {
  it('starts from Settings, walks to each page and closes on Escape', async () => {
    const { user } = renderDemo('/app/settings')
    await user.click(await screen.findByRole('button', { name: 'Take the tour' }))

    const tour = () => within(screen.getByRole('dialog', { name: 'Turn your syllabus into a study plan' }))
    await waitFor(() => expect(location()).toBe('/app'))
    await user.click(tour().getByRole('button', { name: 'Show me around' }))

    await screen.findByRole('dialog', { name: 'Start with your courses' })
    await waitFor(() => expect(location()).toBe('/app/courses'))
    await user.keyboard('{ArrowRight}')
    await screen.findByRole('dialog', { name: 'Lock in to study' })
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(location()).toBe('/app/review'))

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Rate how sure you feel' })).not.toBeInTheDocument())
    expect(localStorage.getItem('lockin.tour.seen.v1')).toContain('"')
  })
})
