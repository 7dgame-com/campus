import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/token')>()
  return {
    ...actual,
    isInIframe: vi.fn().mockReturnValue(true),
    requestParentTokenRefresh: vi.fn().mockResolvedValue(null),
  }
})

describe('api token bootstrap', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('waits for the parent token before sending the first embedded request', async () => {
    const tokenModule = await import('../utils/token')
    vi.mocked(tokenModule.isInIframe).mockReturnValue(true)
    vi.mocked(tokenModule.requestParentTokenRefresh).mockResolvedValueOnce({ accessToken: 'parent-token' })

    const { default: api } = await import('../api/index')

    let callCount = 0
    const originalAdapter = api.defaults.adapter
    api.defaults.adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
      callCount += 1
      expect(config.headers.Authorization).toBe('Bearer parent-token')

      return {
        status: 200,
        statusText: 'OK',
        data: { ok: true },
        headers: {},
        config,
      }
    }

    try {
      const response = await api.get('/plugin/verify-token')

      expect(response.data).toEqual({ ok: true })
      expect(callCount).toBe(1)
      expect(tokenModule.requestParentTokenRefresh).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem('campus-plugin-token')).toBe('parent-token')
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })

  it('uploads campus scene ZIP files through the organization-scoped wrapper', async () => {
    localStorage.setItem('campus-plugin-token', 'campus-token')

    const { campusApi, importCampusSceneZip } = await import('../api/index')
    const originalAdapter = campusApi.defaults.adapter
    campusApi.defaults.adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
      expect(config.baseURL).toBe('/api/v1/plugin-campus')
      expect(config.url).toBe('/users/import-scene-zip')
      expect(config.method).toBe('post')
      expect(config.headers.Authorization).toBe('Bearer campus-token')
      expect(config.data).toBeInstanceOf(FormData)

      const formData = config.data as FormData
      expect(formData.get('organization_id')).toBe('7')
      expect(formData.get('user_ids')).toBe('[11,12]')
      expect(formData.get('file')).toBeInstanceOf(File)

      return {
        status: 200,
        statusText: 'OK',
        data: { code: 0, data: { success_count: 2, failed_count: 0, results: [] } },
        headers: {},
        config,
      }
    }

    try {
      const file = new File(['zip'], 'scene.zip', { type: 'application/zip' })
      const response = await importCampusSceneZip({
        organization_id: 7,
        user_ids: [11, 12],
        file,
      })

      expect(response.data.data.success_count).toBe(2)
    } finally {
      campusApi.defaults.adapter = originalAdapter
    }
  })

  it('uploads campus resources through the organization-scoped wrapper', async () => {
    localStorage.setItem('campus-plugin-token', 'campus-token')

    const { campusApi, uploadCampusResource } = await import('../api/index')
    const originalAdapter = campusApi.defaults.adapter
    campusApi.defaults.adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
      expect(config.baseURL).toBe('/api/v1/plugin-campus')
      expect(config.url).toBe('/users/upload-resource')
      expect(config.method).toBe('post')
      expect(config.headers.Authorization).toBe('Bearer campus-token')
      expect(config.data).toBeInstanceOf(FormData)

      const formData = config.data as FormData
      expect(formData.get('organization_id')).toBe('7')
      expect(formData.get('user_ids')).toBe('[11,12]')
      expect(formData.get('filename')).toBe('model.glb')
      expect(formData.get('name')).toBe('Campus Model')
      expect(formData.get('type')).toBe('polygen')
      expect(formData.get('info')).toBe('for class')
      expect(formData.get('file')).toBeInstanceOf(File)

      return {
        status: 200,
        statusText: 'OK',
        data: { code: 0, data: { success_count: 2, failed_count: 0, results: [] } },
        headers: {},
        config,
      }
    }

    try {
      const file = new File(['glb'], 'model.glb', { type: 'model/gltf-binary' })
      const response = await uploadCampusResource({
        organization_id: 7,
        user_ids: [11, 12],
        file,
        name: 'Campus Model',
        type: 'polygen',
        info: 'for class',
      })

      expect(response.data.data.success_count).toBe(2)
    } finally {
      campusApi.defaults.adapter = originalAdapter
    }
  })
})
