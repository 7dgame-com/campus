import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listOrganizations, sessionState } = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  sessionState: {
    fetchSession: vi.fn(),
    isAuthenticated: { value: true },
    loaded: { value: true },
    loading: { value: false },
    user: { value: null as null | { roles?: string[]; organizations?: Array<{ id: number; title: string; name: string }> } },
  },
}))

vi.mock('../api', () => ({
  listOrganizations,
}))

vi.mock('../composables/useAuthSession', () => ({
  useAuthSession: () => ({
    fetchSession: sessionState.fetchSession,
    isAuthenticated: sessionState.isAuthenticated,
    loaded: sessionState.loaded,
    loading: sessionState.loading,
    user: sessionState.user,
  }),
}))

async function loadComposables() {
  vi.resetModules()
  const currentOrganization = await import('../composables/useCurrentOrganization')
  const hostPluginContext = await import('../composables/useHostPluginContext')
  return { ...currentOrganization, ...hostPluginContext }
}

describe('useCurrentOrganization', () => {
  beforeEach(() => {
    listOrganizations.mockReset()
    sessionState.fetchSession.mockReset()
    sessionState.isAuthenticated.value = true
    sessionState.loaded.value = true
    sessionState.loading.value = false
    sessionState.user.value = null
  })

  it('reloads the current organization when host organization context arrives later', async () => {
    listOrganizations.mockResolvedValue({
      data: {
        data: [{ id: 1, title: '测试大学', name: 'test' }],
      },
    })

    const { setHostPluginConfig, useCurrentOrganization } = await loadComposables()
    const currentOrganization = useCurrentOrganization()

    await currentOrganization.loadCurrentOrganization()

    expect(currentOrganization.organization.value).toBeNull()
    expect(currentOrganization.error.value).toBe('当前插件没有组织上下文')

    setHostPluginConfig({
      hostContext: {
        pluginId: 'campus',
        group: 'org:test',
      },
    })

    await vi.waitFor(() => {
      expect(currentOrganization.organizationTitle.value).toBe('测试大学')
    })
    expect(listOrganizations).toHaveBeenCalledWith('test')
  })

  it('does not resolve organization title groups as identity keys', async () => {
    listOrganizations
      .mockResolvedValueOnce({
        data: {
          data: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 1, title: '测试大学', name: 'test' }],
        },
      })

    const { setHostPluginConfig, useCurrentOrganization } = await loadComposables()
    setHostPluginConfig({
      hostContext: {
        pluginId: 'campus',
        group: 'org:测试大学',
      },
    })

    const currentOrganization = useCurrentOrganization()
    await currentOrganization.loadCurrentOrganization()

    expect(currentOrganization.organizationId.value).toBeNull()
    expect(currentOrganization.organizationTitle.value).toBe('测试大学')
    expect(listOrganizations).toHaveBeenNthCalledWith(1, '测试大学')
    expect(listOrganizations).toHaveBeenNthCalledWith(2)
  })
})
