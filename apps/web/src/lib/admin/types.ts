export type UserMode = 'personal' | 'team'

export type MemberRole = 'owner' | 'admin' | 'editor' | 'contributor' | 'viewer'

export type MemberStatus = 'active' | 'invited' | 'disabled'

export type Permission =
  | 'overview.view'
  | 'attachments.view'
  | 'attachments.viewOwn'
  | 'attachments.upload'
  | 'attachments.edit'
  | 'attachments.editOwn'
  | 'attachments.delete'
  | 'attachments.deleteOwn'
  | 'attachments.assign'
  | 'attachments.rebuild'
  | 'albums.view'
  | 'albums.manage'
  | 'categories.view'
  | 'categories.manage'
  | 'members.view'
  | 'members.manage'
  | 'roles.view'
  | 'roles.manage'
  | 'settings.site'
  | 'settings.gallery'
  | 'settings.storage'

export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  builtin?: boolean
  protected?: boolean
}

export interface Member {
  id: string
  name: string
  email: string
  role: string
  status: MemberStatus
  color: string
  joinedAt: string
}

export interface Album {
  id: string
  title: string
  slug: string
  description: string
  coverPhotoId?: string
  photoIds: string[]
  visibility: 'public' | 'private'
  createdAt: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string
  color: string
  icon?: string
}

export interface PhotoMeta {
  uploaderId?: string
  categoryIds?: string[]
  albumIds?: string[]
  caption?: string
}

export interface SiteSettings {
  name: string
  title: string
  description: string
  url: string
  accentColor: string
  authorName: string
  authorAvatar: string
  authorUrl: string
  github: string
  twitter: string
  footerText: string
  icp: string
  police: string
}

export interface GallerySettings {
  defaultViewMode: 'masonry' | 'list'
  defaultColumns: number | 'auto'
  defaultSortOrder: 'asc' | 'desc'
  showExif: boolean
  showMap: boolean
  showUploader: boolean
  showAlbumsEntry: boolean
  showCategoriesEntry: boolean
  enableLikes: boolean
  enableComments: boolean
  enableDownloads: boolean
}

export interface TeamSettings {
  allowInvites: boolean
  defaultRole: string
  inviteToken: string
}

export interface StorageSettings {
  provider: 'local'
  basePath: string
  baseUrl: string
  maxFileSizeMb: number
  allowedFormats: string
}

export interface HomeSettings {
  mode: 'random' | 'manual'
  count: number
  interval: number
  photoIds: string[]
  title: string
  subtitle: string
}

export interface EquipmentItem {
  id: string
  imageUrl: string
  assetId: string
  name: string
  category: string
  brand: string
  model: string
}

export interface AboutSettings {
  age: string
  location: string
  email: string
  wechat: string
  phone: string
  bio: string
  devices: string
  avatarUrl: string
  heroPhotoId: string
  equipment: EquipmentItem[]
}

export type BookingStatus = 'pending' | 'confirmed' | 'done' | 'cancelled'

export interface BookingRecord {
  id: string
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
  status: BookingStatus
  createdAt: string
  updatedAt: string
}

export interface AdminData {
  version: number
  mode: UserMode
  site: SiteSettings
  gallery: GallerySettings
  home: HomeSettings
  about: AboutSettings
  team: TeamSettings
  storage: StorageSettings
  members: Member[]
  roles: Role[]
  albums: Album[]
  categories: Category[]
  photoMeta: Record<string, PhotoMeta>
  updatedAt: string
}

export const ALL_PERMISSIONS: Permission[] = [
  'overview.view',
  'attachments.view',
  'attachments.viewOwn',
  'attachments.upload',
  'attachments.edit',
  'attachments.editOwn',
  'attachments.delete',
  'attachments.deleteOwn',
  'attachments.assign',
  'attachments.rebuild',
  'albums.view',
  'albums.manage',
  'categories.view',
  'categories.manage',
  'members.view',
  'members.manage',
  'roles.view',
  'roles.manage',
  'settings.site',
  'settings.gallery',
  'settings.storage',
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'overview.view': '查看概览',
  'attachments.view': '查看全部照片',
  'attachments.viewOwn': '查看自己投稿的照片',
  'attachments.upload': '上传照片',
  'attachments.edit': '编辑全部照片信息',
  'attachments.editOwn': '编辑自己投稿的照片信息',
  'attachments.delete': '删除全部照片',
  'attachments.deleteOwn': '删除自己投稿的照片',
  'attachments.assign': '批量归类照片（摄影集/分类/上传者）',
  'attachments.rebuild': '重建照片清单',
  'albums.view': '查看摄影集',
  'albums.manage': '管理摄影集',
  'categories.view': '查看分类',
  'categories.manage': '管理分类',
  'members.view': '查看成员',
  'members.manage': '管理成员与协作模式',
  'roles.view': '查看角色',
  'roles.manage': '管理角色与权限',
  'settings.site': '站点设置',
  'settings.gallery': '图库外观设置',
  'settings.storage': '存储与数据设置',
}

