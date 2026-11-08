import { photoLoader } from '@afilmory/data'
import { Link, useParams } from 'react-router'

import { getAdminData, getCategoryBySlug, getMember, getPhotoMeta } from '~/lib/admin/store'
import { CollectionPage } from '~/modules/discover/CollectionPage'
import { DiscoverShell, Empty } from '~/modules/discover'

const CategoryDetailPage = () => {
  const { slug } = useParams()
  const category = slug ? getCategoryBySlug(slug) : undefined

  if (!category) {
    return (
      <DiscoverShell title="分类不存在">
        <Empty text="没有找到这个分类。" />
        <Link to="/categories" className="mt-6 inline-block text-sm text-white/55 hover:text-white">
          ← 返回分类
        </Link>
      </DiscoverShell>
    )
  }

  const { albums, photoMeta } = getAdminData()
  const photos = photoLoader
    .getPhotos()
    .filter(photo => (photoMeta[photo.id]?.categoryIds ?? []).includes(category.id))

  const albumNames = [...new Set(
    photos.flatMap((photo) => {
      const albumIds = photoMeta[photo.id]?.albumIds ?? []
      return albums.filter(album => albumIds.includes(album.id)).map(album => album.title)
    }),
  )]

  const uploaders = [...new Set(
    photos.map(photo => getMember(getPhotoMeta(photo.id).uploaderId)?.name).filter(Boolean),
  )]

  return (
    <CollectionPage
      kind="category"
      title={category.name}
      description={category.description}
      photos={photos}
      accent={category.color}
      meta={[
        ...(albumNames.length > 0 ? [{ label: '摄影集', value: albumNames.slice(0, 3).join(' · ') }] : []),
        ...(uploaders.length > 0 ? [{ label: '上传者', value: uploaders.slice(0, 3).join(' · ') }] : []),
      ]}
    />
  )
}

export const Component = CategoryDetailPage
