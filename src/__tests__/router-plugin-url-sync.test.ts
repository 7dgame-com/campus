import { afterEach, describe, expect, it, vi } from 'vitest'

import router, { shouldRegisterDiagnostics } from '../router'

afterEach(async () => {
  vi.restoreAllMocks()
  await router.push('/dashboard')
})

describe('plugin URL sync', () => {
  it('does not register diagnostics in Production', () => {
    expect(shouldRegisterDiagnostics(true)).toBe(false)
  })

  it('sends plugin-url-changed events after route changes', async () => {
    const postMessage = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => undefined)

    await router.push('/api-diagnostics?debug=1#env')

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT',
        payload: {
          event: 'plugin-url-changed',
          pluginUrl: '/api-diagnostics?debug=1#env',
        },
      }),
      '*',
    )
  })
})
