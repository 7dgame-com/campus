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
        <el-button :icon="DocumentAdd" :disabled="!canOperate" @click="openSceneImportDialog()">导入场景</el-button>
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
        <el-table-column v-if="canManageAccounts" label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link :icon="Key" type="primary" @click="openPasswordDialog(row)">改密码</el-button>
              <el-button link :icon="Brush" type="danger" @click="openClearDialog(row)">清空</el-button>
              <el-button link :icon="Upload" @click="openResourceDialog(row)">上传资源</el-button>
              <el-button v-if="!hasProtectedBatchRole(row)" link :icon="DocumentAdd" @click="openSceneImportDialog(row)">导入场景</el-button>
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
        <el-alert
          v-if="resourceFileProgress"
          :title="`正在上传第 ${resourceFileProgress.current}/${resourceFileProgress.total} 个资源：${resourceFileProgress.filename}`"
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
              v-model:file-list="resourceUploadFileList"
              drag
              multiple
              :accept="resourceAccept"
              :auto-upload="false"
              :on-change="handleResourceFileChange"
              :on-remove="handleResourceFileRemove"
            >
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div class="el-upload__text">拖入文件或点击选择</div>
            </el-upload>
          </el-form-item>
          <el-form-item label="资源名称">
            <el-input
              v-model="resourceName"
              :disabled="resourceUploadItems.length > 1"
              :placeholder="resourceUploadItems.length > 1 ? '多文件上传时默认使用各自文件名' : '默认使用文件名'"
            />
          </el-form-item>
          <el-form-item label="资源类型">
            <div class="detected-resource-type">
              <template v-if="resourceUploadItems.length === 1">
                <el-tag type="info">{{ resourceTypeLabel(resourceUploadItems[0].type) }}</el-tag>
              </template>
              <template v-else-if="resourceUploadItems.length > 1">
                <span>已选择 {{ resourceUploadItems.length }} 个文件</span>
                <el-tag v-for="summary in resourceTypeSummary" :key="summary.type" type="info">
                  {{ summary.label }} {{ summary.count }}
                </el-tag>
              </template>
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
        <el-button type="primary" :loading="resourceSubmitting" :disabled="!resourceUploadItems.length" @click="submitUploadResource">
          {{ resourceSubmitButtonLabel }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="sceneImportDialogVisible"
      title="导入场景"
      width="560px"
      :close-on-click-modal="!sceneImportSubmitting"
      :close-on-press-escape="!sceneImportSubmitting"
      :show-close="!sceneImportSubmitting"
    >
      <div class="dialog-body">
        <el-alert :title="sceneImportTargetSummary" type="info" :closable="false" show-icon />
        <el-alert
          title="场景包会复用项目现有导出/导入能力；多个账号会按顺序逐个导入。"
          type="warning"
          :closable="false"
          show-icon
        />
        <el-alert
          v-if="sceneImportProgress"
          :title="`正在导入第 ${sceneImportProgress.current}/${sceneImportProgress.total} 个账号：${sceneImportProgress.username}`"
          type="success"
          :closable="false"
          show-icon
        />
        <el-form label-position="top">
          <el-form-item label="场景包">
            <el-upload
              v-model:file-list="sceneImportFileList"
              drag
              accept=".zip"
              :auto-upload="false"
              :on-change="handleSceneZipChange"
              :on-remove="handleSceneZipRemove"
            >
              <el-icon class="upload-icon"><DocumentAdd /></el-icon>
              <div class="el-upload__text">拖入 .zip 场景包或点击选择</div>
            </el-upload>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button :disabled="sceneImportSubmitting" @click="sceneImportDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="sceneImportSubmitting" :disabled="!sceneImportFile" @click="submitImportScene">
          确认导入
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
import { ElMessage, ElMessageBox, type UploadFile, type UploadFiles, type UploadUserFile } from 'element-plus'
import { Brush, DocumentAdd, Key, Refresh, Upload } from '@element-plus/icons-vue'
import {
  clearCampusContent,
  importCampusSceneZip,
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
import {
  campusAllowedResourceExtensions,
  campusResourceAccept,
  campusResourceTypeOptions,
  inferCampusResourceType,
  type CampusResourceType,
} from '../utils/resourceUploadPolicy'

const ROLE_PRIORITY: Record<string, number> = { root: 4, admin: 3, manager: 2, user: 1 }
const BATCH_PROTECTED_ROLES = ['root', 'admin', 'manager'] as const
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
const resourceUploadFileList = ref<UploadUserFile[]>([])
type ResourceType = CampusResourceType
interface ResourceUploadItem {
  file: File
  type: ResourceType
}
interface ResourceUploadPayload {
  organization_id: number
  file: MainUploadedFile
  name: string
  type: ResourceType
  info?: string
}

const resourceUploadItems = ref<ResourceUploadItem[]>([])
const resourceName = ref('')
const resourceInfo = ref('')
const resourceSubmitting = ref(false)
const resourceBatchProgress = ref<{ current: number; total: number; username: string } | null>(null)
const resourceFileProgress = ref<{ current: number; total: number; filename: string } | null>(null)
const resourceStorageProgress = ref<{ label: string; progress: number } | null>(null)
const sceneImportDialogVisible = ref(false)
const sceneImportFileList = ref<UploadUserFile[]>([])
const sceneImportFile = ref<File | null>(null)
const sceneImportSubmitting = ref(false)
const sceneImportProgress = ref<{ current: number; total: number; username: string } | null>(null)
const resultDialogVisible = ref(false)
const resultTitle = ref('')
const operationResults = ref<CampusOperationResult[]>([])
let mounted = false
const resourceTypeOptions = campusResourceTypeOptions

const canManageAccounts = computed(() => can('manage-student-accounts'))
const canOperate = computed(() => canManageAccounts.value && organizationId.value !== null)
const resourceAccept = campusResourceAccept
const resourceTypeSummary = computed(() => {
  const counts = new Map<ResourceType, number>()
  for (const item of resourceUploadItems.value) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  }

  return resourceTypeOptions
    .filter((type) => counts.has(type.value))
    .map((type) => ({ type: type.value, label: type.label, count: counts.get(type.value) ?? 0 }))
})
const resourceSubmitButtonLabel = computed(() => {
  if (resourceFileProgress.value) {
    return `上传中 ${resourceFileProgress.value.current}/${resourceFileProgress.value.total}`
  }
  if (resourceBatchProgress.value) {
    return `上传中 ${resourceBatchProgress.value.current}/${resourceBatchProgress.value.total}`
  }
  return '确认上传'
})

const targetSummary = computed(() => {
  if (activeUser.value) return `目标账号：${activeUser.value.username}`
  if (selectedUsers.value.length) {
    const { allowed, skipped } = splitBatchTargets(selectedUsers.value)
    if (skipped.length) return `目标账号：已选 ${selectedUsers.value.length} 个账号，将处理 ${allowed.length} 个普通用户，跳过 ${skipped.length} 个管理员账号`
    return `目标账号：已选 ${selectedUsers.value.length} 个账号`
  }
  return '目标账号：当前组织全部普通用户（统一操作跳过 root/admin/manager）'
})
const sceneImportTargetSummary = computed(() => {
  if (activeUser.value) return `目标账号：${activeUser.value.username}`
  if (selectedUsers.value.length) {
    const { allowed, skipped } = splitBatchTargets(selectedUsers.value)
    if (skipped.length) return `目标账号：已选 ${selectedUsers.value.length} 个账号，将依次导入 ${allowed.length} 个普通学生，跳过 ${skipped.length} 个管理员账号`
    return `目标账号：已选 ${selectedUsers.value.length} 个账号，将依次导入`
  }
  return '目标账号：当前组织全部普通学生（会依次导入，跳过 root/admin/manager）'
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

function operationScope(): 'single' | 'batch' {
  return activeUser.value ? 'single' : 'batch'
}

function hasProtectedBatchRole(user: CampusManagedUser) {
  return (user.roles ?? []).some((role) => BATCH_PROTECTED_ROLES.includes(role as (typeof BATCH_PROTECTED_ROLES)[number]))
}

function splitBatchTargets(targets: CampusManagedUser[]) {
  const allowed: CampusManagedUser[] = []
  const skipped: CampusManagedUser[] = []

  for (const user of targets) {
    if (hasProtectedBatchRole(user)) {
      skipped.push(user)
    } else {
      allowed.push(user)
    }
  }

  return { allowed, skipped }
}

function selectedBatchSkippedTargets() {
  if (activeUser.value || !selectedUsers.value.length) return []
  return splitBatchTargets(selectedUsers.value).skipped
}

function batchProtectionNote(skippedTargets = selectedBatchSkippedTargets()) {
  if (activeUser.value) return ''
  if (selectedUsers.value.length && skippedTargets.length) {
    return `统一操作会跳过 ${skippedTargets.length} 个 root/admin/manager 账号。`
  }
  return '统一操作只处理普通用户，会跳过 root/admin/manager 账号。'
}

function warnSkippedBatchTargets(skippedTargets: CampusManagedUser[]) {
  if (!skippedTargets.length) return
  ElMessage.warning(`统一操作已跳过 ${skippedTargets.length} 个 root/admin/manager 账号`)
}

function ensureBatchSelectionCanOperate(actionLabel: string) {
  if (activeUser.value || !selectedUsers.value.length) return true

  const { allowed, skipped } = splitBatchTargets(selectedUsers.value)
  if (!allowed.length) {
    ElMessage.warning(`已选账号均为 root/admin/manager，无法统一${actionLabel}`)
    return false
  }

  warnSkippedBatchTargets(skipped)
  return true
}

function targetUserIds() {
  if (activeUser.value) return [activeUser.value.id]
  if (selectedUsers.value.length) return splitBatchTargets(selectedUsers.value).allowed.map((user) => user.id)
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

function showResults(title: string, results: CampusOperationResult[], successCount: number, failedCount: number, skippedCount = 0) {
  resultTitle.value = `${title}：成功 ${successCount}，失败 ${failedCount}${skippedCount ? `，跳过 ${skippedCount}` : ''}`
  operationResults.value = results
  resultDialogVisible.value = true
}

function resultDetail(result: CampusOperationResult) {
  if (result.errors?.length) return result.errors.join('；')
  if (result.verse_id) return `${result.message}：场景 #${result.verse_id}`
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
  if (!ensureBatchSelectionCanOperate('改密码')) {
    activeUser.value = null
    return
  }
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
  const skippedCount = selectedBatchSkippedTargets().length
  const note = batchProtectionNote()

  try {
    await ElMessageBox.confirm(`确认将 ${targetDescription} 的密码修改为当前输入的临时密码？${note ? `\n${note}` : ''}`, '二次确认', {
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
      operation_scope: operationScope(),
    })
    passwordDialogVisible.value = false
    showResults('修改密码', data.data.results, data.data.success_count, data.data.failed_count, data.data.skipped_count ?? skippedCount)
  } catch {
    ElMessage.error('密码修改失败')
  } finally {
    passwordSubmitting.value = false
  }
}

async function openClearDialog(user?: CampusManagedUser) {
  if (!requireOrganization()) return
  activeUser.value = user ?? null
  if (!ensureBatchSelectionCanOperate('清空')) {
    activeUser.value = null
    return
  }
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
      operation_scope: operationScope(),
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
  const skippedCount = selectedBatchSkippedTargets().length || clearPreview.value.skipped_count || 0
  const note = batchProtectionNote()

  try {
    await ElMessageBox.confirm(`确认清空目标账号的资源和场景？此操作不可撤销。${note ? `\n${note}` : ''}`, '二次确认', {
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
      operation_scope: operationScope(),
      confirm: true,
    })
    clearDialogVisible.value = false
    showResults('清空资源和场景', data.data.results, data.data.success_count, data.data.failed_count, data.data.skipped_count ?? skippedCount)
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
  if (!ensureBatchSelectionCanOperate('上传资源')) {
    activeUser.value = null
    return
  }
  resourceUploadFileList.value = []
  resourceUploadItems.value = []
  resourceName.value = ''
  resourceInfo.value = ''
  resourceBatchProgress.value = null
  resourceFileProgress.value = null
  resourceStorageProgress.value = null
  resourceDialogVisible.value = true
}

function openSceneImportDialog(user?: CampusManagedUser) {
  if (!requireOrganization()) return
  activeUser.value = user ?? null

  if (activeUser.value && hasProtectedBatchRole(activeUser.value)) {
    ElMessage.warning('导入场景只处理普通学生账号')
    activeUser.value = null
    return
  }

  if (!ensureSceneImportSelectionCanOperate()) {
    activeUser.value = null
    return
  }

  sceneImportFileList.value = []
  sceneImportFile.value = null
  sceneImportProgress.value = null
  sceneImportDialogVisible.value = true
}

function handleResourceFileChange(_uploadFile: UploadFile, uploadFiles: UploadFiles) {
  syncResourceUploadFiles(uploadFiles)
}

function handleResourceFileRemove(_uploadFile: UploadFile, uploadFiles: UploadFiles) {
  syncResourceUploadFiles(uploadFiles)
  resourceStorageProgress.value = null
}

function handleSceneZipChange(uploadFile: UploadFile, uploadFiles: UploadFiles) {
  const file = uploadFile.raw
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.zip')) {
    ElMessage.warning('请选择 .zip 场景包')
    syncSceneImportFiles(uploadFiles)
    return
  }

  syncSceneImportFiles(uploadFiles)
}

function handleSceneZipRemove() {
  sceneImportFile.value = null
}

function syncSceneImportFiles(uploadFiles: UploadFiles) {
  const zipFiles = [...uploadFiles]
    .filter((item) => item.raw?.name.toLowerCase().endsWith('.zip'))
  const latestZip = zipFiles.length ? zipFiles[zipFiles.length - 1] : undefined

  sceneImportFileList.value = latestZip ? [latestZip] : []
  sceneImportFile.value = latestZip?.raw ?? null
}

async function submitImportScene() {
  const orgId = requireOrganization()
  if (!orgId || !sceneImportFile.value) return

  const targetDescription = sceneImportTargetSummary.value.replace('目标账号：', '')
  const note = sceneImportProtectionNote()

  try {
    await ElMessageBox.confirm(`确认将该场景包按账号依次导入到 ${targetDescription}？${note ? `\n${note}` : ''}`, '二次确认', {
      type: 'warning',
      confirmButtonText: '确认导入',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  sceneImportSubmitting.value = true
  try {
    const { targets, skippedCount } = await resolveSceneImportTargets(orgId)
    if (!targets.length) {
      ElMessage.warning('没有可导入场景的普通学生账号')
      return
    }

    const results = await importSceneForUsersSequentially(orgId, sceneImportFile.value, targets)
    const successCount = results.filter((result) => result.success).length
    const failedCount = results.length - successCount

    sceneImportDialogVisible.value = false
    showResults('导入场景', results, successCount, failedCount, skippedCount)
    await loadUsers()
  } catch (error) {
    ElMessage.error(`导入场景失败：${requestErrorMessage(error)}`)
  } finally {
    sceneImportSubmitting.value = false
    sceneImportProgress.value = null
  }
}

function sceneImportProtectionNote() {
  if (activeUser.value) return ''
  return '导入会按账号顺序执行，只处理普通学生，会跳过 root/admin/manager 账号。'
}

function ensureSceneImportSelectionCanOperate() {
  if (activeUser.value || !selectedUsers.value.length) return true

  const { allowed, skipped } = splitBatchTargets(selectedUsers.value)
  if (!allowed.length) {
    ElMessage.warning('已选账号均为 root/admin/manager，无法导入场景')
    return false
  }

  warnSkippedSceneImportTargets(skipped)
  return true
}

function warnSkippedSceneImportTargets(skippedTargets: CampusManagedUser[]) {
  if (!skippedTargets.length) return
  ElMessage.warning(`导入场景已跳过 ${skippedTargets.length} 个 root/admin/manager 账号`)
}

async function resolveSceneImportTargets(orgId: number): Promise<{ targets: CampusManagedUser[]; skippedCount: number }> {
  if (activeUser.value) {
    return { targets: [activeUser.value], skippedCount: 0 }
  }

  const sourceTargets = selectedUsers.value.length
    ? selectedUsers.value.slice()
    : await loadAllManageableUsers(orgId)
  const { allowed, skipped } = splitBatchTargets(sourceTargets)
  warnSkippedSceneImportTargets(skipped)

  return { targets: allowed, skippedCount: skipped.length }
}

async function importSceneForUsersSequentially(orgId: number, file: File, targets: CampusManagedUser[]): Promise<CampusOperationResult[]> {
  const results: CampusOperationResult[] = []

  for (const [index, user] of targets.entries()) {
    sceneImportProgress.value = {
      current: index + 1,
      total: targets.length,
      username: user.username,
    }

    try {
      const { data } = await importCampusSceneZip({
        organization_id: orgId,
        user_ids: [user.id],
        file,
        operation_scope: 'batch',
      })
      results.push(...data.data.results)
    } catch (error) {
      results.push({
        user_id: user.id,
        username: user.username,
        success: false,
        message: '导入失败',
        error: requestErrorMessage(error),
      })
    }
  }

  return results
}

async function submitUploadResource() {
  const orgId = requireOrganization()
  if (!orgId || !resourceUploadItems.value.length) return

  resourceSubmitting.value = true
  try {
    let batchTargets: CampusManagedUser[] = []
    let skippedCount = selectedBatchSkippedTargets().length

    if (!activeUser.value) {
      const sourceTargets = selectedUsers.value.length
        ? selectedUsers.value.slice()
        : await loadAllManageableUsers(orgId)
      const { allowed, skipped } = splitBatchTargets(sourceTargets)
      skippedCount = skipped.length
      warnSkippedBatchTargets(skipped)

      if (!allowed.length) {
        ElMessage.warning('没有可统一上传资源的普通用户')
        return
      }
      batchTargets = allowed
    }

    const uploadItems = resourceUploadItems.value.slice()
    const results: CampusOperationResult[] = []

    for (const [index, item] of uploadItems.entries()) {
      resourceFileProgress.value = {
        current: index + 1,
        total: uploadItems.length,
        filename: item.file.name,
      }

      const resourcePayload = await prepareResourceUploadPayload(orgId, item, uploadItems.length)

      if (!activeUser.value) {
        results.push(...await uploadResourceForSelectedUsersSequentially(resourcePayload, batchTargets))
        continue
      }

      const { data } = await uploadCampusResource({
        ...resourcePayload,
        user_ids: targetUserIds(),
        operation_scope: operationScope(),
      })
      results.push(...data.data.results)
    }

    const successCount = results.filter((result) => result.success).length
    const failedCount = results.length - successCount
    resourceDialogVisible.value = false
    showResults('上传资源', results, successCount, failedCount, skippedCount)
    await loadUsers()
  } catch (error) {
    ElMessage.error(`上传资源失败：${requestErrorMessage(error)}`)
  } finally {
    resourceSubmitting.value = false
    resourceBatchProgress.value = null
    resourceFileProgress.value = null
    resourceStorageProgress.value = null
  }
}

async function prepareResourceUploadPayload(orgId: number, item: ResourceUploadItem, selectedFileCount: number): Promise<ResourceUploadPayload> {
  const uploadedFile = await ensureMainUploadedFile(item.file, {
    directory: resourceStorageDirectory(item.type),
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

  return {
    organization_id: orgId,
    file: uploadedFile,
    name: resourceNameForItem(item, selectedFileCount),
    type: item.type,
    info: resourcePayloadInfo(uploadedFile),
  }
}

async function uploadResourceForSelectedUsersSequentially(payload: ResourceUploadPayload, targets: CampusManagedUser[]): Promise<CampusOperationResult[]> {
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
        operation_scope: 'batch',
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

type ResourceFileRejectionReason = 'size' | 'missingExtension' | 'doubleExtension' | 'unsupported'

function syncResourceUploadFiles(uploadFiles: UploadFiles) {
  const previousSingleFilename = resourceUploadItems.value.length === 1 ? resourceUploadItems.value[0].file.name : ''
  const acceptedUploadFiles: UploadUserFile[] = []
  const items: ResourceUploadItem[] = []
  const rejectedCounts: Record<ResourceFileRejectionReason, number> = {
    size: 0,
    missingExtension: 0,
    doubleExtension: 0,
    unsupported: 0,
  }

  for (const uploadFile of uploadFiles) {
    if (!uploadFile.raw) continue

    const rejectionReason = resourceFileRejectionReason(uploadFile.raw)
    if (rejectionReason) {
      rejectedCounts[rejectionReason] += 1
      continue
    }

    acceptedUploadFiles.push(uploadFile)
    items.push({
      file: uploadFile.raw,
      type: inferResourceType(uploadFile.raw),
    })
  }

  resourceUploadFileList.value = acceptedUploadFiles
  resourceUploadItems.value = items
  syncResourceNameWithFiles(items, previousSingleFilename)
  warnRejectedResourceFiles(rejectedCounts)
}

function resourceFileRejectionReason(file: File): ResourceFileRejectionReason | null {
  if (file.size > RESOURCE_UPLOAD_MAX_BYTES) return 'size'

  const extension = resourceFileExtension(file)
  if (!extension) return 'missingExtension'
  if (hasDoubleExtension(file.name)) return 'doubleExtension'
  if (!campusAllowedResourceExtensions.has(extension)) return 'unsupported'

  return null
}

function warnRejectedResourceFiles(rejectedCounts: Record<ResourceFileRejectionReason, number>) {
  if (rejectedCounts.size) {
    ElMessage.warning(`已跳过 ${rejectedCounts.size} 个超过 200MB 的资源文件`)
  }
  if (rejectedCounts.missingExtension) {
    ElMessage.warning(`已跳过 ${rejectedCounts.missingExtension} 个缺少扩展名的资源文件`)
  }
  if (rejectedCounts.doubleExtension) {
    ElMessage.warning(`已跳过 ${rejectedCounts.doubleExtension} 个多重扩展名的资源文件`)
  }
  if (rejectedCounts.unsupported) {
    ElMessage.warning(`已跳过 ${rejectedCounts.unsupported} 个暂不支持的资源文件`)
  }
}

function syncResourceNameWithFiles(items: ResourceUploadItem[], previousSingleFilename: string) {
  if (items.length !== 1) {
    resourceName.value = ''
    return
  }

  if (!resourceName.value.trim() || items[0].file.name !== previousSingleFilename) {
    resourceName.value = stripFileExtension(items[0].file.name)
  }
}

function stripFileExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '') || filename
}

function resourceFileExtension(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

function hasDoubleExtension(filename: string) {
  const basename = filename.replace(/\\/g, '/').split('/').pop() ?? filename
  const withoutLastExtension = stripFileExtension(basename)
  return withoutLastExtension.includes('.')
}

function inferResourceType(file: File): ResourceType {
  const extension = resourceFileExtension(file)
  const resourceType = inferCampusResourceType(extension)
  if (!resourceType) throw new Error(`Unsupported campus resource extension: ${extension}`)
  return resourceType
}

function resourceNameForItem(item: ResourceUploadItem, selectedFileCount: number) {
  if (selectedFileCount === 1 && resourceName.value.trim()) {
    return resourceName.value.trim()
  }

  return stripFileExtension(item.file.name)
}

function resourceTypeLabel(type: ResourceType) {
  return resourceTypeOptions.find((option) => option.value === type)?.label ?? '未知资源'
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
  gap: var(--spacing-xs);
  flex-wrap: wrap;
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
