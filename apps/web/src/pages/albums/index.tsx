import { photoLoader } from '@afilmory/data'

import { getAdminData, publicAlbums } from '~/lib/admin/store'
import { EntryCard } from '~/modules/discover/EntryCard'
import { PageHeader } from '~/modules/gallery/PageHeader'

const PALETTE = ['#e0a458', '#7c9cff', '#69c9a8', '#e179a8', '#c9a0ff']

const AlbumsPage = () => {
  const albums = publicAlbums(getAdminData())
  const photoMap = new Map(photoLoader.getPhotos().map(photo => [photo.id, photo]))

  return (
    <div className="scroll-smooth fixed inset-0 z-90 overflow-y-auto overscroll-contain bg-[var(--site-bg)] text-[var(--site-fg)]">
      <PageHeader showViewControls={false} />
      <main className="page-emerge mx-auto w-full max-w-6xl px-5 pt-20 pb-24 sm:px-8">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.35em] text-white/35 uppercase">Albums</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">摄影集</h1>
            <p className="mt-2 text-sm text-white/45">按主题整理的成组照片，点开即可浏览整组故事。</p>
          </div>
          <span className="hidden text-sm text-white/30 sm:block">
            {albums.length}
            {' '}
            本
          </span>
        </div>

        {albums.length === 0
          ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 text-sm text-white/45">
                <p>还没有公开的摄影集</p>
                <a href="/console" className="text-[var(--color-accent)] hover:underline">去后台创建摄影集</a>
              </div>
            )
          : (
              <div className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {albums.map((album, index) => {
                  const photoIds = album.coverPhotoId
                    ? [album.coverPhotoId, ...album.photoIds.filter(id => id !== album.coverPhotoId)]
                    : album.photoIds
                  const albumPhotos = photoIds
                    .map(id => photoMap.get(id))
                    .filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
                    .slice(0, 3)

                  return (
                    <EntryCard
                      key={album.id}
                      to={`/albums/${album.slug}`}
                      title={album.title}
                      count={album.photoIds.length}
                      description={album.description || '用镜头记录下这一段时光。'}
                      images={albumPhotos.map(photo => photo.thumbnailUrl || photo.originalUrl)}
                      accent={PALETTE[index % PALETTE.length]}
                      index={index}
                    />
                  )
                })}
              </div>
            )}
      </main>
    </div>
  )
}

export const Component = AlbumsPage
