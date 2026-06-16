<template>
  <div class="dashboard-view">
    <section class="summary-band">
      <div>
        <p class="eyebrow">{{ $t('dashboard.eyebrow') }}</p>
        <h2>{{ $t('dashboard.title') }}</h2>
        <p class="summary-copy">{{ $t('dashboard.description') }}</p>
      </div>
      <div class="role-panel">
        <span class="role-label">{{ $t('dashboard.currentRole') }}</span>
        <div class="role-tags">
          <el-tag v-for="role in user?.roles || []" :key="role" size="small">{{ role }}</el-tag>
          <el-tag v-if="!user?.roles?.length" size="small" type="info">-</el-tag>
        </div>
        <span class="role-hint">{{ roleHint }}</span>
      </div>
    </section>

    <section class="metric-grid">
      <div v-for="item in metrics" :key="item.label" class="metric-card">
        <span class="metric-label">{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <span class="metric-note">{{ item.note }}</span>
      </div>
    </section>

    <section class="workflow">
      <div class="section-header">
        <h3>{{ $t('dashboard.workflowTitle') }}</h3>
      </div>
      <div class="workflow-grid">
        <button
          v-for="step in workflowSteps"
          :key="step.to"
          type="button"
          class="workflow-step"
          @click="$router.push(step.to)"
        >
          <span class="step-index">{{ step.index }}</span>
          <strong>{{ step.title }}</strong>
          <span>{{ step.description }}</span>
        </button>
      </div>
    </section>

    <section class="mapping-section">
      <div class="section-header">
        <h3>{{ $t('dashboard.mappingTitle') }}</h3>
      </div>
      <div class="mapping-grid">
        <div v-for="item in mappings" :key="item.platform" class="mapping-row">
          <span class="mapping-platform">{{ item.platform }}</span>
          <span class="mapping-arrow">-></span>
          <span class="mapping-campus">{{ item.campus }}</span>
          <span class="mapping-note">{{ item.note }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listCampusManagedUsers, listGroups, listOrganizations, listUsers } from '../api'
import { useAuthSession } from '../composables/useAuthSession'
import { usePermissions } from '../composables/usePermissions'
import { normalizeList, normalizeTotal } from '../utils/apiData'

const { user } = useAuthSession()
const { primaryRole, can } = usePermissions()

const schoolCount = ref('-')
const groupCount = ref('-')
const userCount = ref('-')

const roleHint = computed(() => {
  switch (primaryRole.value) {
    case 'root':
      return '管理员视角，可维护学校初始化、全局插件入口和所有校园聚合信息。'
    case 'admin':
      return '学校管理视角，可维护学校、班级、学生账号和校内教学入口。'
    case 'manager':
      return '老师视角，可处理班级、小组、学生查看和教学工具入口。'
    case 'user':
      return '学生账号不使用校园管理插件，请从课程工具入口进入学习内容。'
    default:
      return '请使用平台账号进入校园管理插件。'
  }
})

const metrics = computed(() => [
  ...(can('view-schools') ? [{ label: '学校', value: schoolCount.value, note: 'Organization' }] : []),
  ...(can('view-classes') ? [{ label: '班级/小组', value: groupCount.value, note: 'Group' }] : []),
  ...(can('view-students') ? [{ label: '账号', value: userCount.value, note: 'User' }] : []),
  { label: '工具入口', value: '已有插件', note: 'Plugin' },
])

const workflowSteps = computed(() => {
  if (primaryRole.value === 'root') {
    return [
      { index: '1', title: '初始化学校', description: '维护学校边界和平台级入口。', to: '/schools' },
      { index: '2', title: '整理班级', description: '复用 Group 管理班级或项目组。', to: '/classes' },
      { index: '3', title: '管理账号', description: '维护组织账号、资源和场景归属。', to: '/students' },
      { index: '4', title: '配置工具', description: '进入 system-admin 维护插件注册。', to: '/tools' },
    ]
  }

  if (primaryRole.value === 'admin') {
    return [
      { index: '1', title: '维护学校', description: '管理本校账号和工具开放边界。', to: '/schools' },
      { index: '2', title: '管理班级', description: '按课程、年级或项目组织学生。', to: '/classes' },
      { index: '3', title: '维护账号', description: '管理本校老师和学生账号内容。', to: '/students' },
      { index: '4', title: '查看工具', description: '整理本校常用教学入口。', to: '/tools' },
    ]
  }

  if (primaryRole.value === 'manager') {
    return [
      { index: '1', title: '管理班级', description: '维护课程班级和学习小组。', to: '/classes' },
      { index: '2', title: '查看学生', description: '按学校和关键字查看学生账号。', to: '/students' },
      { index: '3', title: '进入工具', description: '打开课程中使用的创作工具。', to: '/tools' },
    ]
  }

  return []
})

const mappings = [
  { platform: 'Organization', campus: '学校', note: '控制账号、插件和菜单开放范围' },
  { platform: 'Group', campus: '班级/小组', note: '复用现有小组协作能力' },
  { platform: 'User', campus: '学生/老师', note: '学生 user 不进入本插件，老师为 manager，学校管理为 admin，管理员为 root' },
  { platform: 'Plugin', campus: '教学工具', note: '由 system-admin 维护注册、启停和入口' },
]

async function loadSummary() {
  try {
    const [organizationsRes, groupsRes, usersRes] = await Promise.allSettled([
      can('view-schools') ? listOrganizations() : Promise.resolve(null),
      can('view-classes') ? listGroups({ 'per-page': 1 }) : Promise.resolve(null),
      can('view-students')
        ? (can('manage-student-accounts') ? listCampusManagedUsers({ page: 1, pageSize: 1 }) : listUsers({ page: 1, pageSize: 1 }))
        : Promise.resolve(null),
    ])

    if (organizationsRes.status === 'fulfilled' && organizationsRes.value) {
      schoolCount.value = String(normalizeList(organizationsRes.value.data).length)
    }
    if (groupsRes.status === 'fulfilled' && groupsRes.value) {
      groupCount.value = String(normalizeTotal(groupsRes.value.data))
    }
    if (usersRes.status === 'fulfilled' && usersRes.value) {
      userCount.value = String(normalizeTotal(usersRes.value.data))
    }
  } catch {
    ElMessage.warning('部分统计暂时不可用')
  }
}

onMounted(loadSummary)
</script>

<style scoped>
.dashboard-view {
  display: grid;
  gap: var(--spacing-lg);
}

.summary-band {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
}

.eyebrow {
  color: var(--primary-color);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-sm);
}

