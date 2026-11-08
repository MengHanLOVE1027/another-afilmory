import { photoLoader } from '@afilmory/data'
import { useSetAtom } from 'jotai'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  FolderOpen,
  Globe,
  HardDrive,
  House,
  Image as ImageIcon,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { photoManifestVersionAtom } from '~/atoms/app'
import {
  type AdminLogEntry,
  type RebuildJob,
  deletePhotos,
  fetchAdminLogs,
  fetchRebuildJob,
  rebuildAttachments,
  uploadPhotos,
} from '~/lib/admin/attachments'
import { fetchBookings, removeBooking, setBookingStatus } from '~/lib/admin/bookings'
import {
  type AuthUser,
  fetchMe,
  hasPermission,
  logout,
  resetPassword,
} from '~/lib/admin/auth'
import { getAdminData, makeId, saveAdminData, setAdminData, slugify } from '~/lib/admin/store'
import type { AdminData, BookingRecord, BookingStatus, EquipmentItem, Permission, Role } from '~/lib/admin/types'
import {
  ALL_PERMISSIONS,
  MODE_LABELS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  roleNameOf,
} from '~/lib/admin/types'

type SectionId = 'overview' | 'bookings' | 'attachments' | 'trash' | 'site' | 'home' | 'gallery' | 'albums' | 'categories' | 'team' | 'roles' | 'storage'

interface AttachmentFilter {
  kind: 'all' | 'uncategorized' | 'unassigned-album' | 'album' | 'category' | 'uploader'
  value?: string
}

const SECTIONS: Array<{ id: SectionId, label: string, icon: typeof Globe, title: string }> = [
  { id: 'overview', label: '概览', icon: LayoutDashboard, title: '概览' },
  { id: 'bookings', label: '预约管理', icon: CalendarDays, title: '预约管理' },
  { id: 'attachments', label: '附件库', icon: ImagePlus, title: '附件库' },
  { id: 'trash', label: '回收站', icon: Trash2, title: '回收站' },
  { id: 'albums', label: '摄影集', icon: FolderOpen, title: '摄影集管理' },
  { id: 'categories', label: '分类', icon: Tags, title: '分类管理' },
  { id: 'team', label: '成员与模式', icon: Users, title: '成员与协作模式' },
  { id: 'roles', label: '角色与权限', icon: ShieldCheck, title: '角色与权限' },
  { id: 'site', label: '站点设置', icon: Globe, title: '站点设置' },
  { id: 'home', label: '首页与关于', icon: House, title: '首页与关于' },
  { id: 'gallery', label: '图库外观', icon: ImageIcon, title: '图库外观' },
  { id: 'storage', label: '存储与数据', icon: HardDrive, title: '存储与数据' },
]

const inputCls
  = 'h-9 w-full rounded-lg border border-[#e3e5e8] bg-white px-3 text-sm text-[#1f2329] outline-none transition-colors placeholder:text-[#a9adb5] focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20'

const panelCls = 'rounded-xl border border-[#e8eaed] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

