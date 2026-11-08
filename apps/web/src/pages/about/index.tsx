import { photoLoader } from '@afilmory/data'
import { Camera, MapPin, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { getAdminData } from '~/lib/admin/store'
import type { EquipmentItem } from '~/lib/admin/types'
import { PageHeader } from '~/modules/gallery/PageHeader'

function EquipmentThumb({ item }: { item: EquipmentItem }) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        className="size-10 rounded-lg border border-[var(--site-line)] object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex size-10 items-center justify-center rounded-lg border border-[var(--site-line)] bg-gradient-to-br from-[var(--site-panel)] to-[var(--site-line)] text-[var(--site-muted)]">
      <Camera className="size-4" />
    </div>
  )
}

function EquipmentTable({ items }: { items: EquipmentItem[] }) {
  const groups = Array.from(new Set(items.map(item => item.category || '其他')))
  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group}>
          <h3 className="mb-2 text-sm font-medium">{group}</h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--site-line)] bg-[var(--site-panel)]">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--site-line)] text-[10px] tracking-wide text-[var(--site-muted)]">
                  <th className="w-16 px-3 py-2.5 font-normal">图片</th>
                  <th className="w-24 px-3 py-2.5 font-normal">资产编号</th>
                  <th className="px-3 py-2.5 font-normal">器材</th>
                  <th className="w-16 px-3 py-2.5 font-normal">分类</th>
                  <th className="w-20 px-3 py-2.5 font-normal">品牌</th>
                  <th className="w-32 px-3 py-2.5 font-normal">型号</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(item => (item.category || '其他') === group).map(item => (
                  <tr key={item.id} className="border-b border-[var(--site-line)] last:border-0">
                    <td className="px-3 py-2">
                      <EquipmentThumb item={item} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--site-muted)]">{item.assetId || '—'}</td>
                    <td className="px-3 py-2 text-[var(--site-fg)]">{item.name || '未命名器材'}</td>
                    <td className="px-3 py-2 text-[var(--site-muted)]">{item.category || '其他'}</td>
                    <td className="px-3 py-2 text-[var(--site-muted)]">{item.brand || '—'}</td>
                    <td className="px-3 py-2 text-[var(--site-muted)]">{item.model || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

function AboutPage() {
  const data = getAdminData()
  const about = data.about
  const photos = photoLoader.getPhotos()
  const hero = about.heroPhotoId
    ? photos.find(photo => photo.id === about.heroPhotoId) ?? photos[0]
    : photos[0]
  const heroSrc = hero ? `/previews/${hero.id}.jpg` : ''
  const avatar = about.avatarUrl || data.site.authorAvatar || '/logo.jpg'
  const contacts = [
    { label: '邮箱', value: about.email },
    { label: '微信', value: about.wechat },
    { label: '电话', value: about.phone },
    { label: '所在地', value: about.location },
  ].filter(item => item.value)

  return (
    <div className="fixed inset-0 z-90 overflow-y-auto overscroll-contain bg-[var(--site-bg)] text-[var(--site-fg)]">
      <PageHeader showViewControls={false} />
      <main className="mx-auto w-full max-w-4xl px-5 pt-16 pb-10 sm:px-8 sm:pt-20 sm:pb-14">
        <p className="text-[10px] tracking-[0.24em] text-[var(--site-muted)]">ABOUT</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{data.site.title || data.site.name}</h1>
        <p className="mt-3 text-sm text-[var(--site-muted)]">{data.site.description || '摄影、生活与一些被记住的瞬间。'}</p>

        <section className="mt-10 flex items-center gap-5 border-t border-[var(--site-line)] pt-8">
          <img
            src={avatar}
            alt={data.site.authorName}
            className="size-20 shrink-0 rounded-full border border-[var(--site-line)] object-cover sm:size-24"
          />
          <div>
            <h2 className="text-xl font-medium">{data.site.authorName || '摄影师'}</h2>
            <p className="mt-1.5 max-w-lg text-sm leading-6 text-[var(--site-muted)]">{about.bio}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--site-muted)]">
              {about.age && <span>{about.age} 岁</span>}
              {about.location && <span>{about.location}</span>}
            </div>
          </div>
        </section>

        {heroSrc && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--site-line)] bg-[var(--site-line)]">
            <img src={heroSrc} alt="关于页主图" className="aspect-[16/8] w-full object-cover" />
          </div>
        )}

        <section className="mt-12">
          <p className="text-[10px] tracking-[0.24em] text-[var(--site-muted)]">LOCATION</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-medium tracking-tight">{about.location || '杭州'}</h2>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--site-muted)]">
              <MapPin className="size-3.5" />
              常驻城市
            </span>
          </div>
          <div className="relative mt-4 h-44 overflow-hidden rounded-2xl border border-[var(--site-line)] bg-[var(--site-line)] sm:h-52">
            <div
              className="absolute inset-0 opacity-80"
              style={{
                backgroundImage:
                  'linear-gradient(115deg, transparent 0 18%, #26262a 18% 22%, transparent 22% 100%), linear-gradient(25deg, transparent 0 38%, #26262a 38% 42%, transparent 42% 100%), repeating-linear-gradient(0deg, transparent 0 29px, rgba(255,255,255,0.05) 29px 30px), repeating-linear-gradient(90deg, transparent 0 39px, rgba(255,255,255,0.05) 39px 40px)',
              }}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--site-fg)] text-[var(--site-bg)] shadow-lg">
                <MapPin className="size-4" />
              </span>
            </div>
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <span className="rounded-full bg-[var(--site-panel)] px-3 py-1.5 text-[11px] text-[var(--site-muted)] backdrop-blur">
                {about.location || '杭州'}
              </span>
              <Link
                to="/map"
                className="rounded-full bg-[var(--site-fg)] px-3 py-1.5 text-[11px] text-[var(--site-bg)]"
              >
                查看地图
              </Link>
            </div>
          </div>
        </section>

        {contacts.length > 0 && (
          <section className="mt-10">
            <p className="text-[10px] tracking-[0.24em] text-[var(--site-muted)]">CONTACT</p>
            <h2 className="mt-2 text-2xl font-medium tracking-tight">联系方式</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {contacts.map(contact => (
                <div key={contact.label} className="rounded-xl border border-[var(--site-line)] bg-[var(--site-panel)] px-4 py-3">
                  <p className="text-[10px] text-[var(--site-muted)]">{contact.label}</p>
                  <p className="mt-0.5 text-sm text-[var(--site-muted)]">{contact.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {about.equipment.length > 0 && (
          <section className="mt-12">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] tracking-[0.24em] text-[var(--site-muted)]">EQUIPMENT</p>
                <h2 className="mt-2 text-2xl font-medium tracking-tight">设备清单</h2>
              </div>
              <span className="rounded-full border border-[var(--site-line)] px-3 py-1 text-[11px] text-[var(--site-muted)]">
                {about.equipment.length} 件
              </span>
            </div>
            <div className="mt-4">
              <EquipmentTable items={about.equipment} />
            </div>
          </section>
        )}

        <section className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[var(--site-line)] bg-[var(--site-panel)] px-5 py-6 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-4 text-[var(--site-muted)]" />
              想一起拍点什么？
            </p>
            <p className="mt-1 text-xs text-[var(--site-muted)]">留下日期与想法，我会尽快回复。</p>
          </div>
          <Link
            to="/booking"
            className="rounded-full bg-[var(--site-fg)] px-5 py-2.5 text-sm text-[var(--site-bg)] transition hover:opacity-90"
          >
            预约约拍 →
          </Link>
        </section>
      </main>
    </div>
  )
}

export const Component = AboutPage
