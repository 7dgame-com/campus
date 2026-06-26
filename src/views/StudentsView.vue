<template>
  <div class="students-view">
    <section class="page-header">
      <div>
        <h2>组织账号</h2>
        <p>维护当前组织内老师和学生账号的密码、资源、场景归属。</p>
      </div>
      <div v-if="canManageAccounts" class="header-actions">
        <el-button :icon="Key" type="primary" :disabled="!canOperate" @click="openPasswordDialog()">批量改密码</el-button>
        <el-button :icon="Brush" type="danger" plain :disabled="!canOperate" @click="openClearDialog()">批量清空</el-button>
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
      <el-tag size="large" type="info">当前组织：{{ organizationTitle }}</el-tag>
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
        <el-table-column label="组织" min-width="180">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ organizationLabel(row) }}</el-tag>
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
        <el-table-column v-if="canManageAccounts" label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link :icon="Key" type="primary" @click="openPasswordDialog(row)">改密码</el-button>
              <el-button link :icon="Brush" type="danger" @click="openClearDialog(row)">清空</el-button>
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
        <div class="password-field">
          <el-input
            v-model="temporaryPassword"
            type="password"
            show-password
            placeholder="临时密码"
            maxlength="64"
            autocomplete="new-password"
          />
          <p class="password-policy-hint">{{ PASSWORD_POLICY_HINT }}</p>
        </div>
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

    <el-dialog
      v-model="resourceDialogVisible"
      title="上传资源"
      width="560px"
      :close-on-click-modal="!resourceSubmitting"
      :close-on-press-escape="!resourceSubmitting"
      :show-close="!resourceSubmitting"
    >
      <div class="dialog-body">
        <el-alert :title="targetSummary" type="info" :closable="false" show-icon />
        <el-alert
          v-if="resourceBatchProgress"
          :title="`正在上传第 ${resourceBatchProgress.current}/${resourceBatchProgress.total} 个账号：${resourceBatchProgress.username}`"
          type="success"
          :closable="false"
          show-icon
        />
        <div v-if="resourceStorageProgress" class="resource-progress">
          <span>{{ resourceStorageProgress.label }}</span>
          <el-progress :percentage="Math.round(resourceStorageProgress.progress * 100)" />
        </div>
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
            <div class="detected-resource-type">
              <el-tag v-if="resourceType" type="info">{{ resourceTypeLabel }}</el-tag>
              <span v-else>选择文件后自动识别</span>
            </div>
          </el-form-item>
          <el-form-item label="资源说明">
            <el-input v-model="resourceInfo" type="textarea" :rows="2" placeholder="可选" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button :disabled="resourceSubmitting" @click="resourceDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resourceSubmitting" :disabled="!resourceFile || !resourceType" @click="submitUploadResource">
          {{ resourceBatchProgress ? `上传中 ${resourceBatchProgress.current}/${resourceBatchProgress.total}` : '确认上传' }}
        </el-button>
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
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus'
import { Brush, Key, Refresh, Upload } from '@element-plus/icons-vue'
import {
  clearCampusContent,
  listCampusManagedUsers,
  previewCampusClearContent,
  updateCampusUserPassword,
  uploadCampusResource,
  type CampusClearPreview,
  type CampusManagedUser,
  type CampusOperationResult,
} from '../api'
import { useCurrentOrganization } from '../composables/useCurrentOrganization'
import { usePermissions } from '../composables/usePermissions'
import { ensureMainUploadedFile, type MainUploadedFile } from '../services/mainFileUpload'
import { formatTimestamp, normalizeList, normalizeTotal } from '../utils/apiData'

const ROLE_PRIORITY: Record<string, number> = { root: 4, admin: 3, manager: 2, user: 1 }
const RESOURCE_UPLOAD_MAX_BYTES = 200 * 1024 * 1024
const ALL_MANAGED_USERS_PAGE_SIZE = 100
const PASSWORD_POLICY_HINT = '密码要求：8-64 位，需包含大写字母、小写字母、数字、特殊字符中的至少 3 类，且不能包含用户名或邮箱信息。'
const { can } = usePermissions()
const {
  organization,
  organizationName,
  organizationId,
  organizationTitle,
  error: organizationError,
  loadCurrentOrganization,
} = useCurrentOrganization()

const users = ref<CampusManagedUser[]>([])
const selectedUsers = ref<CampusManagedUser[]>([])
const loading = ref(false)
const search = ref('')
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
const resourceDialogVisible = ref(false)
const resourceFile = ref<File | null>(null)
const resourceName = ref('')
type ResourceType = 'polygen' | 'picture' | 'video' | 'audio' | 'file'

