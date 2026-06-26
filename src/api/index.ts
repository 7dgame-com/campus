import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import {
  getToken,
  setToken,
  removeAllTokens,
  isInIframe,
  requestParentTokenRefresh,
  getRefreshToken,
  setRefreshToken,
} from '../utils/token'

const userApi = axios.create({
  baseURL: '/api/v1/plugin-user',
  timeout: 10000,
})

const identityPluginUserApi = axios.create({
  baseURL: '/api-auth/v1/plugin-user',
  timeout: 10000,
})

const campusApi = axios.create({
  baseURL: '/api/v1/plugin-campus',
  timeout: 60000,
})

const mainApi = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: Error) => void
}> = []
let bootstrapTokenPromise: Promise<string | null> | null = null

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error ?? new Error('Token refresh failed'))
    } else {
      resolve(token)
    }
  })
  failedQueue = []
}

async function tryRefreshToken(): Promise<string | null> {
  if (isInIframe()) {
    const result = await requestParentTokenRefresh()
    if (result?.accessToken) {
      setToken(result.accessToken)
      return result.accessToken
    }
  }

  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await axios.post('/api/auth/refresh', { refreshToken })
    const { accessToken, refreshToken: newRefreshToken } = res.data
    setToken(accessToken)
    if (newRefreshToken) setRefreshToken(newRefreshToken)
    return accessToken
  } catch {
    return null
  }
}

async function getRequestToken(): Promise<string | null> {
  const token = getToken()
  if (token) return token

  if (!isInIframe()) return null

  if (!bootstrapTokenPromise) {
    bootstrapTokenPromise = requestParentTokenRefresh()
      .then((result) => {
        const accessToken = result?.accessToken ?? getToken()
        if (accessToken) setToken(accessToken)
        return accessToken
      })
      .finally(() => {
        bootstrapTokenPromise = null
      })
  }

  return bootstrapTokenPromise
}

