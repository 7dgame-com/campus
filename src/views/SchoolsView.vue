<template>
  <div class="schools-view">
    <section class="page-header">
      <div>
        <h2>学校管理</h2>
        <p>学校直接复用平台 Organization，作为账号、菜单和工具开放边界。</p>
      </div>
      <el-button v-if="can('manage-school-boundaries')" type="primary" @click="openOrganizationCreate">
        新建学校
      </el-button>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>学校</h3>
          <span>Organization，用于账号、菜单和工具开放范围。</span>
        </div>
      </div>
      <el-table :data="organizations" v-loading="loadingOrganizations" stripe>
        <el-table-column prop="title" label="学校名称" min-width="180" />
        <el-table-column prop="name" label="标识" min-width="180" />
        <el-table-column v-if="can('manage-school-boundaries')" label="操作" width="110">
          <template #default="{ row }">
            <el-button link type="primary" @click="openOrganizationEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="organizationDialog.visible" :title="organizationDialog.mode === 'create' ? '新建学校' : '编辑学校'" width="520px">
      <el-form label-position="top">
        <el-form-item label="学校名称">
          <el-input v-model="organizationForm.title" placeholder="例如 第一实验学校" />
        </el-form-item>
        <el-form-item label="标识">
          <el-input v-model="organizationForm.name" :disabled="organizationDialog.mode === 'edit'" placeholder="例如 school-first-lab" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="organizationDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitOrganization">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createOrganization,
  listOrganizations,
  updateOrganization,
  type OrganizationSummary,
} from '../api'
import { usePermissions } from '../composables/usePermissions'
import { normalizeList } from '../utils/apiData'

const { can } = usePermissions()

const organizations = ref<OrganizationSummary[]>([])
const loadingOrganizations = ref(false)
const submitting = ref(false)

const organizationDialog = reactive({ visible: false, mode: 'create' as 'create' | 'edit' })
const organizationForm = reactive({ id: 0, title: '', name: '' })

async function loadOrganizations() {
  loadingOrganizations.value = true
  try {
    const { data } = await listOrganizations()
    organizations.value = normalizeList<OrganizationSummary>(data)
  } catch {
    ElMessage.error('学校边界加载失败')
  } finally {
    loadingOrganizations.value = false
  }
}

function openOrganizationCreate() {
  organizationDialog.mode = 'create'
  Object.assign(organizationForm, { id: 0, title: '', name: '' })
  organizationDialog.visible = true
}

function openOrganizationEdit(row: OrganizationSummary) {
  organizationDialog.mode = 'edit'
  Object.assign(organizationForm, row)
  organizationDialog.visible = true
}

async function submitOrganization() {
  if (!organizationForm.title.trim()) {
    ElMessage.error('请填写显示名称')
    return
  }
  if (organizationDialog.mode === 'create' && !organizationForm.name.trim()) {
    ElMessage.error('请填写标识')
    return
  }

  submitting.value = true
  try {
    if (organizationDialog.mode === 'create') {
      await createOrganization({ title: organizationForm.title.trim(), name: organizationForm.name.trim() })
    } else {
      await updateOrganization({ id: organizationForm.id, title: organizationForm.title.trim() })
    }
    ElMessage.success('已保存')
    organizationDialog.visible = false
    await loadOrganizations()
  } catch {
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadOrganizations()
})
</script>

<style scoped>
.schools-view {
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
  justify-content: space-between;
  gap: var(--spacing-lg);
  align-items: flex-start;
}

.page-header h2,
.panel-header h3 {
  margin: 0 0 var(--spacing-xs);
}

.page-header p,
.panel-header span {
  color: var(--text-secondary);
}

.panel {
  overflow: hidden;
}

.panel-header {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

@media (max-width: 900px) {
  .page-header,
  .panel-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
