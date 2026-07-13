import { computed, readonly } from 'vue'
import { useAuthSession } from './useAuthSession'
import { useHostPluginContext } from './useHostPluginContext'

export type CampusPermission =
  | 'view-dashboard'
  | 'view-schools'
  | 'view-classes'
  | 'view-students'
  | 'view-tools'
  | 'manage-school-boundaries'
  | 'manage-classes'
  | 'manage-student-accounts'
  | 'manage-global-tools'

export type Permissions = Record<CampusPermission, boolean>
export type CampusRole = 'root' | 'admin' | 'manager' | 'user' | 'guest'

type CampusOrganization = {
  id?: number
  title?: string
  name?: string
}

const ROLE_PRIORITY: Record<CampusRole, number> = {
  root: 4,
  admin: 3,
  manager: 2,
  user: 1,
  guest: 0,
}

function resolvePrimaryRole(roles: readonly string[]): CampusRole {
  return roles.reduce<CampusRole>((highest, role) => {
    const normalized = role as CampusRole
    return (ROLE_PRIORITY[normalized] ?? 0) > ROLE_PRIORITY[highest] ? normalized : highest
  }, 'guest')
}

function normalizeOrganizationKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeOrganizationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (/^[1-9]\d*$/.test(normalized)) {
      return Number(normalized)
    }
  }

  return null
}

function belongsToOrganization(
  organizations: readonly CampusOrganization[],
  organizationId: unknown,
  organizationName: string,
): boolean {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId)
  const hasComparableOrganizationIds = organizations.some((organization) =>
    normalizeOrganizationId(organization.id) !== null
  )

  if (normalizedOrganizationId !== null && hasComparableOrganizationIds) {
    return organizations.some((organization) =>
      normalizeOrganizationId(organization.id) === normalizedOrganizationId
    )
  }

  const normalizedOrganizationName = normalizeOrganizationKey(organizationName)
  if (normalizedOrganizationName === '') {
    return false
  }

  return organizations.some((organization) => {
    const name = normalizeOrganizationKey(organization.name)
    return name === normalizedOrganizationName
  })
}

export function usePermissions() {
  const { user, loaded, loading, isAuthenticated, fetchSession } = useAuthSession()
  const {
    configLoaded,
    hasExplicitGroup,
    hasOrganizationGroup,
    isPublicPluginGroup,
    currentOrganizationId,
    currentOrganizationName,
    currentOrganizationTitle,
  } = useHostPluginContext()

  const roles = computed(() => user.value?.roles ?? [])
  const organizations = computed(() => user.value?.organizations ?? [])
  const primaryRole = computed<CampusRole>(() => resolvePrimaryRole(roles.value))
  const isRoot = computed(() => roles.value.includes('root'))
  const isAdmin = computed(() => roles.value.includes('admin'))
  const isManager = computed(() => roles.value.includes('manager'))
  const isStudent = computed(() => roles.value.includes('user') && !isRoot.value && !isAdmin.value && !isManager.value)
  const hasVerifiedSession = computed(() => loaded.value && isAuthenticated.value)
  const hasOrganizationContext = computed(() => {
    if (!configLoaded.value) return false
    if (currentOrganizationId.value !== null) return true
    if (isPublicPluginGroup.value) return false
    if (hasOrganizationGroup.value) return true
    if (hasExplicitGroup.value) return false

    return isRoot.value || organizations.value.length > 0
  })
  const hasPlatformScope = computed(() =>
    configLoaded.value
    && hasVerifiedSession.value
    && isRoot.value
    && currentOrganizationId.value === null
    && normalizeOrganizationKey(currentOrganizationName.value) === ''
  )
  const belongsToCurrentOrganization = computed(() =>
    belongsToOrganization(organizations.value, currentOrganizationId.value, currentOrganizationName.value)
  )
  const isCampusAdmin = computed(() => {
    if (!hasVerifiedSession.value || !hasOrganizationContext.value) return false
    if (isRoot.value) return true
    return (isAdmin.value || isManager.value) && belongsToCurrentOrganization.value
  })
  const hasSchoolManagement = computed(() => isCampusAdmin.value)
  const hasTeachingManagement = computed(() => isCampusAdmin.value)
  const hasCampusAccess = computed(() => isCampusAdmin.value || hasPlatformScope.value)

  const permissions = computed<Permissions>(() => ({
    'view-dashboard': isCampusAdmin.value,
    'view-schools': hasSchoolManagement.value,
    'view-classes': false,
    'view-students': hasTeachingManagement.value || hasPlatformScope.value,
    'view-tools': isCampusAdmin.value,
    'manage-school-boundaries': hasSchoolManagement.value,
    'manage-classes': false,
    'manage-student-accounts': hasSchoolManagement.value || hasPlatformScope.value,
    'manage-global-tools': isCampusAdmin.value && isRoot.value,
  }))

  async function fetchPermissions(force = false) {
    await fetchSession(force)
  }

  function can(action: CampusPermission): boolean {
    return permissions.value[action]
  }

  function hasAny(): boolean {
    return Object.values(permissions.value).some(Boolean)
  }

  return {
    user: readonly(user),
    permissions: readonly(permissions),
    loaded: readonly(loaded),
    loading: readonly(loading),
    isRoot,
    isAdmin,
    isManager,
    isStudent,
    primaryRole,
    hasOrganizationContext,
    hasPlatformScope,
    currentOrganizationId,
    currentOrganizationName,
    currentOrganizationTitle,
    belongsToCurrentOrganization,
    isCampusAdmin,
    isPublicPluginGroup,
    hasCampusAccess,
    fetchPermissions,
    can,
    hasAny,
  }
}
