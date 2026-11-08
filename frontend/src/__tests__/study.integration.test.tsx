import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { rankReview } from '../lib/domain'
import { NOW, location, main, persisted, renderDemo, seed, topic } from './demoHarness'

describe('review and focus with persisted demo data', () => {
  it('rates from the review queue and Undo restores confidence and review time', async () => {
    const { user } = renderDemo('/app/review')
    const queue = within(await screen.findByRole('region', { name: 'Review queue' }))
    const original = rankReview(seed, NOW)[0].topic
    const row = queue.getByRole('link', { name: original.title }).closest('li')!
    const rating = original.confidence === 'solid' ? 'Shaky' : 'Solid'
    await user.click(within(row).getByRole('button', { name: /change rating/i }))
    await user.click(await screen.findByRole('menuitem', { name: rating }))
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent(original.title)
    await waitFor(() => expect(persisted().topics.find((item) => item.id === original.id)?.confidence).toBe(rating === 'Solid' ? 'solid' : 'shaky'))
    await user.click(within(toast).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(persisted().topics.find((item) => item.id === original.id)).toMatchObject({ confidence: original.confidence, lastReviewedAt: original.lastReviewedAt }))
    expect(await queue.findByRole('link', { name: original.title })).toBeInTheDocument()
  })

  it('rates a complete review pass with 1/2/3 keys and tallies the saved results', async () => {
    const { user } = renderDemo('/app/review')
    const ranked = rankReview(seed, NOW)
    expect(ranked.length).toBeGreaterThanOrEqual(3)
    const beforeReviews = seed.reviews.length
    await user.click(await screen.findByRole('button', { name: 'Start a review pass' }))
    for (let index = 0; index < ranked.length; index += 1) {
      await main().findByRole('heading', { level: 1, name: ranked[index].topic.title })
      expect(main().getByRole('progressbar', { name: 'Pass progress' })).toHaveAttribute('aria-valuenow', String(index))
      await user.keyboard(String(index % 3 + 1))
    }
    expect(await main().findByRole('heading', { level: 1, name: `${ranked.length} topics checked.` })).toBeInTheDocument()
    const tally = main().getByRole('list')
    const counts = ['Shaky', 'Getting there', 'Solid'].map((label, rating) => {
      const expected = ranked.filter((_, index) => index % 3 === rating).length
      const item = within(tally).getByText(label).closest('li')!
      expect(within(item).getByText(String(expected), { exact: true })).toBeInTheDocument()
      return expected
    })
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(ranked.length)
    await waitFor(() => expect(persisted().reviews).toHaveLength(beforeReviews + ranked.length))
  })

  it('requires a focus check-in rating, then logs a session and opens the topic', async () => {
    const { user } = renderDemo(`/app/topics/${topic.id}`)
    await user.click(await screen.findByRole('button', { name: 'Lock in on this' }))
    await main().findByRole('button', { name: 'Finish' })
    act(() => vi.setSystemTime(new Date(NOW.getTime() + 25 * 60_000)))
    await user.click(main().getByRole('button', { name: 'Pause' }))
    await user.click(main().getByRole('button', { name: 'Finish' }))
    const save = main().getByRole('button', { name: 'Save session' })
    expect(save).toBeDisabled()
    const confidence = within(main().getByRole('radiogroup', { name: 'Confidence' }))
    await user.click(confidence.getByRole('radio', { name: /Getting there/ }))
    expect(save).toBeEnabled()
    await user.type(main().getByRole('textbox', { name: 'One line for future you' }), 'Revisit the worked example')
    const before = persisted().sessions.length
    await user.click(save)
    expect(await main().findByRole('textbox', { name: 'Topic title' })).toHaveValue(topic.title)
    expect(location()).toBe(`/app/topics/${topic.id}`)
    await waitFor(() => expect(persisted().sessions).toHaveLength(before + 1))
    expect(persisted().sessions.at(-1)).toMatchObject({ topicId: topic.id, minutes: 25, note: 'Revisit the worked example' })
    expect(persisted().reviews.at(-1)).toMatchObject({ topicId: topic.id, rating: 'okay', source: 'focus' })
    expect(localStorage.getItem('lockin.focus.v1')).toBeNull()
  })

  it('flushes notes when unmounted before the autosave debounce and restores them on remount', async () => {
    const { user, unmount } = renderDemo(`/app/topics/${topic.id}`)
    const notes = await screen.findByRole('textbox', { name: 'Notes' })
    const text = 'A local note that must survive leaving immediately.'
    await user.clear(notes)
    await user.type(notes, text)
    // No 900 ms sleep: this must exercise the unmount flush, not the debounce.
    unmount()
    await waitFor(() => expect(persisted().topics.find((item) => item.id === topic.id)?.notes).toBe(text))
    renderDemo(`/app/topics/${topic.id}`)
    expect(await screen.findByRole('textbox', { name: 'Notes' })).toHaveValue(text)
  })
})
