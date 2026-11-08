import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

import type { Plugin } from 'vite'

import type { AdminData, BookingStatus, Permission } from '../../src/lib/admin/types'
import { ALL_PERMISSIONS, BUILTIN_ROLES } from '../../src/lib/admin/types'
import { MONOREPO_ROOT_PATH } from './__internal__/constants'
import {
  type AdminLike,
  authenticate,
  clearTrashRows,
  countUsers,
  createInitialOwner,
  createSession,
  createDatabaseBackup,
  createBooking,
  databaseFilePath,
  deleteBooking,
  deleteSession,
  deleteTrashRow,
  getSessionUser,
  getTrash,
  insertTrash,
  isInitialized,
  listBookings,
  listTrash,
  listDatabaseBackups,
  type AuthUser,
  readContentData,
  setPassword,
  syncUsers,
  updateBookingStatus,
  writeContentData,
} from './admin-db'
import {
  type ManifestPhoto,
  type UploadInput,
  movePhotoToTrash,
  purgePhotoFromTrash,
  readManifest,
  rebuildManifest,
  removePhotos,
  restorePhotoFromTrash,
  saveUploads,
} from './admin-files'
import { getRebuildJob, getActiveRebuildJob, startRebuildJob } from './admin-jobs'
import { addAdminLog, listAdminLogs } from './admin-log'

const DATA_PATH = path.resolve(MONOREPO_ROOT_PATH, 'content/admin-data.json')
const SCRIPT_ID = 'admin-data'
const MAX_BODY_SIZE = 4 * 1024 * 1024
const MAX_UPLOAD_SIZE = 200 * 1024 * 1024
const SESSION_COOKIE = 'afilmory_session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

type AdminRecord = AdminData & Record<string, unknown>
type AdminUser = AuthUser & { permissions: Permission[], roleName: string }

function readAdminData(): string {
  const stored = readContentData()
  if (stored) {
    return stored
  }
  try {
    const seed = fs.readFileSync(DATA_PATH, 'utf8')
    JSON.parse(seed)
    writeContentData(seed)
    return seed
  }
  catch {
    return 'null'
  }
}

function readAdminObject(): AdminRecord | null {
  try {
    return JSON.parse(readAdminData()) as AdminRecord
  }
  catch {
    return null
  }
}

function toScriptContent(raw: string): string {
  let parsed: unknown = null
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    parsed = null
  }
  const json = JSON.stringify(parsed).replaceAll('<', '\\u003c')
  return `window.__ADMIN_DATA__ = ${json};`
}

function writeAdminObject(parsed: AdminRecord): void {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.members) || !Array.isArray(parsed.albums)) {
    throw new Error('Invalid admin data payload')
  }
  if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) {
    parsed.roles = BUILTIN_ROLES
  }
  const ownerRole = parsed.roles.find(role => role.id === 'owner')
  if (!ownerRole) {
    parsed.roles = [BUILTIN_ROLES[0], ...parsed.roles]
  }
  else {
    ownerRole.permissions = ALL_PERMISSIONS
    ownerRole.protected = true
  }
  parsed.storage = { ...(parsed.storage ?? {}), provider: 'local' }
  parsed.updatedAt = new Date().toISOString()
  writeContentData(`${JSON.stringify(parsed, null, 2)}\n`)
  try {
    createDatabaseBackup()
  }
  catch {
    // A backup failure must not block saving the content itself.
  }
}

function writeAdminData(raw: string): void {
  const parsed = JSON.parse(raw) as AdminRecord
  writeAdminObject(parsed)
}

function readBody(req: IncomingMessage, limit = MAX_BODY_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        req.resume()
        reject(new Error('Payload too large'))
        return
      }
      chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie ?? ''
  const result: Record<string, string> = {}
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) {
      continue
    }
    const key = part.slice(0, index).trim()
    if (key) {
      result[key] = decodeURIComponent(part.slice(index + 1).trim())
    }
  }
  return result
}

function sessionToken(req: IncomingMessage): string | undefined {
  return parseCookies(req)[SESSION_COOKIE]
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function setSessionCookie(res: ServerResponse, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  )
}

function clearSessionCookie(res: ServerResponse): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

