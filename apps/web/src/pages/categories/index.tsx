import { photoLoader } from '@afilmory/data'

import { getAdminData } from '~/lib/admin/store'
import { EntryCard } from '~/modules/discover/EntryCard'
import { PageHeader } from '~/modules/gallery/PageHeader'

const CategoriesPage = () => {
  const { categories, photoMeta } = getAdminData()
  const photos = photoLoader.getPhotos()

  return (
    <div className="scroll-smooth fixed inset-0 z-90 overflow-y-auto overscroll-contain bg-[var(--site-bg)] text-[var(--site-fg)]">
      <PageHeader showViewControls={false} />
      <main className="page-emerge mx-auto w-full max-w-6xl px-5 pt-20 pb-24 sm:px-8">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.35em] text-white/35 uppercase">Categories</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">分类</h1>
            <p className="mt-2 text-sm text-white/45">换一种方式浏览：按生活、人像、活动等主题归类。</p>
          </div>
          <span className="hidden text-sm text-white/30 sm:block">
            {categories.length}
            {' '}
            类
          </span>
        </div>

        {categories.length === 0
          ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 text-sm text-white/45">
                <p>还没有分类</p>
                <a href="/console" className="text-[var(--color-accent)] hover:underline">去后台添加分类</a>
              </div>
            )
          : (
              <div className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category, index) => {
                  const photosInCategory = photos.filter(photo =>
                    (photoMeta[photo.id]?.categoryIds ?? []).includes(category.id),
                  )
                  return (
                    <EntryCard
                      key={category.id}
                      to={`/categories/${category.slug}`}
                      title={category.name}
                      count={photosInCategory.length}
                      description={category.description}
                      images={photosInCategory.slice(0, 3).map(photo => photo.thumbnailUrl || photo.originalUrl)}
                      accent={category.color}
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

export const Component = CategoriesPage
