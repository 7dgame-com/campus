<template>
  <div class="classes-view">
    <section class="page-header">
      <div>
        <h2>班级管理</h2>
        <p>班级直接复用平台 Group，可按课程、年级或项目组织学生协作。</p>
      </div>
      <div class="header-actions">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索班级"
          style="width: 220px"
        />
        <el-button type="primary" @click="openCreate">新建班级</el-button>
      </div>
    </section>

    <section class="panel">
      <el-table :data="filteredGroups" v-loading="loading" stripe>
        <el-table-column prop="name" label="班级名称" min-width="180" />
        <el-table-column prop="description" label="说明" min-width="220">
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column prop="info" label="备注" min-width="220">
          <template #default="{ row }">{{ row.info || '-' }}</template>
        </el-table-column>
        <el-table-column prop="user_id" label="创建者 ID" width="120">
          <template #default="{ row }">{{ row.user_id || '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">{{ formatTimestamp(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialog.visible" :title="dialog.mode === 'create' ? '新建班级' : '编辑班级'" width="560px">
      <el-form label-position="top">
        <el-form-item label="班级名称">
          <el-input v-model="form.name" placeholder="例如 2026 春季 AR 创作班" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="课程、年级、项目或行政班说明" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.info" type="textarea" :rows="3" placeholder="可记录校区、老师或协作说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitGroup">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createGroup, listGroups, updateGroup, type GroupItem } from '../api'
import { normalizeList, formatTimestamp } from '../utils/apiData'

const groups = ref<GroupItem[]>([])
const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')

const dialog = reactive({ visible: false, mode: 'create' as 'create' | 'edit' })
const form = reactive({ id: 0, name: '', description: '', info: '' })

const filteredGroups = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) return groups.value

  return groups.value.filter((item) => {
    const text = [item.name, item.description, item.info].filter(Boolean).join(' ').toLowerCase()
    return text.includes(query)
  })
})

async function loadGroups() {
  loading.value = true
  try {
    const { data } = await listGroups({ 'per-page': 100 })
    groups.value = normalizeList<GroupItem>(data)
  } catch {
    groups.value = []
    ElMessage.error('班级加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  dialog.mode = 'create'
  Object.assign(form, { id: 0, name: '', description: '', info: '' })
  dialog.visible = true
}

function openEdit(row: GroupItem) {
  dialog.mode = 'edit'
  Object.assign(form, {
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    info: row.info ?? '',
  })
  dialog.visible = true
}

async function submitGroup() {
  if (!form.name.trim()) {
    ElMessage.error('请填写班级名称')
    return
  }

  const payload = {
    name: form.name.trim(),
    description: form.description.trim(),
    info: form.info.trim(),
  }

  submitting.value = true
  try {
    if (dialog.mode === 'create') {
      await createGroup(payload)
    } else {
      await updateGroup(form.id, payload)
    }
    ElMessage.success('已保存')
    dialog.visible = false
    await loadGroups()
  } catch {
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

onMounted(loadGroups)
</script>

<style scoped>
.classes-view {
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

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.panel {
  overflow: hidden;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
  }

  .header-actions,
  .header-actions .el-input {
    width: 100%;
  }
}
</style>