function currentAdmin(): AdminLike {
  const data = readAdminObject()
  return data ?? { mode: 'team', members: [] }
}

function currentUser(req: IncomingMessage): AdminUser | null {
  const admin = currentAdmin()
  syncUsers(admin)
  const user = getSessionUser(sessionToken(req))
  if (!user) {
    return null
  }
  return withPermissions(admin, user)
}

function withPermissions(admin: AdminLike, user: AuthUser): AdminUser {
  const roles = Array.isArray((admin as AdminRecord).roles) && (admin as AdminRecord).roles.length > 0
    ? (admin as AdminRecord).roles
    : BUILTIN_ROLES
  const role = roles.find(item => item.id === user.role) ?? BUILTIN_ROLES.find(item => item.id === user.role)
  const permissions = user.role === 'owner'
    ? ALL_PERMISSIONS
    : (Array.isArray(role?.permissions) ? role.permissions : [])
  return {
    ...user,
    permissions,
    roleName: role?.name ?? user.role,
  }
}

function hasPermission(user: AdminUser, permission: Permission): boolean {
  return user.role === 'owner' || user.permissions.includes(permission)
}

function assertPermission(user: AdminUser, permission: Permission, message: string): void {
  if (!hasPermission(user, permission)) {
    throw new Error(message)
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function assertRoleChangeAllowed(current: AdminRecord | null, next: AdminRecord, user: AdminUser): void {
  if (!current) {
    if (user.role !== 'owner') {
      throw new Error('只有所有者可以初始化配置')
    }
    return
  }

  const permissionByKey: Array<[keyof AdminRecord, Permission]> = [
    ['site', 'settings.site'],
    ['gallery', 'settings.gallery'],
    ['storage', 'settings.storage'],
    ['team', 'members.manage'],
    ['mode', 'members.manage'],
    ['members', 'members.manage'],
    ['roles', 'roles.manage'],
    ['albums', 'albums.manage'],
    ['categories', 'categories.manage'],
  ]

  for (const [key, permission] of permissionByKey) {
    if (!sameJson(current[key], next[key])) {
      assertPermission(user, permission, `当前角色没有修改「${key}」的权限`)
    }
  }

  const canEditAllPhotos = hasPermission(user, 'attachments.edit')
  const canEditOwnPhotos = hasPermission(user, 'attachments.editOwn')
  const canAssign = hasPermission(user, 'attachments.assign')
  const currentMeta = current.photoMeta ?? {}
  const nextMeta = next.photoMeta ?? {}
  const photoIds = new Set([...Object.keys(currentMeta), ...Object.keys(nextMeta)])
  for (const photoId of photoIds) {
    if (sameJson(currentMeta[photoId], nextMeta[photoId])) {
      continue
    }
    const own = currentMeta[photoId]?.uploaderId === user.id
    if (!canEditAllPhotos && !(canEditOwnPhotos && own)) {
      throw new Error('只能编辑自己投稿的照片')
    }
    if (!canAssign) {
      const nextUploader = nextMeta[photoId]?.uploaderId
      const sameAssignments = sameJson(currentMeta[photoId]?.categoryIds ?? [], nextMeta[photoId]?.categoryIds ?? [])
        && sameJson(currentMeta[photoId]?.albumIds ?? [], nextMeta[photoId]?.albumIds ?? [])
      if (nextUploader !== currentMeta[photoId]?.uploaderId) {
        throw new Error('不能修改照片的上传者')
      }
      if (!sameAssignments && !(canEditOwnPhotos && own)) {
        throw new Error('当前角色没有归类照片的权限')
      }
    }
    else if (!canEditAllPhotos && nextMeta[photoId]?.uploaderId !== user.id) {
      throw new Error('不能修改照片的上传者')
    }
  }
}

function normalizeUploadPayload(input: unknown): { folder: string, files: UploadInput[] } {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid upload payload')
  }
  const payload = input as { files?: unknown, folder?: unknown }
  const files = payload.files
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('请选择要上传的照片')
  }
  return {
    folder: typeof payload.folder === 'string' ? payload.folder : '',
    files: files.map((file) => {
      const item = file as { name?: unknown, data?: unknown }
      if (typeof item.name !== 'string' || typeof item.data !== 'string') {
        throw new Error('上传文件格式不正确')
      }
      return { name: item.name, data: item.data }
    }),
  }
}

