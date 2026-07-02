import { describe, expect, it } from 'vitest'
import {
  campusAllowedResourceExtensions,
  campusResourceAccept,
  campusResourceExtensionsByType,
  campusResourceTypeOptions,
  inferCampusResourceType,
} from '../utils/resourceUploadPolicy'

describe('campus resource upload policy', () => {
  it('only allows the campus subset of main frontend resource formats', () => {
    expect(campusResourceExtensionsByType).toEqual({
      polygen: ['glb'],
      picture: ['jpg', 'jpeg', 'png'],
      video: ['mp4'],
      audio: ['mp3', 'wav'],
    })
    expect(Array.from(campusAllowedResourceExtensions)).toEqual(['glb', 'jpg', 'jpeg', 'png', 'mp4', 'mp3', 'wav'])
    expect(campusResourceAccept).toBe('.glb,.jpg,.jpeg,.png,.mp4,.mp3,.wav')
  })

  it('does not expose voxel, particle, json, or generic file uploads', () => {
    expect(campusResourceTypeOptions.map((option) => option.value)).toEqual(['polygen', 'picture', 'video', 'audio'])
    expect(campusAllowedResourceExtensions.has('vox')).toBe(false)
    expect(campusAllowedResourceExtensions.has('json')).toBe(false)
    expect(campusAllowedResourceExtensions.has('pdf')).toBe(false)
    expect(campusAllowedResourceExtensions.has('webp')).toBe(false)
    expect(campusAllowedResourceExtensions.has('mov')).toBe(false)
    expect(campusAllowedResourceExtensions.has('m4a')).toBe(false)
  })

  it('infers the matching main resource type from allowed extensions', () => {
    expect(inferCampusResourceType('glb')).toBe('polygen')
    expect(inferCampusResourceType('jpeg')).toBe('picture')
    expect(inferCampusResourceType('mp4')).toBe('video')
    expect(inferCampusResourceType('wav')).toBe('audio')
    expect(inferCampusResourceType('json')).toBeNull()
    expect(inferCampusResourceType('vox')).toBeNull()
  })
})
