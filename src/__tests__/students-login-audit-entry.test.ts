import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('organization account login audit entry', () => {
  it('keeps the Clock action inside the permission-protected account operations', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../views/StudentsView.vue'),
      'utf8',
    )

    expect(source).toContain('<el-table-column v-if="canManageAccounts" label="操作"')
    expect(source).toContain(':icon="Clock" type="primary" @click="openLoginAudit(row)">登录记录</el-button>')
    expect(source).toContain('ref="loginAuditDialogRef"')
    expect(source).toContain(':organization-id="organizationId"')
    expect(source).toContain(':allow-platform-scope="hasPlatformScope"')
    expect(source).toContain('统计范围：{{ scopeLabel }}')
    expect(source).toContain("if (hasPlatformScope.value) return '全平台'")
    expect(source).toContain('const { can, hasPlatformScope } = usePermissions()')
    expect(source).toContain(': await listUsers(params)')
    expect(source).toContain('import { Brush, Clock, DocumentAdd, Key, Refresh, Upload }')
  })
})
