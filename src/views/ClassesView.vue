<template>
  <div class="classes-view">
    <section class="page-header">
      <div>
        <h2>班级管理</h2>
        <p>班级必须绑定当前组织后才能在校园管理内维护。</p>
      </div>
    </section>

    <section class="panel">
      <el-result
        icon="info"
        title="班级管理暂未开放"
        sub-title="当前平台 Group 还没有组织归属字段。为避免读取或修改全局班级数据，校园管理暂不展示班级列表。"
      />
    </section>
  </div>
</template>

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
}

.page-header h2 {
  margin: 0 0 var(--spacing-xs);
}

.page-header p {
  color: var(--text-secondary);
}
</style>
