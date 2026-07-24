import { flushPromises, shallowMount } from '@vue/test-utils'
import { nextTick, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentsView from '../views/StudentsView.vue'

const mocks = vi.hoisted(() => {
  const refLike = <T>(value: T) => ({ value, __v_isRef: true as const })
  return {
    organizationId: refLike<number | null>(7),
    organizationName: refLike('school'),
    organizationTitle: refLike('示例学校'),
    organizationError: refLike(''),
    hasPlatformScope: refLike(false),
    canManageAccounts: true,
    loadCurrentOrganization: vi.fn(),
    listCampusManagedUsers: vi.fn(),
    listUsers: vi.fn(),
    routeQuery: {} as Record<string, string>,
    routerPush: vi.fn(),
    routerReplace: vi.fn(),
  }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
  useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace }),
}))

vi.mock('../composables/useCurrentOrganization', () => ({
  useCurrentOrganization: () => ({
    organizationName: mocks.organizationName,
    organizationId: mocks.organizationId,
    organizationTitle: mocks.organizationTitle,
    error: mocks.organizationError,
    loadCurrentOrganization: mocks.loadCurrentOrganization,
  }),
}))

vi.mock('../composables/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => permission === 'manage-student-accounts' && mocks.canManageAccounts,
    hasPlatformScope: mocks.hasPlatformScope,
  }),
}))

vi.mock('../api', () => ({
  clearCampusContent: vi.fn(),
  importCampusSceneZip: vi.fn(),
  listCampusManagedUsers: (...args: unknown[]) => mocks.listCampusManagedUsers(...args),
  listUsers: (...args: unknown[]) => mocks.listUsers(...args),
  previewCampusClearContent: vi.fn(),
  updateCampusUserPassword: vi.fn(),
  uploadCampusResource: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  ElMessageBox: {
    confirm: vi.fn(),
  },
}))

const emptyPage = {
  data: {
    data: [],
    pagination: { total: 0, page: 1, pageSize: 20 },
  },
}

function mountView() {
  return shallowMount(StudentsView, {
    global: {
      directives: {
        loading: () => undefined,
      },
      stubs: {
        ElAlert: true,
        ElButton: true,
        ElDialog: true,
        ElForm: true,
        ElFormItem: true,
        ElIcon: true,
        ElInput: {
          name: 'ElInput',
          props: ['modelValue'],
          emits: ['update:modelValue', 'clear', 'keyup'],
          template: '<input />',
        },
        ElPagination: {
          name: 'ElPagination',
          props: ['currentPage', 'pageSize', 'total'],
          emits: ['update:currentPage', 'update:pageSize', 'current-change', 'size-change'],
          template: '<div class="pagination-stub" />',
        },
        ElProgress: true,
        ElSkeleton: true,
        ElTable: {
          props: ['data'],
          template: '<div class="table-data">{{ JSON.stringify(data) }}<slot /></div>',
        },
        ElTableColumn: true,
        ElTag: { template: '<span><slot /></span>' },
        ElUpload: true,
        LoginAuditDialog: true,
      },
    },
  })
}

