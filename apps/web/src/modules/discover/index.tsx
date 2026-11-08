import { Link } from 'react-router'

import { photoLoader } from '@afilmory/data'

import { getAdminData, getCategory, getPhotoUploader } from '~/lib/admin/store'
import { PageHeader } from '~/modules/gallery/PageHeader'

export const DiscoverShell = ({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) => (
  <div className="fixed inset-0 z-90 overflow-y-auto bg-[#0a0a0b] text-white">
    <PageHeader showViewControls={false} />

    <main className="mx-auto max-w-5xl px-5 pt-20 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-white/45">{subtitle}</p>}
      </div>
      {children}
    </main>
  </div>
)

export const PhotoGrid = ({ photoIds, scope }: { photoIds: string[], scope?: { kind: 'album' | 'category', slug: string } }) => {
  const photos = photoLoader.getPhotos().filter(photo => photoIds.includes(photo.id))
  const scopeSearch = scope ? `?scope=${scope.kind}&slug=${encodeURIComponent(scope.slug)}` : ''
  if (photos.length === 0) {
    return <Empty text="这里还没有照片" />
  }
  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
      {photos.map(photo => (
        <Link
          key={photo.id}
          to={`/photos/${photo.id}${scopeSearch}`}
          className="group relative block overflow-hidden rounded-xl border border-white/8 bg-white/5"
        >
          <img
            src={photo.thumbnailUrl || photo.originalUrl}
            alt={photo.id}
            loading="lazy"
            className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-linear-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-xs text-white/80">{formatDate(photo.lastModified)}</span>
            <span className="text-[11px] text-white/50">{getPhotoUploader(photo.id)?.name ?? ''}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

export const Empty = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center text-sm text-white/35">
    {text}
  </div>
)

export const photoMeta = (id: string) => getAdminData().photoMeta[id] ?? {}

export const formatDate = (value?: string) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export const categoryName = (id: string) => getCategory(id)?.name ?? ''