export const PERMISSION_GROUPS: Array<{ title: string, permissions: Permission[] }> = [
  { title: '概览', permissions: ['overview.view'] },
  {
    title: '附件库',
    permissions: [
      'attachments.view',
      'attachments.viewOwn',
      'attachments.upload',
      'attachments.edit',
      'attachments.editOwn',
      'attachments.delete',
      'attachments.deleteOwn',
      'attachments.assign',
      'attachments.rebuild',
    ],
  },
  { title: '摄影集', permissions: ['albums.view', 'albums.manage'] },
  { title: '分类', permissions: ['categories.view', 'categories.manage'] },
  { title: '成员', permissions: ['members.view', 'members.manage'] },
  { title: '角色与权限', permissions: ['roles.view', 'roles.manage'] },
  { title: '设置', permissions: ['settings.site', 'settings.gallery', 'settings.storage'] },
]

export const BUILTIN_ROLES: Role[] = [
  {
    id: 'owner',
    name: '所有者',
    description: '拥有全部权限，不能被删除或降级。',
    permissions: ALL_PERMISSIONS,
    builtin: true,
    protected: true,
  },
  {
    id: 'admin',
    name: '管理员',
    description: '拥有除所有者保护外的全部后台权限。',
    permissions: ALL_PERMISSIONS,
    builtin: true,
    protected: true,
  },
  {
    id: 'editor',
    name: '编辑',
    description: '管理摄影集、分类与全部照片，但不能改站点设置和成员。',
    permissions: [
      'overview.view',
      'attachments.view',
      'attachments.upload',
      'attachments.edit',
      'attachments.delete',
      'attachments.assign',
      'attachments.rebuild',
      'albums.view',
      'albums.manage',
      'categories.view',
      'categories.manage',
    ],
    builtin: true,
  },
  {
    id: 'contributor',
    name: '投稿者',
    description: '只能上传、查看、编辑和删除自己投稿的照片。',
    permissions: [
      'overview.view',
      'attachments.viewOwn',
      'attachments.upload',
      'attachments.editOwn',
      'attachments.deleteOwn',
    ],
    builtin: true,
  },
  {
    id: 'viewer',
    name: '访客',
    description: '只读访问概览与全部照片。',
    permissions: ['overview.view', 'attachments.view'],
    builtin: true,
  },
]

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(BUILTIN_ROLES.map(role => [role.id, role.name]))

export const MODE_LABELS: Record<UserMode, string> = {
  personal: '个人模式',
  team: '团队模式',
}

export const DEFAULT_ADMIN_DATA: AdminData = {
  version: 1,
  mode: 'team',
  site: {
    name: 'Another-Afilmory',
    title: 'Another-Afilmory',
    description: '记录光线、颜色与日常。',
    url: 'https://another-afilmory.local',
    accentColor: '#e0a458',
    authorName: 'Another-Afilmory',
    authorAvatar: '',
    authorUrl: 'https://another-afilmory.local',
    github: '',
    twitter: '',
    footerText: 'Another-Afilmory · 个人摄影站',
    icp: '',
    police: '',
  },
  gallery: {
    defaultViewMode: 'masonry',
    defaultColumns: 'auto',
    defaultSortOrder: 'desc',
    showExif: true,
    showMap: true,
    showUploader: true,
    showAlbumsEntry: true,
    showCategoriesEntry: true,
    enableLikes: true,
    enableComments: true,
    enableDownloads: false,
  },
  home: {
    mode: 'random',
    count: 8,
    interval: 6,
    photoIds: [],
    title: 'Another-Afilmory',
    subtitle: '记录光线、颜色与日常。',
  },
  about: {
    age: '22',
    location: '杭州',
    email: 'hello@another-afilmory.local',
    wechat: 'another-afilmory',
    phone: '',
    bio: 'Another-Afilmory 是一个本地优先的个人摄影站，记录光线、颜色与日常。',
    devices: 'Sony A7M4\n85mm F1.4\niPhone 15 Pro',
    avatarUrl: '/logo.jpg',
    heroPhotoId: '',
    equipment: [
      {
        id: 'eq_light_1',
        imageUrl: '',
        assetId: 'LIGHT-001',
        name: 'Nanlite Forza 500B II',
        category: '灯具',
        brand: '南光',
        model: 'Forza 500B II',
      },
      {
        id: 'eq_light_2',
        imageUrl: '',
        assetId: 'LIGHT-002',
        name: 'Nanlite FC-500B',
        category: '灯具',
        brand: '南光',
        model: 'FC-500B',
      },
      {
        id: 'eq_acc_1',
        imageUrl: '',
        assetId: 'ACCESSORY-001',
        name: 'FM 卡口八角柔光箱 60CM',
        category: '附件',
        brand: '南光',
        model: 'SB-FMM-O-60',
      },
    ],
  },
  team: {
    allowInvites: true,
    defaultRole: 'editor',
    inviteToken: 'another-team-2026',
  },
  storage: {
    provider: 'local',
    basePath: './photos',
    baseUrl: '/photos',
    maxFileSizeMb: 50,
    allowedFormats: 'jpg,jpeg,png,webp,heic,avif',
  },
  members: [
    {
      id: 'usr_owner',
      name: 'Another-Afilmory',
      email: 'owner@another-afilmory.local',
      role: 'owner',
      status: 'active',
      color: '#e0a458',
      joinedAt: '2026-01-01',
    },
  ],
  albums: [],
  categories: [],
  roles: BUILTIN_ROLES,
  photoMeta: {},
  updatedAt: new Date().toISOString(),
}

