import { photoLoader } from '@afilmory/data'
import type { PhotoManifest } from '~/types/photo'
import { useAtomValue } from 'jotai'
import { FolderOpen, Folder, UserRound, ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { photoManifestVersionAtom } from '~/atoms/app'
import { getAdminData } from '~/lib/admin/store'
import { PageHeader } from '~/modules/gallery/PageHeader'

const previewOf = (photo: PhotoManifest) => `/previews/${photo.id}.jpg`

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const HomePage = () => {
  const manifestVersion = useAtomValue(photoManifestVersionAtom)
  const data = getAdminData()
  const home = data.home
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)

  const photos = useMemo(() => {
    const all = photoLoader.getPhotos()
    if (home.mode === 'manual' && home.photoIds.length > 0) {
      const map = new Map(all.map(photo => [photo.id, photo]))
      const selected = home.photoIds
        .map(id => map.get(id))
        .filter((photo): photo is PhotoManifest => Boolean(photo))
      if (selected.length > 0) {
        return selected
      }
    }
    const count = Math.max(1, Math.min(home.count || 8, all.length))
    return shuffled(all).slice(0, count)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.mode, home.count, home.photoIds.join(','), manifestVersion])

  useEffect(() => {
    setIndex(photos.length > 0 ? Math.floor(photos.length / 2) : 0)
  }, [photos])

  useEffect(() => {
    if (paused || photos.length <= 1) {
      return
    }
    const timer = window.setInterval(() => {
      setIndex(value => (value + 1) % photos.length)
    }, Math.max(2, home.interval || 6) * 1000)
    return () => window.clearInterval(timer)
  }, [paused, photos.length, home.interval])

  useEffect(() => {
    if (photos.length === 0) {
      return
    }
    for (const offset of [-1, 1]) {
      const near = photos[(index + offset + photos.length) % photos.length]
      const img = new Image()
      img.src = previewOf(near)
    }
  }, [index, photos])

  const categoryEntries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const photo of photoLoader.getPhotos()) {
      const meta = data.photoMeta[photo.id]
      for (const categoryId of meta?.categoryIds ?? []) {
        counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1)
      }
    }
    return data.categories
      .filter(category => (counts.get(category.id) ?? 0) > 0)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
      .slice(0, 3)
      .map((category, i) => ({
        ...category,
        count: counts.get(category.id) ?? 0,
        Icon: [FolderOpen, Folder, UserRound][i] ?? Folder,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestVersion])

  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 z-90 flex flex-col bg-[var(--site-bg)] text-[var(--site-fg)]">
        <PageHeader showViewControls={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-sm opacity-65">
          <p>还没有可以展示的照片。</p>
          <Link className="underline underline-offset-4" to="/console">
            去后台添加照片
          </Link>
        </div>
      </div>
    )
  }

  const currentIndex = Math.min(index, photos.length - 1)
  const current = photos[currentIndex]

  return (
    <div className="fixed inset-0 z-90 overflow-hidden bg-black text-white">
      <PageHeader transparent showViewControls={false} />

      <main
        className="relative h-svh w-full overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          setPaused(false)
          setHovered(null)
        }}
      >
        {/* 移动端：单张轮播 */}
        <div className="absolute inset-0 sm:hidden">
          <img
            src={previewOf(photos[(currentIndex - 1 + photos.length) % photos.length])}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
          <img
            key={current.id}
            src={previewOf(current)}
            alt={current.title}
            className="hero-fade absolute inset-0 size-full object-cover"
            onError={(event) => {
              event.currentTarget.src = current.originalUrl
            }}
          />
        </div>

        {/* 桌面端：横向手风琴 */}
        <div className="absolute inset-0 hidden sm:flex">
          {photos.map((photo, photoIndex) => {
            const active = photoIndex === currentIndex
            const grow = active ? 7.5 : hovered === photoIndex ? 2.2 : 1
            return (
              <button
                key={photo.id}
                type="button"
                aria-label={`展示第 ${photoIndex + 1} 张：${photo.title}`}
                className="group relative h-full min-w-0 overflow-hidden outline-none"
                style={{
                  flexGrow: grow,
                  flexBasis: 0,
                  transition: 'flex-grow 800ms cubic-bezier(0.22,1,0.36,1)',
                  contain: 'paint',
                  transform: 'translateZ(0)',
                }}
                onClick={() => setIndex(photoIndex)}
                onMouseEnter={() => setHovered(photoIndex)}
                onFocus={() => setHovered(photoIndex)}
                onBlur={() => setHovered(null)}
              >
                <img
                  src={previewOf(photo)}
                  alt={photo.title}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = photo.originalUrl
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/10" />
                <div
                  className={`absolute inset-y-0 left-0 w-px transition-colors ${
                    active ? 'bg-white/25' : 'bg-white/10'
                  }`}
                />
                {active && (
                  <div className="pointer-events-none absolute inset-0 ring-1 ring-white/12 ring-inset" />
                )}
              </button>
            )
          })}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

        <div className="pointer-events-none absolute right-6 bottom-28 left-5 z-30 max-w-[calc(100%-3rem)] sm:right-auto sm:bottom-9 sm:left-10 sm:max-w-[min(720px,55vw)]">
          <p className="text-[10px] font-medium tracking-[0.32em] text-white/55 uppercase">
            Featured gallery
          </p>
          <h1 className="mt-2 text-4xl leading-[1.05] font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {home.title || data.site.title}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
            {home.subtitle || data.site.description}
          </p>

          <div className="pointer-events-auto mt-5 hidden flex-wrap items-center gap-2 sm:flex">
            {categoryEntries.map((entry) => (
              <Link
                key={entry.id}
                to={`/categories/${entry.slug}`}
                className="group flex min-w-[148px] items-center gap-3 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 backdrop-blur-xl transition-colors hover:bg-white/12"
              >
                <entry.Icon className="size-4 shrink-0 text-white/65" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">
                    {entry.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/45">
                    {entry.count} 张照片
                  </span>
                </span>
              </Link>
            ))}
            <Link
              to="/gallery"
              className="ml-1 inline-flex items-center gap-1.5 px-2 py-3 text-xs text-white/55 transition-colors hover:text-white"
            >
              浏览全部作品
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <Link
            to="/gallery"
            className="pointer-events-auto mt-5 inline-flex items-center gap-1.5 text-sm text-white/70 sm:hidden"
          >
            浏览全部作品
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="absolute right-5 bottom-4 z-40 flex items-center gap-3 rounded-full border border-white/12 bg-black/35 px-3 py-2 text-white backdrop-blur-xl sm:right-7 sm:bottom-8">
          <span className="font-mono text-[11px] tabular-nums text-white/70">
            {String(currentIndex + 1).padStart(2, '0')}
            {' / '}
            {String(photos.length).padStart(2, '0')}
          </span>
          <div className="flex items-center gap-1.5">
            {photos.map((photo, photoIndex) => (
              <button
                key={photo.id}
                type="button"
                aria-label={`切换到第 ${photoIndex + 1} 张`}
                className={`h-1.5 rounded-full transition-all ${
                  photoIndex === currentIndex
                    ? 'w-5 bg-white'
                    : 'w-1.5 bg-white/35 hover:bg-white/65'
                }`}
                onClick={() => setIndex(photoIndex)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export const Component = HomePage
