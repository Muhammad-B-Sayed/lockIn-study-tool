import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { exitExample } from '../app/exampleStore'
import { Root } from '../app/Root'
import { SESSION_STORAGE_KEY } from '../lib/data'
import { persisted } from './demoHarness'

function Location() {
  return <output data-testid="location" hidden>{useLocation().pathname}</output>
}

afterEach(() => exitExample())

describe('view-only example', () => {
  it('opens from Help, refuses edits, and returns to the learner’s own workspace untouched', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ mode: 'demo' }))
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/app/settings']}>
        <Root />
        <Location />
      </MemoryRouter>,
    )
    const location = () => screen.getByTestId('location').textContent

    await user.click(await screen.findByRole('button', { name: 'View an example' }))
    const own = JSON.stringify(persisted())
    await waitFor(() => expect(location()).toBe('/app'))
    const banner = (await screen.findByText('View-only example.')).closest<HTMLElement>('.example-bar')!

    const deadlines = await screen.findByRole('heading', { name: 'Deadlines' })
    await user.click(deadlines.closest('section')!.querySelector<HTMLButtonElement>('.check')!)
    expect(await screen.findByText('This is a view-only example. Nothing here can be changed.')).toBeInTheDocument()

    await user.click(within(banner).getByRole('button', { name: 'Back to my workspace' }))
    await waitFor(() => expect(location()).toBe('/app/settings'))
    expect(screen.queryByText('View-only example.')).not.toBeInTheDocument()
    expect(JSON.stringify(persisted())).toBe(own)
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe(JSON.stringify({ mode: 'demo' }))
  })
})
