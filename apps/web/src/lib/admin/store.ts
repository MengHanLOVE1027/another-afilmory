import { normalizeAdminData } from './types'

import type { AdminData, Album, Category, Member, PhotoMeta } from './types'

const STORAGE_KEY = 'afilmory.admin-data'

let cached: AdminData | null = null

export function getAdminData(): AdminData {
  if (cached) {
    return cached
  }

  const injected = typeof window !== 'undefined' ? window.__ADMIN_DATA__ : undefined
  let local: AdminData | null = null

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (raw) {
      local = normalizeAdminData(JSON.parse(raw))
    }
  }
  catch {
    // Ignore broken local storage snapshots.
  }

  // 静态构建下没有保存接口，优先使用最后一次本地保存；开发环境下服务端注入的
  // 数据若比本地快照更新，则以注入数据为准。
  if (local && (!injected || new Date(local.updatedAt).getTime() >= new Date(injected.updatedAt).getTime())) {
    cached = local
    return cached
  }

  if (injected) {
    cached = normalizeAdminData(injected)
    return cached
  }

  cached = local ?? normalizeAdminData(undefined)
  return cached
}

export function setAdminData(data: AdminData): AdminData {
  cached = normalizeAdminData(data)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
  }
  catch {
    // localStorage can be disabled; the in-memory snapshot still works.
  }
  return cached
}

export async function saveAdminData(data: AdminData): Promise<{ ok: boolean, offline?: boolean, error?: string }> {
  const next = setAdminData({ ...data, updatedAt: new Date().toISOString() })
  try {
    const response = await fetch('/api/admin/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        // 静态构建没有 /api/admin/data 中间件，配置已写入 localStorage。
        return { ok: false, offline: true, error: '静态模式' }
      }
      const text = await response.text()
      return { ok: false, error: text || `HTTP ${response.status}` }
    }
    return { ok: true }
  }
  catch (error) {
    return { ok: false, offline: true, error: (error as Error).message }
  }
}

export function getActiveMembers(data: AdminData = getAdminData()): Member[] {
  if (data.mode === 'personal') {
    return data.members.filter(member => member.role === 'owner').slice(0, 1)
  }
  return data.members.filter(member => member.status !== 'disabled')
}

export function getMember(id: string | undefined, data: AdminData = getAdminData()): Member | undefined {
  if (!id) {
    return undefined
  }
  return data.members.find(member => member.id === id)
}

export function getPhotoMeta(photoId: string, data: AdminData = getAdminData()): PhotoMeta {
  return data.photoMeta[photoId] ?? {}
}

export function getPhotoUploader(photoId: string, data: AdminData = getAdminData()): Member | undefined {
  if (data.mode === 'personal') {
    return undefined
  }
  const meta = getPhotoMeta(photoId, data)
  return getMember(meta.uploaderId, data)
}

export function getAlbum(id: string, data: AdminData = getAdminData()): Album | undefined {
  return data.albums.find(album => album.id === id)
}

export function getAlbumBySlug(slug: string, data: AdminData = getAdminData()): Album | undefined {
  return data.albums.find(album => album.slug === slug)
}

export function getCategory(id: string, data: AdminData = getAdminData()): Category | undefined {
  return data.categories.find(category => category.id === id)
}

export function getCategoryBySlug(slug: string, data: AdminData = getAdminData()): Category | undefined {
  return data.categories.find(category => category.slug === slug)
}

export function getPhotosForAlbum(album: Album, photos: { id: string }[]): string[] {
  const ids = new Set(album.photoIds)
  return photos.filter(photo => ids.has(photo.id)).map(photo => photo.id)
}

export function getAlbumPhotoIds(album: Album): string[] {
  return album.photoIds
}

export function publicAlbums(data: AdminData = getAdminData()): Album[] {
  return data.albums.filter(album => album.visibility === 'public')
}

export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4E00-\u9FA5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `item-${Date.now().toString(36)}`
}
