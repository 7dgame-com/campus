<template>
  <div class="diagnostics-view">
    <section class="page-header">
      <div>
        <h2>API 诊断</h2>
        <p>检查校园插件依赖的主后端代理，不涉及独立后端或额外环境变量。</p>
      </div>
      <el-button type="primary" :loading="running" @click="runChecks">重新检测</el-button>
    </section>

    <section class="panel">
      <el-table :data="checks" stripe>
        <el-table-column prop="name" label="检查项" width="180" />
        <el-table-column prop="url" label="路径" min-width="260">
          <template #default="{ row }"><code>{{ row.url }}</code></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'ok'" type="success" size="small">可达</el-tag>
            <el-tag v-else-if="row.status === 'error'" type="danger" size="small">失败</el-tag>
            <el-tag v-else type="info" size="small">待检测</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="结果" min-width="260" />
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useCurrentOrganization } from '../composables/useCurrentOrganization'
import { formatDiagnosticOutcome, type DiagnosticStatus } from '../utils/diagnostics'

interface DiagnosticCheck {
  name: string
  url: string
  status: DiagnosticStatus
  message: string
}

const running = ref(false)
const { organizationId, loadCurrentOrganization } = useCurrentOrganization()
const checks = reactive<DiagnosticCheck[]>([
  {
    name: 'Token 校验',
    url: '/api/v1/plugin/verify-token',
    status: 'pending',
    message: '-',
  },
  {
    name: '组织信息',
    url: '/api/v1/organization/list',
    status: 'pending',
    message: '-',
  },
  {
    name: '组织账号',
    url: '/api/v1/plugin-campus/users?organization_id=',
    status: 'pending',
    message: '-',
  },
  {
    name: '只读账号',
    url: '/api-auth/v1/plugin-user/users',
    status: 'pending',
    message: '-',
  },
])

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
  }
}

async function readResponseMessage(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json() as { message?: string }
    return body.message
  } catch {
    return undefined
  }
}

async function runChecks() {
  running.value = true
  await loadCurrentOrganization()
  await Promise.all(checks.map(async (check) => {
    check.status = 'pending'
    check.message = '检测中'
    try {
      const url = check.name === '组织账号'
        ? `/api/v1/plugin-campus/users?organization_id=${organizationId.value ?? ''}`
        : check.url
      check.url = url
      if (check.name === '组织账号' && !organizationId.value) {
        throw new Error('当前组织尚未解析')
      }
      const response = await fetchWithTimeout(url)
      const outcome = formatDiagnosticOutcome(response.status, await readResponseMessage(response))
      check.status = outcome.status
      check.message = outcome.message
    } catch (error) {
      check.status = 'error'
      check.message = error instanceof DOMException && error.name === 'AbortError'
        ? '请求超时'
        : error instanceof Error
          ? error.message
          : '请求失败'
    }
  }))
  running.value = false
}

onMounted(runChecks)
</script>

<style scoped>
.diagnostics-view {
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

.panel {
  overflow: hidden;
}

code {
  color: var(--text-secondary);
}
</style>
