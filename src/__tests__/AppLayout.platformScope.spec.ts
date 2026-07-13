import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { fetchPermissions, routerReplace } = vi.hoisted(() => ({
  fetchPermissions: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('../composables/useAuthSession', () => ({
  useAuthSession: () => ({
    user: { value: { username: 'root-user', nickname: '平台管理员' } },
  }),
}))

vi.mock('../composables/usePermissions', () => ({
  usePermissions: () => ({
    fetchPermissions,
    can: (permission: string) => permission === 'view-students',
    hasAny: () => true,
    loaded: { value: true },
    primaryRole: { value: 'root' },
    hasCampusAccess: { value: true },
    hasPlatformScope: { value: true, __v_isRef: true as const },
    isPublicPluginGroup: { value: true },
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: { requiresPermission: 'view-dashboard' } }),
  useRouter: () => ({ replace: routerReplace }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

import AppLayout from '../layout/AppLayout.vue'

describe('AppLayout platform scope', () => {
  it('renders root public-group access and redirects the initial route to accounts', async () => {
    fetchPermissions.mockResolvedValue(undefined)
    const wrapper = mount(AppLayout, {
      global: {
        mocks: {
          $route: { meta: { title: '校园管理总览' } },
          $t: (key: string) => key,
        },
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          RouterView: { template: '<div data-test="route-view" />' },
          ElEmpty: true,
          ElIcon: true,
          ElResult: true,
          ElTag: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('[data-test="route-view"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('permission.organizationRequiredTitle')
    expect(routerReplace).toHaveBeenCalledWith('/students')
  })
})
