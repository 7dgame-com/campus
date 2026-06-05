<template>
  <div class="students-view">
    <section class="page-header">
      <div>
        <h2>学生账号</h2>
        <p>学生账号仍由用户管理插件维护，校园插件提供学校筛选、角色识别和常用入口。</p>
      </div>
      <div v-if="can('manage-student-accounts')" class="header-actions">
        <el-button type="primary" @click="openUserManagement('/users/batch-create')">批量创建</el-button>
        <el-button @click="openUserManagement('/invitations')">邀请链接</el-button>
      </div>
    </section>

    <section class="toolbar panel">
      <el-input
        v-model="search"
        clearable
        placeholder="搜索用户名、昵称或邮箱"
        style="width: 260px"
        @clear="loadUsers"
        @keyup.enter="loadUsers"
      />
      <el-select v-model="organizationId" clearable filterable placeholder="学校边界" style="width: 240px" @change="loadUsers">
        <el-option v-for="org in organizations" :key="org.id" :label="org.title" :value="org.id" />
      </el-select>
      <el-button @click="loadUsers">查询</el-button>
    </section>

    <section class="panel">
      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="nickname" label="姓名/昵称" min-width="140">
          <template #default="{ row }">{{ row.nickname || '-' }}</template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="200">
          <template #default="{ row }">{{ row.email || '-' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="150">
          <template #default="{ row }">
            <el-tag :type="roleTagType(highestRole(row.roles))" size="small">{{ roleLabel(highestRole(row.roles)) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="学校边界" min-width="220">
          <template #default="{ row }">
            <div v-if="row.organizations?.length" class="tag-list">
              <el-tag v-for="org in row.organizations" :key="org.id" size="small" type="info">{{ org.title }}</el-tag>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">{{ formatTimestamp(row.created_at) }}</template>
        </el-table-column>
        <el-table-column v-if="can('manage-student-accounts')" label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openUserManagement(`/users/${row.id}/edit`)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadUsers"
          @size-change="loadUsers"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listOrganizations, listUsers, type OrganizationSummary, type UserItem } from '../api'
import { usePermissions } from '../composables/usePermissions'
import { formatTimestamp, normalizeList, normalizeTotal } from '../utils/apiData'
import { navigateHost } from '../utils/hostEvents'

const ROLE_PRIORITY: Record<string, number> = { root: 4, admin: 3, manager: 2, user: 1 }
const { can } = usePermissions()

const users = ref<UserItem[]>([])
const organizations = ref<OrganizationSummary[]>([])
const loading = ref(false)
const search = ref('')
const organizationId = ref<number | ''>('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

function highestRole(roles?: string[]) {
  if (!roles?.length) return 'user'
  return roles.reduce((highest, role) => (ROLE_PRIORITY[role] || 0) > (ROLE_PRIORITY[highest] || 0) ? role : highest, roles[0])
}

function roleLabel(role: string) {
  switch (role) {
    case 'root':
      return '管理员'
    case 'admin':
      return '学校管理'
    case 'manager':
      return '老师'
    default:
      return '学生'
  }
}

function roleTagType(role: string) {
  if (role === 'root') return 'danger'
  if (role === 'admin') return 'warning'
  if (role === 'manager') return 'success'
  return 'info'
}

function openUserManagement(pluginUrl: string) {
  navigateHost('/plugins/user-management', { pluginUrl })
}

async function loadOrganizations() {
  try {
    const { data } = await listOrganizations()
    organizations.value = normalizeList<OrganizationSummary>(data)
  } catch {
    organizations.value = []
  }
}

async function loadUsers() {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value,
    }
    if (search.value.trim()) params.search = search.value.trim()
    if (organizationId.value) params.organization_id = organizationId.value

    const { data } = await listUsers(params)
    users.value = normalizeList<UserItem>(data)
    total.value = normalizeTotal<UserItem>(data)
  } catch {
    users.value = []
    total.value = 0
    ElMessage.error('学生账号加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadOrganizations()
  loadUsers()
})
</script>

<style scoped>
.students-view {
  display: grid;
  gap: var(--spacing-lg);
}

.page-header,
.panel {
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

.page-header h2 {
  margin: 0 0 var(--spacing-xs);
}

.page-header p {
  color: var(--text-secondary);
}

.header-actions,
.toolbar,
.tag-list {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.toolbar {
  padding: var(--spacing-md);
  align-items: center;
}

.panel {
  overflow: hidden;
}

.pagination {
  padding: var(--spacing-md);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
  }

  .header-actions,
  .header-actions .el-button,
  .toolbar,
  .toolbar .el-input,
  .toolbar .el-select {
    width: 100%;
  }
}
</style>
