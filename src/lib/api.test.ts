import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, isRetryable, parseApiError, rpc } from './api'

describe('parseApiError', () => {
  it('maps P0001 messages to codes', () => {
    const e = parseApiError(400, { code: 'P0001', message: 'username_taken' })
    expect(e).toBeInstanceOf(ApiError)
    expect(e.code).toBe('username_taken')
    expect(e.status).toBe(400)
    for (const c of ['unauthorized', 'not_found', 'forbidden', 'body_invalid', 'self_chat', 'theme_invalid', 'rate_limited', 'gender_invalid', 'username_invalid']) {
      expect(parseApiError(400, { code: 'P0001', message: c }).code).toBe(c)
    }
  })
  it('maps unknown errors to server', () => {
    expect(parseApiError(404, { code: 'PGRST202', message: 'Could not find the function' }).code).toBe('server')
    expect(parseApiError(500, null).code).toBe('server')
    expect(parseApiError(429, {}).code).toBe('rate_limited')
  })
  it('classifies retryable errors', () => {
    expect(isRetryable(new ApiError('network'))).toBe(true)
    expect(isRetryable(new ApiError('server', 503))).toBe(true)
    expect(isRetryable(new ApiError('server', 404))).toBe(false)
    expect(isRetryable(new ApiError('body_invalid', 400))).toBe(false)
  })
})

describe('rpc', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts to PostgREST with key headers', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ at: 'x' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await api.read('tok', 'conv')
    expect(r).toEqual({ at: 'x' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/rest\/v1\/rpc\/gat_read$/)
    const h = init.headers as Record<string, string>
    expect(h.apikey).toBeTruthy()
    expect(h.Authorization).toBe(`Bearer ${h.apikey}`)
    expect(JSON.parse(init.body as string)).toEqual({ p_token: 'tok', p_conversation: 'conv' })
  })

  it('throws ApiError with the P0001 code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'P0001', message: 'unauthorized' }), { status: 400 })))
    await expect(api.me('bad')).rejects.toMatchObject({ code: 'unauthorized', status: 400 })
  })

  it('maps fetch failures to network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(rpc('gat_me', {})).rejects.toMatchObject({ code: 'network' })
  })

  it('handles empty bodies (void RPCs)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(api.heartbeat('t', null, true)).resolves.toBeNull()
  })
})
