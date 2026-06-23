<template>
  <div class="tools-view">
    <section class="page-header">
      <div>
        <h2>教学工具</h2>
        <p>这里汇总当前组织可用的教学工具入口，工具启停、组织归属和菜单可见性仍由插件注册管理维护。</p>
      </div>
      <el-button v-if="can('manage-global-tools')" type="primary" @click="openPluginRegistry">
        插件注册管理
      </el-button>
    </section>

    <section class="tool-grid">
      <div v-for="tool in visibleTeachingTools" :key="tool.id" class="tool-card">
        <div class="tool-card-header">
          <el-icon :size="22"><component :is="tool.icon" /></el-icon>
          <div>
            <h3>{{ tool.name }}</h3>
            <span>{{ tool.scope }}</span>
          </div>
        </div>
        <p>{{ tool.description }}</p>
        <div class="tool-meta">
          <el-tag size="small" :type="tool.statusType">{{ tool.status }}</el-tag>
          <el-tag size="small" type="info">{{ tool.visibility }}</el-tag>
        </div>
        <div class="tool-actions">
          <el-button type="primary" @click="navigateHost(tool.path)">打开</el-button>
        </div>
      </div>
    </section>

    <section class="review-panel">
      <div class="review-header">
        <h3>审阅重点</h3>
        <span>这些项来自校园工具提交说明，当前由现有插件和主后端共同保障。</span>
      </div>
      <el-table :data="reviewItems" stripe>
        <el-table-column prop="item" label="审阅项" width="180" />
        <el-table-column prop="description" label="说明" min-width="360" />
        <el-table-column prop="owner" label="落点" width="180" />
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { Box, Grid, MagicStick, Setting, User } from '@element-plus/icons-vue'
import { usePermissions } from '../composables/usePermissions'
import { navigateHost } from '../utils/hostEvents'

const { can } = usePermissions()

const teachingTools = [
  {
    id: 'user-management',
    name: '平台用户管理',
    description: '维护平台账号、角色、组织归属和邀请注册链接。',
    scope: '账号与组织归属',
    visibility: '管理员',
    status: '已有插件',
    statusType: 'success' as const,
    path: '/plugins/user-management',
    icon: markRaw(User),
    permission: 'manage-global-tools',
  },
  {
    id: 'blockly',
    name: '积木编程',
    description: '面向数字课程的积木编程教学入口。',
    scope: '课程工具',
    visibility: '按插件菜单可见性',
    status: '已有插件',
    statusType: 'success' as const,
    path: '/plugins/blockly.7dgame.com',
    icon: markRaw(Grid),
    permission: 'view-tools',
  },
  {
    id: 'editor',
    name: '3D 场景编辑器',
    description: 'AR/VR 与 3D 创作课程的场景编辑入口。',
    scope: '创作工具',
    visibility: '按插件菜单可见性',
    status: '已有插件',
    statusType: 'success' as const,
    path: '/plugins/editor.7dgame.com',
    icon: markRaw(Box),
    permission: 'view-tools',
  },
  {
    id: 'ai-3d-generator-v3',
    name: 'AI 3D 生成器',
    description: '辅助课程中的 3D 资源生成与实验。',
    scope: '创作工具',
    visibility: '按插件菜单可见性',
    status: '已有插件',
    statusType: 'success' as const,
    path: '/plugins/ai-3d-generator-v3',
    icon: markRaw(MagicStick),
    permission: 'view-tools',
  },
  {
    id: 'system-admin',
    name: '插件管理',
    description: '维护插件名称、地址、版本、启用状态和菜单可见性。',
    scope: '全局配置',
    visibility: '管理员',
    status: '管理入口',
    statusType: 'warning' as const,
    path: '/plugins/system-admin',
    icon: markRaw(Setting),
    permission: 'manage-global-tools',
  },
] as const

const visibleTeachingTools = computed(() => teachingTools.filter((tool) => can(tool.permission)))

const reviewItems = [
  { item: '管理对象清晰', description: '校园管理绑定一个 Organization，只管理该组织内的账号和账号名下内容。', owner: '校园插件' },
  { item: '权限边界合理', description: 'root 可进入任何组织；admin 和 manager 必须属于当前组织才是管理员。', owner: '校园插件 + 主后端' },
  { item: '账号操作受控', description: '组织内管理只改密码、清空内容、上传资源，不提供增删账号入口。', owner: '校园插件 + 主后端' },
  { item: '工具开放可控', description: '工具入口按插件注册配置和 accessScope 控制，不在校园插件新增独立权限源。', owner: 'system-admin' },
  { item: '后续扩展平滑', description: '新增数字课程插件后，只需注册为平台插件，再在校园工具页增加入口。', owner: '插件体系' },
]

function openPluginRegistry() {
  navigateHost('/plugins/system-admin', { pluginUrl: '/plugins' })
}
</script>

<style scoped>
.tools-view {
  display: grid;
  gap: var(--spacing-lg);
}

.page-header,
.review-panel,
.tool-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
}

.page-header {
  padding: var(--spacing-lg);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-lg);
}

.page-header h2,
.tool-card h3,
.review-header h3 {
  margin: 0;
}

.page-header p,
.tool-card p,
.tool-card-header span,
.review-header span {
  color: var(--text-secondary);
  line-height: 1.7;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-md);
}

.tool-card {
  min-height: 220px;
  padding: var(--spacing-md);
  display: grid;
  gap: var(--spacing-md);
  align-content: start;
}

.tool-card-header {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
}

.tool-card-header .el-icon {
  color: var(--primary-color);
  margin-top: 2px;
}

.tool-meta,
.tool-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.review-panel {
  overflow: hidden;
}

.review-header {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
  }
}
</style>
