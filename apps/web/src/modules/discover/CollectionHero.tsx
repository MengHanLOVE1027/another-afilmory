import { Calendar, Images } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import type { PhotoManifest } from '~/types/photo'

export interface CollectionHeroMeta {
  label: string
  value: string
}

export interface CollectionHeroProps {
  kind: 'album' | 'category'
  title: string
  description?: string
  count: number
  photos: PhotoManifest[]
  meta?: CollectionHeroMeta[]
  accent?: string
}

const backgroundPhotos = (photos: PhotoManifest[]) => {
  if (photos.length === 0) {
    return []
  }
  return Array.from({ length: 12 }, (_, index) => photos[index % photos.length])
}

const formatRange = (photos: PhotoManifest[]) => {
  if (photos.length === 0) {
    return '暂无照片'
  }
  const dates = photos
    .map(photo => photo.lastModified ?? photo.exif?.DateTimeOriginal)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
  if (dates.length === 0) {
    return '未记录时间'
  }
  const format = (value: string) => value.slice(0, 10).replaceAll('-', '.')
  const first = format(dates[0])
  const last = format(dates[dates.length - 1])
  return first === last ? first : `${first} — ${last}`
}

export const CollectionHero = ({ kind, title, description, count, photos, meta = [], accent }: CollectionHeroProps) => {
  const navigate = useNavigate()
  const bg = backgroundPhotos(photos)
  const kindLabel = kind === 'album' ? '摄影集' : '分类'

  return (
    <header className="relative isolate overflow-hidden border-b border-white/8">
      <div className="absolute inset-0 grid grid-cols-3 gap-1 opacity-45 sm:grid-cols-4 lg:grid-cols-6">
        {bg.map((photo, index) => (
          <div key={`${photo.id}-${index}`} className="relative aspect-[4/3] overflow-hidden">
            <img
              src={photo.thumbnailUrl || photo.originalUrl}
              alt=""
              className="size-full scale-105 object-cover blur-[0.5px]"
              loading="eager"
            />
            <div className="absolute inset-0 bg-black/35" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/82 to-[#0a0a0b]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_55%)]" />

      <div
        className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-col justify-between px-5 pt-6 pb-10 sm:px-8 lg:px-12"
        style={{ minHeight: 420 }}
      >
        <div className="max-w-4xl">
          <button
            type="button"
            aria-label="返回"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/65 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
          >
            <i className="i-mingcute-arrow-left-line text-sm" />
            返回
          </button>
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.45em] text-white/50 uppercase">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: accent ?? 'var(--color-accent)' }} />
            {kindLabel}
            <span className="text-white/25">/</span>
            {count}
            {' '}
            张照片
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">{description}</p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3.5 py-1.5 text-xs text-white/80 backdrop-blur">
              <Images className="size-3.5 text-white/60" />
              {count}
              {' '}
              张照片
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3.5 py-1.5 text-xs text-white/80 backdrop-blur">
              <Calendar className="size-3.5 text-white/60" />
              {formatRange(photos)}
            </span>
            {meta.map(item => (
              <span
                key={item.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3.5 py-1.5 text-xs text-white/80 backdrop-blur"
              >
                <span className="text-white/45">{item.label}</span>
                {item.value}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between text-xs text-white/40">
          <span>点击任意照片进入查看器 · 关闭后回到当前{kindLabel}</span>
          <Link to="/gallery" className="transition-colors hover:text-white/80">浏览全部照片 →</Link>
        </div>
      </div>
    </header>
  )
}