const resourceType = ref<ResourceType | ''>('')
const resourceInfo = ref('')
const resourceSubmitting = ref(false)
const resourceBatchProgress = ref<{ current: number; total: number; username: string } | null>(null)
const resourceStorageProgress = ref<{ label: string; progress: number } | null>(null)
const resultDialogVisible = ref(false)
const resultTitle = ref('')
const operationResults = ref<CampusOperationResult[]>([])
let mounted = false
const resourceTypeOptions: Array<{ label: string; value: ResourceType }> = [
  { label: '3D 模型', value: 'polygen' },
  { label: '图片', value: 'picture' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
  { label: '其他文件', value: 'file' },
]
const resourceAcceptByType: Record<ResourceType, string> = {
  polygen: '.glb,.gltf,.fbx,.obj,.stl',
  picture: '.jpg,.jpeg,.png,.gif,.webp',
  video: '.mp4,.webm,.mov',
  audio: '.mp3,.wav,.ogg,.m4a',
  file: '.pdf,.zip,.rar,.7z',
}

const canManageAccounts = computed(() => can('manage-student-accounts'))
const canOperate = computed(() => canManageAccounts.value && organizationId.value !== null)
const resourceAccept = computed(() => Object.values(resourceAcceptByType).join(','))
const resourceTypeLabel = computed(() =>
  resourceTypeOptions.find((type) => type.value === resourceType.value)?.label ?? '未识别'
)

const targetSummary = computed(() => {
  if (activeUser.value) return `目标账号：${activeUser.value.username}`
  if (selectedUsers.value.length) return `目标账号：已选 ${selectedUsers.value.length} 个账号`
  return '目标账号：当前组织全部可管理账号'
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
      return '组织管理员'
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
    const detail = organizationError.value
      || (organizationName.value ? `组织标识：${organizationName.value}` : '缺少组织上下文')
    ElMessage.warning(`当前组织尚未加载完成：${detail}`)
    return null
  }
  return organizationId.value
}

function organizationLabel(row: CampusManagedUser) {
  const currentOrganizationId = organizationId.value
  const rowOrganization = row.organizations?.find((item) => item.id === currentOrganizationId)
  return rowOrganization?.title ?? organization.value?.title ?? organizationTitle.value
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

async function loadUsers() {
  const orgId = requireOrganization()
  if (!orgId) {
    users.value = []
    total.value = 0
    return
  }

  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value,
      organization_id: orgId,
    }
    if (search.value.trim()) params.search = search.value.trim()

    const { data } = await listCampusManagedUsers(params)
    users.value = normalizeList<CampusManagedUser>(data)
    total.value = normalizeTotal<CampusManagedUser>(data)
    selectedUsers.value = []
  } catch {
    users.value = []
    total.value = 0
    ElMessage.error('账号加载失败')
  } finally {
    loading.value = false
  }
}

