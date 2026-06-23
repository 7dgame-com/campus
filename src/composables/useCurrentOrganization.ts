import { computed, readonly, ref } from 'vue'
import { listOrganizations, type OrganizationSummary } from '../api'
import { normalizeList } from '../utils/apiData'
import { useAuthSession } from './useAuthSession'
import { usePermissions } from './usePermissions'

const organization = ref<OrganizationSummary | null>(null)
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
let loadPromise: Promise<void> | null = null

function normalizeOrganizationKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function matchesOrganization(organization: OrganizationSummary, key: string): boolean {
  return organization.name === key || organization.title === key
}

export function useCurrentOrganization() {
  const { user } = useAuthSession()
  const { currentOrganizationName } = usePermissions()

  const organizationName = computed(() => normalizeOrganizationKey(currentOrganizationName.value))
  const organizationId = computed(() => organization.value?.id ?? null)
  const organizationTitle = computed(() => organization.value?.title ?? organizationName.value)

  async function loadCurrentOrganization(force = false) {
    if (loaded.value && !force) return
    if (loadPromise && !force) {
      await loadPromise
      return
    }

    loadPromise = (async () => {
      loading.value = true
      error.value = ''

      try {
        const key = organizationName.value
        if (key === '') {
          organization.value = null
          loaded.value = true
          error.value = '当前插件没有组织上下文'
          return
        }

        const sessionOrganization = user.value?.organizations?.find((item) =>
          matchesOrganization(item, key)
        )
        if (sessionOrganization) {
          organization.value = sessionOrganization
          loaded.value = true
          return
        }

        const { data } = await listOrganizations(key)
        const organizations = normalizeList<OrganizationSummary>(data)
        organization.value = organizations.find((item) => matchesOrganization(item, key)) ?? null
        loaded.value = true

        if (!organization.value) {
          error.value = `未找到当前组织：${key}`
        }
      } catch {
        organization.value = null
        loaded.value = false
        error.value = '当前组织加载失败'
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()

    await loadPromise
  }

  return {
    organization: readonly(organization),
    organizationId,
    organizationName,
    organizationTitle,
    loading: readonly(loading),
    loaded: readonly(loaded),
    error: readonly(error),
    loadCurrentOrganization,
  }
}
