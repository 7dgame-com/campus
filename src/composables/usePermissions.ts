import { computed, readonly } from 'vue'
import { useAuthSession } from './useAuthSession'

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

export function usePermissions() {
  const { user, loaded, loading, isAuthenticated, fetchSession } = useAuthSession()

  const roles = computed(() => user.value?.roles ?? [])
  const primaryRole = computed<CampusRole>(() => resolvePrimaryRole(roles.value))
  const isRoot = computed(() => roles.value.includes('root'))
  const isAdmin = computed(() => roles.value.includes('admin'))
  const isManager = computed(() => roles.value.includes('manager'))
  const isStudent = computed(() => roles.value.includes('user') && !isRoot.value && !isAdmin.value && !isManager.value)
  const hasVerifiedSession = computed(() => loaded.value && isAuthenticated.value)
  const hasSchoolManagement = computed(() => hasVerifiedSession.value && (isRoot.value || isAdmin.value))
  const hasTeachingManagement = computed(() => hasVerifiedSession.value && (isRoot.value || isAdmin.value || isManager.value))
  const hasCampusAccess = computed(() => hasTeachingManagement.value)

  const permissions = computed<Permissions>(() => ({
    'view-dashboard': hasCampusAccess.value,
    'view-schools': hasSchoolManagement.value,
    'view-classes': hasTeachingManagement.value,
    'view-students': hasTeachingManagement.value,
    'view-tools': hasCampusAccess.value,
    'manage-school-boundaries': hasSchoolManagement.value,
    'manage-classes': hasTeachingManagement.value,
    'manage-student-accounts': hasSchoolManagement.value,
    'manage-global-tools': hasVerifiedSession.value && isRoot.value,
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
    hasCampusAccess,
    fetchPermissions,
    can,
    hasAny,
  }
}
