import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { course, location, main, persisted, renderDemo } from './demoHarness'

describe('demo entry and course workflows', () => {
  it('opens the real demo from Landing and shows Today with a review list', async () => {
    const { user } = renderDemo('/', false)
    await user.click(await screen.findByRole('button', { name: 'Try it with sample courses' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Good afternoon, Alex/ })).toBeInTheDocument()
    expect(location()).toBe('/app')
    const review = screen.getByRole('region', { name: 'Review next' })
    expect(within(review).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(persisted().courses.some((item) => item.code === 'CSC369')).toBe(true)
  })

  it('adds a course topic through the inline input and persists it', async () => {
    const { user } = renderDemo(`/app/courses/${course.id}`)
    const input = await screen.findByRole('textbox', { name: 'New topic title' })
    const title = 'Integration test: copy-on-write'
    await user.type(input, `${title}{Enter}`)
    expect(await main().findByRole('link', { name: title })).toBeInTheDocument()
    await waitFor(() => expect(persisted().topics.find((item) => item.title === title)).toMatchObject({ courseId: course.id, confidence: 'unrated' }))
    expect(input).toHaveValue('')
  })

  it('previews and imports the syllabus example into the real course', async () => {
    const { user } = renderDemo(`/app/courses/${course.id}`)
    await user.click(await screen.findByRole('button', { name: 'Import syllabus' }))
    const dialog = within(screen.getByRole('dialog', { name: `Paste the ${course.code} syllabus` }))
    await user.click(dialog.getByRole('button', { name: 'Try an example' }))
    await user.click(dialog.getByRole('button', { name: 'Read syllabus' }))
    const preview = screen.getByRole('table', { name: 'Parsed syllabus' })
    expect(within(preview).getAllByRole('row')).toHaveLength(7)
    const before = persisted().topics.length
    await user.click(dialog.getByRole('button', { name: 'Add 4 topics and 2 deadlines' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const topics = within(main().getByRole('region', { name: 'Topics' }))
    expect(await topics.findByRole('link', { name: 'Introduction and OS structure' })).toBeInTheDocument()
    expect(topics.getByRole('link', { name: 'Paging and TLBs' })).toBeInTheDocument()
    await waitFor(() => expect(persisted().topics).toHaveLength(before + 4))
    expect(persisted().assessments.some((item) => item.title === 'Assignment 1' && item.dueDate === '2026-10-03')).toBe(true)
  })

  it('blocks an undated syllabus deadline until the learner supplies a date', async () => {
    const { user } = renderDemo(`/app/courses/${course.id}`)
    await user.click(await screen.findByRole('button', { name: 'Import syllabus' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('Syllabus schedule'), 'Assignment 9')
    await user.click(dialog.getByRole('button', { name: 'Read syllabus' }))
    const add = dialog.getByRole('button', { name: 'Add 0 topics and 1 deadline' })
    expect(add).toBeDisabled()
    expect(dialog.getByRole('button', { name: /1 deadline needs a date/ })).toBeInTheDocument()
    await user.type(dialog.getByLabelText('Date'), '2026-11-12')
    expect(add).toBeEnabled()
  })
})

describe('navigation and preferences', () => {
  it.each(['Control', 'Meta'])('quick-adds a deadline through %s+K and shows it on its course', async (modifier) => {
    const { user } = renderDemo('/app')
    await screen.findByRole('heading', { level: 1, name: /Alex/ })
    await user.keyboard(`{${modifier}>}k{/${modifier}}`)
    const dialog = within(screen.getByRole('dialog', { name: 'Search or add' }))
    await user.type(dialog.getByRole('combobox', { name: 'Search or add' }), 'csc369 midterm nov 12')
    const add = dialog.getByRole('option', { name: /Create exam.*midterm/ })
    expect(dialog.getByRole('option', { name: /CSC369 Midterm 2/ })).toBeInTheDocument()
    await user.click(add)
    await waitFor(() => expect(persisted().assessments.find((item) => item.title === 'midterm')).toMatchObject({ kind: 'exam', courseId: course.id, dueDate: '2026-11-12' }))
    const sidebarCourse = screen.getByRole('link', { name: /CSC369.*Operating Systems/ })
    await user.click(sidebarCourse)
    expect(await main().findByText('midterm', { exact: true })).toBeInTheDocument()
    expect(location()).toBe(`/app/courses/${course.id}`)
  })

  it('falls back to today for an invalid calendar date and renders a month', async () => {
    const { user } = renderDemo('/app/calendar?d=not-a-date')
    expect(await screen.findByRole('heading', { level: 1, name: 'November 2 to 8' })).toBeInTheDocument()
    expect(main().getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'date')
    await user.click(main().getByRole('radio', { name: 'Month' }))
    expect(await main().findByRole('heading', { level: 1, name: 'November 2026' })).toBeInTheDocument()
    expect(main().getAllByRole('button', { name: /^Open week of/ })).toHaveLength(42)
    expect(location()).toContain('view=month')
  })

  it('changes and persists the theme from Settings', async () => {
    const { user } = renderDemo('/app/settings')
    const theme = within(await screen.findByRole('radiogroup', { name: 'Theme' }))
    await user.click(theme.getByRole('radio', { name: 'Day' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('lockin.theme')).toBe('light')
    await user.click(theme.getByRole('radio', { name: 'Night' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(theme.getByRole('radio', { name: 'Night' })).toBeChecked()
  })
})
