export interface UploadedPhoto {
  id: string
  filename: string
  originalName: string
}

export interface RebuildJobLog {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface RebuildJob {
  id: string
  kind: 'rebuild'
  status: 'running' | 'success' | 'error'
  progress: number
  message: string
  logs: RebuildJobLog[]
  startedAt: string
  finishedAt?: string
  error?: string
}

export interface AdminLogEntry {
  id: number
  at: string
  level: 'info' | 'success' | 'warn' | 'error'
  scope: 'api' | 'auth' | 'build' | 'file' | 'system'
  message: string
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`))
    reader.readAsDataURL(file)
  })
}

export async function uploadPhotos(
  files: File[],
  folder = '',
): Promise<{ ok: boolean, uploaded?: UploadedPhoto[], error?: string }> {
  if (files.length === 0) {
    return { ok: false, error: '请选择照片' }
  }
  try {
    const payload = await Promise.all(
      files.map(async file => ({ name: file.name, data: await fileToDataUrl(file) })),
    )
    const response = await fetch('/api/admin/attachments/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: payload, folder }),
    })
    const data = await response.json() as { ok?: boolean, uploaded?: UploadedPhoto[], error?: string }
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? '上传失败' }
    }
    return { ok: true, uploaded: data.uploaded ?? [] }
  }
  catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export async function deletePhotos(photoIds: string[]): Promise<{ ok: boolean, error?: string }> {
  try {
    const response = await fetch('/api/admin/attachments/delete', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds }),
    })
    const data = await response.json() as { ok?: boolean, error?: string }
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? '删除失败' }
    }
    return { ok: true }
  }
  catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export async function rebuildAttachments(): Promise<{ ok: boolean, job?: RebuildJob, error?: string }> {
  try {
    const response = await fetch('/api/admin/attachments/rebuild', {
      method: 'POST',
      credentials: 'same-origin',
    })
    const data = await response.json() as { ok?: boolean, job?: RebuildJob, error?: string }
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? '重建失败' }
    }
    return { ok: true, job: data.job }
  }
  catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export async function fetchRebuildJob(id?: string): Promise<RebuildJob | null> {
  const query = id ? `?id=${encodeURIComponent(id)}` : ''
  const response = await fetch(`/api/admin/attachments/rebuild${query}`, { credentials: 'same-origin' })
  const data = await response.json() as { ok?: boolean, job?: RebuildJob }
  return response.ok && data.ok && data.job ? data.job : null
}

export async function fetchAdminLogs(limit = 200): Promise<AdminLogEntry[]> {
  const response = await fetch(`/api/admin/logs?limit=${limit}`, { credentials: 'same-origin' })
  const data = await response.json() as { ok?: boolean, logs?: AdminLogEntry[] }
  return response.ok && data.ok && Array.isArray(data.logs) ? data.logs : []
}
