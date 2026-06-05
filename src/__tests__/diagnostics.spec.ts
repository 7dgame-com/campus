import { describe, expect, it } from 'vitest'
import { formatDiagnosticOutcome, isReachableHttpStatus } from '../utils/diagnostics'

describe('diagnostics status formatting', () => {
  it('treats auth failures as a reachable protected backend', () => {
    expect(isReachableHttpStatus(401)).toBe(true)
    expect(isReachableHttpStatus(403)).toBe(true)
    expect(formatDiagnosticOutcome(401).status).toBe('ok')
    expect(formatDiagnosticOutcome(403).message).toContain('需要授权')
  })

  it('keeps missing routes and server errors as failures', () => {
    expect(isReachableHttpStatus(404)).toBe(false)
    expect(isReachableHttpStatus(500)).toBe(false)
    expect(formatDiagnosticOutcome(404, 'Not Found')).toEqual({
      status: 'error',
      message: 'HTTP 404: Not Found',
    })
  })
})
