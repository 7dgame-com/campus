import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginRecordsView from '../views/LoginRecordsView.vue'
import { beijingDateInterval, formatBeijingLoginTime, recentBeijingDates } from '../utils/loginRecordDates'

const mocks = vi.hoisted(() => ({
  list: vi.fn(), loadOrganization: vi.fn(),
  context: { id: 7 as number | null, name: 'school', title: '测试学校', error: '', allowed: true },
}))
vi.mock('../api', () => ({ listOrganizationLoginEvents: (...args: unknown[]) => mocks.list(...args) }))
vi.mock('../composables/useCurrentOrganization', async () => {
  const { reactive, toRef } = await import('vue')
  mocks.context = reactive(mocks.context)
  return { useCurrentOrganization: () => ({
    organizationId: toRef(mocks.context, 'id'), organizationName: toRef(mocks.context, 'name'),
    organizationTitle: toRef(mocks.context, 'title'), error: toRef(mocks.context, 'error'),
    loadCurrentOrganization: mocks.loadOrganization,
  }) }
})
vi.mock('../composables/usePermissions', () => ({ usePermissions: () => ({ can: () => mocks.context.allowed }) }))

const result = (username = 'alice', total = 24) => ({ data: {
  code: 0, data: [{ eventKey: `event-${username}`, userId: 2, username, nickname: '同学', primaryRole: 'user', occurredAt: '2026-09-26T01:00:00Z', source: 'identity-adapter' }],
  pagination: { total, page: 1, pageSize: 20, totalPages: 2 },
} })
let wrapper: VueWrapper
function render() {
  wrapper = mount(LoginRecordsView, { global: {
    directives: { loading: () => undefined },
    stubs: {
      ElConfigProvider: { template: '<div><slot /></div>' },
      ElButton: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
      ElTag: { template: '<span><slot /></span>' },
      ElAlert: { props: ['title'], template: '<div>{{ title }}</div>' },
      ElEmpty: { props: ['description'], template: '<div>{{ description }}</div>' },
      ElTable: { props: ['data', 'emptyText'], template: '<div>{{ data.length ? JSON.stringify(data) : emptyText }}</div>' },
      ElTableColumn: true, ElPagination: true, ElInput: true, ElSelect: true, ElOption: true, ElDatePicker: true,
    },
  } })
  return wrapper
}
async function click(label: string) {
  await wrapper.findAll('button').find((button) => button.text() === label)!.trigger('click')
  await flushPromises()
}

