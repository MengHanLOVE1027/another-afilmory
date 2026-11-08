import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { MONOREPO_ROOT_PATH } from './__internal__/constants'

const execFileAsync = promisify(execFile)

export const MANIFEST_PATH = path.resolve(MONOREPO_ROOT_PATH, 'apps/web/src/data/photos-manifest.json')
export const PUBLIC_PHOTOS_DIR = path.resolve(MONOREPO_ROOT_PATH, 'apps/web/public/photos')
export const THUMBNAILS_DIR = path.resolve(MONOREPO_ROOT_PATH, 'apps/web/public/thumbnails')
export const TRASH_DIR = path.resolve(MONOREPO_ROOT_PATH, 'content/trash')

const DEFAULT_ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif']

export interface ManifestPhoto {
  id: string
  originalUrl: string
  s3Key: string
  thumbnailUrl: string
  width: number
  height: number
  [key: string]: unknown
}

export interface ManifestFile {
  version: number
  data: ManifestPhoto[]
  cameras: unknown[]
  lenses: unknown[]
}

export function readManifest(): ManifestFile | null {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as ManifestFile
  }
  catch {
    return null
  }
}

function runBuilder(): Promise<void> {
  const isWindows = process.platform === 'win32'
  const command = isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm'
  const args = isWindows
    ? ['/d', '/s', '/c', 'pnpm --filter @afilmory/builder cli']
    : ['--filter', '@afilmory/builder', 'cli']
  return execFileAsync(command, args, {
    cwd: MONOREPO_ROOT_PATH,
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  }).then(() => undefined)
}

export async function rebuildManifest(): Promise<void> {
  await runBuilder()
}

