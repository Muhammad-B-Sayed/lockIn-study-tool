import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTasks, persistSession, signup } from './api'
import type { AuthSession } from './types'

const fetchMock = vi.fn()

describe('api auth headers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('sends the bearer token for protected requests', async () => {
    const session: AuthSession = {
      accessToken: 'token-123',
      tokenType: 'Bearer',
      expiresAt: null,
      user: {
        id: 'user-1',
        username: 'muhammad',
        createdAt: null,
      },
    }

    persistSession(session)

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await getTasks()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/tasks',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    )
  })

  it('does not send the bearer token for signup requests', async () => {
    const session: AuthSession = {
      accessToken: 'stale-token',
      tokenType: 'Bearer',
      expiresAt: null,
      user: {
        id: 'user-1',
        username: 'muhammad',
        createdAt: null,
      },
    }

    persistSession(session)

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'fresh-token',
          tokenType: 'Bearer',
          expiresAt: null,
          user: {
            id: 'user-2',
            username: 'new-user',
            createdAt: null,
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    await signup({
      username: 'new-user',
      password: 'secret123',
      repeatPassword: 'secret123',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/signup',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    )
  })
})
