import { randomBytes, scryptSync } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = process.env.AFILMORY_DB_PATH
  ? path.resolve(root, process.env.AFILMORY_DB_PATH)
  : path.join(root, 'content/afilmory.db')

const [email, password] = process.argv.slice(2)

if (!email || !password) {
  console.error('用法: pnpm reset:password <邮箱> <新密码>')
  process.exit(1)
}

if (password.length < 6) {
  console.error('新密码至少 6 位。')
  process.exit(1)
}

if (!fs.existsSync(dbPath)) {
  console.error(`数据库不存在: ${dbPath}`)
  process.exit(1)
}

const db = new DatabaseSync(dbPath)
try {
  const user = db.prepare('SELECT id, email FROM users WHERE lower(email) = ?').get(email.trim().toLowerCase())
  if (!user) {
    console.error(`没有找到账号: ${email}`)
    process.exit(1)
  }

  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(`scrypt:${salt}:${hash}`, new Date().toISOString(), user.id)
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)

  console.log(`已更新 ${user.email} 的密码，旧会话已失效。`)
}
finally {
  db.close()
}
