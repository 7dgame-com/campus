<template>
  <!-- 公开页面不需要 token -->
  <router-view v-if="isPublicRoute" />
  <template v-else>
    <router-view v-if="canRenderProtectedRoute" />

    <div v-else-if="accessDenied" class="access-denied" role="alert">
      您没有权限访问此页面
    </div>

    <!-- 握手状态 -->
    <Transition name="handshake-fade">
      <!-- 非 iframe：警告模态窗 -->
      <div v-if="showHandshake && !inIframe" key="warning" class="handshake-overlay">
        <div class="handshake-card">
          <div class="handshake-icon warn">⚠️</div>
          <h3 class="handshake-title">{{ $t('handshake.notInIframe') }}</h3>
          <p class="handshake-desc">{{ $t('handshake.notInIframeDesc') }}</p>
          <div class="handshake-steps">
            <div class="step done">✅ {{ $t('handshake.pageLoaded') }}</div>
            <div class="step done">✅ {{ $t('handshake.pluginReady') }}</div>
            <div class="step warn">⚠️ {{ $t('handshake.waitingInit') }}</div>
          </div>
        </div>
      </div>
      <!-- iframe 内：简单 loading -->
      <div v-else-if="showHandshake && inIframe" key="loading" class="handshake-inline">
        <div class="handshake-spinner spin">⚙️</div>
        <p class="handshake-text">{{ $t('handshake.connecting') }}</p>
      </div>
    </Transition>
  </template>

  <!-- 全局版本号 -->
  <span class="global-version">{{ appVersion }}</span>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { isInIframe, getToken, setToken, removeToken } from './utils/token'
import { usePluginMessageBridge } from './composables/usePluginMessageBridge'
import { clearHostPluginConfig, setHostPluginConfig, useHostPluginContext } from './composables/useHostPluginContext'
import { setThemeFromConfig } from './composables/useTheme'
import { usePermissions } from './composables/usePermissions'

declare const __APP_VERSION__: string
const appVersion = `v${__APP_VERSION__}`

const route = useRoute()
const hasToken = ref(!!getToken())
const inIframe = ref(isInIframe())
const { configLoaded } = useHostPluginContext()
const { loaded, can, fetchPermissions } = usePermissions()

// 公开路由不需要 token 认证
const isPublicRoute = computed(() => route.meta.public === true)
const requiredPermission = computed(() => route.meta.requiresPermission)
const refreshPermissions = (force = false) => {
  void fetchPermissions(force).catch(() => undefined)
}
const canRenderProtectedRoute = computed(() =>
  hasToken.value
  && configLoaded.value
  && loaded.value
  && (!requiredPermission.value || can(requiredPermission.value))
)
const accessDenied = computed(() =>
  !isPublicRoute.value
  && hasToken.value
  && configLoaded.value
  && loaded.value
  && !!requiredPermission.value
  && !can(requiredPermission.value)
)

// 显示握手状态：非公开页面必须在 iframe 内拿到当前 INIT token 和配置。
const showHandshake = computed(() =>
  !isPublicRoute.value && (!inIframe.value || !canRenderProtectedRoute.value)
)

usePluginMessageBridge({
  onInit: (payload) => {
    if (payload.token) {
      setToken(payload.token)
      hasToken.value = true
    }
    setHostPluginConfig(payload.config)
    setThemeFromConfig(payload.config)
    if (payload.token) refreshPermissions(true)
  },
  onTokenUpdate: (newToken) => {
    if (newToken) {
      setToken(newToken)
      hasToken.value = true
      refreshPermissions(true)
    }
  },
  onDestroy: () => {
    removeToken()
    clearHostPluginConfig()
    hasToken.value = false
  }
})

onMounted(() => {
  if (isPublicRoute.value) return
  inIframe.value = isInIframe()

  if (!inIframe.value) {
    removeToken()
    hasToken.value = false
  } else {
    hasToken.value = !!getToken()
    if (hasToken.value) refreshPermissions()
  }
})
</script>

<style scoped>
.handshake-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.handshake-card {
  background: #fff;
  border-radius: 16px;
  padding: 36px 40px;
  min-width: 360px;
  max-width: 480px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
  text-align: center;
}

.handshake-icon {
  font-size: 40px;
  margin-bottom: 12px;
  line-height: 1;
}

.handshake-icon.spin {
  display: inline-block;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.handshake-title {
  margin: 0 0 8px;
  font-size: 18px;
  color: #303133;
}

.handshake-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
}

.handshake-steps {
  text-align: left;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.step {
  font-size: 13px;
  color: #606266;
}

.step.done { color: #67c23a; }
.step.waiting { color: #909399; }
.step.warn { color: #e6a23c; }

.diag-link {
  font-size: 13px;
  color: #409eff;
  text-decoration: none;
}
.diag-link:hover { text-decoration: underline; }

.handshake-inline {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-page, #f5f7fa);
}
.access-denied {
  min-height: 240px;
  display: grid;
  place-items: center;
  color: #c45656;
  font-size: 16px;
}
.handshake-spinner { font-size: 36px; display: inline-block; }
.handshake-spinner.spin { animation: spin 2s linear infinite; }
.handshake-text { margin-top: 12px; font-size: 14px; color: #909399; }

/* 淡入淡出动画 */
.handshake-fade-enter-active,
.handshake-fade-leave-active {
  transition: opacity 0.4s ease;
}
.handshake-fade-enter-from,
.handshake-fade-leave-to {
  opacity: 0;
}

.global-version {
  position: fixed;
  right: 12px;
  bottom: 8px;
  font-size: 11px;
  color: #ccc;
  pointer-events: none;
  z-index: 9999;
  user-select: none;
}
</style>