function setupInterceptors(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.request.use(async (config) => {
    const token = await getRequestToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  instance.interceptors.response.use(
    (res) => {
      const refreshToken = res.headers['x-refresh-token']
      if (refreshToken) setRefreshToken(refreshToken)
      return res
    },
    async (err: AxiosError) => {
      const originalRequest = err.config as InternalAxiosRequestConfig & {
        _retry?: boolean
      }

      if (err.response?.status !== 401 || originalRequest._retry) {
        return Promise.reject(err)
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          originalRequest._retry = true
          return instance(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const newToken = await tryRefreshToken()
        if (!newToken) throw new Error('Token refresh failed')

        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return instance(originalRequest)
      } catch (refreshError) {
        removeAllTokens()
        if (isInIframe()) {
          window.parent.postMessage({ type: 'TOKEN_EXPIRED' }, '*')
        }
        processQueue(
          refreshError instanceof Error
            ? refreshError
            : new Error('Token refresh failed'),
          null,
        )
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    },
  )
}

setupInterceptors(userApi)
setupInterceptors(identityPluginUserApi)
setupInterceptors(campusApi)
setupInterceptors(mainApi)

export default mainApi
export { campusApi, identityPluginUserApi, mainApi, userApi }

export interface OrganizationSummary {
  id: number
  title: string
  name: string
}

export interface VerifyTokenResponse {
  code: number
  message?: string
  data: {
    id: number
    username?: string
    nickname?: string
    roles?: string[]
    organizations?: OrganizationSummary[]
  }
}

export interface PaginatedResponse<T> {
  data?: T[]
  items?: T[]
  pagination?: {
    total?: number
    page?: number
    pageSize?: number
  }
  _meta?: {
    totalCount?: number
    currentPage?: number
    perPage?: number
  }
}

export interface UserItem {
  id: number
  username: string
  nickname?: string
  email?: string | null
  roles?: string[]
  organizations?: OrganizationSummary[]
  created_at?: number
}

export interface CampusContentCounts {
  verse_count: number
  resource_count: number
  meta_count?: number
}

export interface CampusManagedUser extends UserItem {
  primary_role?: string
  content_counts?: CampusContentCounts
}

export interface CampusOperationResult {
  user_id: number
  username: string
  success: boolean
  message: string
  error?: string
  errors?: string[]
  cleared?: CampusContentCounts
  verse_id?: number | null
  file_id?: number | null
  resource_id?: number | null
  resource_name?: string
  resource_type?: string
}

export interface CampusOperationResponse {
  code: number
  message?: string
  data: {
    success_count: number
    failed_count: number
    skipped_count?: number
    skipped_targets?: CampusSkippedTarget[]
    results: CampusOperationResult[]
  }
}

export interface CampusSkippedTarget {
  user_id: number
  username: string
  role?: string
  reason?: string
}

export interface CampusClearPreview {
  user_count: number
  verse_count: number
  resource_count: number
  meta_count?: number
  skipped_count?: number
  skipped_targets?: CampusSkippedTarget[]
  targets: Array<{
    user_id: number
    username: string
  } & CampusContentCounts>
}

export interface CampusUploadedFilePayload {
  filename: string
  key: string
  url?: string
  md5: string
  size: number
  mime_type?: string
  image?: CampusUploadedFilePayload
}

export interface GroupItem {
  id: number
  name?: string
  info?: string | null
  description?: string | null
  user_id?: number
  created_at?: string
  updated_at?: string
}

export interface InvitationItem {
  code: string
  quota?: number
  used_count?: number
  expires_at?: number
  created_at?: number
  status?: string
}

export function verifyCurrentToken(): Promise<{ data: VerifyTokenResponse }> {
  return mainApi.get('/plugin/verify-token')
}

export function listOrganizations(names?: string) {
  return mainApi.get<{ code: number; data: OrganizationSummary[] }>('/organization/list', {
    params: names ? { names } : undefined,
  })
}

export function createOrganization(payload: Pick<OrganizationSummary, 'title' | 'name'>) {
  return mainApi.post('/organization/create', payload)
}

export function updateOrganization(payload: Pick<OrganizationSummary, 'id' | 'title'>) {
  return mainApi.post('/organization/update', payload)
}

export function listGroups(params?: Record<string, unknown>) {
  return mainApi.get<PaginatedResponse<GroupItem> | GroupItem[]>('/group', { params })
}

export function createGroup(payload: Pick<GroupItem, 'name' | 'description' | 'info'>) {
  return mainApi.post<GroupItem>('/group', payload)
}

export function updateGroup(id: number, payload: Pick<GroupItem, 'name' | 'description' | 'info'>) {
  return mainApi.put<GroupItem>(`/group/${id}`, payload)
}

export function listUsers(params?: Record<string, unknown>) {
  return getPluginUserReadonly<PaginatedResponse<UserItem>>('/users', params)
}

export function listCampusManagedUsers(params?: Record<string, unknown>) {
  return campusApi.get<PaginatedResponse<CampusManagedUser>>('/users', { params })
}

export function updateCampusUserPassword(payload: {
  organization_id: number
  user_ids?: number[]
  password: string
  operation_scope?: 'single' | 'batch'
}) {
  return campusApi.post<CampusOperationResponse>('/users/password', payload)
}

export function previewCampusClearContent(payload: {
  organization_id: number
  user_ids?: number[]
  operation_scope?: 'single' | 'batch'
}) {
  return campusApi.post<{ code: number; message?: string; data: CampusClearPreview }>(
    '/users/clear-content-preview',
    payload,
  )
}

export function clearCampusContent(payload: {
  organization_id: number
  user_ids?: number[]
  operation_scope?: 'single' | 'batch'
  confirm: true
}) {
  return campusApi.post<CampusOperationResponse>('/users/clear-content', payload)
}

export function importCampusSceneZip(payload: {
  organization_id: number
  user_ids?: number[]
  file: File
}) {
  const formData = new FormData()
  formData.append('organization_id', String(payload.organization_id))
  formData.append('file', payload.file)
  if (payload.user_ids?.length) {
    formData.append('user_ids', JSON.stringify(payload.user_ids))
  }

  return campusApi.post<CampusOperationResponse>('/users/import-scene-zip', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function uploadCampusResource(payload: {
  organization_id: number
  user_ids?: number[]
  file: CampusUploadedFilePayload
  name?: string
  type?: string
  info?: string
  operation_scope?: 'single' | 'batch'
}) {
  return campusApi.post<CampusOperationResponse>('/users/upload-resource', {
    organization_id: payload.organization_id,
    user_ids: payload.user_ids,
    operation_scope: payload.operation_scope,
    filename: payload.file.filename,
    key: payload.file.key,
    url: payload.file.url,
    md5: payload.file.md5,
    size: payload.file.size,
    mime_type: payload.file.mime_type,
    image: payload.file.image,
    name: payload.name?.trim() || undefined,
    type: payload.type,
    info: payload.info?.trim() || undefined,
  })
}

export function listInvitations(params?: Record<string, unknown>) {
  return getPluginUserReadonly<PaginatedResponse<InvitationItem>>('/invitations', params)
}

function getPluginUserReadonly<T>(path: string, params?: Record<string, unknown>) {
  return identityPluginUserApi.get<T>(path, { params }).catch((err: AxiosError) => {
    if (shouldFallbackToLegacyPluginUser(err)) {
      return userApi.get<T>(path, { params })
    }
    return Promise.reject(err)
  })
}

function shouldFallbackToLegacyPluginUser(err: AxiosError): boolean {
  if (!err.response) {
    return true
  }
  return [401, 404, 502, 503, 504].includes(err.response.status)
}
