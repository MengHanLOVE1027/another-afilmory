import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import type { BookingRecord, BookingStatus } from '../../src/lib/admin/types'
import { MONOREPO_ROOT_PATH } from './__internal__/constants'

const DB_PATH = process.env.AFILMORY_DB_PATH
  ? path.resolve(MONOREPO_ROOT_PATH, process.env.AFILMORY_DB_PATH)
  : path.resolve(MONOREPO_ROOT_PATH, 'content/afilmory.db')
const BACKUP_DIR = path.resolve(MONOREPO_ROOT_PATH, 'content/backups')
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

const DEFAULT_OWNER_PASSWORD = process.env.AFILMORY_ADMIN_PASSWORD || 'admin123'
const DEFAULT_MEMBER_PASSWORD = process.env.AFILMORY_MEMBER_PASSWORD || 'photo123'

export interface AdminMemberLike {
  id: string
  name: string
  email?: string
  role: string
  status?: string
  color?: string
  joinedAt?: string
}

export interface AdminLike {
  mode?: 'personal' | 'team'
  members: AdminMemberLike[]
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  color: string | null
  joinedAt: string | null
}

let database: DatabaseSync | null = null

function getDb(): DatabaseSync {
  if (database) {
    return database
  }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  database = new DatabaseSync(DB_PATH)
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      color TEXT,
      joined_at TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trash (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      deleted_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_trash_deleted ON trash(deleted_at);

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      qq TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      wechat TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      content TEXT NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
  `)
  return database
}

export function readContentData(): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('admin-data') as { value?: string } | undefined
  return row?.value ?? null
}

export function writeContentData(raw: string): void {
  getDb()
    .prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    .run('admin-data', raw, new Date().toISOString())
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value?: string } | undefined
  return row?.value ?? null
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare(`
      INSERT INTO app_meta (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(key, value)
}

export function countUsers(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
  return Number(row?.count ?? 0)
}

export function isInitialized(): boolean {
  if (countUsers() === 0) {
    return false
  }
  if (getMeta('initialized') !== '1') {
    setMeta('initialized', '1')
  }
  return true
}

export function createInitialOwner(input: { id?: string, name: string, email: string, password: string }): AuthUser {
  if (countUsers() > 0) {
    throw new Error('数据库已经初始化')
  }
  const db = getDb()
  const id = input.id || 'usr_owner'
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO users (id, name, email, role, status, color, joined_at, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, 'owner', 'active', ?, ?, ?, ?, ?)
  `).run(id, input.name, input.email.toLowerCase(), '#e0a458', now, hashPassword(input.password), now, now)
  setMeta('initialized', '1')
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>
  return toUser(row)
}

export function databaseFilePath(): string {
  return DB_PATH
}

export interface TrashRow {
  id: string
  payload: string
  deleted_at: string
  deleted_by: string | null
}

export function listTrash(): TrashRow[] {
  return getDb()
    .prepare('SELECT id, payload, deleted_at, deleted_by FROM trash ORDER BY deleted_at DESC')
    .all() as unknown as TrashRow[]
}

export function getTrash(id: string): TrashRow | null {
  const row = getDb()
    .prepare('SELECT id, payload, deleted_at, deleted_by FROM trash WHERE id = ?')
    .get(id) as TrashRow | undefined
  return row ?? null
}

export function insertTrash(id: string, payload: string, deletedBy: string | null): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO trash (id, payload, deleted_at, deleted_by) VALUES (?, ?, ?, ?)')
    .run(id, payload, new Date().toISOString(), deletedBy)
}

export function deleteTrashRow(id: string): void {
  getDb().prepare('DELETE FROM trash WHERE id = ?').run(id)
}

export function clearTrashRows(): void {
  getDb().prepare('DELETE FROM trash').run()
}

export interface BackupFile {
  name: string
  size: number
  createdAt: string
}

export function createDatabaseBackup(): BackupFile {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const name = `afilmory-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.db`
  const target = path.join(BACKUP_DIR, name)
  const escaped = target.replaceAll("'", "''")
  getDb().exec(`VACUUM INTO '${escaped}'`)
  pruneDatabaseBackups(10)
  const stat = fs.statSync(target)
  return { name, size: stat.size, createdAt: stat.birthtime.toISOString() }
}

export function listDatabaseBackups(): BackupFile[] {
  if (!fs.existsSync(BACKUP_DIR)) {
    return []
  }
  return fs.readdirSync(BACKUP_DIR)
    .filter(name => name.endsWith('.db'))
    .map((name) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name))
      return { name, size: stat.size, createdAt: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function pruneDatabaseBackups(keep = 10): void {
  const files = listDatabaseBackups()
  for (const file of files.slice(keep)) {
    fs.rmSync(path.join(BACKUP_DIR, file.name), { force: true })
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, hash] = stored.split(':')
  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false
  }
  try {
    const expected = Buffer.from(hash, 'hex')
    const actual = scryptSync(password, salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  }
  catch {
    return false
  }
}

function sanitizeEmail(member: AdminMemberLike, used: Set<string>): string {
  const raw = (member.email ?? '').trim().toLowerCase()
  const fallback = `${member.id.replaceAll(/[^\w.-]/g, '')}@another-afilmory.local`
  let email = raw || fallback
  if (used.has(email)) {
    email = fallback
  }
  let suffix = 2
  while (used.has(email)) {
    email = `${fallback.split('@')[0]}${suffix}@another-afilmory.local`
    suffix += 1
  }
  used.add(email)
  return email
}

function toUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    status: String(row.status),
    color: row.color == null ? null : String(row.color),
    joinedAt: row.joined_at == null ? null : String(row.joined_at),
  }
}

/**
 * Mirrors the member list from admin-data.json into SQLite. Passwords are kept
 * when the account already exists; new accounts get a documented initial
 * password so an administrator can hand them out.
 */
export function syncUsers(admin: AdminLike): void {
  if (countUsers() === 0) {
    // First run: do not auto-create members before the setup wizard creates
    // the initial owner account.
    return
  }
  const db = getDb()
  const members = Array.isArray(admin.members) ? admin.members : []
  if (members.length === 0) {
    return
  }

  const existing = db.prepare('SELECT * FROM users').all() as Array<Record<string, unknown>>
  const byId = new Map(existing.map(row => [String(row.id), row]))
  const usedEmails = new Set<string>()
  const now = new Date().toISOString()

  const upsert = db.prepare(`
    INSERT INTO users (id, name, email, role, status, color, joined_at, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      role = excluded.role,
      status = excluded.status,
      color = excluded.color,
      joined_at = excluded.joined_at,
      updated_at = excluded.updated_at
  `)

  for (const member of members) {
    if (!member?.id) {
      continue
    }
    const previous = byId.get(member.id)
    const email = sanitizeEmail(member, usedEmails)
    const passwordHash = previous
      ? String(previous.password_hash)
      : hashPassword(member.role === 'owner' ? DEFAULT_OWNER_PASSWORD : DEFAULT_MEMBER_PASSWORD)
    upsert.run(
      member.id,
      member.name || '未命名成员',
      email,
      member.role || 'viewer',
      member.status || 'active',
      member.color ?? null,
      member.joinedAt ?? now,
      passwordHash,
      previous ? String(previous.created_at) : now,
      now,
    )
  }

  const keep = new Set(members.map(member => member.id))
  for (const row of existing) {
    const id = String(row.id)
    if (!keep.has(id)) {
      db.prepare('DELETE FROM users WHERE id = ?').run(id)
    }
  }
}

export function authenticate(email: string, password: string, admin: AdminLike): AuthUser | null {
  syncUsers(admin)
  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email.trim().toLowerCase()) as
    | Record<string, unknown>
    | undefined
  if (!row || row.status !== 'active') {
    return null
  }
  if ((admin.mode ?? 'team') === 'personal' && row.role !== 'owner') {
    return null
  }
  if (!verifyPassword(password, String(row.password_hash))) {
    return null
  }
  return toUser(row)
}

export function createSession(userId: string): { token: string, expiresAt: number } {
  const db = getDb()
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS
  db.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    token,
    userId,
    expiresAt,
    now,
  )
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now)
  return { token, expiresAt }
}

export function getSessionUser(token: string | undefined): AuthUser | null {
  if (!token) {
    return null
  }
  const db = getDb()
  const row = db
    .prepare(`
      SELECT users.* FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ? AND sessions.expires_at > ?
    `)
    .get(token, Date.now()) as Record<string, unknown> | undefined
  return row ? toUser(row) : null
}

export function deleteSession(token: string | undefined): void {
  if (!token) {
    return
  }
  getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function setPassword(userId: string, password: string): boolean {
  const db = getDb()
  const result = db
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hashPassword(password), new Date().toISOString(), userId)
  return result.changes > 0
}

export function getUserById(userId: string): AuthUser | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined
  return row ? toUser(row) : null
}

export function listUsers(): AuthUser[] {
  const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at ASC').all() as Array<Record<string, unknown>>
  return rows.map(toUser)
}

export interface BookingInput {
  name: string
  qq: string
  email: string
  wechat: string
  phone: string
  date: string
  time: string
  content: string
  paid: boolean
  note: string
}

function toBooking(row: Record<string, unknown>): BookingRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    qq: String(row.qq ?? ''),
    email: String(row.email ?? ''),
    wechat: String(row.wechat ?? ''),
    phone: String(row.phone ?? ''),
    date: String(row.date),
    time: String(row.time),
    content: String(row.content),
    paid: Boolean(row.paid),
    note: String(row.note ?? ''),
    status: String(row.status ?? 'pending') as BookingStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function createBooking(input: BookingInput): BookingRecord {
  const now = new Date().toISOString()
  const id = randomUUID()
  getDb()
    .prepare(`
      INSERT INTO bookings (id, name, qq, email, wechat, phone, date, time, content, paid, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `)
    .run(
      id,
      input.name,
      input.qq,
      input.email,
      input.wechat,
      input.phone,
      input.date,
      input.time,
      input.content,
      input.paid ? 1 : 0,
      input.note,
      now,
      now,
    )
  return toBooking(getDb().prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Record<string, unknown>)
}

export function listBookings(): BookingRecord[] {
  const rows = getDb().prepare('SELECT * FROM bookings ORDER BY created_at DESC').all() as Array<Record<string, unknown>>
  return rows.map(toBooking)
}

export function updateBookingStatus(id: string, status: BookingStatus): boolean {
  const result = getDb()
    .prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id)
  return result.changes > 0
}

export function deleteBooking(id: string): boolean {
  const result = getDb().prepare('DELETE FROM bookings WHERE id = ?').run(id)
  return result.changes > 0
}

export { DB_PATH }
