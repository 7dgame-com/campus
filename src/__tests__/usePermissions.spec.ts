import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchSession, hostContextState, sessionState } = vi.hoisted(() => ({
  fetchSession: vi.fn(),
  hostContextState: {
    configLoaded: { value: true },
    hasExplicitGroup: { value: true },
    hasOrganizationGroup: { value: true },
    isPublicPluginGroup: { value: false },
    currentOrganizationId: { value: null as number | null },
    currentOrganizationName: { value: 'school-first-lab' },
  },
  sessionState: {
    loaded: { value: false },
    loading: { value: false },
    user: { value: null as null | { roles?: string[]; organizations?: Array<{ id: number; title: string; name: string }> } },
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

vi.mock('../composables/useHostPluginContext', () => ({
  useHostPluginContext: () => hostContextState,
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
    hostContextState.configLoaded.value = true
    hostContextState.hasExplicitGroup.value = true
    hostContextState.hasOrganizationGroup.value = true
    hostContextState.isPublicPluginGroup.value = false
    hostContextState.currentOrganizationId.value = null
    hostContextState.currentOrganizationName.value = 'school-first-lab'
  })

  it('allows school management for admin sessions in the same organization', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = {
      roles: ['user', 'admin'],
      organizations: [{ id: 7, title: '第一实验学校', name: 'school-first-lab' }],
    }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(fetchSession).toHaveBeenCalledTimes(1)
    expect(permissions.hasAny()).toBe(true)
    expect(permissions.belongsToCurrentOrganization.value).toBe(true)
    expect(permissions.isCampusAdmin.value).toBe(true)
    expect(permissions.primaryRole.value).toBe('admin')
    expect(permissions.can('view-schools')).toBe(true)
    expect(permissions.can('manage-student-accounts')).toBe(true)
    expect(permissions.can('manage-global-tools')).toBe(false)
  })

  it('allows organization admins when the host organization id matches', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = {
      roles: ['user', 'admin'],
      organizations: [{ id: 7, title: '第一实验学校', name: 'school-first-lab' }],
    }
    sessionState.isAuthenticated.value = true
    hostContextState.currentOrganizationId.value = 7
    hostContextState.currentOrganizationName.value = '第一实验学校'

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.belongsToCurrentOrganization.value).toBe(true)
    expect(permissions.isCampusAdmin.value).toBe(true)
    expect(permissions.hasAny()).toBe(true)
  })

  it('allows root global plugin management', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = { roles: ['user', 'manager', 'root'] }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.primaryRole.value).toBe('root')
    expect(permissions.belongsToCurrentOrganization.value).toBe(false)
    expect(permissions.isCampusAdmin.value).toBe(true)
    expect(permissions.can('manage-global-tools')).toBe(true)
    expect(permissions.can('manage-school-boundaries')).toBe(true)
  })

  it('treats manager sessions in the same organization as campus admins', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = {
      roles: ['user', 'manager'],
      organizations: [{ id: 7, title: '第一实验学校', name: 'school-first-lab' }],
    }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.primaryRole.value).toBe('manager')
    expect(permissions.belongsToCurrentOrganization.value).toBe(true)
    expect(permissions.isCampusAdmin.value).toBe(true)
    expect(permissions.can('view-classes')).toBe(false)
    expect(permissions.can('view-students')).toBe(true)
    expect(permissions.can('view-schools')).toBe(true)
    expect(permissions.can('manage-student-accounts')).toBe(true)
    expect(permissions.can('manage-global-tools')).toBe(false)
  })

  it('denies admin and manager sessions from a different organization', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = {
      roles: ['admin', 'manager'],
      organizations: [{ id: 9, title: '第二实验学校', name: 'school-second-lab' }],
    }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.hasOrganizationContext.value).toBe(true)
    expect(permissions.belongsToCurrentOrganization.value).toBe(false)
    expect(permissions.isCampusAdmin.value).toBe(false)
    expect(permissions.hasCampusAccess.value).toBe(false)
    expect(permissions.hasAny()).toBe(false)
  })

  it('does not treat organization titles as organization identity keys', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = {
      roles: ['admin'],
      organizations: [{ id: 7, title: '第一实验学校', name: 'school-first-lab' }],
    }
    sessionState.isAuthenticated.value = true
    hostContextState.currentOrganizationId.value = null
    hostContextState.currentOrganizationName.value = '第一实验学校'

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.belongsToCurrentOrganization.value).toBe(false)
    expect(permissions.isCampusAdmin.value).toBe(false)
    expect(permissions.hasAny()).toBe(false)
  })

  it('keeps organization name matching strict when no organization id is available', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = {
      roles: ['admin'],
      organizations: [{ id: 7, title: '第一实验学校', name: 'School-First-Lab' }],
    }
    sessionState.isAuthenticated.value = true
    hostContextState.currentOrganizationId.value = null
    hostContextState.currentOrganizationName.value = 'school-first-lab'

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.belongsToCurrentOrganization.value).toBe(false)
    expect(permissions.isCampusAdmin.value).toBe(false)
    expect(permissions.hasAny()).toBe(false)
  })

  it('denies student-only sessions from the campus plugin', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = { roles: ['user'] }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.primaryRole.value).toBe('user')
    expect(permissions.hasCampusAccess.value).toBe(false)
    expect(permissions.hasAny()).toBe(false)
    expect(permissions.can('view-dashboard')).toBe(false)
    expect(permissions.can('view-tools')).toBe(false)
    expect(permissions.can('view-students')).toBe(false)
    expect(permissions.can('manage-global-tools')).toBe(false)
  })

  it('locks all campus functions when opened from the public plugin group', async () => {
    sessionState.loaded.value = true
    sessionState.user.value = {
      roles: ['root', 'admin', 'manager'],
      organizations: [{ id: 7, title: '第一实验学校', name: 'school-first-lab' }],
    }
    sessionState.isAuthenticated.value = true
    hostContextState.hasOrganizationGroup.value = false
    hostContextState.isPublicPluginGroup.value = true
    hostContextState.currentOrganizationName.value = ''

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    await permissions.fetchPermissions()

    expect(permissions.hasOrganizationContext.value).toBe(false)
    expect(permissions.isCampusAdmin.value).toBe(false)
    expect(permissions.hasCampusAccess.value).toBe(false)
    expect(permissions.hasAny()).toBe(false)
    expect(permissions.can('view-dashboard')).toBe(false)
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

  it('does not grant permissions before the session is verified', async () => {
    sessionState.loaded.value = false
    sessionState.user.value = { roles: ['root'] }
    sessionState.isAuthenticated.value = true

    const { usePermissions } = await loadComposable()
    const permissions = usePermissions()

    expect(permissions.primaryRole.value).toBe('root')
    expect(permissions.hasCampusAccess.value).toBe(false)
    expect(permissions.can('manage-global-tools')).toBe(false)
    expect(permissions.hasAny()).toBe(false)
  })
})
