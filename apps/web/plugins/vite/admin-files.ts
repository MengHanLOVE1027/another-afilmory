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

export function builderInvocation(): { command: string, args: string[] } {
  const isWindows = process.platform === 'win32'
  return {
    command: isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm',
    args: isWindows
      ? ['/d', '/s', '/c', 'pnpm --filter @afilmory/builder cli']
      : ['--filter', '@afilmory/builder', 'cli'],
  }
}

function runBuilder(): Promise<void> {
  const { command, args } = builderInvocation()
  return execFileAsync(command, args, {
    cwd: MONOREPO_ROOT_PATH,
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  }).then(() => undefined)
}

/**
 * The builder mirrors `photos/` into `public/photos`, but on Windows its bulk
 * `fs.cp` can abort on files currently open by Vite. This incremental sync
 * makes sure newly added nested folders still get published without
 * re-copying every unchanged file.
 */
export async function syncPublicPhotos(photosDir = resolvePhotosDir(undefined)): Promise<void> {
  const pending = [photosDir]
  while (pending.length > 0) {
    const directory = pending.pop()
    if (!directory) {
      continue
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) {
        continue
      }
      const source = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        pending.push(source)
        continue
      }
      if (!entry.isFile() || !DEFAULT_ALLOWED.includes(path.extname(entry.name).slice(1).toLowerCase())) {
        continue
      }
      const relativePath = path.relative(photosDir, source).replaceAll('\\', '/')
      const target = resolveInside(PUBLIC_PHOTOS_DIR, relativePath)
      try {
        const sourceStat = fs.statSync(source)
        const targetStat = fs.existsSync(target) ? fs.statSync(target) : null
        if (targetStat && targetStat.size === sourceStat.size && targetStat.mtimeMs >= sourceStat.mtimeMs) {
          continue
        }
        fs.mkdirSync(path.dirname(target), { recursive: true })
        await fs.promises.copyFile(source, target)
      }
      catch (error) {
        console.warn(`[admin-files] 无法同步公开照片 ${relativePath}: ${(error as Error).message}`)
      }
    }
  }
}

export async function rebuildManifest(): Promise<void> {
  await runBuilder()
  await syncPublicPhotos()
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

function resolveInside(root: string, relativePath: string): string {
  const target = path.resolve(root, relativePath)
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error('路径必须位于照片目录内')
  }
  return target
}

function normalizeFolder(folder: string | undefined): string {
  const value = (folder ?? '').trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (!value) {
    return ''
  }
  if (value.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('文件夹名称不合法')
  }
  return value
}

function photoRelativePath(photo: ManifestPhoto): string {
  const s3Key = (photo.s3Key ?? '').trim().replaceAll('\\', '/').replace(/^\/+/, '')
  if (s3Key) {
    return s3Key
  }
  const originalUrl = decodeURIComponent(photo.originalUrl ?? '')
  const marker = '/photos/'
  const index = originalUrl.indexOf(marker)
  return index >= 0 ? originalUrl.slice(index + marker.length) : path.basename(originalUrl)
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
    folder?: string
  } = {},
): Promise<UploadedPhoto[]> {
  const photosDir = resolvePhotosDir(options.basePath)
  const folder = normalizeFolder(options.folder)
  const targetDir = folder ? resolveInside(photosDir, folder) : photosDir
  fs.mkdirSync(targetDir, { recursive: true })
  const allowed = (options.allowedFormats || DEFAULT_ALLOWED.join(','))
    .split(',')
    .map(item => item.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean)
  const maxBytes = Math.max(1, options.maxFileSizeMb ?? 50) * 1024 * 1024
  const written: Array<{ relativePath: string, originalName: string }> = []

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
      const target = uniquePath(targetDir, safeFilename(originalName))
      fs.writeFileSync(target, buffer)
      written.push({
        relativePath: path.relative(photosDir, target).replaceAll('\\', '/'),
        originalName,
      })
    }

    await rebuildManifest()
    const manifest = readManifest()
    const uploaded = written.map((item) => {
      const encodedPath = item.relativePath.split('/').map(encodeURIComponent).join('/')
      const photo = manifest?.data.find(photo =>
        photo.s3Key === item.relativePath
        || decodeURIComponent(photo.originalUrl).endsWith(`/${item.relativePath}`)
        || photo.originalUrl.endsWith(`/${encodedPath}`),
      )
      return {
        id: photo?.id ?? '',
        filename: item.relativePath,
        originalName: item.originalName,
      }
    })
    return uploaded.filter(item => item.id)
  }
  catch (error) {
    for (const item of written) {
      fs.rmSync(resolveInside(photosDir, item.relativePath), { force: true })
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
    const filename = photoRelativePath(photo)
    fs.rmSync(resolveInside(photosDir, filename), { force: true })
    fs.rmSync(resolveInside(PUBLIC_PHOTOS_DIR, filename), { force: true })
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
  const filename = photoRelativePath(photo)
  const publicFilename = filename
  const dir = path.join(TRASH_DIR, photo.id)
  fs.mkdirSync(dir, { recursive: true })
  moveFile(resolveInside(photosDir, filename), path.join(dir, filename))
  moveFile(resolveInside(PUBLIC_PHOTOS_DIR, publicFilename), path.join(dir, `public-${publicFilename}`))
  return { id: photo.id, filename, publicFilename, photo }
}

export function restorePhotoFromTrash(files: TrashedFiles, options: { basePath?: string } = {}): boolean {
  const photosDir = resolvePhotosDir(options.basePath)
  const dir = path.join(TRASH_DIR, files.id)
  const restored = moveFile(path.join(dir, files.filename), resolveInside(photosDir, files.filename))
  moveFile(
    path.join(dir, `public-${files.publicFilename}`),
    resolveInside(PUBLIC_PHOTOS_DIR, files.publicFilename),
  )
  fs.rmSync(dir, { recursive: true, force: true })
  return restored
}

export function purgePhotoFromTrash(photoId: string): void {
  fs.rmSync(path.join(TRASH_DIR, photoId), { recursive: true, force: true })
  fs.rmSync(path.join(THUMBNAILS_DIR, `${photoId}.jpg`), { force: true })
}