/**
 * Injects the editable admin content (site settings, albums, categories,
 * members, photo metadata) into the page and exposes a small local API in dev.
 * Accounts and sessions live in SQLite; content stays in content/admin-data.json
 * so the static build can still embed the last saved configuration.
 */
export function adminDataPlugin(): Plugin {
  return {
    name: 'afilmory-admin-data',
    enforce: 'pre',
    transformIndexHtml(html) {
      const scriptContent = toScriptContent(readAdminData())
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'text/javascript', id: SCRIPT_ID },
            children: scriptContent,
            injectTo: 'head',
          },
        ],
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) {
          next()
          return
        }

        const requestStartedAt = Date.now()
        res.on('finish', () => {
          if (
            url.pathname === '/api/admin/logs'
            || url.pathname.endsWith('/rebuild')
            || url.pathname.endsWith('/rebuild/status')
          ) {
            return
          }
          const status = res.statusCode
          addAdminLog({
            scope: 'api',
            level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
            message: `${req.method ?? 'GET'} ${url.pathname} · ${status} · ${Date.now() - requestStartedAt}ms`,
          })
        })

        try {
          if (url.pathname === '/api/bookings' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req, 64 * 1024)) as Record<string, unknown>
            const value = (key: string) => (typeof body[key] === 'string' ? String(body[key]).trim() : '')
            const name = value('name')
            const date = value('date')
            const time = value('time')
            const content = value('content')
            const contacts = {
              qq: value('qq'),
              email: value('email'),
              wechat: value('wechat'),
              phone: value('phone'),
            }
            const note = value('note')
            if (!name || name.length > 40) {
              sendJson(res, 400, { ok: false, error: '请填写称呼（40 字以内）' })
              return
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
              sendJson(res, 400, { ok: false, error: '请选择有效的日期和时间' })
              return
            }
            if (content.length < 2 || content.length > 1000) {
              sendJson(res, 400, { ok: false, error: '请填写 2-1000 字的拍摄内容' })
              return
            }
            if (!contacts.qq && !contacts.email && !contacts.wechat && !contacts.phone) {
              sendJson(res, 400, { ok: false, error: '请至少留下一种联系方式' })
              return
            }
            if (note.length > 500) {
              sendJson(res, 400, { ok: false, error: '备注不能超过 500 字' })
              return
            }
            const booking = createBooking({
              name,
              date,
              time,
              content,
              paid: body.paid === true,
              note,
              ...contacts,
            })
            sendJson(res, 200, { ok: true, id: booking.id })
            return
          }

          if (url.pathname === '/api/auth/state' && req.method === 'GET') {
            sendJson(res, 200, { initialized: isInitialized(), userCount: countUsers() })
            return
          }

          if (url.pathname === '/api/auth/setup' && req.method === 'POST') {
            if (isInitialized()) {
              sendJson(res, 409, { ok: false, error: '数据库已经初始化，请直接登录' })
              return
            }
            const body = JSON.parse(await readBody(req)) as {
              name?: unknown
              email?: unknown
              password?: unknown
              siteName?: unknown
            }
            const name = typeof body.name === 'string' ? body.name.trim() : ''
            const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
            const password = typeof body.password === 'string' ? body.password : ''
            if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              sendJson(res, 400, { ok: false, error: '请填写管理员名称和有效邮箱' })
              return
            }
            if (password.length < 8) {
              sendJson(res, 400, { ok: false, error: '密码至少 8 位' })
              return
            }

            const data = readAdminObject()
            if (!data) {
              sendJson(res, 500, { ok: false, error: '内容数据未初始化' })
              return
            }
            const owner = data.members.find(member => member.role === 'owner') ?? data.members[0]
            const ownerId = owner?.id || 'usr_owner'
            // 首次初始化只创建这一个管理员账号，其他种子成员等后台手动邀请，
            // 避免默认密码账号在首次运行时被自动创建。
            data.members = [{
              ...(owner ?? { id: ownerId, joinedAt: new Date().toISOString() }),
              id: ownerId,
              name,
              email,
              role: 'owner',
              status: 'active',
            }]
            for (const meta of Object.values(data.photoMeta ?? {})) {
              if (meta.uploaderId && meta.uploaderId !== ownerId) {
                meta.uploaderId = ownerId
              }
            }
            if (typeof body.siteName === 'string' && body.siteName.trim()) {
              data.site = { ...data.site, name: body.siteName.trim(), authorName: name, author: name }
            }
            writeAdminObject(data)
            const user = createInitialOwner({ id: ownerId, name, email, password })
            syncUsers(data)
            const { token } = createSession(user.id)
            setSessionCookie(res, token)
            sendJson(res, 200, { ok: true, user: withPermissions(data, user) })
            return
          }

          if (url.pathname === '/api/auth/login' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req)) as { email?: string, password?: string }
            if (!body.email || !body.password) {
              sendJson(res, 400, { ok: false, error: '请输入邮箱和密码' })
              return
            }
            const admin = currentAdmin()
            const user = authenticate(body.email, body.password, admin)
            if (!user) {
              sendJson(res, 401, { ok: false, error: '邮箱或密码不正确，或账号已被停用' })
              return
            }
            const { token } = createSession(user.id)
            setSessionCookie(res, token)
            sendJson(res, 200, { ok: true, user: withPermissions(admin, user) })
            return
          }

          if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
            deleteSession(sessionToken(req))
            clearSessionCookie(res)
            sendJson(res, 200, { ok: true })
            return
          }

          if (url.pathname === '/api/auth/me' && req.method === 'GET') {
            const user = currentUser(req)
            if (!user) {
              sendJson(res, 401, { ok: false, error: '未登录' })
              return
            }
            sendJson(res, 200, { ok: true, user })
            return
          }

          if (url.pathname === '/api/auth/password' && req.method === 'POST') {
            const user = currentUser(req)
            if (!user) {
              sendJson(res, 401, { ok: false, error: '未登录' })
              return
            }
            const body = JSON.parse(await readBody(req)) as {
              memberId?: string
              currentPassword?: string
              newPassword?: string
            }
            const newPassword = body.newPassword ?? ''
            if (newPassword.length < 6) {
              sendJson(res, 400, { ok: false, error: '新密码至少 6 位' })
              return
            }
            if (body.memberId === user.id && !body.currentPassword) {
              setPassword(user.id, newPassword)
              sendJson(res, 200, { ok: true })
              return
            }
            if (body.memberId && body.memberId !== user.id) {
              if (!hasPermission(user, 'members.manage')) {
                sendJson(res, 403, { ok: false, error: '没有重置其他成员密码的权限' })
                return
              }
              if (!setPassword(body.memberId, newPassword)) {
                sendJson(res, 404, { ok: false, error: '成员不存在' })
                return
              }
              sendJson(res, 200, { ok: true })
              return
            }
            const admin = currentAdmin()
            if (!authenticate(user.email, body.currentPassword ?? '', admin)) {
              sendJson(res, 400, { ok: false, error: '当前密码不正确' })
              return
            }
            setPassword(user.id, newPassword)
            sendJson(res, 200, { ok: true })
            return
          }

          const user = currentUser(req)
          if (!user) {
            sendJson(res, 401, { ok: false, error: '未登录' })
            return
          }

          if (url.pathname === '/api/admin/logs' && req.method === 'GET') {
            if (!hasPermission(user, 'settings.storage')) {
              sendJson(res, 403, { ok: false, error: '当前角色不能查看运行日志' })
              return
            }
            const limit = Number(url.searchParams.get('limit') ?? 200)
            sendJson(res, 200, { ok: true, logs: listAdminLogs(Number.isFinite(limit) ? limit : 200) })
            return
          }

          if (url.pathname === '/api/admin/data') {
            if (req.method === 'GET') {
              sendJson(res, 200, JSON.parse(readAdminData() ?? 'null'))
              return
            }
            if (req.method === 'PUT' || req.method === 'POST') {
              const body = await readBody(req)
              const next = JSON.parse(body) as AdminRecord
              assertRoleChangeAllowed(readAdminObject(), next, user)
              writeAdminData(body)
              syncUsers(next)
              sendJson(res, 200, { ok: true })
              return
            }
            sendJson(res, 405, { ok: false, error: 'Method not allowed' })
            return
          }

          if (url.pathname === '/api/admin/bookings' && req.method === 'GET') {
            if (!hasPermission(user, 'members.manage')) {
              sendJson(res, 403, { ok: false, error: '当前角色不能查看预约' })
              return
            }
            sendJson(res, 200, { ok: true, bookings: listBookings() })
            return
          }

          if (url.pathname === '/api/admin/bookings/status' && req.method === 'POST') {
            if (!hasPermission(user, 'members.manage')) {
              sendJson(res, 403, { ok: false, error: '当前角色不能处理预约' })
              return
            }
            const body = JSON.parse(await readBody(req)) as { id?: unknown, status?: unknown }
            const id = typeof body.id === 'string' ? body.id : ''
            const status = String(body.status ?? '')
            const allowed: BookingStatus[] = ['pending', 'confirmed', 'done', 'cancelled']
            if (!id || !allowed.includes(status as BookingStatus)) {
              sendJson(res, 400, { ok: false, error: '预约状态参数不正确' })
              return
            }
            if (!updateBookingStatus(id, status as BookingStatus)) {
              sendJson(res, 404, { ok: false, error: '预约不存在' })
              return
            }
            sendJson(res, 200, { ok: true })
            return
          }

          if (url.pathname === '/api/admin/bookings/delete' && req.method === 'POST') {
            if (!hasPermission(user, 'members.manage')) {
              sendJson(res, 403, { ok: false, error: '当前角色不能删除预约' })
              return
            }
            const body = JSON.parse(await readBody(req)) as { id?: unknown }
            if (typeof body.id !== 'string' || !deleteBooking(body.id)) {
              sendJson(res, 404, { ok: false, error: '预约不存在' })
              return
            }
            sendJson(res, 200, { ok: true })
            return
          }

          if (url.pathname === '/api/admin/attachments/upload' && req.method === 'POST') {
            if (!hasPermission(user, 'attachments.upload')) {
              sendJson(res, 403, { ok: false, error: '当前角色不能上传照片' })
              return
            }
            const body = JSON.parse(await readBody(req, MAX_UPLOAD_SIZE)) as unknown
            const upload = normalizeUploadPayload(body)
            const data = readAdminObject()
            if (!data) {
              sendJson(res, 500, { ok: false, error: '后台配置未初始化' })
              return
            }
            const uploaded = await saveUploads(upload.files, {
              basePath: data.storage?.basePath,
              allowedFormats: data.storage?.allowedFormats,
              maxFileSizeMb: data.storage?.maxFileSizeMb,
              folder: upload.folder,
            })
            for (const item of uploaded) {
              data.photoMeta = {
                ...data.photoMeta,
                [item.id]: { ...(data.photoMeta?.[item.id] ?? {}), uploaderId: user.id },
              }
            }
            writeAdminObject(data)
            syncUsers(data)
            sendJson(res, 200, { ok: true, uploaded })
            return
          }

          if (url.pathname === '/api/admin/attachments/delete' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req)) as { photoIds?: unknown }
            const photoIds = Array.isArray(body.photoIds) ? body.photoIds.filter((id): id is string => typeof id === 'string') : []
            if (photoIds.length === 0) {
              sendJson(res, 400, { ok: false, error: '请选择要删除的照片' })
              return
            }
            const data = readAdminObject()
            if (!data) {
              sendJson(res, 500, { ok: false, error: '后台配置未初始化' })
              return
            }
            const canDeleteAll = hasPermission(user, 'attachments.delete')
            const canDeleteOwn = hasPermission(user, 'attachments.deleteOwn')
            for (const photoId of photoIds) {
              const own = data.photoMeta?.[photoId]?.uploaderId === user.id
              if (!canDeleteAll && !(canDeleteOwn && own)) {
                sendJson(res, 403, { ok: false, error: '只能删除自己投稿的照片' })
                return
              }
            }
            const trashed: string[] = []
            for (const photoId of photoIds) {
              const files = movePhotoToTrash(photoId, { basePath: data.storage?.basePath })
              if (!files) {
                continue
              }
              const albumIds = data.albums.filter(album => album.photoIds.includes(photoId)).map(album => album.id)
              insertTrash(
                photoId,
                JSON.stringify({
                  photo: files.photo,
                  meta: data.photoMeta?.[photoId] ?? {},
                  albumIds,
                  files: { filename: files.filename, publicFilename: files.publicFilename },
                }),
                user.id,
              )
              trashed.push(photoId)
            }
            const trashedSet = new Set(trashed)
            data.photoMeta = Object.fromEntries(
              Object.entries(data.photoMeta ?? {}).filter(([id]) => !trashedSet.has(id)),
            )
            data.albums = data.albums.map(album => ({
              ...album,
              photoIds: album.photoIds.filter(id => !trashedSet.has(id)),
            }))
            writeAdminObject(data)
            if (trashed.length > 0) {
              await rebuildManifest()
            }
            sendJson(res, 200, { ok: true, trashed })
            return
          }

          if (url.pathname === '/api/admin/attachments/rebuild' && req.method === 'GET') {
            if (!hasPermission(user, 'attachments.rebuild')) {
              sendJson(res, 403, { ok: false, error: '当前角色不能查看重建进度' })
              return
            }
            const id = url.searchParams.get('id')
            const job = id ? getRebuildJob(id) : getActiveRebuildJob()
            if (!job) {
              sendJson(res, 404, { ok: false, error: '没有正在进行的索引任务' })
              return
            }
            sendJson(res, 200, { ok: true, job })
            return
          }

          if (url.pathname === '/api/admin/attachments/rebuild' && req.method === 'POST') {
            if (!hasPermission(user, 'attachments.rebuild')) {
              sendJson(res, 403, { ok: false, error: '当前角色不能重建附件索引' })
              return
            }
            const data = readAdminObject()
            if (!data) {
              sendJson(res, 500, { ok: false, error: '后台配置未初始化' })
              return
            }
            const job = startRebuildJob(data.storage?.basePath)
            sendJson(res, 202, { ok: true, job })
            return
          }

          if (url.pathname === '/api/admin/trash' && req.method === 'GET') {
            const canSeeAll = hasPermission(user, 'attachments.delete')
            const rows = listTrash()
              .filter(row => canSeeAll || row.deleted_by === user.id)
              .map((row) => {
                try {
                  const payload = JSON.parse(row.payload) as {
                    photo?: ManifestPhoto
                    meta?: unknown
                    albumIds?: string[]
                  }
                  return {
                    id: row.id,
                    photo: payload.photo,
                    meta: payload.meta ?? {},
                    albumIds: payload.albumIds ?? [],
                    deletedAt: row.deleted_at,
                    deletedBy: row.deleted_by,
                    thumbnailUrl: `/thumbnails/${row.id}.jpg`,
                  }
                }
                catch {
                  return null
                }
              })
              .filter(Boolean)
            sendJson(res, 200, { ok: true, items: rows })
            return
          }

          if (url.pathname === '/api/admin/trash/restore' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req)) as { ids?: unknown }
            const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : []
            if (ids.length === 0) {
              sendJson(res, 400, { ok: false, error: '请选择要恢复的照片' })
              return
            }
            const data = readAdminObject()
            if (!data) {
              sendJson(res, 500, { ok: false, error: '内容数据未初始化' })
              return
            }
            const canRestoreAll = hasPermission(user, 'attachments.delete')
            const canRestoreOwn = hasPermission(user, 'attachments.deleteOwn')
            const restored: string[] = []
            for (const id of ids) {
              const row = getTrash(id)
              if (!row || (!canRestoreAll && !(canRestoreOwn && row.deleted_by === user.id))) {
                continue
              }
              const payload = JSON.parse(row.payload) as {
                photo?: ManifestPhoto
                meta?: Record<string, unknown>
                albumIds?: string[]
                files?: { filename: string, publicFilename: string }
              }
              if (!payload.photo || !payload.files) {
                continue
              }
              const ok = restorePhotoFromTrash({
                id,
                filename: payload.files.filename,
                publicFilename: payload.files.publicFilename,
                photo: payload.photo,
              }, { basePath: data.storage?.basePath })
              if (!ok) {
                continue
              }
              data.photoMeta = { ...data.photoMeta, [id]: payload.meta ?? {} }
              const albumIds = new Set(payload.albumIds ?? [])
              data.albums = data.albums.map(album => albumIds.has(album.id) && !album.photoIds.includes(id)
                ? { ...album, photoIds: [...album.photoIds, id] }
                : album)
              deleteTrashRow(id)
              restored.push(id)
            }
            writeAdminObject(data)
            if (restored.length > 0) {
              await rebuildManifest()
            }
            sendJson(res, 200, { ok: true, restored })
            return
          }

          if (url.pathname === '/api/admin/trash/empty' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req)) as { ids?: unknown }
            const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : []
            const canEmptyAll = hasPermission(user, 'attachments.delete')
            const canEmptyOwn = hasPermission(user, 'attachments.deleteOwn')
            const rows = ids.length > 0
              ? listTrash().filter(row => ids.includes(row.id))
              : listTrash()
            const purged: string[] = []
            for (const row of rows) {
              if (!canEmptyAll && !(canEmptyOwn && row.deleted_by === user.id)) {
                continue
              }
              purgePhotoFromTrash(row.id)
              deleteTrashRow(row.id)
              purged.push(row.id)
            }
            if (ids.length === 0 && canEmptyAll) {
              clearTrashRows()
            }
            sendJson(res, 200, { ok: true, purged })
            return
          }

          if (url.pathname === '/api/admin/attachments/reindex' && req.method === 'POST') {
            if (!hasPermission(user, 'attachments.rebuild')) {
              sendJson(res, 403, { ok: false, error: '当前角色不能重新索引照片' })
              return
            }
            const data = readAdminObject()
            if (!data) {
              sendJson(res, 500, { ok: false, error: '后台配置未初始化' })
              return
            }
            const job = startRebuildJob(data.storage?.basePath)
            sendJson(res, 202, { ok: true, job })
            return
          }

          if (url.pathname === '/api/admin/manifest' && req.method === 'GET') {
            sendJson(res, 200, { ok: true, manifest: readManifest() })
            return
          }

          if (url.pathname === '/api/admin/export' && req.method === 'GET') {
            if (!hasPermission(user, 'settings.site')) {
              sendJson(res, 403, { ok: false, error: '没有导出数据的权限' })
              return
            }
            const raw = readAdminData()
            const stamp = new Date().toISOString().slice(0, 19).replaceAll(/[:T]/g, '-')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Content-Disposition', `attachment; filename="afilmory-data-${stamp}.json"`)
            res.end(raw)
            return
          }

          if (url.pathname === '/api/admin/import' && req.method === 'POST') {
            if (!hasPermission(user, 'roles.manage')) {
              sendJson(res, 403, { ok: false, error: '没有导入数据的权限' })
              return
            }
            try {
              const raw = await readBody(req)
              const data = JSON.parse(raw) as AdminRecord
              if (!Array.isArray(data.members) || !Array.isArray(data.albums)) {
                throw new Error('导入文件缺少 members/albums')
              }
              writeAdminObject(data)
              syncUsers(data)
              sendJson(res, 200, { ok: true, data: readAdminObject() })
            }
            catch (error) {
              sendJson(res, 400, { ok: false, error: `导入失败：${(error as Error).message}` })
            }
            return
          }

          if (url.pathname === '/api/admin/backup' && req.method === 'POST') {
            if (!hasPermission(user, 'roles.manage')) {
              sendJson(res, 403, { ok: false, error: '没有备份权限' })
              return
            }
            try {
              sendJson(res, 200, { ok: true, backup: createDatabaseBackup(), backups: listDatabaseBackups() })
            }
            catch (error) {
              sendJson(res, 500, { ok: false, error: `备份失败：${(error as Error).message}` })
            }
            return
          }

          if (url.pathname === '/api/admin/backups' && req.method === 'GET') {
            if (!hasPermission(user, 'roles.manage')) {
              sendJson(res, 403, { ok: false, error: '没有查看备份的权限' })
              return
            }
            sendJson(res, 200, { ok: true, backups: listDatabaseBackups(), database: databaseFilePath() })
            return
          }

          sendJson(res, 404, { ok: false, error: 'Not found' })
        }
        catch (error) {
          sendJson(res, 500, { ok: false, error: (error as Error).message })
        }
      })
    },
  }
}