.summary-band h2 {
  margin: 0 0 var(--spacing-sm);
  font-size: 24px;
}

.summary-copy,
.role-hint,
.metric-note,
.workflow-step span,
.mapping-note {
  color: var(--text-secondary);
  line-height: 1.7;
}

.role-panel {
  border-left: 1px solid var(--border-color);
  padding-left: var(--spacing-lg);
  display: grid;
  align-content: center;
  gap: var(--spacing-sm);
}

.role-label,
.metric-label {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.metric-card {
  display: grid;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
}

.metric-card strong {
  font-size: 26px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.section-header h3 {
  margin: 0;
  font-size: var(--font-size-xl);
}

.workflow,
.mapping-section {
  padding: var(--spacing-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.workflow-step {
  min-height: 132px;
  text-align: left;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  padding: var(--spacing-md);
  display: grid;
  gap: var(--spacing-sm);
  cursor: pointer;
  color: var(--text-primary);
}

.workflow-step:hover {
  border-color: var(--primary-color);
}

.step-index {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary-color);
  font-weight: var(--font-weight-bold);
}

.mapping-grid {
  display: grid;
  gap: var(--spacing-sm);
}

.mapping-row {
  display: grid;
  grid-template-columns: 160px 40px 160px minmax(0, 1fr);
  gap: var(--spacing-md);
  align-items: center;
  padding: 12px var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.mapping-platform,
.mapping-campus {
  font-weight: var(--font-weight-bold);
}

.mapping-arrow {
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .summary-band,
  .metric-grid,
  .workflow-grid {
    grid-template-columns: 1fr;
  }

  .role-panel {
    border-left: 0;
    border-top: 1px solid var(--border-color);
    padding-left: 0;
    padding-top: var(--spacing-md);
  }

  .mapping-row {
    grid-template-columns: 1fr;
    gap: var(--spacing-xs);
  }
}
</style>
