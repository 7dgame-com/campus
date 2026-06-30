import COS from 'cos-js-sdk-v5'
import SparkMD5 from 'spark-md5'
import { mainApi } from '../api'
import { processModel } from '../utils/modelProcessor'

type ProgressCallback = (progress: number) => void

const STORAGE_BUCKET = 'store'
const MD5_CHUNK_SIZE = 2 * 1024 * 1024

interface StorageBucketConfig {
  bucket?: string
  region?: string
}

interface TencentCloudConfig {
  public?: StorageBucketConfig
}

interface TencentCloudTokenResponse {
  Credentials?: {
    TmpSecretId: string
    TmpSecretKey: string
    Token: string
  }
  StartTime?: number
  ExpiredTime?: number
}

interface FileHandler {
  bucket: string
  region: string
  cos: COS
}

export interface MainUploadedFile {
  filename: string
  key: string
  url: string
  md5: string
  size: number
  mime_type: string
  info?: string
  image?: MainUploadedFile
}

export interface EnsureMainFileOptions {
  directory: string
  onHashProgress?: ProgressCallback
  onUploadProgress?: ProgressCallback
  onMetadataProgress?: (label: string) => void
}

export async function ensureMainUploadedFile(file: File, options: EnsureMainFileOptions): Promise<MainUploadedFile> {
  const handler = await publicHandler()
  const uploadedFile = await ensureStoredFile(file, options.directory, handler, {
    onHashProgress: options.onHashProgress,
    onUploadProgress: options.onUploadProgress,
  })

  const metadata = await resolveResourceMetadata(file, options.directory, handler, options)
  if (metadata.info) uploadedFile.info = metadata.info
  if (metadata.image) uploadedFile.image = metadata.image

  return uploadedFile
}

async function resolveResourceMetadata(
  file: File,
  directory: string,
  handler: FileHandler,
  options: EnsureMainFileOptions,
): Promise<{ info?: string; image?: MainUploadedFile }> {
  if (directory === 'picture' && file.type.startsWith('image/')) {
    const size = await getImageSize(file)
    return size.x > 0 && size.y > 0 ? { info: JSON.stringify({ size }) } : {}
  }

  if (directory === 'video' && file.type.startsWith('video/')) {
    const videoInfo = await getVideoInfo(file)
    return videoInfo.size.x > 0 ? { info: JSON.stringify(videoInfo) } : {}
  }

  if (directory === 'audio' && file.type.startsWith('audio/')) {
    const audioInfo = await getAudioInfo(file)
    if (audioInfo.length <= 0) return {}
    return { info: JSON.stringify({ size: { x: 800, y: 800 }, length: audioInfo.length }) }
  }

  if (directory === 'polygen' && file.name.toLowerCase().endsWith('.glb')) {
    try {
      options.onMetadataProgress?.('生成模型缩略图')
      const processed = await processModel(file)
      options.onMetadataProgress?.('确认模型缩略图')
      const image = await ensureStoredFile(processed.image, 'screenshot/polygen', handler)
      return { info: processed.info, image }
    } catch (error) {
      console.warn('[campus] model thumbnail generation failed', error)
    }
  }

  return {}
}

async function ensureStoredFile(
  file: File,
  directory: string,
  handler: FileHandler,
  progress: {
    onHashProgress?: ProgressCallback
    onUploadProgress?: ProgressCallback
  } = {},
): Promise<MainUploadedFile> {
  const extension = fileExtension(file)
  const md5 = await fileMD5(file, progress.onHashProgress)
  const exists = await fileHas(md5, extension, handler, directory)

  if (!exists) {
    await fileUpload(md5, extension, file, progress.onUploadProgress, handler, directory)
  } else {
    progress.onUploadProgress?.(1)
  }

  return {
    filename: file.name,
    key: md5 + extension,
    url: fileUrl(md5, extension, handler, directory),
    md5,
    size: file.size,
    mime_type: file.type || 'application/octet-stream',
  }
}