export function resolvePhotosDir(basePath: string | undefined): string {
  const relative = (basePath || './photos').replace(/^\.\//, '')
  const target = path.resolve(MONOREPO_ROOT_PATH, relative)
  if (!target.startsWith(MONOREPO_ROOT_PATH)) {
    throw new Error('照片目录必须位于仓库内')
  }
  return target
}

function safeFilename(input: string): string {
  const base = path.basename(input).replaceAll(/[^\w.\-()\u4E00-\u9FA5]/g, '_')
  return base || `photo-${Date.now()}.jpg`
}

function uniquePath(dir: string, filename: string): string {
  let candidate = path.join(dir, filename)
  if (!fs.existsSync(candidate)) {
    return candidate
  }
  const ext = path.extname(filename)
  const stem = filename.slice(0, -ext.length)
  let index = 2
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem}-${index}${ext}`)
    index += 1
  }
  return candidate
}

export interface UploadInput {
  name: string
  data: string
}

export interface UploadedPhoto {
  id: string
  filename: string
  originalName: string
}

export async function saveUploads(
  files: UploadInput[],
  options: {
    basePath?: string
    allowedFormats?: string
    maxFileSizeMb?: number
  } = {},
): Promise<UploadedPhoto[]> {
  const photosDir = resolvePhotosDir(options.basePath)
  fs.mkdirSync(photosDir, { recursive: true })
  const allowed = (options.allowedFormats || DEFAULT_ALLOWED.join(','))
    .split(',')
    .map(item => item.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean)
  const maxBytes = Math.max(1, options.maxFileSizeMb ?? 50) * 1024 * 1024
  const written: Array<{ filename: string, originalName: string }> = []

  try {
    for (const file of files) {
      const originalName = path.basename(file.name || 'photo.jpg')
      const ext = path.extname(originalName).slice(1).toLowerCase()
      if (!allowed.includes(ext)) {
        throw new Error(`不支持的格式：${ext || originalName}`)
      }
      const base64 = file.data.includes(',') ? file.data.slice(file.data.indexOf(',') + 1) : file.data
      const buffer = Buffer.from(base64, 'base64')
      if (buffer.length === 0) {
        throw new Error('文件内容为空')
      }
      if (buffer.length > maxBytes) {
        throw new Error(`文件超过 ${options.maxFileSizeMb ?? 50}MB 上限`)
      }
      const target = uniquePath(photosDir, safeFilename(originalName))
      fs.writeFileSync(target, buffer)
      written.push({ filename: path.basename(target), originalName })
    }

    await rebuildManifest()
    const manifest = readManifest()
    const uploaded = written.map((item) => {
      const photo = manifest?.data.find(photo => photo.s3Key === item.filename || photo.originalUrl.endsWith(`/${item.filename}`))
      return {
        id: photo?.id ?? '',
        filename: item.filename,
        originalName: item.originalName,
      }
    })
    return uploaded.filter(item => item.id)
  }
  catch (error) {
    for (const item of written) {
      fs.rmSync(path.join(photosDir, item.filename), { force: true })
    }
    throw error
  }
}

export interface RemovedPhoto {
  id: string
  filename: string
}

export async function removePhotos(photoIds: string[], options: { basePath?: string } = {}): Promise<RemovedPhoto[]> {
  const manifest = readManifest()
  if (!manifest) {
    return []
  }
  const photosDir = resolvePhotosDir(options.basePath)
  const removed: RemovedPhoto[] = []
  for (const id of photoIds) {
    const photo = manifest.data.find(item => item.id === id)
    if (!photo) {
      continue
    }
    const filename = photo.s3Key || path.basename(photo.originalUrl)
    fs.rmSync(path.join(photosDir, filename), { force: true })
    fs.rmSync(path.join(PUBLIC_PHOTOS_DIR, filename), { force: true })
    fs.rmSync(path.join(THUMBNAILS_DIR, `${photo.id}.jpg`), { force: true })
    removed.push({ id: photo.id, filename })
  }
  if (removed.length > 0) {
    await rebuildManifest()
  }
  return removed
}

export interface TrashedFiles {
  id: string
  filename: string
  publicFilename: string
  photo: ManifestPhoto
}

function moveFile(source: string, target: string): boolean {
  if (!fs.existsSync(source)) {
    return false
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  try {
    fs.renameSync(source, target)
  }
  catch {
    fs.copyFileSync(source, target)
    fs.rmSync(source, { force: true })
  }
  return true
}

/**
 * Moves the original file and its public copy into content/trash/<id>/.
 * The thumbnail is intentionally kept in public/thumbnails so the recycle bin
 * can still render a preview without a second image pipeline.
 */
export function movePhotoToTrash(photoId: string, options: { basePath?: string } = {}): TrashedFiles | null {
  const manifest = readManifest()
  const photo = manifest?.data.find(item => item.id === photoId)
  if (!photo) {
    return null
  }
  const photosDir = resolvePhotosDir(options.basePath)
  const filename = photo.s3Key || decodeURIComponent(path.basename(photo.originalUrl))
  const publicFilename = decodeURIComponent(path.basename(photo.originalUrl))
  const dir = path.join(TRASH_DIR, photo.id)
  fs.mkdirSync(dir, { recursive: true })
  moveFile(path.join(photosDir, filename), path.join(dir, filename))
  if (publicFilename !== filename) {
    moveFile(path.join(PUBLIC_PHOTOS_DIR, publicFilename), path.join(dir, `public-${publicFilename}`))
  }
  else {
    moveFile(path.join(PUBLIC_PHOTOS_DIR, filename), path.join(dir, `public-${filename}`))
  }
  return { id: photo.id, filename, publicFilename, photo }
}

export function restorePhotoFromTrash(files: TrashedFiles, options: { basePath?: string } = {}): boolean {
  const photosDir = resolvePhotosDir(options.basePath)
  const dir = path.join(TRASH_DIR, files.id)
  const restored = moveFile(path.join(dir, files.filename), path.join(photosDir, files.filename))
  moveFile(
    path.join(dir, `public-${files.publicFilename}`),
    path.join(PUBLIC_PHOTOS_DIR, files.publicFilename),
  )
  fs.rmSync(dir, { recursive: true, force: true })
  return restored
}

export function purgePhotoFromTrash(photoId: string): void {
  fs.rmSync(path.join(TRASH_DIR, photoId), { recursive: true, force: true })
  fs.rmSync(path.join(THUMBNAILS_DIR, `${photoId}.jpg`), { force: true })
}
