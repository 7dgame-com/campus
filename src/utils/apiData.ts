import type { PaginatedResponse } from '../api'

export function normalizeList<T>(payload: PaginatedResponse<T> | T[] | { code?: number; data?: T[] } | unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (!payload || typeof payload !== 'object') return []

  const body = payload as PaginatedResponse<T> & { data?: T[]; items?: T[] }
  if (Array.isArray(body.data)) return body.data
  if (Array.isArray(body.items)) return body.items
  return []
}

export function normalizeTotal<T>(payload: PaginatedResponse<T> | T[] | { pagination?: { total?: number } } | unknown): number {
  if (Array.isArray(payload)) return payload.length
  if (!payload || typeof payload !== 'object') return 0

  const body = payload as PaginatedResponse<T>
  if (typeof body.pagination?.total === 'number') return body.pagination.total
  if (typeof body._meta?.totalCount === 'number') return body._meta.totalCount
  return normalizeList<T>(payload).length
}

export function formatTimestamp(value?: number | string | null): string {
  if (!value) return '-'
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}