async function loadAllManageableUsers(orgId: number): Promise<CampusManagedUser[]> {
  const allUsers: CampusManagedUser[] = []
  let nextPage = 1
  let expectedTotal = Number.POSITIVE_INFINITY

  while (allUsers.length < expectedTotal) {
    const { data } = await listCampusManagedUsers({
      page: nextPage,
      pageSize: ALL_MANAGED_USERS_PAGE_SIZE,
      organization_id: orgId,
    })
    const pageUsers = normalizeList<CampusManagedUser>(data)
    const totalUsers = normalizeTotal<CampusManagedUser>(data)

    if (Number.isFinite(totalUsers) && totalUsers >= 0) {
      expectedTotal = totalUsers
    }
    if (!pageUsers.length) break

    allUsers.push(...pageUsers)
    nextPage += 1
  }

  return allUsers
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

  const targetDescription = targetSummary.value.replace('目标账号：', '')

  try {
    await ElMessageBox.confirm(`确认将 ${targetDescription} 的密码修改为当前输入的临时密码？`, '二次确认', {
      type: 'warning',
      confirmButtonText: '确认修改',
      cancelButtonText: '取消',
    })
  } catch {
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

function openResourceDialog(user?: CampusManagedUser) {
  if (!requireOrganization()) return
  activeUser.value = user ?? null
  resourceFile.value = null
  resourceName.value = ''
  resourceType.value = ''
  resourceInfo.value = ''
  resourceBatchProgress.value = null
  resourceStorageProgress.value = null
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

  const detectedType = inferResourceType(resourceFile.value)
  if (!detectedType) {
    ElMessage.warning('暂不支持该资源格式')
    resourceFile.value = null
    resourceType.value = ''
    return
  }

  resourceType.value = detectedType
}

function handleResourceFileRemove() {
  resourceFile.value = null
  resourceName.value = ''
  resourceType.value = ''
  resourceStorageProgress.value = null
}

async function submitUploadResource() {
  const orgId = requireOrganization()
  if (!orgId || !resourceFile.value || !resourceType.value) return

  resourceSubmitting.value = true
  try {
    const uploadedFile = await ensureMainUploadedFile(resourceFile.value, {
      directory: resourceStorageDirectory(resourceType.value),
      onHashProgress: (progress) => {
        resourceStorageProgress.value = { label: '计算文件 MD5', progress }
      },
      onUploadProgress: (progress) => {
        resourceStorageProgress.value = { label: '确认资源文件', progress }
      },
      onMetadataProgress: (label) => {
        resourceStorageProgress.value = { label, progress: 1 }
      },
    })
    const resourcePayload = {
      organization_id: orgId,
      file: uploadedFile,
      name: resourceName.value || stripFileExtension(resourceFile.value.name),
      type: resourceType.value,
      info: resourcePayloadInfo(uploadedFile),
    }
    const targets = activeUser.value
      ? []
      : selectedUsers.value.length
        ? selectedUsers.value.slice()
        : await loadAllManageableUsers(orgId)

    if (!activeUser.value) {
      if (!targets.length) {
        ElMessage.warning('当前组织没有可上传的目标账号')
        return
      }
      const results = await uploadResourceForSelectedUsersSequentially(resourcePayload, targets)
      const successCount = results.filter((result) => result.success).length
      const failedCount = results.length - successCount
      resourceDialogVisible.value = false
      showResults('上传资源', results, successCount, failedCount)
      await loadUsers()
      return
    }

    const { data } = await uploadCampusResource({
      ...resourcePayload,
      user_ids: targetUserIds(),
    })
    resourceDialogVisible.value = false
    showResults('上传资源', data.data.results, data.data.success_count, data.data.failed_count)
    await loadUsers()
  } catch (error) {
    ElMessage.error(`上传资源失败：${requestErrorMessage(error)}`)
  } finally {
    resourceSubmitting.value = false
    resourceBatchProgress.value = null
    resourceStorageProgress.value = null
  }
}

async function uploadResourceForSelectedUsersSequentially(
  payload: {
    organization_id: number
    file: MainUploadedFile
    name: string
    type: ResourceType
    info?: string
  },
  targets: CampusManagedUser[],
): Promise<CampusOperationResult[]> {
  const results: CampusOperationResult[] = []

  for (const [index, user] of targets.entries()) {
    resourceBatchProgress.value = {
      current: index + 1,
      total: targets.length,
      username: user.username,
    }

    try {
      const { data } = await uploadCampusResource({
        ...payload,
        user_ids: [user.id],
      })
      results.push(...data.data.results)
    } catch (error) {
      results.push({
        user_id: user.id,
        username: user.username,
        success: false,
        message: '上传失败',
        error: requestErrorMessage(error),
      })
    }
  }

  return results
}

function stripFileExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '') || filename
}

function inferResourceType(file: File): ResourceType | '' {
  const mimeType = file.type.toLowerCase()
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (['glb', 'gltf', 'fbx', 'obj', 'stl'].includes(extension)) return 'polygen'
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'picture'
  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(extension)) return 'video'
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension)) return 'audio'
  if (['pdf', 'zip', 'rar', '7z'].includes(extension)) return 'file'
  return ''
}

function resourceStorageDirectory(type: ResourceType): string {
  return type
}

function resourcePayloadInfo(uploadedFile: MainUploadedFile): string | undefined {
  return uploadedFile.info || resourceInfo.value.trim() || undefined
}

function requestErrorMessage(error: unknown): string {
  const err = error as {
    response?: { data?: { message?: string; error?: string } }
    message?: string
  }
  return err.response?.data?.message || err.response?.data?.error || err.message || '请求失败'
}

watch(organizationId, (id, previousId) => {
  if (!mounted || !id || id === previousId) return
  refreshFromFirstPage()
})

onMounted(async () => {
  await loadCurrentOrganization()
  mounted = true
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

.password-field {
  display: grid;
  gap: var(--spacing-xs);
}

.password-policy-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.preview-box {
  display: grid;
  gap: var(--spacing-sm);
}

.upload-icon {
  font-size: 28px;
  color: var(--primary-color);
}

.detected-resource-type {
  min-height: 32px;
  display: flex;
  align-items: center;
  color: var(--text-secondary);
}

.resource-progress {
  display: grid;
  gap: var(--spacing-xs);
  color: var(--text-secondary);
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
