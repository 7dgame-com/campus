import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { usePermissions, type CampusPermission } from '../composables/usePermissions'
import { notifyHostPluginUrlChanged } from '../utils/hostEvents'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    requiresPermission?: CampusPermission
  }
}

export const shouldRegisterDiagnostics = (isProduction: boolean) => !isProduction
const developmentRoutes: RouteRecordRaw[] = []
if (!import.meta.env.PROD) {
  developmentRoutes.push({
    path: '/api-diagnostics',
    name: 'ApiDiagnostics',
    component: () => import('../views/ApiDiagnostics.vue'),
    meta: { title: 'API 诊断', public: true },
  })
}

export const appRoutes: RouteRecordRaw[] = [
    ...developmentRoutes,
    {
      path: '/',
      component: () => import('../layout/AppLayout.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('../views/DashboardView.vue'),
          meta: { title: '校园管理总览', requiresPermission: 'view-dashboard' },
        },
        {
          path: 'schools',
          name: 'Schools',
          component: () => import('../views/SchoolsView.vue'),
          meta: { title: '组织信息', requiresPermission: 'view-schools' },
        },
        {
          path: 'classes',
          name: 'Classes',
          component: () => import('../views/ClassesView.vue'),
          meta: { title: '班级管理', requiresPermission: 'view-classes' },
        },
        {
          path: 'students',
          name: 'Students',
          component: () => import('../views/StudentsView.vue'),
          meta: { title: '账号管理', requiresPermission: 'view-students' },
        },
        {
          path: 'tools',
          name: 'Tools',
          component: () => import('../views/ToolsView.vue'),
          meta: { title: '教学工具', requiresPermission: 'view-tools' },
        },
      ],
    },
  ]

const router = createRouter({
  history: createWebHistory(),
  routes: appRoutes,
})

export function permissionGuard(
  to: { meta: { public?: boolean; requiresPermission?: CampusPermission } },
  from: { name?: string | symbol | null | undefined },
): boolean {
  if (to.meta.public) return true

  const requiredPermission = to.meta.requiresPermission
  if (!requiredPermission) return true

  try {
    const { can } = usePermissions()
    if (can(requiredPermission)) return true
    if (!from.name) return true
    ElMessage.error('您没有权限访问此页面')
    return false
  } catch {
    if (!from.name) return true
    ElMessage.error('权限验证失败，请稍后重试')
    return false
  }
}

router.beforeEach(permissionGuard)

router.afterEach((to) => {
  notifyHostPluginUrlChanged(to.fullPath)
})

export default router
