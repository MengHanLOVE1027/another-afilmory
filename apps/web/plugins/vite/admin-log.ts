export type AdminLogLevel = 'info' | 'success' | 'warn' | 'error'

export interface AdminLogEntry {
  id: number
  at: string
  level: AdminLogLevel
  scope: 'api' | 'auth' | 'build' | 'file' | 'system'
  message: string
}

const MAX_ENTRIES = 600
let nextId = 1
const entries: AdminLogEntry[] = []

/**
 * Keep the dev-server terminal in sync with the in-app log panel. Builder
 * stdout can be noisy, so every line is still emitted exactly once.
 */
export function echoAdminLog(entry: Pick<AdminLogEntry, 'at' | 'level' | 'scope' | 'message'>): void {
  const time = new Date(entry.at).toLocaleTimeString('zh-CN', { hour12: false })
  const line = `[${time}] [${entry.scope}] ${entry.message}`
  if (entry.level === 'error') {
    console.error(line)
  }
  else if (entry.level === 'warn') {
    console.warn(line)
  }
  else {
    console.log(line)
  }
}

export function addAdminLog(
  entry: Omit<AdminLogEntry, 'id' | 'at'> & { at?: string },
  options: { echo?: boolean } = {},
): AdminLogEntry {
  const value: AdminLogEntry = {
    id: nextId++,
    at: entry.at ?? new Date().toISOString(),
    level: entry.level,
    scope: entry.scope,
    message: entry.message,
  }
  entries.push(value)
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }
  if (options.echo !== false) {
    echoAdminLog(value)
  }
  return value
}

export function listAdminLogs(limit = 200): AdminLogEntry[] {
  const size = Math.max(1, Math.min(MAX_ENTRIES, Math.floor(limit)))
  return entries.slice(-size).reverse()
}
