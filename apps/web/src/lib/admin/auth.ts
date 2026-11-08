import type { Permission } from './types'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  roleName?: string
  permissions?: Permission[]
  status: string
  color?: string | null
  joinedAt?: string | null
}

interface AuthResponse {
  ok?: boolean
  user?: AuthUser
  error?: string
}

async function readJson(response: Response): Promise<AuthResponse | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return null
  }
  try {
    return (await response.json()) as AuthResponse
  }
  catch {
    return null
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
    if (response.status === 401) {
      return null
    }
    const data = await readJson(response)
    return data?.user ?? null
  }
  catch {
    return null
  }
}

export async function login(email: string, password: string): Promise<{ ok: boolean, user?: AuthUser, error?: string }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await readJson(response)
    if (!response.ok || !data?.ok) {
      return { ok: false, error: data?.error ?? '登录失败，请确认开发服务器已启动' }
    }
    return { ok: true, user: data.user }
  }
  catch {
    return { ok: false, error: '无法连接后台接口' }
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  }
  catch {
    // Ignore network failures; the caller still navigates away.
  }
}

export async function resetPassword(memberId: string, newPassword: string): Promise<{ ok: boolean, error?: string }> {
  try {
    const response = await fetch('/api/auth/password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, newPassword }),
    })
    const data = await readJson(response)
    if (!response.ok || !data?.ok) {
      return { ok: false, error: data?.error ?? '密码重置失败' }
    }
    return { ok: true }
  }
  catch {
    return { ok: false, error: '无法连接后台接口' }
  }
}

export interface AuthState {
  initialized: boolean
  userCount: number
}

export async function fetchAuthState(): Promise<AuthState> {
  try {
    const response = await fetch('/api/auth/state', { credentials: 'same-origin' })
    const data = await response.json() as Partial<AuthState>
    return { initialized: !!data.initialized, userCount: Number(data.userCount ?? 0) }
  }
  catch {
    return { initialized: false, userCount: 0 }
  }
}

export async function setupAdmin(input: {
  name: string
  email: string
  password: string
  siteName?: string
}): Promise<{ ok: boolean, user?: AuthUser, error?: string }> {
  try {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await readJson(response)
    if (!response.ok || !data?.ok) {
      return { ok: false, error: data?.error ?? '初始化失败' }
    }
    return { ok: true, user: data.user }
  }
  catch {
    return { ok: false, error: '无法连接后台接口' }
  }
}

export function hasPermission(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user || user.status === 'disabled') {
    return false
  }
  if (user.role === 'owner') {
    return true
  }
  return Array.isArray(user.permissions) && user.permissions.includes(permission)
}

export function canManageSettings(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageContent(role: string | undefined): boolean {
  return canManageSettings(role) || role === 'editor'
}

export function canManageMeta(role: string | undefined): boolean {
  return canManageContent(role) || role === 'contributor'
}

export function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'owner': {
      return '所有者'
    }
    case 'admin': {
      return '管理员'
    }
    case 'editor': {
      return '编辑'
    }
    case 'contributor': {
      return '投稿者'
    }
    case 'viewer': {
      return '访客'
    }
    default: {
      return role ?? '未分配'
    }
  }
}
