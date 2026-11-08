import siteConfig from '@config'
import { ArrowLeft, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import { fetchAuthState, setupAdmin } from '~/lib/admin/auth'

const inputCls
  = 'h-10 w-full rounded-lg border border-[#e3e5e8] bg-white pl-9 pr-3 text-sm text-[#1f2329] outline-none transition-colors placeholder:text-[#a9adb5] focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20'

const SetupPage = () => {
  const [siteName, setSiteName] = useState(siteConfig.name)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAuthState()
      .then((state) => {
        if (cancelled) {
          return
        }
        if (state.initialized) {
          window.location.replace('/console/login')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChecking(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) {
      return
    }
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    setError(null)
    const result = await setupAdmin({ name, email, password, siteName })
    if (result.ok) {
      window.location.replace('/console')
      return
    }
    setLoading(false)
    setError(result.error ?? '初始化失败')
  }

  if (checking) {
    return (
      <div className="fixed inset-0 z-300 flex items-center justify-center bg-[#f5f6f8] text-[#8a9099]">
        <Loader2 className="mr-2 size-4 animate-spin" />
        正在检查数据库…
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center overflow-y-auto bg-[#f5f6f8] px-4 py-10 text-[#1f2329]">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#1f2329] text-white">
            <i className="i-mingcute-camera-2-line" />
          </span>
          <div>
            <p className="truncate text-sm font-semibold">{siteConfig.name}</p>
            <p className="text-[11px] text-[#8a9099]">首次运行初始化</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#e8eaed] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
        >
          <h1 className="text-lg font-semibold">创建第一个管理员</h1>
          <p className="mt-1 text-xs leading-5 text-[#8a9099]">
            数据库还没有账号。设置站点名称和管理员账号后，即可进入后台。
          </p>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-medium text-[#4b5563]">站点名称</span>
            <input
              className="h-10 w-full rounded-lg border border-[#e3e5e8] bg-white px-3 text-sm outline-none transition-colors focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20"
              value={siteName}
              onChange={event => setSiteName(event.target.value)}
              required
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-[#4b5563]">管理员名称</span>
            <span className="relative block">
              <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#a9adb5]" />
              <input
                className={inputCls}
                placeholder="你的名字"
                value={name}
                onChange={event => setName(event.target.value)}
                required
              />
            </span>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-[#4b5563]">管理员邮箱</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#a9adb5]" />
              <input
                className={inputCls}
                type="email"
                autoComplete="username"
                placeholder="owner@another-afilmory.local"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </span>
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#4b5563]">密码</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#a9adb5]" />
                <input
                  className={inputCls}
                  type="password"
                  autoComplete="new-password"
                  placeholder="至少 8 位"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#4b5563]">确认密码</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#a9adb5]" />
                <input
                  className={inputCls}
                  type="password"
                  autoComplete="new-password"
                  placeholder="再次输入"
                  value={confirm}
                  onChange={event => setConfirm(event.target.value)}
                  required
                />
              </span>
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-[#f6d3d3] bg-[#fef4f4] px-3 py-2 text-xs leading-5 text-[#dc2626]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1f2329] text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            创建管理员并进入后台
          </button>

          <a href="/" className="mt-4 flex items-center justify-center gap-1 text-xs text-[#8a9099] hover:text-[#4b5563]">
            <ArrowLeft className="size-3.5" />
            返回站点
          </a>
        </form>
      </div>
    </div>
  )
}

export const Component = SetupPage