describe('organization login records page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mocks.context, { id: 7, name: 'school', title: '测试学校', error: '', allowed: true })
    mocks.list.mockResolvedValue(result())
  })
  afterEach(() => wrapper?.unmount())

  it('loads the current organization and default Beijing range', async () => {
    render()
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledWith({ organization_id: 7, ...beijingDateInterval(recentBeijingDates(7)), search: undefined, role: undefined, page: 1, pageSize: 20 })
    expect(wrapper.text()).toContain('alice')
    expect(wrapper.text()).toContain('北京时间')
    expect(wrapper.findComponent({ name: 'ElPagination' }).attributes('total')).toBe('24')
  })

  it('clears old results when filters change and applies search, role and dates on query', async () => {
    render(); await flushPromises()
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2)
    await flushPromises()
    wrapper.findComponent({ name: 'ElInput' }).vm.$emit('update:modelValue', ' 张同学 ')
    wrapper.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'user')
    wrapper.findComponent({ name: 'ElDatePicker' }).vm.$emit('update:modelValue', ['2026-09-25', '2026-09-26'])
    await flushPromises()
    expect(wrapper.text()).not.toContain('alice')
    expect(wrapper.text()).toContain('筛选条件已更改')
    await click('查询')
    expect(mocks.list).toHaveBeenLastCalledWith({ organization_id: 7, search: '张同学', role: 'user', page: 1, pageSize: 20, start_at: '2026-09-24T16:00:00.000Z', end_at: '2026-09-26T16:00:00.000Z' })
  })

  it('supports pagination, page size, refresh and reset', async () => {
    render(); await flushPromises()
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2)
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 20 }))
    await click('刷新')
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('size-change', 50)
    await flushPromises()
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 50 }))
    await click('重置')
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 20, search: undefined, role: undefined }))
  })

  it.each([null, 'denied'])('does not query without scope or permission (%s)', async (reason) => {
    if (reason === null) mocks.context.id = null
    else mocks.context.allowed = false
    render(); await flushPromises()
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('ignores stale responses after switching organization', async () => {
    let resolveOld!: (value: ReturnType<typeof result>) => void
    mocks.list.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    render()
    mocks.list.mockResolvedValue(result('bob'))
    mocks.context.id = 8
    await flushPromises()
    resolveOld(result('alice'))
    await flushPromises()
    expect(wrapper.text()).toContain('bob')
    expect(wrapper.text()).not.toContain('alice')
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ organization_id: 8, page: 1 }))
  })

  it('ignores stale failures after editing filters and clears results on lost permission', async () => {
    let rejectOld!: (error: unknown) => void
    mocks.list.mockReturnValueOnce(new Promise((_, reject) => { rejectOld = reject }))
    render()
    wrapper.findComponent({ name: 'ElInput' }).vm.$emit('update:modelValue', 'bob')
    rejectOld(new Error('old failure'))
    await flushPromises()
    expect(wrapper.text()).not.toContain('加载失败')
    await click('查询')
    mocks.context.allowed = false
    await flushPromises()
    expect(wrapper.text()).not.toContain('alice')
  })

  it.each([
    ['LOGIN_AUDIT_DISABLED', '登录记录功能尚未启用'],
    ['PLUGIN_USER_READONLY_DISABLED', '登录流水查询服务尚未启用'],
    ['UNKNOWN', '登录流水加载失败'],
  ])('shows %s distinctly from empty results and retries', async (code, message) => {
    mocks.list.mockRejectedValueOnce({ response: { data: { code } } })
    render(); await flushPromises()
    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).not.toContain('暂无成功登录记录')
    await click('重试')
    expect(wrapper.text()).toContain('alice')
  })

  it('shows empty results and rejects an invalid date interval', async () => {
    mocks.list.mockResolvedValue({ data: { data: [], pagination: { total: 0 } } })
    render(); await flushPromises()
    expect(wrapper.text()).toContain('所选条件下暂无成功登录记录')
    wrapper.findComponent({ name: 'ElDatePicker' }).vm.$emit('update:modelValue', ['2026-09-27', '2026-09-26'])
    await click('查询')
    expect(wrapper.text()).toContain('请选择有效的日期范围')
    expect(mocks.list).toHaveBeenCalledTimes(1)
  })
})

describe('Beijing calendar dates', () => {
  it('uses the Beijing day across UTC midnight and month boundaries', () => {
    const now = new Date('2026-09-30T17:30:00Z')
    expect(recentBeijingDates(1, now)).toEqual(['2026-10-01', '2026-10-01'])
    expect(recentBeijingDates(7, now)).toEqual(['2026-09-25', '2026-10-01'])
    expect(recentBeijingDates(30, now)).toEqual(['2026-09-02', '2026-10-01'])
    expect(formatBeijingLoginTime('2026-09-30T16:00:00Z')).toBe('2026/10/01 00:00:00')
  })
  it('includes the whole selected end day with an exclusive boundary', () => {
    expect(beijingDateInterval(['2026-09-26', '2026-09-26'])).toEqual({ start_at: '2026-09-25T16:00:00.000Z', end_at: '2026-09-26T16:00:00.000Z' })
  })
  it.each([null, [], ['2026-02-30', '2026-03-01'], ['bad', '2026-03-01']])('rejects invalid dates %j', (range) => {
    expect(beijingDateInterval(range)).toBeNull()
  })
})
