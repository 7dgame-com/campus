export type DiagnosticStatus = 'pending' | 'ok' | 'error'

export interface DiagnosticOutcome {
  status: DiagnosticStatus
  message: string
}

const AUTH_REQUIRED_STATUSES = new Set([401, 403])

export function isReachableHttpStatus(status: number): boolean {
  return (status >= 200 && status < 400) || AUTH_REQUIRED_STATUSES.has(status)
}

export function formatDiagnosticOutcome(status: number, message?: string): DiagnosticOutcome {
  if (isReachableHttpStatus(status)) {
    return {
      status: 'ok',
      message: AUTH_REQUIRED_STATUSES.has(status)
        ? `HTTP ${status}，代理已到达后端，当前需要授权`
        : `HTTP ${status}`,
    }
  }

  return {
    status: 'error',
    message: `HTTP ${status}${message ? `: ${message}` : ''}`,
  }
}
