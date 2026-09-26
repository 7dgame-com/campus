<template>
  <el-config-provider :locale="zhCn">
  <div class="login-records-view">
    <section class="page-header">
      <div>
        <h2>登录流水</h2>
        <p>查看当前组织所有账号的成功登录记录，时间均为北京时间。</p>
      </div>
      <el-button :icon="Refresh" :disabled="!canQuery" @click="loadRecords">刷新</el-button>
    </section>

    <section class="panel filters" aria-label="登录流水筛选">
      <el-tag type="info">当前组织：{{ organizationTitle || '未确定' }}</el-tag>
      <div class="filter-fields">
        <label class="date-field">
          <span>日期范围（北京时间）</span>
          <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD"
            format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期"
            end-placeholder="结束日期" :shortcuts="dateShortcuts" :clearable="false" />
        </label>
        <label>
          <span>账号</span>
          <el-input v-model="search" placeholder="搜索用户名或姓名/昵称" clearable @keyup.enter="queryRecords" />
        </label>
        <label>
          <span>身份</span>
          <el-select v-model="role" aria-label="身份" placeholder="全部身份">
            <el-option label="全部身份" value="" />
            <el-option v-for="(label, value) in roleLabels" :key="value" :label="label" :value="value" />
          </el-select>
        </label>
        <div class="filter-actions">
          <el-button type="primary" :disabled="!canQuery" @click="queryRecords">查询</el-button>
          <el-button :disabled="!canQuery" @click="resetFilters">重置</el-button>
        </div>
      </div>
    </section>

    <section class="panel records-panel" v-loading="loading" aria-label="组织登录流水">
      <div v-if="displayError" class="error-state" role="alert">
        <el-alert :title="displayError" type="error" :closable="false" show-icon />
        <el-button v-if="canQuery" @click="loadRecords">重试</el-button>
        <el-button v-else-if="!organizationId && canRead" @click="retryOrganization">重新加载组织</el-button>
      </div>
      <el-empty v-else-if="filtersChanged" description="筛选条件已更改，请点击查询" />
      <template v-else>
        <el-table :data="records" row-key="eventKey" stripe empty-text="所选条件下暂无成功登录记录">
          <el-table-column label="登录时间（北京时间）" min-width="200">
            <template #default="{ row }">{{ formatBeijingLoginTime(row.occurredAt) }}</template>
          </el-table-column>
          <el-table-column prop="username" label="用户名" min-width="150" show-overflow-tooltip />
          <el-table-column label="姓名/昵称" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.nickname || '-' }}</template>
          </el-table-column>
          <el-table-column label="身份" min-width="130">
            <template #default="{ row }"><el-tag size="small" type="info">{{ roleLabels[row.primaryRole as LoginRecordRole] }}</el-tag></template>
          </el-table-column>
          <el-table-column label="登录来源" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ sourceLabels[row.source] || row.source || '-' }}</template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination :current-page="page" :page-size="pageSize" :total="total" :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next" :disabled="loading || !canQuery"
            @current-change="changePage" @size-change="changePageSize" />
        </div>
      </template>
    </section>
    <p class="scope-note">按账号当前组织归属展示历史成功登录；账号移出组织后，其记录不再显示。仅包含已采集的登录记录。</p>
  </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { listOrganizationLoginEvents, type LoginRecordRole, type OrganizationLoginRecord } from '../api'
import { useCurrentOrganization } from '../composables/useCurrentOrganization'
import { usePermissions } from '../composables/usePermissions'
import { beijingDateInterval, formatBeijingLoginTime, recentBeijingDates } from '../utils/loginRecordDates'

