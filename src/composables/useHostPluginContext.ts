import { computed, readonly, ref } from 'vue'

type HostContextPayload = {
  pluginId?: unknown
  group?: unknown
}

const config = ref<Record<string, unknown>>({})
const configLoaded = ref(false)

function readHostContext(value: Record<string, unknown>): HostContextPayload {
  const hostContext = value.hostContext
  if (hostContext && typeof hostContext === 'object') {
    return hostContext as HostContextPayload
  }

  return {
    pluginId: value.pluginId,
    group: value.group,
  }
}

function normalizeGroup(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isOrganizationGroup(group: string): boolean {
  return group.startsWith('org:') && group !== 'org:public'
}

function organizationNameFromGroup(group: string): string {
  return isOrganizationGroup(group) ? group.slice('org:'.length).trim() : ''
}

export function setHostPluginConfig(value: Record<string, unknown>) {
  config.value = value
  configLoaded.value = true
}

export function clearHostPluginConfig() {
  config.value = {}
  configLoaded.value = false
}

export function useHostPluginContext() {
  const hostContext = computed(() => readHostContext(config.value))
  const pluginId = computed(() => (typeof hostContext.value.pluginId === 'string' ? hostContext.value.pluginId : ''))
  const group = computed(() => normalizeGroup(hostContext.value.group))
  const hasExplicitGroup = computed(() => group.value.length > 0)
  const isPublicPluginGroup = computed(() => group.value === 'org:public')
  const hasOrganizationGroup = computed(() => isOrganizationGroup(group.value))
  const currentOrganizationName = computed(() => organizationNameFromGroup(group.value))

  return {
    config: readonly(config),
    configLoaded: readonly(configLoaded),
    pluginId,
    group,
    hasExplicitGroup,
    isPublicPluginGroup,
    hasOrganizationGroup,
    currentOrganizationName,
  }
}
