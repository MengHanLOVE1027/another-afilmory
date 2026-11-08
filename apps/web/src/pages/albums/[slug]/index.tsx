import { photoLoader } from '@afilmory/data'
import { Link, useParams } from 'react-router'

import { getAlbumBySlug, getMember, getPhotoMeta } from '~/lib/admin/store'
import { CollectionPage } from '~/modules/discover/CollectionPage'
import { DiscoverShell, Empty } from '~/modules/discover'

const AlbumDetailPage = () => {
  const { slug } = useParams()
  const album = slug ? getAlbumBySlug(slug) : undefined

  if (!album) {
    return (
      <DiscoverShell title="摄影集不存在">
        <Empty text="没有找到这个摄影集，它可能被删除了。" />
        <Link to="/albums" className="mt-6 inline-block text-sm text-white/55 hover:text-white">
          ← 返回摄影集
        </Link>
      </DiscoverShell>
    )
  }

  const allPhotos = photoLoader.getPhotos()
  const photos = album.photoIds
    .map(id => allPhotos.find(photo => photo.id === id))
    .filter((photo): photo is (typeof allPhotos)[number] => !!photo)

  const categories = [...new Set(
    photos.flatMap(photo => getPhotoMeta(photo.id).categoryIds ?? []),
  )]

  const uploaders = [...new Set(
    photos.map(photo => getMember(getPhotoMeta(photo.id).uploaderId)?.name).filter(Boolean),
  )]

  return (
    <CollectionPage
      kind="album"
      title={album.title}
      description={album.description}
      photos={photos}
      meta={[
        ...(categories.length > 0 ? [{ label: '分类', value: `${categories.length} 个` }] : []),
        ...(uploaders.length > 0 ? [{ label: '上传者', value: uploaders.slice(0, 3).join(' · ') }] : []),
      ]}
    />
  )
}

export const Component = AlbumDetailPage
