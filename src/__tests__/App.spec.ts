import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'
import { clearHostPluginConfig } from '../composables/useHostPluginContext'

const { routeState, tokenState } = vi.hoisted(() => ({
  routeState: {
    path: '/students',
  },
  tokenState: {
    inIframe: true,
    token: 'stale-token' as string | null,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
}))

vi.mock('../utils/token', () => ({
  isInIframe: () => tokenState.inIframe,
  getToken: () => tokenState.token,
  setToken: (token: string) => {
    tokenState.token = token
  },
  removeToken: () => {
    tokenState.token = null
  },
}))

vi.mock('../composables/useTheme', () => ({
  setThemeFromConfig: vi.fn(),
}))

function mountApp(): VueWrapper {
  return mount(App, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        RouterView: {
          template: '<div data-test="route-view" />',
        },
        Transition: false,
      },
    },
  })
}

function dispatchInit() {
  window.dispatchEvent(new MessageEvent('message', {
    source: window.parent,
    data: {
      type: 'INIT',
      id: 'init-campus',
      payload: {
        token: 'fresh-token',
        config: {
          organizationId: 1,
          organizationName: 'msc',
          organizationTitle: '澳门科学馆',
          hostContext: {
            pluginId: 'campus',
            group: 'org:msc',
          },
        },
      },
    },
  }))
}

describe('App handshake gate', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    routeState.path = '/students'
    tokenState.inIframe = true
    tokenState.token = 'stale-token'
    clearHostPluginConfig()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    clearHostPluginConfig()
    vi.restoreAllMocks()
  })

  it('waits for host config before mounting protected routes even when a token exists', async () => {
    wrapper = mountApp()
    await nextTick()

    expect(wrapper.find('[data-test="route-view"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('handshake.connecting')

    dispatchInit()
    await nextTick()

    expect(wrapper.find('[data-test="route-view"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('handshake.connecting')
  })
})
