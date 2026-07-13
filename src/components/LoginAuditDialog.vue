<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="min(760px, 92vw)"
    class="login-audit-dialog"
  >
    <div v-loading="loading" class="login-audit-content">
      <template v-if="!loading">
        <div v-if="stats" class="audit-summary">
          <div class="audit-metric">
            <span>成功登录</span>
            <strong>{{ stats.loginCount }}</strong>
          </div>
          <div class="audit-metric">
            <span>失败登录</span>
            <strong>{{ stats.failedLoginCount }}</strong>
          </div>
          <div class="audit-metric">
            <span>最近登录</span>
            <strong>{{ formatDateTime(stats.lastLoginAt) }}</strong>
          </div>
          <div class="audit-metric">
            <span>最近失败</span>
            <strong>{{ formatDateTime(stats.lastFailedLoginAt) }}</strong>
          </div>
        </div>

        <el-empty v-else description="暂无登录记录" />

        <el-table
          v-if="events.length > 0"
          :data="events"
          size="small"
          border
          class="audit-events-table"
        >
          <el-table-column prop="occurredAt" label="发生时间" min-width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.occurredAt) }}
            </template>
          </el-table-column>
          <el-table-column prop="eventType" label="事件" min-width="110" />
          <el-table-column prop="success" label="结果" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.success ? 'success' : 'danger'">
                {{ row.success ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="source" label="来源" min-width="140" />
          <el-table-column prop="traceId" label="追踪标识" min-width="150">
            <template #default="{ row }">
              {{ row.traceId || '-' }}
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getCampusUserLoginAudit,
  type CampusManagedUser,
  type LoginAuditRecentEvent,
  type LoginAuditStats,
} from '../api'

const props = defineProps<{
  organizationId: number | null
  allowPlatformScope?: boolean
}>()

const visible = ref(false)
const loading = ref(false)
const selectedUser = ref<CampusManagedUser | null>(null)
const stats = ref<LoginAuditStats | null>(null)
const events = ref<LoginAuditRecentEvent[]>([])
let requestSequence = 0

const dialogTitle = computed(() => {
  const username = selectedUser.value?.username
  return username ? `登录记录 - ${username}` : '登录记录'
})

function resetForScopeChange() {
  requestSequence += 1
  visible.value = false
  loading.value = false
  selectedUser.value = null
  stats.value = null
  events.value = []
}

watch(
  () => [props.organizationId, Boolean(props.allowPlatformScope)] as const,
  resetForScopeChange,
)

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN')
}

async function open(user: CampusManagedUser) {
  const requestId = ++requestSequence
  if (props.organizationId === null && !props.allowPlatformScope) {
    loading.value = false
    ElMessage.warning('当前组织尚未加载完成')
    return
  }

  selectedUser.value = user
  stats.value = null
  events.value = []
  visible.value = true
  loading.value = true

  try {
    const { data } = await getCampusUserLoginAudit(user.id, props.organizationId)
    if (requestId !== requestSequence) return
    stats.value = data.data?.stats ?? null
    events.value = data.data?.recentEvents ?? []
  } catch (error: any) {
    if (requestId !== requestSequence) return
    const errorCode = error.response?.data?.code
    const errorMessage = errorCode === 'LOGIN_AUDIT_DISABLED'
      ? '登录记录功能尚未启用'
      : error.response?.data?.message || '登录记录加载失败'
    ElMessage.error(errorMessage)
  } finally {
    if (requestId === requestSequence) loading.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.login-audit-content {
  min-height: 180px;
}

.audit-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.audit-metric {
  min-width: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-page);
}

.audit-metric span {
  display: block;
  margin-bottom: 4px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.audit-metric strong {
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  overflow-wrap: anywhere;
}

.audit-events-table {
  margin-top: var(--spacing-sm);
}

@media (max-width: 640px) {
  .audit-summary {
    grid-template-columns: 1fr;
  }
}
</style>
