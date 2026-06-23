import axios from 'axios'
import SparkMD5 from 'spark-md5'
import { mainApi } from '../api'

const STORAGE_BUCKET = 'store'
const UPLOAD_BLOCK_SIZE = 1024 * 1024
const MD5_CHUNK_SIZE = 2 * 1024 * 1024

export interface MainUploadedFile {
  filename: string
  key: string
  url: string
  md5: string
  size: number
  mime_type: string
}

export interface EnsureMainFileOptions {
  directory: string
  onHashProgress?: (progress: number) => void
  onUploadProgress?: (progress: number) => void
}

export async function ensureMainUploadedFile(file: File, options: EnsureMainFileOptions): Promise<MainUploadedFile> {
  const extension = fileExtension(file)
  const md5 = await fileMD5(file, options.onHashProgress)
  const key = `${options.directory}/${md5}${extension}`

  const exists = await fileHas(STORAGE_BUCKET, key)
  if (!exists) {
    await fileUpload(md5, extension, file, options.directory, options.onUploadProgress)
  } else {
    options.onUploadProgress?.(1)
  }

  return {
    filename: file.name,
    key,
    url: storageRecordUrl(STORAGE_BUCKET, key),
    md5,
    size: file.size,
    mime_type: file.type || 'application/octet-stream',
  }
}

export function fileExtension(file: File): string {
  const match = file.name.match(/\.([0-9a-z]+)(?:[\\?#]|$)/i)
  return match ? `.${match[1].toLowerCase()}` : '.bytes'
}

function fileMD5(file: File, progress: (p: number) => void = () => {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    const chunks = Math.ceil(file.size / MD5_CHUNK_SIZE)
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

async function fileHas(bucket: string, key: string): Promise<boolean> {
  try {
    await axios.head(storageRequestUrl(bucket, key))
    return true
  } catch {
    return false
  }
}

async function fileUpload(
  md5: string,
  extension: string,
  file: File,
  directory: string,
  progress: (p: number) => void = () => {},
  skip = 0,
): Promise<void> {
  const nextSize = Math.min((skip + 1) * UPLOAD_BLOCK_SIZE, file.size)
  const formData = new FormData()
  formData.append('file', file.slice(skip * UPLOAD_BLOCK_SIZE, nextSize))
  formData.append('filename', `${md5}${extension}`)
  formData.append('md5', md5)
  formData.append('skip', String(skip))
  formData.append('block_size', String(UPLOAD_BLOCK_SIZE))
  formData.append('upload_size', String(nextSize))
  formData.append('size', String(file.size))
  formData.append('directory', directory)
  formData.append('bucket', STORAGE_BUCKET)

  await mainApi.post('/upload/file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  if (file.size <= nextSize) {
    progress(1)
    return
  }

  progress(nextSize / file.size)
  await fileUpload(md5, extension, file, directory, progress, skip + 1)
}

function storageRequestUrl(bucket: string, key: string): string {
  return `/api/storage/${encodePathPart(bucket)}/${encodeKey(key)}`
}

function storageRecordUrl(bucket: string, key: string): string {
  return `/storage/${encodePathPart(bucket)}/${encodeKey(key)}`
}

function encodeKey(key: string): string {
  return key.split('/').map(encodePathPart).join('/')
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value)
}
