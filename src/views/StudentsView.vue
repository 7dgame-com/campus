<template>
  <div class="students-view">
    <section class="page-header">
      <div>
        <h2>组织账号</h2>
        <p>按学校边界维护老师和学生账号的密码、资源、场景归属。</p>
      </div>
      <div v-if="canManageAccounts" class="header-actions">
        <el-button :icon="Key" type="primary" :disabled="!canOperate" @click="openPasswordDialog()">批量改密码</el-button>
        <el-button :icon="Delete" type="danger" plain :disabled="!canOperate" @click="openClearDialog()">批量清空</el-button>
        <el-button :icon="Upload" :disabled="!canOperate" @click="openImportDialog()">批量导入场景</el-button>
        <el-button :icon="Upload" :disabled="!canOperate" @click="openResourceDialog()">批量上传资源</el-button>
      </div>
    </section>

    <section class="toolbar panel">
      <el-input
        v-model="search"
        clearable
        placeholder="搜索用户名、昵称或邮箱"
        style="width: 260px"
        @clear="refreshFromFirstPage"
        @keyup.enter="refreshFromFirstPage"
      />
      <el-select
        v-model="organizationId"
        clearable
        filterable
        placeholder="学校边界"
        style="width: 240px"
        @change="refreshFromFirstPage"
      >
        <el-option v-for="org in organizations" :key="org.id" :label="org.title" :value="org.id" />
      </el-select>
      <el-button :icon="Refresh" @click="refreshFromFirstPage">查询</el-button>
    </section>

    <section class="panel">
      <el-table
        :data="users"
        v-loading="loading"
        row-key="id"
        stripe
        @selection-change="selectedUsers = $event"
      >
        <el-table-column v-if="canManageAccounts" type="selection" width="46" />
        <el-table-column prop="username" label="用户名" min-width="140" />
        <el-table-column prop="nickname" label="姓名/昵称" min-width="140">
          <template #default="{ row }">{{ row.nickname || '-' }}</template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="200">
          <template #default="{ row }">{{ row.email || '-' }}</template>
        </el-table-column>
        <el-table-column label="身份" width="130">
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
        <el-table-column v-if="canManageAccounts" label="内容" width="150">
          <template #default="{ row }">
            <span class="content-counts">
              场景 {{ row.content_counts?.verse_count ?? 0 }} / 资源 {{ row.content_counts?.resource_count ?? 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">{{ formatTimestamp(row.created_at) }}</template>
        </el-table-column>
        <el-table-column v-if="canManageAccounts" label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link :icon="Key" type="primary" @click="openPasswordDialog(row)">改密码</el-button>
              <el-button link :icon="Delete" type="danger" @click="openClearDialog(row)">清空</el-button>
              <el-button link :icon="Upload" @click="openImportDialog(row)">导入场景</el-button>
              <el-button link :icon="Upload" @click="openResourceDialog(row)">上传资源</el-button>
            </div>
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

    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="460px">
      <div class="dialog-body">
        <el-alert :title="targetSummary" type="info" :closable="false" show-icon />
        <el-input v-model="temporaryPassword" type="password" show-password placeholder="临时密码" />
      </div>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordSubmitting" @click="submitPassword">确认修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="clearDialogVisible" title="清空资源和场景" width="620px">
      <div class="dialog-body">
        <el-alert :title="targetSummary" type="warning" :closable="false" show-icon />
        <el-skeleton v-if="clearPreviewLoading" :rows="3" animated />
        <div v-else-if="clearPreview" class="preview-box">
          <strong>
            将清空 {{ clearPreview.user_count }} 个账号、{{ clearPreview.verse_count }} 个场景、{{ clearPreview.resource_count }} 个资源
          </strong>
          <el-table :data="clearPreview.targets" size="small" max-height="220">
            <el-table-column prop="username" label="用户名" min-width="150" />
            <el-table-column prop="verse_count" label="场景" width="90" />
            <el-table-column prop="resource_count" label="资源" width="90" />
          </el-table>
        </div>
      </div>
      <template #footer>
        <el-button @click="clearDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="clearSubmitting" :disabled="!clearPreview" @click="submitClearContent">确认清空</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="导入场景" width="520px">
      <div class="dialog-body">
        <el-alert :title="targetSummary" type="info" :closable="false" show-icon />
        <el-upload
          drag
          accept=".zip,application/zip"
          :auto-upload="false"
          :limit="1"
          :on-change="handleImportFileChange"
          :on-remove="handleImportFileRemove"
        >
          <el-icon class="upload-icon"><Upload /></el-icon>
          <div class="el-upload__text">拖入 ZIP 文件或点击选择</div>
        </el-upload>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importSubmitting" :disabled="!importFile" @click="submitImportScene">确认导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resourceDialogVisible" title="上传资源" width="560px">
      <div class="dialog-body">
        <el-alert :title="targetSummary" type="info" :closable="false" show-icon />
        <el-form label-position="top">
          <el-form-item label="资源文件">
            <el-upload
              drag
              :accept="resourceAccept"
              :auto-upload="false"
              :limit="1"
              :on-change="handleResourceFileChange"
              :on-remove="handleResourceFileRemove"
            >
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div class="el-upload__text">拖入文件或点击选择</div>
            </el-upload>
          </el-form-item>
          <el-form-item label="资源名称">
            <el-input v-model="resourceName" placeholder="默认使用文件名" />
          </el-form-item>
          <el-form-item label="资源类型">
            <el-select v-model="resourceType" style="width: 100%">
              <el-option v-for="type in resourceTypeOptions" :key="type.value" :label="type.label" :value="type.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="资源说明">
            <el-input v-model="resourceInfo" type="textarea" :rows="2" placeholder="可选" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="resourceDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resourceSubmitting" :disabled="!resourceFile || !resourceType" @click="submitUploadResource">确认上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resultDialogVisible" :title="resultTitle" width="640px">
      <el-table :data="operationResults" size="small" max-height="320">
        <el-table-column prop="username" label="用户名" min-width="150" />
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">{{ row.success ? '成功' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="180">
          <template #default="{ row }">{{ resultDetail(row) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus'
import { Delete, Key, Refresh, Upload } from '@element-plus/icons-vue'
import {
  clearCampusContent,
  importCampusSceneZip,
  listCampusManagedUsers,
  listOrganizations,
  listUsers,
  previewCampusClearContent,
  updateCampusUserPassword,
  uploadCampusResource,
  type CampusClearPreview,
  type CampusManagedUser,
  type CampusOperationResult,
  type OrganizationSummary,
  type UserItem,
} from '../api'
import { usePermissions } from '../composables/usePermissions'
import { formatTimestamp, normalizeList, normalizeTotal } from '../utils/apiData'

const ROLE_PRIORITY: Record<string, number> = { root: 4, admin: 3, manager: 2, user: 1 }
const RESOURCE_UPLOAD_MAX_BYTES = 200 * 1024 * 1024
const { can, primaryRole } = usePermissions()

const users = ref<CampusManagedUser[]>([])
const selectedUsers = ref<CampusManagedUser[]>([])
const organizations = ref<OrganizationSummary[]>([])
const loading = ref(false)
const search = ref('')
const organizationId = ref<number | ''>('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const activeUser = ref<CampusManagedUser | null>(null)
const passwordDialogVisible = ref(false)
const temporaryPassword = ref('')
const passwordSubmitting = ref(false)
const clearDialogVisible = ref(false)
const clearPreview = ref<CampusClearPreview | null>(null)
const clearPreviewLoading = ref(false)
const clearSubmitting = ref(false)
const importDialogVisible = ref(false)
const importFile = ref<File | null>(null)
const importSubmitting = ref(false)
const resourceDialogVisible = ref(false)
const resourceFile = ref<File | null>(null)
const resourceName = ref('')
const resourceType = ref('polygen')
const resourceInfo = ref('')
const resourceSubmitting = ref(false)
const resultDialogVisible = ref(false)
const resultTitle = ref('')
const operationResults = ref<CampusOperationResult[]>([])
const resourceTypeOptions = [
  { label: '3D 模型', value: 'polygen' },
  { label: '体素', value: 'voxel' },
  { label: '图片', value: 'picture' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
  { label: '粒子', value: 'particle' },
  { label: '其他文件', value: 'file' },
]
const resourceAcceptByType: Record<string, string> = {
  polygen: '.glb,.gltf,.fbx,.obj,.stl',
  voxel: '.vox',
  picture: '.jpg,.jpeg,.png,.gif,.webp',
  video: '.mp4,.webm,.mov',
  audio: '.mp3,.wav,.ogg,.m4a',
  particle: '.json',
  file: '.pdf,.zip,.rar,.7z',
}

const canManageAccounts = computed(() => can('manage-student-accounts'))
const canOperate = computed(() => canManageAccounts.value && organizationId.value !== '')
const resourceAccept = computed(() => resourceAcceptByType[resourceType.value] ?? '')

const targetSummary = computed(() => {
  if (activeUser.value) return `目标账号：${activeUser.value.username}`
  if (selectedUsers.value.length) return `目标账号：已选 ${selectedUsers.value.length} 个账号`
  return '目标账号：当前学校全部可管理账号'
})

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

function targetUserIds() {
  if (activeUser.value) return [activeUser.value.id]
  if (selectedUsers.value.length) return selectedUsers.value.map((user) => user.id)
  return undefined
}

function requireOrganization() {
  if (!organizationId.value) {
    ElMessage.warning('请选择学校边界')
    return null
  }
  return organizationId.value
}

function showResults(title: string, results: CampusOperationResult[], successCount: number, failedCount: number) {
  resultTitle.value = `${title}：成功 ${successCount}，失败 ${failedCount}`
  operationResults.value = results
  resultDialogVisible.value = true
}

function resultDetail(result: CampusOperationResult) {
  if (result.errors?.length) return result.errors.join('；')
  if (result.resource_name) return `${result.message}：${result.resource_name}`
  return result.error || result.message
}

function refreshFromFirstPage() {
  page.value = 1
  loadUsers()
}

async function loadOrganizations() {
  try {
    const { data } = await listOrganizations()
    organizations.value = normalizeList<OrganizationSummary>(data)
    if (!organizationId.value && primaryRole.value === 'admin' && organizations.value.length === 1) {
      organizationId.value = organizations.value[0].id
    }
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

    const request = canManageAccounts.value
      ? listCampusManagedUsers(params)
      : listUsers(params)
    const { data } = await request
    users.value = normalizeList<CampusManagedUser | UserItem>(data) as CampusManagedUser[]
    total.value = normalizeTotal<CampusManagedUser | UserItem>(data)
    selectedUsers.value = []
  } catch {
    users.value = []
    total.value = 0
    ElMessage.error('账号加载失败')
  } finally {
    loading.value = false
  }
}

function openPasswordDialog(user?: CampusManagedUser) {
  if (!requireOrganization()) return
  activeUser.value = user ?? null
  temporaryPassword.value = ''
  passwordDialogVisible.value = true
}

async function submitPassword() {
  const orgId = requireOrganization()
  if (!orgId) return
  if (!temporaryPassword.value) {
    ElMessage.warning('请输入临时密码')
    return
  }

  passwordSubmitting.value = true
  try {
    const { data } = await updateCampusUserPassword({
      organization_id: orgId,
      user_ids: targetUserIds(),
      password: temporaryPassword.value,
    })
    passwordDialogVisible.value = false
    showResults('修改密码', data.data.results, data.data.success_count, data.data.failed_count)
  } catch {
    ElMessage.error('密码修改失败')
  } finally {
    passwordSubmitting.value = false
  }
}

async function openClearDialog(user?: CampusManagedUser) {
  if (!requireOrganization()) return
  activeUser.value = user ?? null
  clearPreview.value = null
  clearDialogVisible.value = true
  await loadClearPreview()
}

async function loadClearPreview() {
  const orgId = requireOrganization()
  if (!orgId) return

  clearPreviewLoading.value = true
  try {
    const { data } = await previewCampusClearContent({
      organization_id: orgId,
      user_ids: targetUserIds(),
    })
    clearPreview.value = data.data
  } catch {
    clearPreview.value = null
    ElMessage.error('清空预览加载失败')
  } finally {
    clearPreviewLoading.value = false
  }
}

async function submitClearContent() {
  const orgId = requireOrganization()
  if (!orgId || !clearPreview.value) return

  try {
    await ElMessageBox.confirm('确认清空目标账号的资源和场景？此操作不可撤销。', '二次确认', {
      type: 'warning',
      confirmButtonText: '确认清空',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  clearSubmitting.value = true
  try {
    const { data } = await clearCampusContent({
      organization_id: orgId,
      user_ids: targetUserIds(),
      confirm: true,
    })
    clearDialogVisible.value = false
    showResults('清空资源和场景', data.data.results, data.data.success_count, data.data.failed_count)
    await loadUsers()
  } catch {
    ElMessage.error('清空资源和场景失败')
  } finally {
    clearSubmitting.value = false
  }
}

function openImportDialog(user?: CampusManagedUser) {
  if (!requireOrganization()) return
  activeUser.value = user ?? null
  importFile.value = null
  importDialogVisible.value = true
}

function handleImportFileChange(uploadFile: UploadFile) {
  importFile.value = uploadFile.raw ?? null
}

function handleImportFileRemove() {
  importFile.value = null
}

async function submitImportScene() {
  const orgId = requireOrganization()
  if (!orgId || !importFile.value) return

  importSubmitting.value = true
  try {
    const { data } = await importCampusSceneZip({
      organization_id: orgId,
      user_ids: targetUserIds(),
      file: importFile.value,
    })
    importDialogVisible.value = false
    showResults('导入场景', data.data.results, data.data.success_count, data.data.failed_count)
    await loadUsers()
  } catch {
    ElMessage.error('导入场景失败')
  } finally {
    importSubmitting.value = false
  }
}

function openResourceDialog(user?: CampusManagedUser) {
  if (!requireOrganization()) return
  activeUser.value = user ?? null
  resourceFile.value = null
  resourceName.value = ''
  resourceType.value = 'polygen'
  resourceInfo.value = ''
  resourceDialogVisible.value = true
}

function handleResourceFileChange(uploadFile: UploadFile) {
  resourceFile.value = uploadFile.raw ?? null
  if (!resourceFile.value) return
  if (resourceFile.value.size > RESOURCE_UPLOAD_MAX_BYTES) {
    ElMessage.warning('资源文件不能超过 200MB')
    resourceFile.value = null
    return
  }

  if (!resourceName.value.trim()) {
    resourceName.value = stripFileExtension(resourceFile.value.name)
  }
  resourceType.value = inferResourceType(resourceFile.value)
}

function handleResourceFileRemove() {
  resourceFile.value = null
  resourceName.value = ''
  resourceType.value = 'polygen'
}

async function submitUploadResource() {
  const orgId = requireOrganization()
  if (!orgId || !resourceFile.value) return

  resourceSubmitting.value = true
  try {
    const { data } = await uploadCampusResource({
      organization_id: orgId,
      user_ids: targetUserIds(),
      file: resourceFile.value,
      name: resourceName.value || stripFileExtension(resourceFile.value.name),
      type: resourceType.value,
      info: resourceInfo.value,
    })
    resourceDialogVisible.value = false
    showResults('上传资源', data.data.results, data.data.success_count, data.data.failed_count)
    await loadUsers()
  } catch {
    ElMessage.error('上传资源失败')
  } finally {
    resourceSubmitting.value = false
  }
}

function stripFileExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '') || filename
}

function inferResourceType(file: File) {
  const mimeType = file.type.toLowerCase()
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (mimeType.startsWith('image/')) return 'picture'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (extension === 'vox') return 'voxel'
  if (['glb', 'gltf', 'fbx', 'obj', 'stl'].includes(extension)) return 'polygen'
  return 'file'
}

onMounted(async () => {
  await loadOrganizations()
  await loadUsers()
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

.content-counts {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.row-actions {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
  align-items: center;
}

.row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.pagination {
  padding: var(--spacing-md);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.dialog-body {
  display: grid;
  gap: var(--spacing-md);
}

.preview-box {
  display: grid;
  gap: var(--spacing-sm);
}

.upload-icon {
  font-size: 28px;
  color: var(--primary-color);
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
