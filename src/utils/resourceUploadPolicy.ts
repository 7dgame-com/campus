export type CampusResourceType = 'polygen' | 'picture' | 'video' | 'audio'

export const campusResourceTypeOptions: Array<{ label: string; value: CampusResourceType }> = [
  { label: '3D 模型', value: 'polygen' },
  { label: '图片', value: 'picture' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
]

export const campusResourceExtensionsByType: Record<CampusResourceType, string[]> = {
  polygen: ['glb'],
  picture: ['jpg', 'jpeg', 'png'],
  video: ['mp4'],
  audio: ['mp3', 'wav'],
}

export const campusAllowedResourceExtensions = new Set(Object.values(campusResourceExtensionsByType).flat())

export const campusResourceAccept = Array.from(campusAllowedResourceExtensions)
  .map((extension) => `.${extension}`)
  .join(',')

export function inferCampusResourceType(extension: string): CampusResourceType | null {
  const normalizedExtension = extension.toLowerCase()
  for (const [resourceType, extensions] of Object.entries(campusResourceExtensionsByType) as Array<
    [CampusResourceType, string[]]
  >) {
    if (extensions.includes(normalizedExtension)) return resourceType
  }
  return null
}
