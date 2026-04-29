import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'

const SKIP_BELOW_BYTES = 500 * 1024 // 500 KB
const MAX_DIMENSION = 1600
const QUALITY = 0.8

export interface PickedAttachment {
  uri: string
  name: string
  type: string
  size?: number
}

const isImageMime = (m: string) => m.startsWith('image/') && m !== 'image/gif' && m !== 'image/svg+xml'

/**
 * Compress an image attachment URI client-side. Returns the original
 * attachment for non-images, already-small images, or on failure.
 */
export async function compressIfImage(att: PickedAttachment): Promise<PickedAttachment> {
  if (!att?.type || !isImageMime(att.type)) return att

  try {
    // Determine size if caller didn't provide one
    let size: number = att.size ?? 0
    if (!size) {
      try {
        const info = await FileSystem.getInfoAsync(att.uri)
        size = info.exists ? ((info as any).size ?? 0) : 0
      } catch { size = 0 }
    }
    if (size > 0 && size <= SKIP_BELOW_BYTES) return att

    const result = await ImageManipulator.manipulateAsync(
      att.uri,
      [{ resize: { width: MAX_DIMENSION } }],
      { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    )

    // If the new file is somehow bigger, keep original
    let newSize = 0
    try {
      const info = await FileSystem.getInfoAsync(result.uri)
      newSize = info.exists ? ((info as any).size ?? 0) : 0
    } catch { newSize = 0 }
    if (size > 0 && newSize > 0 && newSize >= size) return att

    // Force JPEG mime + name
    const baseName = (att.name ?? 'image').replace(/\.[^.]+$/, '')
    return {
      uri: result.uri,
      name: `${baseName}.jpg`,
      type: 'image/jpeg',
      size: newSize || undefined,
    }
  } catch (e) {
    console.warn('[imageCompress] failed, uploading original', e)
    return att
  }
}
