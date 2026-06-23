<template>
  <div class="schools-view">
    <section class="page-header">
      <div>
        <h2>组织信息</h2>
        <p>校园管理只作用于当前组织内的账号、资源、场景和教学入口。</p>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>当前组织</h3>
          <span>组织由平台统一维护，校园管理不创建、不切换组织。</span>
        </div>
      </div>
      <el-table :data="organizationRows" v-loading="loadingOrganization" stripe>
        <el-table-column prop="title" label="组织名称" min-width="180" />
        <el-table-column prop="name" label="标识" min-width="180" />
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useCurrentOrganization } from '../composables/useCurrentOrganization'

const {
  organization,
  loading: loadingOrganization,
  loadCurrentOrganization,
} = useCurrentOrganization()

const organizationRows = computed(() => (organization.value ? [organization.value] : []))

onMounted(() => {
  loadCurrentOrganization().catch(() => {
    ElMessage.error('当前组织加载失败')
  })
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