export function fileExtension(file: File): string {
  const nameExt = file.name.substring(file.name.lastIndexOf('.'))
  if (!nameExt || nameExt === file.name || !/^\.[0-9a-z]+$/i.test(nameExt)) {
    return '.bytes'
  }
  return nameExt.toLowerCase()
}

function fileMD5(file: File, progress: ProgressCallback = () => {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    const chunks = Math.max(Math.ceil(file.size / MD5_CHUNK_SIZE), 1)
    let currentChunk = 0

    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (event.target?.result) {
        spark.append(event.target.result as ArrayBuffer)
      }
      currentChunk += 1
      progress(Math.min(currentChunk / chunks, 1))
      if (currentChunk < chunks) {
        loadNext()
      } else {
        resolve(spark.end())
      }
    }

    reader.onerror = () => reject(new Error('File reading failed'))

    function loadNext() {
      const start = currentChunk * MD5_CHUNK_SIZE
      const end = Math.min(start + MD5_CHUNK_SIZE, file.size)
      reader.readAsArrayBuffer(file.slice(start, end))
    }

    loadNext()
  })
}

async function publicHandler(): Promise<FileHandler> {
  const { data } = await mainApi.get<TencentCloudConfig>('/tencent-clouds/cloud')
  const publicConfig = data.public ?? {}
  const bucket = publicConfig.bucket || STORAGE_BUCKET
  const region = publicConfig.region || 'ap-nanjing'
  const cos = new COS({
    getAuthorization: async (_options, callback) => {
      const response = await mainApi.get<TencentCloudTokenResponse>('/tencent-clouds/token', {
        params: { bucket, region },
      })
      const data = response.data
      const credentials = data.Credentials
      if (!credentials) {
        throw new Error('COS credentials invalid')
      }
      callback({
        TmpSecretId: credentials.TmpSecretId,
        TmpSecretKey: credentials.TmpSecretKey,
        SecurityToken: credentials.Token,
        StartTime: data.StartTime ?? Math.floor(Date.now() / 1000),
        ExpiredTime: data.ExpiredTime ?? Math.floor(Date.now() / 1000) + 1800,
      })
    },
  })

  return {
    bucket,
    region,
    cos,
  }
}

async function fileHas(md5: string, extension: string, handler: FileHandler, dir = ''): Promise<boolean> {
  try {
    await handler.cos.headObject({
      Bucket: handler.bucket,
      Region: handler.region,
      Key: objectKey(dir, md5, extension),
    })
    return true
  } catch {
    return false
  }
}

async function fileUpload(
  md5: string,
  extension: string,
  file: File,
  progress: ProgressCallback = () => {},
  handler: FileHandler,
  dir = '',
): Promise<void> {
  await handler.cos.uploadFile({
    Bucket: handler.bucket,
    Region: handler.region,
    Key: objectKey(dir, md5, extension),
    Body: file,
    onProgress: (progressData: { percent: number }) => {
      progress(progressData.percent)
    },
  })
}

function fileUrl(md5: string, extension: string, handler: FileHandler, dir = ''): string {
  return handler.cos.getObjectUrl(
    {
      Bucket: handler.bucket,
      Region: handler.region,
      Key: objectKey(dir, md5, extension),
      Expires: 60,
      Sign: true,
    },
    () => undefined,
  )
}

function objectKey(dir: string, md5: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`
  return [dir, md5 + ext].filter(Boolean).join('/').replace(/\/+/g, '/')
}

function getImageSize(file: File): Promise<{ x: number; y: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ x: img.width, y: img.height })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      resolve({ x: 0, y: 0 })
      URL.revokeObjectURL(img.src)
    }
  })
}

function getVideoInfo(file: File): Promise<{ size: { x: number; y: number }; length: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve({
        size: { x: video.videoWidth, y: video.videoHeight },
        length: video.duration,
      })
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      resolve({ size: { x: 0, y: 0 }, length: 0 })
    }
  })
}

function getAudioInfo(file: File): Promise<{ length: number }> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.src = URL.createObjectURL(file)
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      resolve({ length: audio.duration })
    }
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src)
      resolve({ length: 0 })
    }
  })
}
