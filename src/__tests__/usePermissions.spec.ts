import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchSession, sessionState } = vi.hoisted(() => ({
  fetchSession: vi.fn(),
  sessionState: {
    loaded: { value: false },
    loading: { value: false },
    user: { value: null as null | { roles?: string[] } },
    isAuthenticated: { value: false },
  },
}))

vi.mock('../composables/useAuthSession', () => ({
  useAuthSession: () => ({
    user: sessionState.user,
    loaded: sessionState.loaded,
    loading: sessionState.loading,
    isAuthenticated: sessionState.isAuthenticated,
    fetchSession,
  }),
}))

async function loadComposable() {
  vi.resetModules()
  return import('../composables/usePermissions')
}

describe('usePermissions', () => {
  beforeEach(() => {
    fetchSession.mockReset()
    sessionState.loaded.value = false
    sessionState.loading.value = false
    sessionState.user.value = null
    sessionState.isAuthenticated.value = false
  })

  it('allows school management for admin sessions', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = { roles: ['user', 'admin'] }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(fetchSession).toHaveBeenCalledTimes(1)
    expect(permissions.hasAny()).toBe(true)
    expect(permissions.primaryRole.value).toBe('admin')
    expect(permissions.can('view-schools')).toBe(true)
    expect(permissions.can('manage-student-accounts')).toBe(true)
    expect(permissions.can('manage-global-tools')).toBe(false)
  })

  it('allows root global plugin management', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = { roles: ['user', 'manager', 'root'] }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.primaryRole.value).toBe('root')
    expect(permissions.can('manage-global-tools')).toBe(true)
    expect(permissions.can('manage-school-boundaries')).toBe(true)
  })

  it('allows teacher interfaces for manager sessions without school setup actions', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = { roles: ['user', 'manager'] }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.primaryRole.value).toBe('manager')
    expect(permissions.can('view-classes')).toBe(true)
    expect(permissions.can('view-students')).toBe(true)
    expect(permissions.can('view-schools')).toBe(false)
    expect(permissions.can('manage-student-accounts')).toBe(false)
  })

  it('keeps student sessions on overview and teaching tools only', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = { roles: ['user'] }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.primaryRole.value).toBe('user')
    expect(permissions.hasAny()).toBe(true)
    expect(permissions.can('view-dashboard')).toBe(true)
    expect(permissions.can('view-tools')).toBe(true)
    expect(permissions.can('view-students')).toBe(false)
    expect(permissions.can('manage-global-tools')).toBe(false)
  })

  it('denies authenticated sessions without a platform role', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = { roles: ['auditor'] }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.primaryRole.value).toBe('guest')
    expect(permissions.hasAny()).toBe(false)
  })
})
