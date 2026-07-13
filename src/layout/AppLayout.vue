<template>
  <div class="app-layout">
    <div v-if="sidebarOpen && hasAny()" class="sidebar-overlay" @click="sidebarOpen = false" />

    <aside v-if="hasAny()" class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <span class="sidebar-title">{{ $t('pluginMeta.name') }}</span>
        <button class="sidebar-close" @click="sidebarOpen = false">
          <el-icon><Close /></el-icon>
        </button>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          v-slot="{ href, navigate, isActive }"
          :to="item.to"
          custom
        >
          <a
            v-if="can(item.permission)"
            :href="href"
            class="sidebar-item"
            :class="{ active: isActive }"
            @click="(event) => { navigate(event); sidebarOpen = false }"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ $t(item.label) }}</span>
          </a>
        </router-link>
      </nav>
    </aside>

    <div class="main-area">
      <header class="navbar">
        <button v-if="hasAny()" class="menu-btn" @click="sidebarOpen = true">
          <el-icon :size="20"><Fold /></el-icon>
        </button>
        <h1 class="navbar-title">{{ $route.meta.title || $t('pluginMeta.name') }}</h1>
        <div class="navbar-spacer" />
        <div v-if="userInfo" class="user-info">
          <el-icon><User /></el-icon>
          <span class="user-name">{{ userInfo.nickname || userInfo.username }}</span>
          <el-tag size="small">{{ roleLabel }}</el-tag>
        </div>
      </header>

      <main class="content">
        <div v-if="!ready" class="loading-state">
          <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        </div>
        <div v-else-if="loaded && !hasCampusAccess" class="locked-state">
          <el-result
            icon="warning"
            :title="$t('permission.organizationRequiredTitle')"
            :sub-title="organizationRequiredMessage"
          />
        </div>
        <div v-else-if="loaded && !hasAny()" class="no-permission">
          <el-empty :description="$t('permission.noPermission')" />
        </div>
        <router-view v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  Close,
  Collection,
  DataBoard,
  Fold,
  Grid,
  Loading,
  OfficeBuilding,
  User,
} from '@element-plus/icons-vue'
import { useAuthSession } from '../composables/useAuthSession'
import { usePermissions, type CampusPermission } from '../composables/usePermissions'

const { user } = useAuthSession()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const {
  fetchPermissions,
  can,
  hasAny,
  loaded,
  primaryRole,
  hasCampusAccess,
  hasPlatformScope,
  isPublicPluginGroup,
} = usePermissions()

const sidebarOpen = ref(false)
const userInfo = computed(() => user.value)
const ready = ref(false)
const roleLabel = computed(() => {
  switch (primaryRole.value) {
    case 'root':
      return '管理员'
    case 'admin':
      return '组织管理员'
    case 'manager':
      return '组织管理员'
    case 'user':
      return '学生'
    default:
      return '未授权'
  }
})
const organizationRequiredMessage = computed(() =>
  isPublicPluginGroup.value
    ? t('permission.publicPluginLocked')
    : t('permission.organizationRequired'),
)

const navItems: Array<{
  to: string
  label: string
  permission: CampusPermission
  icon: object
}> = [
  { to: '/dashboard', label: 'nav.dashboard', permission: 'view-dashboard', icon: markRaw(DataBoard) },
  { to: '/schools', label: 'nav.schools', permission: 'view-schools', icon: markRaw(OfficeBuilding) },
  { to: '/classes', label: 'nav.classes', permission: 'view-classes', icon: markRaw(Collection) },
  { to: '/students', label: 'nav.students', permission: 'view-students', icon: markRaw(User) },
  { to: '/tools', label: 'nav.tools', permission: 'view-tools', icon: markRaw(Grid) },
]

function redirectPlatformScopeToAccounts() {
  if (!hasPlatformScope.value) return
  const requiredPermission = route.meta.requiresPermission as CampusPermission | undefined
  if (requiredPermission && !can(requiredPermission)) {
    void router.replace('/students')
  }
}

watch(hasPlatformScope, redirectPlatformScopeToAccounts)

onMounted(async () => {
  try {
    await fetchPermissions()
  } catch {
    // The outer App.vue handles token and iframe handshake states.
  } finally {
    ready.value = true
    redirectPlatformScopeToAccounts()
  }
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: var(--bg-page);
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  z-index: 998;
}

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 248px;
  background: var(--bg-card);
  border-right: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  z-index: 999;
  transform: translateX(-100%);
  transition: transform var(--transition-normal);
  display: flex;
  flex-direction: column;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
}

.sidebar-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--primary-color);
}

.sidebar-close,
.menu-btn {
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--text-secondary);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sidebar-close:hover,
.menu-btn:hover {
  color: var(--primary-color);
  background: var(--bg-hover);
}

.sidebar-nav {
  flex: 1;
  padding: var(--spacing-sm);
  overflow-y: auto;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 12px var(--spacing-md);
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  margin-bottom: var(--spacing-xs);
}

.sidebar-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-item.active {
  background: var(--primary-light);
  color: var(--primary-color);
  font-weight: var(--font-weight-medium);
}

.main-area {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.navbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-color);
  height: 56px;
}

.navbar-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.navbar-spacer {
  flex: 1;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-secondary);
  min-width: 0;
}

.user-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  flex: 1;
  padding: var(--spacing-lg);
  overflow: auto;
}

.loading-state,
.no-permission,
.locked-state {
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 640px) {
  .content {
    padding: var(--spacing-md);
  }

  .navbar {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .user-info .el-tag {
    display: none;
  }
}
</style>