export function normalizeRoles(input: unknown): Role[] {
  const raw = Array.isArray(input) ? (input as Role[]) : []
  const merged = BUILTIN_ROLES.map((builtin) => {
    const existing = raw.find(role => role.id === builtin.id)
    if (!existing) {
      return builtin
    }
    return {
      ...builtin,
      ...existing,
      name: existing.name || builtin.name,
      description: existing.description ?? builtin.description,
      permissions: builtin.id === 'owner' ? ALL_PERMISSIONS : (Array.isArray(existing.permissions) ? existing.permissions : builtin.permissions),
      builtin: true,
      protected: builtin.protected,
    }
  })
  const custom = raw
    .filter(role => role && typeof role.id === 'string' && !BUILTIN_ROLES.some(builtin => builtin.id === role.id))
    .map(role => ({
      id: role.id,
      name: role.name || role.id,
      description: role.description ?? '',
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      builtin: false,
    }))
  return [...merged, ...custom]
}

export function roleNameOf(data: Pick<AdminData, 'roles'>, roleId: string | undefined): string {
  if (!roleId) {
    return '未分配'
  }
  return data.roles.find(role => role.id === roleId)?.name ?? ROLE_LABELS[roleId] ?? roleId
}

function normalizeAbout(input: Partial<AboutSettings> | undefined): AboutSettings {
  const merged = { ...DEFAULT_ADMIN_DATA.about, ...input }
  merged.equipment = Array.isArray(merged.equipment)
    ? merged.equipment
        .filter(item => item && typeof item === 'object')
        .map((item, index) => ({
          id: String(item.id || `eq_${index + 1}`),
          imageUrl: String(item.imageUrl || ''),
          assetId: String(item.assetId || ''),
          name: String(item.name || ''),
          category: String(item.category || '其他'),
          brand: String(item.brand || ''),
          model: String(item.model || ''),
        }))
    : DEFAULT_ADMIN_DATA.about.equipment
  return merged
}

export function normalizeAdminData(input: unknown): AdminData {
  const raw = (input ?? {}) as Partial<AdminData>
  return {
    ...DEFAULT_ADMIN_DATA,
    ...raw,
    site: { ...DEFAULT_ADMIN_DATA.site, ...raw.site },
    gallery: { ...DEFAULT_ADMIN_DATA.gallery, ...raw.gallery },
    home: { ...DEFAULT_ADMIN_DATA.home, ...raw.home },
    about: normalizeAbout(raw.about),
    team: { ...DEFAULT_ADMIN_DATA.team, ...raw.team },
    storage: { ...DEFAULT_ADMIN_DATA.storage, ...raw.storage },
    members: Array.isArray(raw.members) && raw.members.length > 0 ? raw.members : DEFAULT_ADMIN_DATA.members,
    roles: normalizeRoles(raw.roles),
    albums: Array.isArray(raw.albums) ? raw.albums : [],
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    photoMeta: raw.photoMeta && typeof raw.photoMeta === 'object' ? raw.photoMeta : {},
  }
}
