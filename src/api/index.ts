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
setupInterceptors(mainApi)

export default mainApi
export { mainApi, userApi }

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
  return userApi.get<PaginatedResponse<UserItem>>('/users', { params })
}

export function listInvitations(params?: Record<string, unknown>) {
  return userApi.get<PaginatedResponse<InvitationItem>>('/invitations', { params })
}
