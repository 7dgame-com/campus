import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginAuditDialog from '../components/LoginAuditDialog.vue'

const { getCampusUserLoginAudit, messageError, messageWarning } = vi.hoisted(() => ({
  getCampusUserLoginAudit: vi.fn(),
  messageError: vi.fn(),
  messageWarning: vi.fn(),
}))

vi.mock('../api', () => ({
  getCampusUserLoginAudit: (...args: unknown[]) => getCampusUserLoginAudit(...args),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: (...args: unknown[]) => messageError(...args),
    warning: (...args: unknown[]) => messageWarning(...args),
  },
}))

const user = {
  id: 24,
  username: 'alice',
  roles: ['user'],
  organizations: [{ id: 7, name: 'school', title: '示例学校' }],
}

function mountDialog(organizationId: number | null = 7, allowPlatformScope = false) {
  return mount(LoginAuditDialog, {
    props: { organizationId, allowPlatformScope },
    global: {
      directives: {
        loading: () => undefined,
      },
      stubs: {
        ElDialog: {
          props: ['title'],
          template: '<section><h2>{{ title }}</h2><slot /></section>',
        },
        ElEmpty: {
          props: ['description'],
          template: '<div>{{ description }}</div>',
        },
        ElTable: { template: '<div><slot /></div>' },
        ElTableColumn: true,
        ElTag: { template: '<span><slot /></span>' },
      },
    },
  })
}

describe('LoginAuditDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and displays the selected organization account login summary', async () => {
    getCampusUserLoginAudit.mockResolvedValue({
      data: {
        code: 0,
        data: {
          stats: {
            legacyUserId: 24,
            identityUserId: null,
            username: 'alice',
            loginCount: 5,
            failedLoginCount: 1,
            lastLoginAt: '2026-07-13T08:00:00.000Z',
            lastFailedLoginAt: null,
            updatedAt: '2026-07-13T08:00:00.000Z',
          },
          recentEvents: [],
        },
      },
    })
    const wrapper = mountDialog()

    await (wrapper.vm as unknown as { open: (account: typeof user) => Promise<void> }).open(user)

    expect(getCampusUserLoginAudit).toHaveBeenCalledWith(24, 7)
    expect(wrapper.text()).toContain('登录记录 - alice')
    expect(wrapper.text()).toContain('成功登录5')
    expect(wrapper.text()).toContain('失败登录1')
  })

  it('does not request records before the organization context is ready', async () => {
    const wrapper = mountDialog(null)

    await (wrapper.vm as unknown as { open: (account: typeof user) => Promise<void> }).open(user)

    expect(getCampusUserLoginAudit).not.toHaveBeenCalled()
    expect(messageWarning).toHaveBeenCalledWith('当前组织尚未加载完成')
  })

  it('loads platform-wide records for root when no organization context exists', async () => {
    getCampusUserLoginAudit.mockResolvedValue({
      data: {
        code: 0,
        data: { stats: null, recentEvents: [] },
      },
    })
    const wrapper = mountDialog(null, true)

    await (wrapper.vm as unknown as { open: (account: typeof user) => Promise<void> }).open(user)

    expect(getCampusUserLoginAudit).toHaveBeenCalledWith(24, null)
    expect(messageWarning).not.toHaveBeenCalled()
  })

  it('shows the empty state when the account has no login records', async () => {
    getCampusUserLoginAudit.mockResolvedValue({
      data: {
        code: 0,
        data: { stats: null, recentEvents: [] },
      },
    })
    const wrapper = mountDialog()

    await (wrapper.vm as unknown as { open: (account: typeof user) => Promise<void> }).open(user)

    expect(wrapper.text()).toContain('暂无登录记录')
  })

  it('localizes the disabled audit response', async () => {
    getCampusUserLoginAudit.mockRejectedValue({
      response: {
        data: {
          code: 'LOGIN_AUDIT_DISABLED',
          message: 'Login audit is disabled.',
        },
      },
    })
    const wrapper = mountDialog()

    await (wrapper.vm as unknown as { open: (account: typeof user) => Promise<void> }).open(user)

    expect(messageError).toHaveBeenCalledWith('登录记录功能尚未启用')
  })

  it('clears the prior account data before showing a generic request failure', async () => {
    getCampusUserLoginAudit
      .mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            stats: {
              legacyUserId: 24,
              identityUserId: null,
              username: 'alice',
              loginCount: 5,
              failedLoginCount: 1,
              lastLoginAt: null,
              lastFailedLoginAt: null,
              updatedAt: null,
            },
            recentEvents: [],
          },
        },
      })
      .mockRejectedValueOnce(new Error('network failed'))
    const wrapper = mountDialog()
    const dialog = wrapper.vm as unknown as { open: (account: typeof user) => Promise<void> }

    await dialog.open(user)
    await dialog.open({ ...user, id: 25, username: 'bob' })

    expect(wrapper.text()).toContain('登录记录 - bob')
    expect(wrapper.text()).not.toContain('成功登录5')
    expect(messageError).toHaveBeenCalledWith('登录记录加载失败')
  })

  it('closes and invalidates an in-flight record when the statistics scope changes', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined
    getCampusUserLoginAudit.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve
    }))
    const wrapper = mountDialog()
    const dialog = wrapper.vm as unknown as { open: (account: typeof user) => Promise<void> }

    const request = dialog.open(user)
    await wrapper.setProps({ organizationId: 8 })
    resolveRequest?.({
      data: {
        code: 0,
        data: {
          stats: {
            legacyUserId: 24,
            identityUserId: null,
            username: 'alice',
            loginCount: 5,
            failedLoginCount: 1,
            lastLoginAt: null,
            lastFailedLoginAt: null,
            updatedAt: null,
          },
          recentEvents: [],
        },
      },
    })
    await request
    await flushPromises()

    expect(wrapper.text()).toContain('登录记录')
    expect(wrapper.text()).not.toContain('alice')
    expect(wrapper.text()).not.toContain('成功登录5')
  })
})
