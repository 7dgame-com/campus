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
})