const { organizationId, organizationName, organizationTitle, error: organizationError, loadCurrentOrganization } = useCurrentOrganization()
const { can } = usePermissions()
const canRead = computed(() => can('view-login-records'))
const canQuery = computed(() => canRead.value && organizationId.value !== null)
const dateRange = ref<string[] | null>(recentBeijingDates(7))
const search = ref('')
const role = ref<LoginRecordRole | ''>('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const records = ref<OrganizationLoginRecord[]>([])
const loading = ref(false)
const error = ref('')
const filtersChanged = ref(false)
let requestSequence = 0
const roleLabels: Record<LoginRecordRole, string> = { root: '平台管理员', admin: '组织管理员', manager: '老师', user: '学生', other: '其他' }
const sourceLabels: Record<string, string> = { 'identity-adapter': '身份服务', 'legacy-backend': '主后端' }
const dateShortcuts = [
  { text: '今天', days: 1 }, { text: '最近 7 天', days: 7 }, { text: '最近 30 天', days: 30 },
].map(({ text, days }) => ({
  text,
  // Date picker consumes browser-local Dates; their calendar labels must still be Beijing dates.
  value: () => recentBeijingDates(days).map((day) => new Date(`${day}T12:00:00`)),
}))
const displayError = computed(() => {
  if (!canRead.value) return '您没有权限查看当前组织的登录流水'
  if (!organizationId.value) return organizationError.value || '正在确认当前组织，请稍候'
  return error.value
})

function clearResults(clearTotal = true) {
  requestSequence += 1
  records.value = []
  if (clearTotal) total.value = 0
  error.value = ''
  loading.value = false
}

async function loadRecords() {
  // Preserve the known page count while loading another page. Element Plus clamps
  // current-page to 1 if total temporarily becomes zero.
  clearResults(false)
  if (!canQuery.value) return
  const interval = beijingDateInterval(dateRange.value)
  if (!interval) {
    error.value = '请选择有效的日期范围，开始日期不能晚于结束日期'
    return
  }
  filtersChanged.value = false
  const requestId = requestSequence
  loading.value = true
  try {
    const { data } = await listOrganizationLoginEvents({
      organization_id: organizationId.value!, ...interval,
      search: search.value.trim() || undefined, role: role.value || undefined,
      page: page.value, pageSize: pageSize.value,
    })
    if (requestId !== requestSequence) return
    records.value = data.data
    total.value = data.pagination.total
  } catch (cause: any) {
    if (requestId !== requestSequence) return
    const code = cause.response?.data?.code
    error.value = code === 'LOGIN_AUDIT_DISABLED' ? '登录记录功能尚未启用'
      : code === 'PLUGIN_USER_READONLY_DISABLED' ? '登录流水查询服务尚未启用'
      : cause.response?.data?.message || '登录流水加载失败，请稍后重试'
  } finally {
    if (requestId === requestSequence) loading.value = false
  }
}

function queryRecords() { page.value = 1; void loadRecords() }
function resetFilters() {
  dateRange.value = recentBeijingDates(7)
  search.value = ''
  role.value = ''
  pageSize.value = 20
  queryRecords()
}
function changePage(value: number) { page.value = value; void loadRecords() }
function changePageSize(value: number) { pageSize.value = value; queryRecords() }
async function retryOrganization() {
  await loadCurrentOrganization(true)
}

watch([search, role, dateRange], () => {
  clearResults()
  page.value = 1
  filtersChanged.value = true
}, { flush: 'sync', deep: true })
watch([organizationId, organizationName, canRead], () => {
  clearResults()
  page.value = 1
  filtersChanged.value = false
  void loadRecords()
}, { immediate: true, flush: 'sync' })
onMounted(() => { void loadCurrentOrganization() })
onBeforeUnmount(() => clearResults())
</script>

<style scoped>
.login-records-view { display: flex; flex-direction: column; gap: var(--spacing-lg); }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--spacing-md); }
h2 { margin: 0 0 var(--spacing-xs); }
.page-header p, .scope-note { color: var(--text-secondary); font-size: var(--font-size-sm); margin: 0; }
.panel { padding: var(--spacing-lg); background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); }
.filter-fields { display: flex; flex-wrap: wrap; gap: var(--spacing-md); align-items: flex-end; margin-top: var(--spacing-md); }
.filter-fields label { display: flex; flex-direction: column; gap: var(--spacing-xs); width: 220px; color: var(--text-secondary); font-size: var(--font-size-sm); }
.filter-fields .date-field { width: 360px; max-width: 100%; }
.date-field :deep(.el-date-editor) { width: 100%; box-sizing: border-box; }
.filter-actions { display: flex; }
.records-panel { min-height: 220px; }
.pagination { display: flex; justify-content: flex-end; margin-top: var(--spacing-md); overflow-x: auto; }
.error-state { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-md); }
@media (max-width: 640px) {
  .panel { padding: var(--spacing-md); }
  .filter-fields label, .filter-fields .date-field { width: 100%; }
  .pagination { justify-content: flex-start; }
}
</style>
