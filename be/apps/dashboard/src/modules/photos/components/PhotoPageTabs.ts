export type PhotoPageTab = 'sync' | 'library' | 'storage' | 'usage'

export const PHOTO_TABS: readonly PhotoPageTab[] = ['sync', 'library', 'storage', 'usage'] as const

export const TAB_ROUTE_MAP: Record<PhotoPageTab, string> = {
  sync: '/photos/sync',
  library: '/photos/library',
  storage: '/photos/storage',
  usage: '/photos/usage',
}
