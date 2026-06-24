import { computed, readonly, ref, watch } from 'vue'
import { listOrganizations, type OrganizationSummary } from '../api'
import { normalizeList } from '../utils/apiData'
import { useAuthSession } from './useAuthSession'
import { usePermissions } from './usePermissions'

const organization = ref<OrganizationSummary | null>(null)
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
let loadPromise: Promise<void> | null = null
let loadedOrganizationKey = ''

function normalizeOrganizationKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function matchesOrganization(organization: OrganizationSummary, key: string): boolean {
  const normalizedKey = normalizeOrganizationKey(key)
  const normalizedName = normalizeOrganizationKey(organization.name)

  return normalizedName.toLowerCase() === normalizedKey.toLowerCase()
}

function findOrganization(
  organizations: OrganizationSummary[],
  key: string,
): OrganizationSummary | null {
  return organizations.find((item) => matchesOrganization(item, key)) ?? null
}

async function fetchOrganizationByKey(key: string): Promise<OrganizationSummary | null> {
  const { data } = await listOrganizations(key)
  const organizations = normalizeList<OrganizationSummary>(data)
  const matchedOrganization = findOrganization(organizations, key)
  if (matchedOrganization) return matchedOrganization

  const fallbackResponse = await listOrganizations()
  return findOrganization(normalizeList<OrganizationSummary>(fallbackResponse.data), key)
}

export function useCurrentOrganization() {
  const { user } = useAuthSession()
  const {
    currentOrganizationId,
    currentOrganizationName,
    currentOrganizationTitle,
  } = usePermissions()

  const organizationName = computed(() => normalizeOrganizationKey(currentOrganizationName.value))
  const organizationId = computed(() => organization.value?.id ?? null)
  const organizationTitle = computed(() => organization.value?.title ?? organizationName.value)

  const hostOrganization = computed<OrganizationSummary | null>(() => {
    const id = currentOrganizationId.value
    const key = organizationName.value
    if (id === null || key === '') return null

    const title = normalizeOrganizationKey(currentOrganizationTitle.value)
    return {
      id,
      name: key,
      title: title || key,
    }
  })

  function resetOrganizationState(key: string) {
    loadedOrganizationKey = key
    organization.value = null
    loaded.value = false
    error.value = ''
    loadPromise = null
  }

  async function loadCurrentOrganization(force = false) {
    const key = organizationName.value
    if (key !== loadedOrganizationKey) {
      resetOrganizationState(key)
    }

    if (loaded.value && !force) return
    if (loadPromise && !force) {
      await loadPromise
      return
    }

    loadPromise = (async () => {
      loading.value = true
      error.value = ''

      try {
        if (key === '') {
          organization.value = null
          loaded.value = true
          error.value = '当前插件没有组织上下文'
          return
        }

        if (hostOrganization.value && matchesOrganization(hostOrganization.value, key)) {
          organization.value = hostOrganization.value
          loaded.value = true
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

        organization.value = await fetchOrganizationByKey(key)
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

  const organizationContextSignature = computed(() =>
    [
      organizationName.value,
      currentOrganizationId.value ?? '',
      currentOrganizationTitle.value,
    ].join(':')
  )

  watch(organizationContextSignature, (signature, previousSignature) => {
    if (signature === previousSignature) return
    const key = organizationName.value
    resetOrganizationState(key)
    if (key) {
      void loadCurrentOrganization(true)
    }
  })

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
