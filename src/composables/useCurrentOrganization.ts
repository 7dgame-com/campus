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
let loadedOrganizationContext = ''

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
  const organizationId = computed(() => currentOrganizationId.value ?? organization.value?.id ?? null)
  const organizationTitle = computed(() => {
    const resolvedTitle = currentOrganizationId.value === null || organization.value?.id === currentOrganizationId.value
      ? organization.value?.title
      : ''
    return resolvedTitle
      || normalizeOrganizationKey(currentOrganizationTitle.value)
      || organizationName.value
      || (organizationId.value === null ? '' : `组织 #${organizationId.value}`)
  })

  const hostOrganization = computed<OrganizationSummary | null>(() => {
    const id = currentOrganizationId.value
    const key = organizationName.value
    if (id === null) return null

    const title = normalizeOrganizationKey(currentOrganizationTitle.value)
    return {
      id,
      name: key || `organization-${id}`,
      title: title || key || `组织 #${id}`,
    }
  })

  const organizationContextSignature = computed(() =>
    [
      organizationName.value,
      currentOrganizationId.value ?? '',
      currentOrganizationTitle.value,
    ].join(':')
  )

  function resetOrganizationState(context: string) {
    loadedOrganizationContext = context
    organization.value = null
    loaded.value = false
    error.value = ''
    loadPromise = null
  }

  async function loadCurrentOrganization(force = false) {
    const key = organizationName.value
    const context = organizationContextSignature.value
    if (context !== loadedOrganizationContext) {
      resetOrganizationState(context)
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
        if (hostOrganization.value) {
          organization.value = hostOrganization.value
          loaded.value = true
          return
        }

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

  watch(organizationContextSignature, (signature, previousSignature) => {
    if (signature === previousSignature) return
    resetOrganizationState(signature)
    if (hostOrganization.value || organizationName.value) {
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
