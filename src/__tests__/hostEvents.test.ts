import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyHostPluginUrlChanged } from '../utils/hostEvents'

describe('hostEvents', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts plugin-url-changed events to the host', () => {
    const postMessage = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined)

    notifyHostPluginUrlChanged('/dashboard?tab=detail#top')

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT',
        payload: {
          event: 'plugin-url-changed',
          pluginUrl: '/dashboard?tab=detail#top',
        },
      }),
      '*',
    )
  })

  it('generates unique ids for multiple host events in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890)
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.123456789)
      .mockReturnValueOnce(0.987654321)
    const postMessage = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined)

    notifyHostPluginUrlChanged('/dashboard')
    notifyHostPluginUrlChanged('/dashboard?tab=detail')

    const firstMessage = postMessage.mock.calls[0]?.[0] as { id?: string }
    const secondMessage = postMessage.mock.calls[1]?.[0] as { id?: string }

    expect(firstMessage.id).toBeTruthy()
    expect(secondMessage.id).toBeTruthy()
    expect(firstMessage.id).not.toBe(secondMessage.id)
  })
})