describe('StudentsView automatic statistics scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.organizationId = ref(7)
    mocks.organizationName = ref('school')
    mocks.organizationTitle = ref('示例学校')
    mocks.organizationError = ref('')
    mocks.hasPlatformScope = ref(false)
    mocks.canManageAccounts = true
    mocks.loadCurrentOrganization.mockResolvedValue(undefined)
    mocks.listCampusManagedUsers.mockResolvedValue(emptyPage)
    mocks.listUsers.mockResolvedValue(emptyPage)
    mocks.routeQuery = reactive({})
    mocks.routerPush.mockResolvedValue(undefined)
    mocks.routerReplace.mockResolvedValue(undefined)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads organization accounts when the host resolves an organization', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(mocks.listCampusManagedUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      organization_id: 7,
    })
    expect(mocks.listUsers).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('统计范围：示例学校')
    expect(wrapper.find('el-select-stub').exists()).toBe(false)

    wrapper.unmount()
  })

  it('restores pagination and search state from the plugin URL query', async () => {
    mocks.routeQuery = { page: '3', pageSize: '50', search: 'Alice' }

    const wrapper = mountView()
    await flushPromises()

    expect(mocks.listCampusManagedUsers).toHaveBeenCalledWith({
      page: 3,
      pageSize: 50,
      organization_id: 7,
      search: 'Alice',
    })
    expect(wrapper.findComponent({ name: 'ElInput' }).props('modelValue')).toBe('Alice')

    wrapper.unmount()
  })

  it('writes a selected page to the plugin URL before loading it', async () => {
    const wrapper = mountView()
    await flushPromises()
    mocks.listCampusManagedUsers.mockClear()

    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2)
    await flushPromises()

    expect(mocks.routerPush).toHaveBeenCalledWith({
      query: { page: '2' },
    })
    expect(mocks.listCampusManagedUsers).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      organization_id: 7,
    })

    wrapper.unmount()
  })

  it('writes the selected page size to the plugin URL and returns to page one', async () => {
    mocks.routeQuery = reactive({ page: '3' })
    const wrapper = mountView()
    await flushPromises()
    mocks.listCampusManagedUsers.mockClear()

    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('size-change', 50)
    await flushPromises()

    expect(mocks.routerPush).toHaveBeenCalledWith({
      query: { pageSize: '50' },
    })
    expect(mocks.listCampusManagedUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      organization_id: 7,
    })

    wrapper.unmount()
  })

  it('writes an applied search to the plugin URL and request', async () => {
    const wrapper = mountView()
    await flushPromises()
    mocks.listCampusManagedUsers.mockClear()

    const searchInput = wrapper.findComponent({ name: 'ElInput' })
    searchInput.vm.$emit('update:modelValue', ' Alice ')
    await nextTick()
    searchInput.vm.$emit('keyup', new KeyboardEvent('keyup', { key: 'Enter' }))
    await flushPromises()

    expect(mocks.routerPush).toHaveBeenCalledWith({
      query: { search: 'Alice' },
    })
    expect(mocks.listCampusManagedUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      organization_id: 7,
      search: 'Alice',
    })

    wrapper.unmount()
  })

  it('reloads the list when browser history changes any list query', async () => {
    const wrapper = mountView()
    await flushPromises()
    mocks.listCampusManagedUsers.mockClear()

    Object.assign(mocks.routeQuery, {
      page: '4',
      pageSize: '50',
      search: 'Bob',
    })
    await nextTick()
    await flushPromises()

    expect(mocks.listCampusManagedUsers).toHaveBeenCalledWith({
      page: 4,
      pageSize: 50,
      organization_id: 7,
      search: 'Bob',
    })

    wrapper.unmount()
  })

  it('loads platform accounts for root only when no organization is declared', async () => {
    mocks.organizationId.value = null
    mocks.organizationName.value = ''
    mocks.organizationTitle.value = ''
    mocks.hasPlatformScope.value = true

    const wrapper = mountView()
    await flushPromises()

    expect(mocks.listUsers).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    expect(mocks.listCampusManagedUsers).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('统计范围：全平台')
    expect(wrapper.find('el-select-stub').exists()).toBe(false)

    wrapper.unmount()
  })

  it('does not fall back to platform accounts when a declared organization cannot resolve', async () => {
    mocks.organizationId.value = null
    mocks.organizationName.value = 'unresolved-school'
    mocks.organizationTitle.value = '待解析学校'
    mocks.hasPlatformScope.value = false

    const wrapper = mountView()
    await flushPromises()

    expect(mocks.listUsers).not.toHaveBeenCalled()
    expect(mocks.listCampusManagedUsers).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('does not load platform accounts for a non-root user without organization context', async () => {
    mocks.organizationId.value = null
    mocks.organizationName.value = ''
    mocks.organizationTitle.value = ''
    mocks.hasPlatformScope.value = false
    mocks.canManageAccounts = false

    const wrapper = mountView()
    await flushPromises()

    expect(mocks.listUsers).not.toHaveBeenCalled()
    expect(mocks.listCampusManagedUsers).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('keeps an id-only host context inside the declared organization scope', async () => {
    mocks.organizationId.value = 9
    mocks.organizationName.value = ''
    mocks.organizationTitle.value = '组织 #9'
    mocks.hasPlatformScope.value = false

    const wrapper = mountView()
    await flushPromises()

    expect(mocks.listCampusManagedUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      organization_id: 9,
    })
    expect(mocks.listUsers).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('统计范围：组织 #9')

    wrapper.unmount()
  })

  it('clears platform results immediately when the host switches to an unresolved organization', async () => {
    mocks.organizationId.value = null
    mocks.organizationName.value = ''
    mocks.organizationTitle.value = ''
    mocks.hasPlatformScope.value = true
    let resolvePlatformRequest: ((value: unknown) => void) | undefined
    mocks.listUsers.mockImplementationOnce(() => new Promise((resolve) => {
      resolvePlatformRequest = resolve
    }))

    const wrapper = mountView()
    await nextTick()
    await vi.waitFor(() => expect(mocks.listUsers).toHaveBeenCalledTimes(1))

    mocks.organizationName.value = 'unresolved-school'
    mocks.organizationTitle.value = '待解析学校'
    mocks.hasPlatformScope.value = false
    await nextTick()

    resolvePlatformRequest?.({
      data: {
        data: [{ id: 88, username: 'platform-only', roles: ['user'] }],
        pagination: { total: 1, page: 1, pageSize: 20 },
      },
    })
    await flushPromises()

    expect(mocks.listCampusManagedUsers).not.toHaveBeenCalled()
    expect(wrapper.find('.table-data').text()).not.toContain('platform-only')

    wrapper.unmount()
  })
})