const AdminPage = () => {
  const bumpManifestVersion = useSetAtom(photoManifestVersionAtom)
  const [data, setData] = useState<AdminData>(() => getAdminData())
  const [section, setSection] = useState<SectionId>('overview')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [attachmentFilter, setAttachmentFilter] = useState<AttachmentFilter>({ kind: 'all' })

  const can = (permission: Permission) => hasPermission(authUser, permission)
  const canEditPhotos = can('attachments.edit') || can('attachments.editOwn')
  const canSave = canEditPhotos
    || can('attachments.assign')
    || can('albums.manage')
    || can('categories.manage')
    || can('members.manage')
    || can('roles.manage')
    || can('settings.site')
    || can('settings.gallery')
    || can('settings.storage')
  const editable = canSave
  const visibleSections = SECTIONS.filter((item) => {
    switch (item.id) {
      case 'overview': {
        return true
      }
      case 'bookings': {
        return can('members.manage')
      }
      case 'attachments': {
        return can('attachments.view') || can('attachments.viewOwn')
      }
      case 'trash': {
        return can('attachments.delete') || can('attachments.deleteOwn')
      }
      case 'albums': {
        return can('albums.view') || can('albums.manage')
      }
      case 'categories': {
        return can('categories.view') || can('categories.manage')
      }
      case 'team': {
        return can('members.view') || can('members.manage')
      }
      case 'roles': {
        return can('roles.view') || can('roles.manage')
      }
      case 'site': {
        return can('settings.site')
      }
      case 'home': {
        return can('settings.site')
      }
      case 'gallery': {
        return can('settings.gallery')
      }
      case 'storage': {
        return can('settings.storage')
      }
      default: {
        return false
      }
    }
  })
  const current = visibleSections.find(item => item.id === section) ?? visibleSections[0]

  useEffect(() => {
    let cancelled = false
    fetchMe().then((user) => {
      if (cancelled) {
        return
      }
      if (!user) {
        window.location.replace('/console/login')
        return
      }
      setAuthUser(user)
      setAuthChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (authChecked && !visibleSections.some(item => item.id === section)) {
      setSection(visibleSections[0]?.id ?? 'overview')
    }
  }, [authChecked, section, visibleSections])

  const openAttachments = (filter: AttachmentFilter) => {
    setAttachmentFilter(filter)
    setSection('attachments')
  }

  const commit = (next: AdminData) => {
    setAdminData(next)
    setData(next)
    setSavedAt(null)
  }

  const handleSave = async () => {
    if (!editable) {
      setSaveError('当前角色为只读，不能保存修改')
      return
    }
    setSaving(true)
    setSaveError(null)
    const result = await saveAdminData({ ...data, updatedAt: new Date().toISOString() })
    setSaving(false)
    if (result.ok) {
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
    }
    else {
      setSaveError(result.offline ? '仅保存到本机浏览器（Vite 接口不可用）' : result.error ?? '保存失败')
    }
  }

  const refreshContent = async () => {
    const [dataResponse, manifestResponse] = await Promise.all([
      fetch('/api/admin/data', { credentials: 'same-origin' }),
      fetch('/api/admin/manifest', { credentials: 'same-origin' }),
    ])
    if (dataResponse.ok) {
      const next = await dataResponse.json() as AdminData
      setAdminData(next)
      setData(next)
    }
    if (manifestResponse.ok) {
      const payload = await manifestResponse.json() as { manifest?: Parameters<typeof photoLoader.replaceManifest>[0] }
      if (payload.manifest) {
        photoLoader.replaceManifest(payload.manifest)
        bumpManifestVersion(version => version + 1)
      }
    }
  }

  const handleLogout = async () => {
    await logout()
    window.location.replace('/console/login')
  }

  if (!authChecked || !authUser) {
    return (
      <div className="fixed inset-0 z-300 flex items-center justify-center bg-[#f5f6f8] text-sm text-[#8a9099]">
        <Loader2 className="mr-2 size-4 animate-spin" />
        正在验证登录状态…
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-300 flex bg-[#f5f6f8] text-[#1f2329]">
      <aside className="flex w-[224px] shrink-0 flex-col border-r border-[#e8eaed] bg-white">
        <div className="flex h-16 items-center gap-2.5 border-b border-[#f0f1f3] px-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#1f2329] text-white">
            <i className="i-mingcute-camera-2-line" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.site.name}</p>
            <p className="truncate text-[11px] text-[#8a9099]">{MODE_LABELS[data.mode]}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {visibleSections.map((item) => {
            const Icon = item.icon
            const active = item.id === section
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={
                  active
                    ? 'flex w-full items-center gap-2.5 rounded-lg bg-[#1f2329] px-3 py-2 text-left text-sm font-medium text-white'
                    : 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#4b5563] transition-colors hover:bg-[#f3f4f6] hover:text-[#1f2329]'
                }
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-[#f0f1f3] p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#f8f9fb] px-3 py-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#1f2329] text-[10px] font-medium text-white">
              {authUser.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{authUser.name}</p>
              <p className="truncate text-[10px] text-[#8a9099]">{authUser.roleName ?? roleNameOf(data, authUser.role)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="退出登录"
              aria-label="退出登录"
              className="flex size-6 items-center justify-center rounded text-[#8a9099] hover:bg-white hover:text-[#1f2329]"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
          <a
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#4b5563] transition-colors hover:bg-[#f3f4f6]"
          >
            <ArrowLeft className="size-4" />
            返回前台
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e8eaed] bg-white px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#8a9099]">后台</span>
            <ChevronRight className="size-3.5 text-[#c3c7cd]" />
            <span className="font-medium">{current.title}</span>
          </div>
          <div className="flex items-center gap-3">
            {saveError && <span className="text-xs text-[#d97706]">{saveError}</span>}
            {savedAt && (
              <span className="flex items-center gap-1 text-xs text-[#16a34a]">
                <Check className="size-3.5" />
                已保存 {savedAt}
              </span>
            )}
            <a
              href="/"
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-[#e3e5e8] px-3 text-sm text-[#4b5563] transition-colors hover:bg-[#f9fafb] sm:flex"
            >
              <Globe className="size-4" />
              查看站点
            </a>
            {editable
              ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f2329] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="size-4" />
                    {saving ? '保存中…' : '保存更改'}
                  </button>
                )
              : (
                  <span className="rounded-lg bg-[#f1f3f5] px-3 py-1.5 text-xs text-[#6b7280]">只读账号</span>
                )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-5xl">
            {section === 'overview' && (
              <OverviewPanel
                data={data}
                currentUser={authUser}
                can={can}
                onOpen={setSection}
                onOpenAttachments={openAttachments}
              />
            )}
            {section === 'bookings' && <BookingsPanel currentUser={authUser} />}
            {section === 'attachments' && (
              <AttachmentsPanel
                data={data}
                commit={commit}
                filter={attachmentFilter}
                onFilterChange={setAttachmentFilter}
                onRefresh={refreshContent}
                currentUser={authUser}
              />
            )}
            {section === 'trash' && (
              <TrashPanel currentUser={authUser} onRefresh={refreshContent} />
            )}
            {section === 'albums' && <AlbumsPanel data={data} commit={commit} onOpenAttachments={openAttachments} />}
            {section === 'categories' && <CategoriesPanel data={data} commit={commit} onOpenAttachments={openAttachments} />}
            {section === 'team' && <TeamPanel data={data} commit={commit} onOpenAttachments={openAttachments} />}
            {section === 'roles' && <RolesPanel data={data} commit={commit} canManage={can('roles.manage')} />}
            {section === 'site' && <SitePanel data={data} commit={commit} />}
            {section === 'home' && <HomepagePanel data={data} commit={commit} />}
            {section === 'gallery' && <GalleryPanel data={data} commit={commit} />}
            {section === 'storage' && <StoragePanel data={data} commit={commit} currentUser={authUser} onRefresh={refreshContent} />}
          </div>
        </main>
      </div>
    </div>
  )
}

const OverviewPanel = ({
  data,
  currentUser,
  can,
  onOpen,
  onOpenAttachments,
}: {
  data: AdminData
  currentUser: AuthUser | null
  can: (permission: Permission) => boolean
  onOpen: (section: SectionId) => void
  onOpenAttachments: (filter: AttachmentFilter) => void
}) => {
  const canViewAll = can('attachments.view')
  const visiblePhotos = photoLoader.getPhotos().filter(photo =>
    canViewAll || data.photoMeta[photo.id]?.uploaderId === currentUser?.id,
  )
  const uncategorized = visiblePhotos.filter(photo => !data.photoMeta[photo.id]?.categoryIds?.length).length
  const unassignedAlbum = visiblePhotos.filter(photo => !data.photoMeta[photo.id]?.albumIds?.length).length
  const stats = [
    { label: canViewAll ? '照片' : '我的照片', value: visiblePhotos.length, icon: ImageIcon },
    ...(can('albums.view') || can('albums.manage') ? [{ label: '摄影集', value: data.albums.length, icon: FolderOpen }] : []),
    ...(can('categories.view') || can('categories.manage') ? [{ label: '分类', value: data.categories.length, icon: Tags }] : []),
    ...(can('members.view') || can('members.manage') ? [{ label: '成员', value: data.members.length, icon: Users }] : []),
  ]
  const canSeeAlbums = can('albums.view') || can('albums.manage')
  const quickActions: { id: SectionId, label: string }[] = []
  if (can('attachments.view') || can('attachments.viewOwn')) {
    quickActions.push({ id: 'attachments', label: '整理附件库' })
  }
  if (can('albums.manage')) {
    quickActions.push({ id: 'albums', label: '新建摄影集' })
  }
  if (can('categories.manage')) {
    quickActions.push({ id: 'categories', label: '整理分类' })
  }
  if (can('members.manage')) {
    quickActions.push({ id: 'team', label: '邀请成员' })
  }

  return (
    <div className="space-y-5">
      <div className={`${panelCls} flex flex-wrap items-center justify-between gap-4 p-5`}>
        <div>
          <p className="text-lg font-semibold">欢迎回来，{currentUser?.name ?? (data.site.authorName || '管理员')}</p>
          <p className="mt-1 text-sm text-[#6b7280]">
            照片统一在附件库管理。当前有
            {' '}
            <button type="button" onClick={() => onOpenAttachments({ kind: 'uncategorized' })} className="font-medium text-[#2563eb] hover:underline">{uncategorized} 张未分类</button>
            {' '}
            与
            {' '}
            <button type="button" onClick={() => onOpenAttachments({ kind: 'unassigned-album' })} className="font-medium text-[#2563eb] hover:underline">{unassignedAlbum} 张未分摄影集</button>
            。
          </p>
        </div>
        <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-medium text-[#4f46e5]">
          {MODE_LABELS[data.mode]}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className={`${panelCls} p-5`}>
              <div className="flex items-center justify-between text-[#8a9099]">
                <span className="text-xs">{stat.label}</span>
                <Icon className="size-4" />
              </div>
              <p className="mt-3 text-2xl font-semibold">{stat.value}</p>
            </div>
          )
        })}
      </div>

      <div className={`grid gap-4 ${canSeeAlbums ? 'lg:grid-cols-2' : ''}`}>
        {canSeeAlbums && (
          <div className={`${panelCls} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">最近的摄影集</h2>
              {(can('albums.view') || can('albums.manage')) && (
                <button type="button" onClick={() => onOpen('albums')} className="text-xs text-[#4f46e5]">
                  管理
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {data.albums.slice(0, 3).map(album => (
                <div key={album.id} className="flex items-center justify-between rounded-lg bg-[#f8f9fb] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{album.title}</p>
                    <p className="text-[11px] text-[#9aa0a8]">/{album.slug}</p>
                  </div>
                  <span className="text-xs text-[#9aa0a8]">{album.photoIds.length} 张</span>
                </div>
              ))}
              {data.albums.length === 0 && <p className="text-xs text-[#9aa0a8]">还没有摄影集</p>}
            </div>
          </div>
        )}

        <div className={`${panelCls} p-5`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">快捷操作</h2>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quickActions.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => (item.id === 'attachments' ? onOpenAttachments({ kind: 'all' }) : onOpen(item.id))}
                className="flex items-center justify-between rounded-lg border border-[#eceef1] px-3 py-2.5 text-sm text-[#4b5563] transition-colors hover:bg-[#f8f9fb]"
              >
                {item.label}
                <ChevronRight className="size-3.5 text-[#c3c7cd]" />
              </button>
            ))}
            {quickActions.length === 0 && <p className="text-xs text-[#9aa0a8]">当前角色没有可用的快捷操作。</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  done: '已完成',
  cancelled: '已取消',
}

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-[#fff7e8] text-[#a16207]',
  confirmed: 'bg-[#eef6ff] text-[#1d4ed8]',
  done: 'bg-[#eefaf1] text-[#15803d]',
  cancelled: 'bg-[#f4f4f5] text-[#71717a]',
}

const BookingsPanel = ({ currentUser }: { currentUser: AuthUser | null }) => {
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<BookingStatus | 'all'>('all')
  const [copied, setCopied] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const list = await fetchBookings()
      setBookings(list)
    }
    catch {
      setBookings([])
    }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visible = filter === 'all' ? bookings : bookings.filter(item => item.status === filter)
  const counts = {
    all: bookings.length,
    pending: bookings.filter(item => item.status === 'pending').length,
    confirmed: bookings.filter(item => item.status === 'confirmed').length,
    done: bookings.filter(item => item.status === 'done').length,
    cancelled: bookings.filter(item => item.status === 'cancelled').length,
  }

  const copy = async (value: string) => {
    if (!value) {
      return
    }
    await navigator.clipboard.writeText(value)
    setCopied(value)
    window.setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div className="space-y-5">
      <Panel
        title="预约管理"
        description="查看约拍表单、确认档期与跟进状态。表单提交会直接写入 SQLite。"
        action={(
          <button type="button" onClick={() => void load()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e3e5e8] bg-white px-3 text-xs text-[#4b5563]">
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            刷新
          </button>
        )}
      >
        <div className="flex flex-wrap gap-2 border-b border-[#f0f1f3] px-5 py-3">
          {(['all', 'pending', 'confirmed', 'done', 'cancelled'] as const).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                filter === key ? 'bg-[#1f2329] text-white' : 'bg-[#f4f5f7] text-[#6b7280] hover:bg-[#eceef2]'
              }`}
            >
              {key === 'all' ? '全部' : BOOKING_STATUS_LABELS[key]}
              <span className="ml-1.5 opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-[#f0f1f3]">
          {loading && <p className="px-5 py-10 text-center text-sm text-[#8a9099]">加载中…</p>}
          {!loading && visible.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-[#8a9099]">还没有预约。前台 `/booking` 提交后会出现在这里。</p>
          )}
          {visible.map(booking => (
            <article key={booking.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{booking.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${BOOKING_STATUS_STYLES[booking.status]}`}>
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${booking.paid ? 'bg-[#fdf2f8] text-[#be185d]' : 'bg-[#f4f4f5] text-[#71717a]'}`}>
                      {booking.paid ? '付费约拍' : '免费约拍'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#8a9099]">
                    {booking.date} {booking.time}
                    <span className="mx-1.5">·</span>
                    提交于 {new Date(booking.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={booking.status}
                    onChange={async (event) => {
                      const status = event.target.value as BookingStatus
                      const result = await setBookingStatus(booking.id, status)
                      if (result.ok) {
                        setBookings(items => items.map(item => item.id === booking.id ? { ...item, status } : item))
                      }
                    }}
                    className="h-8 rounded-lg border border-[#e3e5e8] bg-white px-2 text-xs outline-none"
                  >
                    {(Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[]).map(key => (
                      <option key={key} value={key}>{BOOKING_STATUS_LABELS[key]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('删除这条预约记录？')) {
                        return
                      }
                      const result = await removeBooking(booking.id)
                      if (result.ok) {
                        setBookings(items => items.filter(item => item.id !== booking.id))
                      }
                    }}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-[#f0d5d5] text-[#c24141] hover:bg-[#fdf3f3]"
                    aria-label="删除预约"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#4b5563]">{booking.content}</p>
              {booking.note && <p className="mt-1 text-xs text-[#8a9099]">备注：{booking.note}</p>}

              <div className="mt-3 flex flex-wrap gap-2">
                {booking.qq && (
                  <button type="button" onClick={() => void copy(booking.qq)} className="rounded-md bg-[#f6f7f9] px-2.5 py-1 text-[11px] text-[#4b5563] hover:bg-[#eef0f3]">
                    QQ {booking.qq}{copied === booking.qq ? ' 已复制' : ''}
                  </button>
                )}
                {booking.wechat && (
                  <button type="button" onClick={() => void copy(booking.wechat)} className="rounded-md bg-[#f6f7f9] px-2.5 py-1 text-[11px] text-[#4b5563] hover:bg-[#eef0f3]">
                    微信 {booking.wechat}{copied === booking.wechat ? ' 已复制' : ''}
                  </button>
                )}
                {booking.email && (
                  <button type="button" onClick={() => void copy(booking.email)} className="rounded-md bg-[#f6f7f9] px-2.5 py-1 text-[11px] text-[#4b5563] hover:bg-[#eef0f3]">
                    邮箱 {booking.email}{copied === booking.email ? ' 已复制' : ''}
                  </button>
                )}
                {booking.phone && (
                  <button type="button" onClick={() => void copy(booking.phone)} className="rounded-md bg-[#f6f7f9] px-2.5 py-1 text-[11px] text-[#4b5563] hover:bg-[#eef0f3]">
                    电话 {booking.phone}{copied === booking.phone ? ' 已复制' : ''}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <p className="px-1 text-[11px] text-[#a9adb5]">
        当前账号：{currentUser?.name ?? '未登录'} · 只有拥有「管理成员」权限的账号可以处理预约。
      </p>
    </div>
  )
}

const SitePanel = ({ data, commit }: { data: AdminData, commit: (data: AdminData) => void }) => {
  const update = (key: keyof AdminData['site'], value: string) =>
    commit({ ...data, site: { ...data.site, [key]: value } })

  return (
    <Panel title="站点设置" description="这些信息会即时应用到前台头部、页脚与分享卡片。">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="站点名称">
          <input className={inputCls} value={data.site.name} onChange={e => update('name', e.target.value)} />
        </Field>
        <Field label="页面标题">
          <input className={inputCls} value={data.site.title} onChange={e => update('title', e.target.value)} />
        </Field>
        <Field label="站点描述" className="sm:col-span-2">
          <textarea
            className={`${inputCls} h-20 resize-none py-2`}
            value={data.site.description}
            onChange={e => update('description', e.target.value)}
          />
        </Field>
        <Field label="站点地址">
          <input className={inputCls} value={data.site.url} onChange={e => update('url', e.target.value)} />
        </Field>
        <Field label="主题色">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={data.site.accentColor}
              onChange={e => update('accentColor', e.target.value)}
              className="size-9 cursor-pointer rounded-lg border border-[#e3e5e8] bg-white p-1"
            />
            <input className={inputCls} value={data.site.accentColor} onChange={e => update('accentColor', e.target.value)} />
          </div>
        </Field>
        <Field label="作者名称">
          <input className={inputCls} value={data.site.authorName} onChange={e => update('authorName', e.target.value)} />
        </Field>
        <Field label="作者头像 URL">
          <input className={inputCls} value={data.site.authorAvatar} onChange={e => update('authorAvatar', e.target.value)} />
        </Field>
        <Field label="GitHub">
          <input className={inputCls} value={data.site.github} onChange={e => update('github', e.target.value)} />
        </Field>
        <Field label="Twitter / X">
          <input className={inputCls} value={data.site.twitter} onChange={e => update('twitter', e.target.value)} />
        </Field>
        <Field label="页脚文案" className="sm:col-span-2">
          <input className={inputCls} value={data.site.footerText} onChange={e => update('footerText', e.target.value)} />
        </Field>
        <Field label="ICP 备案号" hint="留空则不显示">
          <input className={inputCls} placeholder="如 京ICP备2026000000号" value={data.site.icp} onChange={e => update('icp', e.target.value)} />
        </Field>
        <Field label="公安备案号" hint="留空则不显示">
          <input className={inputCls} placeholder="如 京公网安备 11010502000000号" value={data.site.police} onChange={e => update('police', e.target.value)} />
        </Field>
      </div>
    </Panel>
  )
}

const HomepagePanel = ({ data, commit }: { data: AdminData, commit: (data: AdminData) => void }) => {
  const photos = photoLoader.getPhotos()
  const selected = new Set(data.home.photoIds)
  const updateHome = <K extends keyof AdminData['home']>(key: K, value: AdminData['home'][K]) =>
    commit({ ...data, home: { ...data.home, [key]: value } })
  const updateAbout = <K extends keyof AdminData['about']>(key: K, value: AdminData['about'][K]) =>
    commit({ ...data, about: { ...data.about, [key]: value } })

  const togglePhoto = (photoId: string) => {
    const photoIds = selected.has(photoId)
      ? data.home.photoIds.filter(id => id !== photoId)
      : [...data.home.photoIds, photoId]
    updateHome('photoIds', photoIds)
  }

  const updateEquipment = (id: string, key: keyof EquipmentItem, value: string) => {
    updateAbout('equipment', data.about.equipment.map(item => item.id === id ? { ...item, [key]: value } : item))
  }

  const addEquipment = () => {
    updateAbout('equipment', [
      ...data.about.equipment,
      { id: makeId('eq'), imageUrl: '', assetId: '', name: '新器材', category: '其他', brand: '', model: '' },
    ])
  }

  const removeEquipment = (id: string) => {
    updateAbout('equipment', data.about.equipment.filter(item => item.id !== id))
  }

  return (
    <div className="space-y-5">
      <Panel title="首页主视觉" description="设置首页大图的挑选方式、展示数量与自动轮播节奏。">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="展示方式">
            <select className={inputCls} value={data.home.mode} onChange={event => updateHome('mode', event.target.value as AdminData['home']['mode'])}>
              <option value="random">随机挑选</option>
              <option value="manual">手动选择</option>
            </select>
          </Field>
          <Field label="展示数量" hint="最多与照片总数一致">
            <input
              className={inputCls}
              type="number"
              min={1}
              max={photos.length || 1}
              value={data.home.count}
              onChange={event => updateHome('count', Math.max(1, Number(event.target.value) || 1))}
            />
          </Field>
          <Field label="轮播间隔（秒）">
            <input
              className={inputCls}
              type="number"
              min={2}
              max={60}
              value={data.home.interval}
              onChange={event => updateHome('interval', Math.max(2, Number(event.target.value) || 5))}
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="主标题">
            <input className={inputCls} value={data.home.title} onChange={event => updateHome('title', event.target.value)} />
          </Field>
          <Field label="副标题">
            <input className={inputCls} value={data.home.subtitle} onChange={event => updateHome('subtitle', event.target.value)} />
          </Field>
        </div>

        {data.home.mode === 'manual' && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[#4b5563]">手动选择照片</span>
              <span className="text-[11px] text-[#a9adb5]">已选 {data.home.photoIds.length} 张</span>
            </div>
            <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-[#eef0f2] p-2 sm:grid-cols-6">
              {photos.map(photo => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => togglePhoto(photo.id)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    selected.has(photo.id) ? 'border-[#1f2329]' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                  title={photo.title}
                >
                  <img src={photo.thumbnailUrl} alt="" className="size-full object-cover" />
                  {selected.has(photo.id) && (
                    <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-[#1f2329] text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="关于页面" description="内容会展示在 /about，包括联系方式、年龄与常用设备。">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="头像 URL">
            <input className={inputCls} value={data.about.avatarUrl} onChange={event => updateAbout('avatarUrl', event.target.value)} placeholder="/logo.jpg" />
          </Field>
          <Field label="主图照片" hint="关于页顶部的大图">
            <select className={inputCls} value={data.about.heroPhotoId} onChange={event => updateAbout('heroPhotoId', event.target.value)}>
              <option value="">使用第一张照片</option>
              {photos.map(photo => (
                <option key={photo.id} value={photo.id}>{photo.title || photo.id}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="年龄">
            <input className={inputCls} value={data.about.age} onChange={event => updateAbout('age', event.target.value)} />
          </Field>
          <Field label="所在地">
            <input className={inputCls} value={data.about.location} onChange={event => updateAbout('location', event.target.value)} />
          </Field>
          <Field label="邮箱">
            <input className={inputCls} value={data.about.email} onChange={event => updateAbout('email', event.target.value)} />
          </Field>
          <Field label="微信">
            <input className={inputCls} value={data.about.wechat} onChange={event => updateAbout('wechat', event.target.value)} />
          </Field>
          <Field label="电话">
            <input className={inputCls} value={data.about.phone} onChange={event => updateAbout('phone', event.target.value)} />
          </Field>
        </div>

        <div className="mt-4 grid gap-4">
          <Field label="个人简介">
            <textarea
              className="min-h-20 w-full rounded-lg border border-[#e3e5e8] bg-white px-3 py-2 text-sm text-[#1f2329] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20"
              value={data.about.bio}
              onChange={event => updateAbout('bio', event.target.value)}
            />
          </Field>
          <Field label="常用设备（文字）" hint="没有图片时作为文字兜底；设备清单在下方维护">
            <textarea
              className="min-h-28 w-full rounded-lg border border-[#e3e5e8] bg-white px-3 py-2 text-sm text-[#1f2329] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20"
              value={data.about.devices}
              onChange={event => updateAbout('devices', event.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[#4b5563]">设备清单</span>
            <button type="button" onClick={addEquipment} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e3e5e8] bg-white px-3 text-xs text-[#4b5563]">
              <Plus className="size-3.5" />
              添加设备
            </button>
          </div>
          <div className="space-y-3">
            {data.about.equipment.map(item => (
              <div key={item.id} className="rounded-xl border border-[#eef0f2] p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="图片 URL">
                    <input className={inputCls} value={item.imageUrl} onChange={event => updateEquipment(item.id, 'imageUrl', event.target.value)} placeholder="https://… 或 /photos/…" />
                  </Field>
                  <Field label="资产编号">
                    <input className={inputCls} value={item.assetId} onChange={event => updateEquipment(item.id, 'assetId', event.target.value)} />
                  </Field>
                  <Field label="器材名称">
                    <input className={inputCls} value={item.name} onChange={event => updateEquipment(item.id, 'name', event.target.value)} />
                  </Field>
                  <Field label="分类">
                    <input className={inputCls} value={item.category} onChange={event => updateEquipment(item.id, 'category', event.target.value)} />
                  </Field>
                  <Field label="品牌">
                    <input className={inputCls} value={item.brand} onChange={event => updateEquipment(item.id, 'brand', event.target.value)} />
                  </Field>
                  <Field label="型号">
                    <input className={inputCls} value={item.model} onChange={event => updateEquipment(item.id, 'model', event.target.value)} />
                  </Field>
                </div>
                <div className="mt-2 flex justify-end">
                  <button type="button" onClick={() => removeEquipment(item.id)} className="inline-flex items-center gap-1 text-xs text-[#c24141]">
                    <Trash2 className="size-3" />
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  )
}

const GalleryPanel = ({ data, commit }: { data: AdminData, commit: (data: AdminData) => void }) => {
  const update = <K extends keyof AdminData['gallery']>(key: K, value: AdminData['gallery'][K]) =>
    commit({ ...data, gallery: { ...data.gallery, [key]: value } })

  const toggles: Array<{ key: keyof AdminData['gallery'], label: string, hint: string }> = [
    { key: 'showExif', label: '显示 EXIF', hint: '在照片卡片上展示相机参数' },
    { key: 'showMap', label: '显示地图', hint: '在顶部工具栏展示地图入口' },
    { key: 'showUploader', label: '显示上传者', hint: '在照片卡片上标注上传成员' },
    { key: 'showAlbumsEntry', label: '摄影集入口', hint: '首页顶部显示摄影集导航' },
    { key: 'showCategoriesEntry', label: '分类入口', hint: '首页顶部显示分类导航' },
  ]

  return (
    <Panel title="图库外观" description="控制首页默认布局与照片详情中的功能开关。">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="默认视图">
          <select
            className={inputCls}
            value={data.gallery.defaultViewMode}
            onChange={e => update('defaultViewMode', e.target.value as 'masonry' | 'list')}
          >
            <option value="masonry">瀑布流</option>
            <option value="list">列表</option>
          </select>
        </Field>
        <Field label="默认列数">
          <select
            className={inputCls}
            value={String(data.gallery.defaultColumns)}
            onChange={e => update('defaultColumns', e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
          >
            <option value="auto">自动</option>
            {[2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value} 列</option>)}
          </select>
        </Field>
        <Field label="默认排序">
          <select
            className={inputCls}
            value={data.gallery.defaultSortOrder}
            onChange={e => update('defaultSortOrder', e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">最新优先</option>
            <option value="asc">最早优先</option>
          </select>
        </Field>
      </div>

      <div className="mt-4 divide-y divide-[#f0f1f3] rounded-lg border border-[#eceef1]">
        {toggles.map((item) => {
          const value = data.gallery[item.key] as boolean
          return (
            <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
              <span>
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[#9aa0a8]">{item.hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={value}
                onClick={() => update(item.key, !value as never)}
                className={value ? 'relative h-6 w-11 rounded-full bg-[#1f2329]' : 'relative h-6 w-11 rounded-full bg-[#e3e5e8]'}
              >
                <span
                  className={
                    value
                      ? 'absolute top-0.5 right-0.5 size-5 rounded-full bg-white shadow transition-all'
                      : 'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-all'
                  }
                />
              </button>
            </label>
          )
        })}
      </div>
    </Panel>
  )
}

const AlbumsPanel = ({
  data,
  commit,
  onOpenAttachments,
}: {
  data: AdminData
  commit: (data: AdminData) => void
  onOpenAttachments: (filter: AttachmentFilter) => void
}) => {
  const photos = photoLoader.getPhotos()
  const [editingId, setEditingId] = useState<string | null>(data.albums[0]?.id ?? null)
  const album = data.albums.find(item => item.id === editingId)

  const updateAlbum = (patch: Partial<AdminData['albums'][number]>) => {
    if (!album) {
      return
    }
    commit({
      ...data,
      albums: data.albums.map(item => (item.id === album.id ? { ...item, ...patch } : item)),
    })
  }

  const addAlbum = () => {
    const id = makeId('alb')
    commit({
      ...data,
      albums: [
        ...data.albums,
        {
          id,
          title: '未命名摄影集',
          slug: `album-${data.albums.length + 1}`,
          description: '',
          photoIds: [],
          visibility: 'public',
          createdAt: new Date().toISOString(),
        },
      ],
    })
    setEditingId(id)
  }

  const removeAlbum = () => {
    if (!album) {
      return
    }
    commit({ ...data, albums: data.albums.filter(item => item.id !== album.id) })
    setEditingId(null)
  }

  return (
    <Panel
      title="摄影集管理"
      description="摄影集是首页「摄影集」入口展示的成组照片，支持公开或私密。"
      action={(
        <button
          type="button"
          onClick={addAlbum}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f2329] px-3 text-sm font-medium text-white"
        >
          <Plus className="size-4" />
          新建摄影集
        </button>
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${inputCls} max-w-xs`}
          value={editingId ?? ''}
          onChange={e => setEditingId(e.target.value || null)}
        >
          <option value="">选择摄影集…</option>
          {data.albums.map(item => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
        {album && (
          <button
            type="button"
            onClick={removeAlbum}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#f0c9c9] px-3 text-sm text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
          >
            <Trash2 className="size-4" />
            删除
          </button>
        )}
      </div>

      {!album && (
        <div className="mt-6 rounded-lg border border-dashed border-[#e3e5e8] px-4 py-10 text-center text-sm text-[#9aa0a8]">
          选择或新建一个摄影集开始编辑
        </div>
      )}

      {album && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="名称">
              <input className={inputCls} value={album.title} onChange={e => updateAlbum({ title: e.target.value })} />
            </Field>
            <Field label="访问路径" hint={`/albums/${album.slug}`}>
              <div className="flex gap-2">
                <input className={inputCls} value={album.slug} onChange={e => updateAlbum({ slug: e.target.value })} />
                <button
                  type="button"
                  onClick={() => updateAlbum({ slug: slugify(album.title) })}
                  className="h-9 shrink-0 rounded-lg border border-[#e3e5e8] px-3 text-xs text-[#4b5563]"
                >
                  自动
                </button>
              </div>
            </Field>
            <Field label="简介" className="sm:col-span-2">
              <textarea
                className={`${inputCls} h-20 resize-none py-2`}
                value={album.description}
                onChange={e => updateAlbum({ description: e.target.value })}
              />
            </Field>
            <Field label="可见性">
              <select
                className={inputCls}
                value={album.visibility}
                onChange={e => updateAlbum({ visibility: e.target.value as 'public' | 'private' })}
              >
                <option value="public">公开</option>
                <option value="private">私密</option>
              </select>
            </Field>
            <Field label="封面照片">
              <select
                className={inputCls}
                value={album.coverPhotoId ?? ''}
                onChange={e => updateAlbum({ coverPhotoId: e.target.value || undefined })}
              >
                <option value="">使用第一张</option>
                {album.photoIds.map((photoId) => {
                  const photo = photos.find(item => item.id === photoId)
                  return (
                    <option key={photoId} value={photoId}>
                      {photoId}
                      {photo ? ` · ${photo.width}×${photo.height}` : ''}
                    </option>
                  )
                })}
              </select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#eceef1] bg-[#f8f9fb] px-4 py-3">
            <div>
              <p className="text-sm font-medium">摄影集内照片</p>
              <p className="mt-0.5 text-xs text-[#8a9099]">
                已归入 {album.photoIds.length} 张。照片现在统一在附件库中勾选并批量归类。
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAttachments({ kind: 'all' })}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#d9dce1] bg-white px-3 text-sm text-[#1f2329] transition-colors hover:bg-[#f2f4f7]"
            >
              <ImagePlus className="size-4" />
              去附件库添加照片
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}

const CategoriesPanel = ({
  data,
  commit,
  onOpenAttachments,
}: {
  data: AdminData
  commit: (data: AdminData) => void
  onOpenAttachments: (filter: AttachmentFilter) => void
}) => {
  const photoCountByCategory = new Map<string, number>()
  for (const meta of Object.values(data.photoMeta)) {
    for (const categoryId of meta.categoryIds ?? []) {
      photoCountByCategory.set(categoryId, (photoCountByCategory.get(categoryId) ?? 0) + 1)
    }
  }
  const uncategorizedCount = Object.values(data.photoMeta).filter(meta => !meta.categoryIds?.length).length

  const updateCategory = (id: string, patch: Partial<AdminData['categories'][number]>) => {
    commit({
      ...data,
      categories: data.categories.map(item => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const addCategory = () => {
    commit({
      ...data,
      categories: [
        ...data.categories,
        {
          id: makeId('cat'),
          name: '新分类',
          slug: `category-${data.categories.length + 1}`,
          description: '',
          color: '#64748b',
          icon: 'i-mingcute-folder-line',
        },
      ],
    })
  }

  const removeCategory = (id: string) => {
    commit({
      ...data,
      categories: data.categories.filter(item => item.id !== id),
      photoMeta: Object.fromEntries(
        Object.entries(data.photoMeta).map(([photoId, meta]) => [
          photoId,
          { ...meta, categoryIds: meta.categoryIds?.filter(categoryId => categoryId !== id) },
        ]),
      ),
    })
  }

  return (
    <Panel
      title="分类管理"
      description="分类用于首页「分类」入口与照片归档，可自定义名称、颜色与图标。"
      action={(
        <button
          type="button"
          onClick={addCategory}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f2329] px-3 text-sm font-medium text-white"
        >
          <Plus className="size-4" />
          新建分类
        </button>
      )}
    >
      <div className="space-y-3">
        {data.categories.map(category => (
          <div key={category.id} className="rounded-lg border border-[#eceef1] p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input
                className={inputCls}
                value={category.name}
                onChange={e => updateCategory(category.id, { name: e.target.value })}
              />
              <input
                className={inputCls}
                value={category.slug}
                onChange={e => updateCategory(category.id, { slug: e.target.value })}
              />
              <input
                type="color"
                value={category.color}
                onChange={e => updateCategory(category.id, { color: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded-lg border border-[#e3e5e8] bg-white p-1"
              />
              <button
                type="button"
                onClick={() => removeCategory(category.id)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#f0c9c9] text-[#dc2626] hover:bg-[#fef2f2]"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                className={inputCls}
                placeholder="分类描述"
                value={category.description}
                onChange={e => updateCategory(category.id, { description: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="图标类名，如 i-mingcute-camera-line"
                value={category.icon ?? ''}
                onChange={e => updateCategory(category.id, { icon: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-[#f0f1f3] pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">照片归类</h3>
            <p className="mt-1 text-xs text-[#8a9099]">分类下的照片统一在附件库中勾选并批量设置，这里只展示统计与入口。</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAttachments({ kind: 'all' })}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#d9dce1] bg-white px-3 text-sm text-[#1f2329] transition-colors hover:bg-[#f2f4f7]"
          >
            <ImagePlus className="size-4" />
            打开附件库
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => onOpenAttachments({ kind: 'uncategorized' })}
            className="flex items-center justify-between rounded-lg border border-dashed border-[#d9dce1] bg-[#fafbfc] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#f2f4f7]"
          >
            <span>
              <span className="block font-medium">未分类照片</span>
              <span className="mt-0.5 block text-[11px] text-[#8a9099]">还没有归入任何分类</span>
            </span>
            <span className="text-xs text-[#8a9099]">{uncategorizedCount} 张</span>
          </button>
          {data.categories.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => onOpenAttachments({ kind: 'category', value: category.id })}
              className="flex items-center justify-between rounded-lg border border-[#eceef1] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#f8f9fb]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="truncate">{category.name}</span>
              </span>
              <span className="text-xs text-[#8a9099]">{photoCountByCategory.get(category.id) ?? 0} 张</span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  )
}

const TeamPanel = ({
  data,
  commit,
  onOpenAttachments,
}: {
  data: AdminData
  commit: (data: AdminData) => void
  onOpenAttachments: (filter: AttachmentFilter) => void
}) => {
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const handleResetPassword = async (memberId: string, name: string) => {
    const nextPassword = window.prompt(`为「${name}」设置新密码（至少 6 位）`)
    if (!nextPassword) {
      return
    }
    if (nextPassword.length < 6) {
      setPasswordMessage('密码至少 6 位')
      return
    }
    await saveAdminData(data)
    const result = await resetPassword(memberId, nextPassword)
    setPasswordMessage(result.ok ? `已重置「${name}」的密码` : result.error ?? '重置失败')
  }
  const addMember = () => {
    commit({
      ...data,
      members: [
        ...data.members,
        {
          id: makeId('usr'),
          name: '新成员',
          email: '',
          role: 'editor',
          status: 'invited',
          color: '#7c3aed',
          joinedAt: new Date().toISOString(),
        },
      ],
    })
  }

  const updateMember = (id: string, patch: Partial<AdminData['members'][number]>) => {
    commit({ ...data, members: data.members.map(item => (item.id === id ? { ...item, ...patch } : item)) })
  }

  const removeMember = (id: string) => {
    commit({
      ...data,
      members: data.members.filter(item => item.id !== id),
      photoMeta: Object.fromEntries(
        Object.entries(data.photoMeta).map(([photoId, meta]) => [
          photoId,
          meta.uploaderId === id ? { ...meta, uploaderId: undefined } : meta,
        ]),
      ),
    })
  }

  const visibleMembers = data.mode === 'personal' ? data.members.filter(member => member.role === 'owner') : data.members

  return (
    <div className="space-y-5">
      <Panel title="协作模式" description="个人模式只有管理员一个账号；团队模式启用多成员、上传者筛选与协作管理。">
        <div className="grid gap-3 sm:grid-cols-2">
          {(['personal', 'team'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => commit({ ...data, mode })}
              className={
                data.mode === mode
                  ? 'rounded-xl border-2 border-[#1f2329] bg-[#f8f9fb] p-4 text-left'
                  : 'rounded-xl border border-[#e3e5e8] p-4 text-left transition-colors hover:bg-[#fafbfc]'
              }
            >
              <span className="flex items-center justify-between text-sm font-semibold">
                {MODE_LABELS[mode]}
                {data.mode === mode && <Check className="size-4" />}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[#8a9099]">
                {mode === 'personal'
                  ? '仅管理员一人维护与上传，界面更简洁。'
                  : '支持多成员分工上传、筛选与协作。'}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.team.allowInvites}
              onChange={e => commit({ ...data, team: { ...data.team, allowInvites: e.target.checked } })}
            />
            允许邀请新成员
          </label>
          <label className="flex items-center gap-2 text-sm">
            默认角色
            <select
              className={`${inputCls} h-8 w-28`}
              value={data.team.defaultRole}
              onChange={e => commit({ ...data, team: { ...data.team, defaultRole: e.target.value } })}
            >
              {data.roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <Panel
        title="成员"
        description={data.mode === 'personal' ? '个人模式下仅保留所有者账号；切到团队模式后可添加成员。' : '成员可被指定为照片上传者，并出现在首页筛选面板中。'}
        action={(
          <button
            type="button"
            onClick={addMember}
            disabled={data.mode === 'personal'}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f2329] px-3 text-sm font-medium text-white disabled:opacity-40"
          >
            <Plus className="size-4" />
            添加成员
          </button>
        )}
      >
        <div className="space-y-2">
          {visibleMembers.map(member => (
            <div
              key={member.id}
              className="grid items-center gap-2 rounded-lg border border-[#eceef1] p-2.5 sm:grid-cols-[1fr_1fr_104px_104px_auto_auto]"
            >
              <input
                className={inputCls}
                value={member.name}
                onChange={e => updateMember(member.id, { name: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="邮箱（可选）"
                value={member.email}
                onChange={e => updateMember(member.id, { email: e.target.value })}
              />
              <select
                className={inputCls}
                value={member.role}
                onChange={e => updateMember(member.id, { role: e.target.value })}
              >
                {data.roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              <select
                className={inputCls}
                value={member.status}
                onChange={e => updateMember(member.id, { status: e.target.value as 'active' | 'invited' | 'disabled' })}
              >
                <option value="active">正常</option>
                <option value="invited">待加入</option>
                <option value="disabled">停用</option>
              </select>
              <button
                type="button"
                onClick={() => handleResetPassword(member.id, member.name)}
                className="flex h-9 items-center justify-center rounded-lg border border-[#e3e5e8] px-2 text-xs text-[#4b5563] hover:bg-[#f8f9fb]"
                title="重置登录密码（含本人）"
              >
                密码
              </button>
              <button
                type="button"
                disabled={member.role === 'owner'}
                onClick={() => removeMember(member.id)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#f0c9c9] text-[#dc2626] disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </Panel>

      {passwordMessage && (
        <p className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-xs text-[#1d4ed8]">{passwordMessage}</p>
      )}

      <Panel title="照片归属" description="上传者、分类与摄影集统一在附件库中按单张或批量设置。">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#eceef1] bg-[#f8f9fb] px-4 py-3">
          <div>
            <p className="text-sm font-medium">照片上传者</p>
            <p className="mt-0.5 text-xs text-[#8a9099]">
              当前 {data.members.filter(member => member.status === 'active').length} 位可用成员，照片归属不再在这里逐张修改。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAttachments({ kind: 'all' })}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#d9dce1] bg-white px-3 text-sm text-[#1f2329] transition-colors hover:bg-[#f2f4f7]"
          >
            <ImagePlus className="size-4" />
            去附件库分配
          </button>
        </div>
      </Panel>
    </div>
  )
}

const RolesPanel = ({
  data,
  commit,
  canManage,
}: {
  data: AdminData
  commit: (data: AdminData) => void
  canManage: boolean
}) => {
  const roles = data.roles ?? []
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? '')
  const selected = roles.find(role => role.id === selectedId) ?? roles[0]
  const memberCount = selected ? data.members.filter(member => member.role === selected.id).length : 0

  const updateRole = (patch: Partial<Role>) => {
    if (!selected || !canManage) {
      return
    }
    commit({
      ...data,
      roles: roles.map(role => (role.id === selected.id ? { ...role, ...patch } : role)),
    })
  }

  const togglePermission = (permission: Permission) => {
    if (!selected || !canManage || selected.id === 'owner') {
      return
    }
    const has = selected.permissions.includes(permission)
    updateRole({
      permissions: has
        ? selected.permissions.filter(item => item !== permission)
        : [...selected.permissions, permission],
    })
  }

  const toggleGroup = (permissions: Permission[], checked: boolean) => {
    if (!selected || !canManage || selected.id === 'owner') {
      return
    }
    const others = selected.permissions.filter(item => !permissions.includes(item))
    updateRole({ permissions: checked ? [...others, ...permissions] : others })
  }

  const addRole = () => {
    if (!canManage) {
      return
    }
    const id = makeId('role')
    const role: Role = {
      id,
      name: '新角色',
      description: '',
      permissions: ['overview.view', 'attachments.view'],
      builtin: false,
    }
    commit({ ...data, roles: [...roles, role] })
    setSelectedId(id)
  }

  const removeRole = () => {
    if (!selected || !canManage || selected.protected || selected.builtin || memberCount > 0) {
      return
    }
    commit({ ...data, roles: roles.filter(role => role.id !== selected.id) })
    setSelectedId('owner')
  }

  return (
    <Panel
      title="角色与权限"
      description="自定义角色可精确控制后台分区、照片编辑范围与设置权限。内置角色不可删除。"
      action={(
        <button
          type="button"
          onClick={addRole}
          disabled={!canManage}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f2329] px-3 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus className="size-4" />
          新建角色
        </button>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="space-y-1.5">
          {roles.map((role) => {
            const count = data.members.filter(member => member.role === role.id).length
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedId(role.id)}
                className={
                  role.id === selected?.id
                    ? 'flex w-full items-center justify-between rounded-lg bg-[#1f2329] px-3 py-2 text-left text-white'
                    : 'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f5f6f8]'
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{role.name}</span>
                  <span className={role.id === selected?.id ? 'block text-[10px] text-white/60' : 'block text-[10px] text-[#9aa0a8]'}>
                    {count}
                    {' '}
                    位成员
                    {role.builtin ? ' · 内置' : ''}
                  </span>
                </span>
                {role.protected && <ShieldCheck className="size-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>

        {!selected && <div className="text-sm text-[#9aa0a8]">暂无角色</div>}

        {selected && (
          <div className="space-y-4 rounded-lg border border-[#eceef1] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="角色名称">
                <input
                  className={inputCls}
                  value={selected.name}
                  disabled={!canManage || selected.id === 'owner'}
                  onChange={e => updateRole({ name: e.target.value })}
                />
              </Field>
              <Field label="角色 ID" hint="创建后不可修改">
                <input className={`${inputCls} bg-[#f8f9fb] text-[#8a9099]`} value={selected.id} readOnly />
              </Field>
              <Field label="描述" className="sm:col-span-2">
                <input
                  className={inputCls}
                  value={selected.description}
                  disabled={!canManage || selected.id === 'owner'}
                  onChange={e => updateRole({ description: e.target.value })}
                />
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">权限</span>
                {selected.id === 'owner' && <span className="text-xs text-[#8a9099]">所有者拥有全部权限</span>}
              </div>
              <div className="space-y-3">
                {PERMISSION_GROUPS.map((group) => {
                  const checkedCount = group.permissions.filter(permission => selected.permissions.includes(permission)).length
                  const allChecked = checkedCount === group.permissions.length
                  return (
                    <div key={group.title} className="rounded-lg border border-[#eceef1] p-3">
                      <label className="flex items-center gap-2 border-b border-[#f0f1f3] pb-2">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          disabled={!canManage || selected.id === 'owner'}
                          onChange={e => toggleGroup(group.permissions, e.target.checked)}
                        />
                        <span className="text-xs font-semibold">{group.title}</span>
                        <span className="ml-auto text-[10px] text-[#9aa0a8]">
                          {checkedCount}
                          /
                          {group.permissions.length}
                        </span>
                      </label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {group.permissions.map(permission => (
                          <label key={permission} className="flex items-start gap-2 text-xs leading-5 text-[#4b5563]">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={selected.permissions.includes(permission)}
                              disabled={!canManage || selected.id === 'owner'}
                              onChange={() => togglePermission(permission)}
                            />
                            <span>{PERMISSION_LABELS[permission]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#f0f1f3] pt-3">
              <p className="text-[11px] text-[#9aa0a8]">
                {memberCount > 0 ? `有 ${memberCount} 位成员使用此角色，需先在成员页更换角色。` : '此角色暂无成员使用。'}
              </p>
              <button
                type="button"
                onClick={removeRole}
                disabled={!canManage || selected.builtin || selected.protected || memberCount > 0}
                className="flex h-8 items-center gap-1 rounded-lg border border-[#f0c9c9] px-3 text-xs text-[#dc2626] disabled:opacity-30"
              >
                <Trash2 className="size-3.5" />
                删除角色
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}


const StoragePanel = ({
  data,
  commit,
  currentUser,
  onRefresh,
}: {
  data: AdminData
  commit: (data: AdminData) => void
  currentUser: AuthUser
  onRefresh: () => Promise<void>
}) => {
  const [dataMessage, setDataMessage] = useState<string | null>(null)
  const [backups, setBackups] = useState<Array<{ name: string, size: number, createdAt: string }>>([])
  const [logs, setLogs] = useState<AdminLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const canBackup = hasPermission(currentUser, 'roles.manage')
  const canExport = hasPermission(currentUser, 'settings.site')

  const loadBackups = async () => {
    if (!canBackup) {
      return
    }
    const response = await fetch('/api/admin/backups', { credentials: 'same-origin' })
    if (response.ok) {
      const payload = await response.json() as { backups?: Array<{ name: string, size: number, createdAt: string }> }
      setBackups(payload.backups ?? [])
    }
  }

  const loadLogs = async () => {
    if (!canBackup) {
      return
    }
    setLogsLoading(true)
    setLogs(await fetchAdminLogs(120))
    setLogsLoading(false)
  }

  useEffect(() => {
    void loadBackups()
    void loadLogs()
  }, [])

  const handleBackup = async () => {
    setDataMessage(null)
    const response = await fetch('/api/admin/backup', { method: 'POST', credentials: 'same-origin' })
    if (!response.ok) {
      setDataMessage('备份失败')
      return
    }
    const payload = await response.json() as { backups?: Array<{ name: string, size: number, createdAt: string }> }
    setBackups(payload.backups ?? [])
    setDataMessage('已创建数据库备份')
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) {
      return
    }
    setDataMessage(null)
    const text = await file.text()
    const response = await fetch('/api/admin/import', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      setDataMessage(payload?.error ?? '导入失败')
      return
    }
    await onRefresh()
    setDataMessage('数据已导入')
  }

  const update = (key: keyof AdminData['storage'], value: string | number) =>
    commit({ ...data, storage: { ...data.storage, [key]: value } })

  return (
    <Panel title="存储与数据" description="照片与配置都保存在本机：本地照片目录 + SQLite 内容库，不依赖云存储。">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="存储提供方">
          <input className={`${inputCls} bg-[#f8f9fb] text-[#8a9099]`} value="本地 local（固定）" disabled />
        </Field>
        <Field label="单文件上限 (MB)">
          <input
            type="number"
            className={inputCls}
            value={data.storage.maxFileSizeMb}
            onChange={e => update('maxFileSizeMb', Number(e.target.value))}
          />
        </Field>
        <Field label="本地目录">
          <input className={inputCls} value={data.storage.basePath} onChange={e => update('basePath', e.target.value)} />
        </Field>
        <Field label="公开路径">
          <input className={inputCls} value={data.storage.baseUrl} onChange={e => update('baseUrl', e.target.value)} />
        </Field>
        <Field label="允许格式" className="sm:col-span-2">
          <input className={inputCls} value={data.storage.allowedFormats} onChange={e => update('allowedFormats', e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 rounded-lg border border-[#e8eaed] bg-[#f8f9fb] p-4 text-xs leading-6 text-[#6b7280]">
        <p className="flex items-center gap-2 font-medium text-[#1f2329]">
          <Database className="size-4" />
          数据存储位置
        </p>
        <p className="mt-2">
          后台配置与账号统一保存在
          {' '}
          <code className="rounded bg-white px-1.5 py-0.5 text-[#1f2329]">content/afilmory.db</code>
          （SQLite 的
          {' '}
          <code className="rounded bg-white px-1.5 py-0.5 text-[#1f2329]">settings/admin-data</code>
          {' '}
          单行），通过 Vite 中间件
          {' '}
          <code className="rounded bg-white px-1.5 py-0.5 text-[#1f2329]">PUT /api/admin/data</code>
          {' '}
          写入；
          {' '}
          <code className="rounded bg-white px-1.5 py-0.5 text-[#1f2329]">content/admin-data.json</code>
          {' '}
          只作为首次导入的种子；照片清单由 builder 生成的
          {' '}
          <code className="rounded bg-white px-1.5 py-0.5 text-[#1f2329]">apps/web/src/data/photos-manifest.json</code>
          。
        </p>
        <p className="mt-2">
          当前共 {photoLoader.getPhotos().length} 张照片，每张照片的上传者、分类与摄影集归属在后台的摄影集页面维护。
        </p>
      </div>

      <div className="mt-5 border-t border-[#f0f1f3] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">数据导入、导出与备份</h3>
            <p className="mt-1 text-xs text-[#8a9099]">导出当前内容 JSON；导入会覆盖内容数据；每次保存也会自动备份数据库。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <a
                href="/api/admin/export"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e3e5e8] px-3 text-sm text-[#4b5563] hover:bg-[#f9fafb]"
              >
                <Download className="size-4" />
                导出数据
              </a>
            )}
            {canBackup && (
              <>
                <button
                  type="button"
                  onClick={() => importRef.current?.click()}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e3e5e8] px-3 text-sm text-[#4b5563] hover:bg-[#f9fafb]"
                >
                  <Upload className="size-4" />
                  导入数据
                </button>
                <button
                  type="button"
                  onClick={handleBackup}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f2329] px-3 text-sm text-white"
                >
                  <Database className="size-4" />
                  立即备份
                </button>
              </>
            )}
          </div>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            void handleImport(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        {dataMessage && <p className="mt-3 text-xs text-[#6b7280]">{dataMessage}</p>}
        {canBackup && backups.length > 0 && (
          <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#eceef1] p-2">
            {backups.slice(0, 8).map(backup => (
              <div key={backup.name} className="flex items-center justify-between gap-3 text-[11px] text-[#8a9099]">
                <span className="truncate">{backup.name}</span>
                <span className="shrink-0">{new Date(backup.createdAt).toLocaleString('zh-CN')}</span>
                <span className="shrink-0">{Math.ceil(backup.size / 1024)} KB</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {canBackup && (
        <div className="mt-5 border-t border-[#f0f1f3] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ScrollText className="size-4" />
                运行日志
              </h3>
              <p className="mt-1 text-xs text-[#8a9099]">记录 API 请求、登录、索引任务与文件操作；内存环形缓冲，重启后清空。</p>
            </div>
            <button
              type="button"
              onClick={() => { void loadLogs() }}
              disabled={logsLoading}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e3e5e8] px-3 text-sm text-[#4b5563] disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${logsLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
          <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-[#eceef1] bg-[#fbfcfd] p-2">
            {logs.length === 0 && <p className="px-2 py-6 text-center text-xs text-[#9aa0a8]">暂无日志</p>}
            {logs.map(line => (
              <div key={line.id} className="flex gap-2 border-b border-[#f3f4f6] px-2 py-1.5 text-[11px] last:border-0">
                <span className="w-28 shrink-0 text-[#9aa0a8]">{new Date(line.at).toLocaleTimeString('zh-CN')}</span>
                <span className={`w-12 shrink-0 font-medium ${line.level === 'error' ? 'text-[#dc2626]' : line.level === 'warn' ? 'text-[#b45309]' : line.level === 'success' ? 'text-[#15803d]' : 'text-[#2563eb]'}`}>
                  {line.level}
                </span>
                <span className="w-12 shrink-0 text-[#8a9099]">{line.scope}</span>
                <span className="min-w-0 break-words text-[#4b5563]">{line.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

const AttachmentsPanel = ({
  data,
  commit,
  filter,
  onFilterChange,
  onRefresh,
  currentUser,
}: {
  data: AdminData
  commit: (data: AdminData) => void
  filter: AttachmentFilter
  onFilterChange: (filter: AttachmentFilter) => void
  onRefresh: () => Promise<void>
  currentUser: AuthUser
}) => {
  const photos = photoLoader.getPhotos()
  const isTeam = data.mode === 'team'
  const can = (permission: Permission) => hasPermission(currentUser, permission)
  const canViewAll = can('attachments.view')
  const canEditAll = can('attachments.edit')
  const canEditOwn = can('attachments.editOwn')
  const canAssign = can('attachments.assign')
  const canUpload = can('attachments.upload')
  const canRebuild = can('attachments.rebuild')
  const canEditPhoto = (photoId: string) =>
    canEditAll || (canEditOwn && data.photoMeta[photoId]?.uploaderId === currentUser.id)
  const sourcePhotos = useMemo(
    () => (canViewAll ? photos : photos.filter(photo => data.photoMeta[photo.id]?.uploaderId === currentUser.id)),
    [canViewAll, currentUser.id, data.photoMeta, photos],
  )
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [bulkAlbum, setBulkAlbum] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkUploader, setBulkUploader] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [folder, setFolder] = useState('*')
  const [uploadFolder, setUploadFolder] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(24)
  const [job, setJob] = useState<RebuildJob | null>(null)
  const [showJobLogs, setShowJobLogs] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const refreshRef = useRef(onRefresh)
  const folderOf = (photo: { s3Key?: string }) => {
    const key = (photo.s3Key ?? '').replaceAll('\\', '/')
    return key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : ''
  }
  const folders = useMemo(
    () => [...new Set(sourcePhotos.map(folderOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [sourcePhotos],
  )

  useEffect(() => {
    refreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    setSelected([])
  }, [filter])

  useEffect(() => {
    setPage(1)
  }, [filter, folder, pageSize, query])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sourcePhotos.filter((photo) => {
      const meta = data.photoMeta[photo.id] ?? {}
      if (q && !photo.id.toLowerCase().includes(q) && !JSON.stringify(photo.exif ?? {}).toLowerCase().includes(q)) {
        return false
      }
      if (folder !== '*' && folderOf(photo) !== folder) {
        return false
      }
      switch (filter.kind) {
        case 'uncategorized': {
          return !meta.categoryIds?.length
        }
        case 'unassigned-album': {
          return !meta.albumIds?.length
        }
        case 'album': {
          return !!filter.value && !!meta.albumIds?.includes(filter.value)
        }
        case 'category': {
          return !!filter.value && !!meta.categoryIds?.includes(filter.value)
        }
        case 'uploader': {
          return !!filter.value && meta.uploaderId === filter.value
        }
        default: {
          return true
        }
      }
    })
  }, [data.photoMeta, filter, folder, sourcePhotos, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pagedPhotos = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(current => Math.min(current, pageCount))
  }, [pageCount])

  const runningJobId = job?.status === 'running' ? job.id : null
  useEffect(() => {
    if (!runningJobId) {
      return
    }
    let cancelled = false
    const tick = async () => {
      const next = await fetchRebuildJob(runningJobId)
      if (cancelled || !next) {
        return
      }
      setJob(next)
      if (next.status !== 'running') {
        setMessage(next.message)
        await refreshRef.current()
      }
    }
    const timer = window.setInterval(() => { void tick() }, 700)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [runningJobId])

  const detail = detailId ? photos.find(photo => photo.id === detailId) : undefined
  const detailEditable = detail ? canEditPhoto(detail.id) : false
  const detailMeta = detailId ? data.photoMeta[detailId] ?? {} : {}
  const memberName = (id?: string) => data.members.find(member => member.id === id)?.name ?? '未指定'
  const albumTitle = (id: string) => data.albums.find(album => album.id === id)?.title ?? id
  const categoryName = (id: string) => data.categories.find(category => category.id === id)?.name ?? id

  const filterLabel
    = filter.kind === 'uncategorized'
      ? '未分类'
      : filter.kind === 'unassigned-album'
        ? '未分摄影集'
        : filter.kind === 'album'
          ? `摄影集 · ${albumTitle(filter.value ?? '')}`
          : filter.kind === 'category'
            ? `分类 · ${categoryName(filter.value ?? '')}`
            : filter.kind === 'uploader'
              ? `上传者 · ${memberName(filter.value)}`
              : (canViewAll ? '全部照片' : '我的照片')
  const canDeleteSelected = can('attachments.delete')
    || (can('attachments.deleteOwn') && selected.every(id => data.photoMeta[id]?.uploaderId === currentUser.id))

  const patchMeta = (ids: string[], patch: (meta: AdminData['photoMeta'][string]) => Partial<AdminData['photoMeta'][string]>) => {
    const next = { ...data.photoMeta }
    for (const id of ids) {
      next[id] = { ...next[id], ...patch(next[id] ?? {}) }
    }
    commit({ ...data, photoMeta: next })
  }

  const toggleSelected = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]))
  }

  const applyAlbum = (albumId: string, mode: 'add' | 'remove') => {
    patchMeta(selected, (meta) => {
      const current = meta.albumIds ?? []
      return { albumIds: mode === 'add' ? [...new Set([...current, albumId])] : current.filter(id => id !== albumId) }
    })
  }

  const applyCategory = (categoryId: string, mode: 'add' | 'remove') => {
    patchMeta(selected, (meta) => {
      const current = meta.categoryIds ?? []
      return { categoryIds: mode === 'add' ? [...new Set([...current, categoryId])] : current.filter(id => id !== categoryId) }
    })
  }

  const applyUploader = (uploaderId: string) => {
    patchMeta(selected, () => ({ uploaderId: uploaderId || undefined }))
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) {
      return
    }
    setBusy(true)
    setMessage(null)
    await saveAdminData(data)
    const result = await uploadPhotos([...files], uploadFolder)
    setBusy(false)
    if (!result.ok) {
      setMessage(result.error ?? '上传失败')
      return
    }
    const target = uploadFolder ? `到「${uploadFolder}」` : '到根目录'
    setMessage(`已上传 ${files.length} 张照片${target}，正在刷新附件库…`)
    await onRefresh()
    setMessage(`已上传 ${files.length} 张照片${target}`)
  }

  const handleDelete = async () => {
    if (!selected.length || !canDeleteSelected) {
      return
    }
    if (!window.confirm(`确定把选中的 ${selected.length} 张照片移入回收站？`)) {
      return
    }
    setBusy(true)
    const result = await deletePhotos(selected)
    setBusy(false)
    if (!result.ok) {
      setMessage(result.error ?? '删除失败')
      return
    }
    setSelected([])
    setMessage('已移入回收站')
    await onRefresh()
  }

  const handleRebuild = async () => {
    setMessage(null)
    const result = await rebuildAttachments()
    if (!result.ok) {
      setMessage(result.error ?? '重建失败')
      return
    }
    if (result.job) {
      setJob(result.job)
      setMessage(result.job.message)
    }
    else {
      await onRefresh()
      setMessage('索引任务已启动')
    }
  }

  const toggleDetailMeta = (kind: 'album' | 'category', id: string) => {
    if (!detailId) {
      return
    }
    const meta = data.photoMeta[detailId] ?? {}
    if (kind === 'album') {
      const current = meta.albumIds ?? []
      patchMeta([detailId], () => ({ albumIds: current.includes(id) ? current.filter(item => item !== id) : [...current, id] }))
    }
    else {
      const current = meta.categoryIds ?? []
      patchMeta([detailId], () => ({ categoryIds: current.includes(id) ? current.filter(item => item !== id) : [...current, id] }))
    }
  }

  return (
    <div className="space-y-5">
      <section className={panelCls}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f1f3] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">附件库</h2>
            <p className="mt-1 text-xs leading-5 text-[#8a9099]">
              所有照片统一在这里查看、筛选和批量归类。摄影集与分类页面只负责组织，不再直接改照片。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRebuild}
              disabled={busy || !canRebuild || runningJobId !== null}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e3e5e8] px-3 text-sm text-[#4b5563] disabled:opacity-40"
            >
              <RefreshCw className={`size-4 ${runningJobId ? 'animate-spin' : ''}`} />
              {runningJobId ? '索引中…' : '重新索引照片'}
            </button>
            {canUpload && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handleUpload(e.target.files)}
                />
                <div className="shrink-0" style={{ width: 176 }}>
                  <input
                    className={`${inputCls} h-9`}
                    placeholder="上传到文件夹（可空）"
                    value={uploadFolder}
                    onChange={e => setUploadFolder(e.target.value.replaceAll('\\', '/'))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f2329] px-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Upload className="size-4" />
                  上传照片
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[#9aa0a8]" />
              <input
                className={`${inputCls} w-56 pl-8`}
                placeholder="搜索文件名 / 相机"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <select
              className={`${inputCls} w-auto`}
              value={
                filter.kind === 'album'
                  ? `album:${filter.value}`
                  : filter.kind === 'category'
                    ? `category:${filter.value}`
                    : filter.kind === 'uploader'
                      ? `uploader:${filter.value}`
                      : filter.kind
              }
              onChange={(e) => {
                const value = e.target.value
                if (value.startsWith('album:')) {
                  onFilterChange({ kind: 'album', value: value.slice(6) })
                }
                else if (value.startsWith('category:')) {
                  onFilterChange({ kind: 'category', value: value.slice(9) })
                }
                else if (value.startsWith('uploader:')) {
                  onFilterChange({ kind: 'uploader', value: value.slice(9) })
                }
                else {
                  onFilterChange({ kind: value as AttachmentFilter['kind'] })
                }
              }}
            >
              <option value="all">{canViewAll ? '全部照片' : '我的照片'}</option>
              <option value="uncategorized">未分类</option>
              <option value="unassigned-album">未分摄影集</option>
              <optgroup label="按摄影集">
                {data.albums.map(album => <option key={album.id} value={`album:${album.id}`}>{album.title}</option>)}
              </optgroup>
              <optgroup label="按分类">
                {data.categories.map(category => <option key={category.id} value={`category:${category.id}`}>{category.name}</option>)}
              </optgroup>
              {isTeam && canViewAll && (
                <optgroup label="按上传者">
                  {data.members.map(member => <option key={member.id} value={`uploader:${member.id}`}>{member.name}</option>)}
                </optgroup>
              )}
            </select>
            <select
              className={`${inputCls} w-auto max-w-48`}
              value={folder}
              onChange={e => setFolder(e.target.value)}
            >
              <option value="*">全部文件夹</option>
              <option value="">根目录</option>
              {folders.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <span className="text-xs text-[#8a9099]">{filterLabel} · {filtered.length} 张</span>
            <span className="ml-auto text-xs text-[#8a9099]">当前账号：{currentUser.name}（{currentUser.roleName ?? roleNameOf(data, currentUser.role)}）</span>
          </div>

          {message && <div className="rounded-lg bg-[#f1f5ff] px-3 py-2 text-xs text-[#3355cc]">{message}</div>}

          {job && (
            <div className="rounded-lg border border-[#e3e5e8] bg-[#fbfcfd] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`size-2 rounded-full ${job.status === 'running' ? 'animate-pulse bg-[#2563eb]' : job.status === 'success' ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
                <span className="text-xs font-medium text-[#1f2329]">
                  {job.status === 'running' ? '正在索引照片' : job.status === 'success' ? '索引完成' : '索引失败'}
                </span>
                <span className="text-xs text-[#8a9099]">{job.progress}%</span>
                <button type="button" onClick={() => setShowJobLogs(value => !value)} className="ml-auto text-xs text-[#4b5563] underline">
                  {showJobLogs ? '收起日志' : '查看日志'}
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8ebef]">
                <div
                  className={`h-full rounded-full transition-[width] ${job.status === 'error' ? 'bg-[#dc2626]' : 'bg-[#1f2329]'}`}
                  style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#6b7280]">{job.message}</p>
              {job.error && job.status === 'error' && <p className="mt-1 text-xs text-[#dc2626]">{job.error}</p>}
              {showJobLogs && (
                <div className="mt-2 max-h-56 overflow-auto rounded-md bg-[#111827] p-2 font-mono text-[11px] leading-5 text-[#d1d5db]">
                  {job.logs.length === 0 && <p className="text-[#9ca3af]">等待索引进程输出…</p>}
                  {job.logs.slice(-80).map((line, index) => (
                    <p key={`${line.at}-${index}`} className={line.level === 'error' ? 'text-[#fca5a5]' : line.level === 'warn' ? 'text-[#fcd34d]' : ''}>
                      {line.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {selected.length > 0 && (canEditAll || canEditOwn || canAssign || canDeleteSelected) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#dbe3f0] bg-[#f7f9ff] p-3">
              <span className="text-xs font-medium text-[#3355cc]">已选 {selected.length} 张</span>
              <button type="button" onClick={() => setSelected(filtered.map(photo => photo.id))} className="text-xs text-[#4b5563] underline">全选当前</button>
              <button type="button" onClick={() => setSelected([])} className="text-xs text-[#4b5563] underline">取消</button>
              {canAssign && (
                <>
                  <span className="mx-1 h-4 w-px bg-[#dbe3f0]" />
                  <select className="h-8 w-36 rounded-lg border border-[#e3e5e8] bg-white px-2 text-xs" value={bulkAlbum} onChange={e => setBulkAlbum(e.target.value)}>
                    <option value="">选择摄影集</option>
                    {data.albums.map(album => <option key={album.id} value={album.id}>{album.title}</option>)}
                  </select>
                  <button type="button" disabled={!bulkAlbum} onClick={() => applyAlbum(bulkAlbum, 'add')} className="rounded-md bg-[#1f2329] px-2.5 py-1.5 text-xs text-white disabled:opacity-40">加入</button>
                  <button type="button" disabled={!bulkAlbum} onClick={() => applyAlbum(bulkAlbum, 'remove')} className="rounded-md border border-[#e3e5e8] px-2.5 py-1.5 text-xs">移出</button>
                  <span className="mx-1 h-4 w-px bg-[#dbe3f0]" />
                  <select className="h-8 w-32 rounded-lg border border-[#e3e5e8] bg-white px-2 text-xs" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                    <option value="">选择分类</option>
                    {data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <button type="button" disabled={!bulkCategory} onClick={() => applyCategory(bulkCategory, 'add')} className="rounded-md bg-[#1f2329] px-2.5 py-1.5 text-xs text-white disabled:opacity-40">归入</button>
                  <button type="button" disabled={!bulkCategory} onClick={() => applyCategory(bulkCategory, 'remove')} className="rounded-md border border-[#e3e5e8] px-2.5 py-1.5 text-xs">移出</button>
                </>
              )}
              {isTeam && canAssign && (
                <>
                  <span className="mx-1 h-4 w-px bg-[#dbe3f0]" />
                  <select className="h-8 w-32 rounded-lg border border-[#e3e5e8] bg-white px-2 text-xs" value={bulkUploader} onChange={e => setBulkUploader(e.target.value)}>
                    <option value="">未指定上传者</option>
                    {data.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                  <button type="button" onClick={() => applyUploader(bulkUploader)} className="rounded-md bg-[#1f2329] px-2.5 py-1.5 text-xs text-white">应用</button>
                </>
              )}
              {canDeleteSelected && (
                <button type="button" onClick={handleDelete} className="ml-auto flex items-center gap-1 rounded-md border border-[#f0c9c9] px-2.5 py-1.5 text-xs text-[#dc2626]">
                  <Trash2 className="size-3.5" />
                  删除
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {pagedPhotos.map((photo) => {
              const meta = data.photoMeta[photo.id] ?? {}
              const active = selected.includes(photo.id)
              return (
                <div key={photo.id} className={`group relative overflow-hidden rounded-lg border ${active ? 'border-[#1f2329] ring-2 ring-[#1f2329]/20' : 'border-[#eceef1]'}`}>
                  <button type="button" onClick={() => setDetailId(photo.id)} className="block w-full">
                    <img src={photo.thumbnailUrl} alt={photo.id} loading="lazy" className="aspect-square w-full bg-[#f3f4f6] object-cover transition-opacity group-hover:opacity-85" />
                  </button>
                  {folderOf(photo) && (
                    <span className="pointer-events-none absolute top-1.5 right-1.5 max-w-[80%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-white">
                      {folderOf(photo)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleSelected(photo.id)}
                    aria-label="选择照片"
                    className={
                      active
                        ? 'absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded border border-[#1f2329] bg-[#1f2329] text-white'
                        : 'absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded border border-white/70 bg-black/30 text-transparent backdrop-blur-sm'
                    }
                  >
                    <Check className="size-3" />
                  </button>
                  <div className="px-1.5 py-1">
                    <p className="truncate text-[10px] text-[#4b5563]">{photo.id}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-[#9aa0a8]">
                      {meta.categoryIds?.length
                        ? meta.categoryIds.map(id => categoryName(id)).join(' · ')
                        : '未分类'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#f0f1f3] pt-3 text-xs text-[#6b7280]">
            <span>第 {page} / {pageCount} 页 · 共 {filtered.length} 张</span>
            <div className="ml-auto flex items-center gap-2">
              <select className="h-8 rounded-lg border border-[#e3e5e8] bg-white px-2" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                <option value={24}>每页 24</option>
                <option value={48}>每页 48</option>
                <option value={96}>每页 96</option>
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(value => Math.max(1, value - 1))}
                className="flex size-8 items-center justify-center rounded-lg border border-[#e3e5e8] bg-white disabled:opacity-35"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage(value => Math.min(pageCount, value + 1))}
                className="flex size-8 items-center justify-center rounded-lg border border-[#e3e5e8] bg-white disabled:opacity-35"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#e3e5e8] px-4 py-12 text-center text-sm text-[#9aa0a8]">
              没有符合条件的照片
            </div>
          )}
        </div>
      </section>

      {detail && (
        <div className="fixed inset-0 z-400 flex items-center justify-center bg-black/45 p-4" onClick={() => setDetailId(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#f0f1f3] px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold">照片设置</h3>
                <p className="mt-0.5 text-xs text-[#8a9099]">{detail.id}</p>
              </div>
              <button type="button" onClick={() => setDetailId(null)} className="rounded p-1 text-[#8a9099] hover:bg-[#f3f4f6]">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[240px_1fr]">
              <div>
                <img src={detail.thumbnailUrl} alt={detail.id} className="w-full rounded-lg bg-[#f3f4f6] object-contain" />
                <div className="mt-3 space-y-1 text-xs text-[#6b7280]">
                  <p>{detail.width} × {detail.height} · {(detail.size / 1024 / 1024).toFixed(1)} MB</p>
                  <p>{detail.format?.toUpperCase()} · {detail.lastModified ? new Date(detail.lastModified).toLocaleDateString('zh-CN') : '—'}</p>
                  <p className="flex items-center gap-1"><FolderOpen className="size-3.5" />{folderOf(detail) || '根目录'}</p>
                  <a href={detail.originalUrl} target="_blank" rel="noreferrer" className="inline-block text-[#2563eb] hover:underline">查看原图</a>
                </div>
              </div>
              <div className="space-y-5">
                {isTeam && (
                  <Field label="上传者">
                    <select
                      className={inputCls}
                      disabled={!detailEditable || !canAssign}
                      value={detailMeta.uploaderId ?? ''}
                      onChange={e => patchMeta([detail.id], () => ({ uploaderId: e.target.value || undefined }))}
                    >
                      <option value="">未指定</option>
                      {data.members.map(member => <option key={member.id} value={member.id}>{member.name}（{roleNameOf(data, member.role)}）</option>)}
                    </select>
                  </Field>
                )}
                <div>
                  <p className="mb-2 text-xs font-medium text-[#4b5563]">摄影集</p>
                  <div className="flex flex-wrap gap-2">
                    {data.albums.map(album => (
                      <button
                        key={album.id}
                        type="button"
                        disabled={!detailEditable}
                        onClick={() => toggleDetailMeta('album', album.id)}
                        className={
                          detailMeta.albumIds?.includes(album.id)
                            ? 'rounded-full bg-[#1f2329] px-3 py-1.5 text-xs text-white'
                            : 'rounded-full border border-[#e3e5e8] px-3 py-1.5 text-xs text-[#4b5563] hover:bg-[#f8f9fb]'
                        }
                      >
                        {album.title}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-[#4b5563]">分类（可多选）</p>
                  <div className="flex flex-wrap gap-2">
                    {data.categories.map(category => (
                      <button
                        key={category.id}
                        type="button"
                        disabled={!detailEditable}
                        onClick={() => toggleDetailMeta('category', category.id)}
                        className={
                          detailMeta.categoryIds?.includes(category.id)
                            ? 'rounded-full bg-[#1f2329] px-3 py-1.5 text-xs text-white'
                            : 'rounded-full border border-[#e3e5e8] px-3 py-1.5 text-xs text-[#4b5563] hover:bg-[#f8f9fb]'
                        }
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-[#9aa0a8]">{detailEditable ? '修改会暂存在当前页面，点击右上角「保存更改」后写入。' : '当前角色没有编辑这张照片的权限。'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TrashItem {
  id: string
  photo?: { title?: string, originalUrl?: string }
  deletedAt: string
  deletedBy: string
  thumbnailUrl: string
  albumIds?: string[]
}

const TrashPanel = ({ currentUser, onRefresh }: { currentUser: AuthUser, onRefresh: () => Promise<void> }) => {
  const [items, setItems] = useState<TrashItem[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const canPurgeAll = hasPermission(currentUser, 'attachments.delete')

  const load = async () => {
    const response = await fetch('/api/admin/trash', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) {
      setMessage('回收站加载失败')
      return
    }
    const payload = await response.json() as { items?: TrashItem[] }
    setItems(payload.items ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  const restore = async (id: string) => {
    setBusy(true)
    setMessage(null)
    const response = await fetch('/api/admin/trash/restore', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setBusy(false)
    if (!response.ok) {
      setMessage('恢复失败')
      return
    }
    await load()
    setItems(previous => previous.filter(item => item.id !== id))
    await onRefresh()
    setMessage('照片已恢复')
  }

  const purge = async (id: string) => {
    if (!window.confirm('永久删除后无法恢复，确定继续？')) {
      return
    }
    setBusy(true)
    setMessage(null)
    const response = await fetch('/api/admin/trash/empty', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setBusy(false)
    if (!response.ok) {
      setMessage('永久删除失败')
      return
    }
    await load()
    setItems(previous => previous.filter(item => item.id !== id))
    setMessage('已永久删除')
  }

  const emptyAll = async () => {
    if (!window.confirm('清空回收站会永久删除其中的照片，确定继续？')) {
      return
    }
    setBusy(true)
    setMessage(null)
    const response = await fetch('/api/admin/trash/empty', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    setBusy(false)
    if (!response.ok) {
      setMessage('清空失败')
      return
    }
    await load()
    setItems([])
    setMessage('回收站已清空')
  }

  return (
    <Panel
      title="回收站"
      description="删除的照片会先进入回收站，原图与缩略图可以恢复，也可以永久删除。"
      action={(
        <button
          type="button"
          onClick={emptyAll}
          disabled={busy || items.length === 0 || !canPurgeAll}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[#f0c9c9] px-3 text-sm text-[#dc2626] disabled:opacity-40"
        >
          <Trash2 className="size-4" />
          清空回收站
        </button>
      )}
    >
      {message && <p className="mb-3 text-xs text-[#6b7280]">{message}</p>}
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#e3e5e8] px-4 py-12 text-center text-sm text-[#9aa0a8]">
          回收站是空的
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map(item => (
          <div key={item.id} className="overflow-hidden rounded-lg border border-[#eceef1] bg-white">
            <div className="relative aspect-square bg-[#f5f6f8]">
              {item.thumbnailUrl && (
                <img src={item.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
              )}
            </div>
            <div className="space-y-1.5 p-2">
              <p className="truncate text-xs font-medium">{item.photo?.title ?? item.id}</p>
              <p className="truncate text-[10px] text-[#9aa0a8]">{new Date(item.deletedAt).toLocaleString('zh-CN')}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => restore(item.id)}
                  className="h-7 flex-1 rounded-md bg-[#1f2329] text-[11px] text-white disabled:opacity-40"
                >
                  恢复
                </button>
                {canPurgeAll && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => purge(item.id)}
                    className="h-7 rounded-md border border-[#f0c9c9] px-2 text-[11px] text-[#dc2626] disabled:opacity-40"
                  >
                    永久删除
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

const Panel = ({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) => (
  <section className={panelCls}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f1f3] px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-[#8a9099]">{description}</p>}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
)

const Field = ({
  label,
  hint,
  className,
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) => (
  <label className={`block ${className ?? ''}`}>
    <span className="mb-1.5 block text-xs font-medium text-[#4b5563]">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-[#a9adb5]">{hint}</span>}
  </label>
)

export const Component = AdminPage
