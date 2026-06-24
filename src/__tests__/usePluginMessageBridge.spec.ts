import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePluginMessageBridge } from '../composables/usePluginMessageBridge'

type PluginBridgeWindow = Window & typeof globalThis & {
  __EARLY_INIT_PAYLOAD__?: Record<string, unknown> | null
  __PLUGIN_READY_SENT__?: boolean
}

function pluginWindow(): PluginBridgeWindow {
  return window as PluginBridgeWindow
}

describe('usePluginMessageBridge', () => {
  beforeEach(() => {
    pluginWindow().__EARLY_INIT_PAYLOAD__ = null
    pluginWindow().__PLUGIN_READY_SENT__ = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    pluginWindow().__EARLY_INIT_PAYLOAD__ = null
    pluginWindow().__PLUGIN_READY_SENT__ = false
  })

  it('consumes early INIT payload config before sending another PLUGIN_READY', async () => {
    const onInit = vi.fn()
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage')

    pluginWindow().__EARLY_INIT_PAYLOAD__ = {
      token: 'early-token',
      config: {
        organizationId: 1,
        organizationName: 'test',
        organizationTitle: '测试大学',
        hostContext: {
          pluginId: 'campus',
          group: 'org:test',
        },
      },
    }

    const wrapper = mount(defineComponent({
      setup() {
        const bridge = usePluginMessageBridge({ onInit })
        return { bridge }
      },
      template: '<div />',
    }))

    await nextTick()

    expect(onInit).toHaveBeenCalledWith({
      token: 'early-token',
      config: {
        organizationId: 1,
        organizationName: 'test',
        organizationTitle: '测试大学',
        hostContext: {
          pluginId: 'campus',
          group: 'org:test',
        },
      },
    })
    expect((wrapper.vm as unknown as { bridge: ReturnType<typeof usePluginMessageBridge> }).bridge.isReady.value).toBe(true)
    expect(pluginWindow().__EARLY_INIT_PAYLOAD__).toBeNull()
    expect(postMessageSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PLUGIN_READY' }),
      '*',
    )
  })

  it('retries PLUGIN_READY until INIT arrives', async () => {
    vi.useFakeTimers()
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage')
    const onInit = vi.fn()

    mount(defineComponent({
      setup() {
        usePluginMessageBridge({ onInit })
      },
      template: '<div />',
    }))

    await nextTick()

    const readyCount = () =>
      postMessageSpy.mock.calls.filter(([message]) =>
        typeof message === 'object'
        && message !== null
        && (message as { type?: unknown }).type === 'PLUGIN_READY'
      ).length

    expect(readyCount()).toBe(1)

    vi.advanceTimersByTime(500)
    expect(readyCount()).toBe(2)

    window.dispatchEvent(new MessageEvent('message', {
      source: window.parent,
      data: {
        type: 'INIT',
        id: 'init-campus',
        payload: {
          token: 'jwt-token',
          config: {
            hostContext: {
              pluginId: 'campus',
              group: 'org:test',
            },
          },
        },
      },
    }))
    await nextTick()

    expect(onInit).toHaveBeenCalledWith({
      token: 'jwt-token',
      config: {
        hostContext: {
          pluginId: 'campus',
          group: 'org:test',
        },
      },
    })

    vi.advanceTimersByTime(5000)
    expect(readyCount()).toBe(2)
  })
})
