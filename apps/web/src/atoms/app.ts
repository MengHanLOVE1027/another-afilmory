import { atom } from 'jotai'

import { getAdminData } from '~/lib/admin/store'

export type GallerySortBy = 'date'
export type GallerySortOrder = 'asc' | 'desc'
export type GalleryViewMode = 'masonry' | 'list'

export interface DateRangeFilter {
  from: string | null
  to: string | null
}

const adminGallery = getAdminData().gallery

export const gallerySettingAtom = atom({
  sortBy: 'date' as GallerySortBy,
  sortOrder: adminGallery.defaultSortOrder as GallerySortOrder,
  selectedTags: [] as string[],
  selectedCameras: [] as string[], // Selected camera display names
  selectedLenses: [] as string[], // Selected lens display names
  selectedUploaders: [] as string[], // Selected member ids (team mode)
  selectedRatings: null as number | null, // Selected minimum rating threshold
  selectedDateRange: null as DateRangeFilter | null,
  tagFilterMode: 'union' as 'union' | 'intersection', // Tag filtering logic mode

  columns: adminGallery.defaultColumns as number | 'auto', // 自定义列数，auto 表示自动计算
  viewMode: adminGallery.defaultViewMode as GalleryViewMode, // 视图模式：瀑布流或列表详情

  showExif: adminGallery.showExif,
  showMap: adminGallery.showMap,
  showUploader: adminGallery.showUploader,
  showAlbumsEntry: adminGallery.showAlbumsEntry,
  showCategoriesEntry: adminGallery.showCategoriesEntry,
})

export const isExiftoolLoadedAtom = atom(false)

// Bumped after attachments are re-indexed so photo consumers recompute from the
// updated manifest without reloading the page.
export const photoManifestVersionAtom = atom(0)

// Command Palette state
export const isCommandPaletteOpenAtom = atom(false)
