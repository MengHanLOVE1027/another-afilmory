import { photoLoader } from '@afilmory/data'
import { Spring } from '@afilmory/utils'
import { useAtom } from 'jotai'
import { ArrowUp, Aperture, CalendarDays, Camera, Check, RotateCcw, SlidersHorizontal, UserRound, X } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { gallerySettingAtom } from '~/atoms/app'
import { getActiveMembers, getAdminData } from '~/lib/admin/store'

interface FilterFabProps {
  scrollElement: HTMLElement | null | undefined
}

const DATE_PRESETS = [
  { id: 'all', label: '全部时间', days: null },
  { id: 'last7', label: '最近 7 天', days: 7 },
  { id: 'last30', label: '最近 30 天', days: 30 },
  { id: 'last90', label: '最近 90 天', days: 90 },
] as const

const toIso = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const presetRange = (preset: (typeof DATE_PRESETS)[number]) => {
  if (preset.days === null) {
    return null
  }
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - (preset.days - 1))
  return { from: toIso(from), to: toIso(today) }
}

const useScrollState = (scrollElement: HTMLElement | null | undefined) => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!scrollElement) {
      return
    }
    const onScroll = () => setScrolled(scrollElement.scrollTop > 260)
    onScroll()
    scrollElement.addEventListener('scroll', onScroll, { passive: true })
    return () => scrollElement.removeEventListener('scroll', onScroll)
  }, [scrollElement])

  return scrolled
}

export const FilterFab = ({ scrollElement }: FilterFabProps) => {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useAtom(gallerySettingAtom)
  const scrolled = useScrollState(scrollElement)
  const adminData = useMemo(() => getAdminData(), [])

  const cameras = useMemo(() => photoLoader.getAllCameras(), [])
  const lenses = useMemo(() => photoLoader.getAllLenses(), [])
  const members = useMemo(() => getActiveMembers(adminData), [adminData])
  const showMembers = adminData.mode === 'team'

  const filterCount
    = settings.selectedCameras.length
      + settings.selectedLenses.length
      + settings.selectedUploaders.length
      + (settings.selectedRatings !== null ? 1 : 0)
      + (settings.selectedDateRange !== null ? 1 : 0)

  const toggleCamera = (name: string) => {
    setSettings(prev => ({
      ...prev,
      selectedCameras: prev.selectedCameras.includes(name)
        ? prev.selectedCameras.filter(item => item !== name)
        : [...prev.selectedCameras, name],
    }))
  }

  const toggleLens = (name: string) => {
    setSettings(prev => ({
      ...prev,
      selectedLenses: prev.selectedLenses.includes(name)
        ? prev.selectedLenses.filter(item => item !== name)
        : [...prev.selectedLenses, name],
    }))
  }

  const toggleUploader = (id: string) => {
    setSettings(prev => ({
      ...prev,
      selectedUploaders: prev.selectedUploaders.includes(id)
        ? prev.selectedUploaders.filter(item => item !== id)
        : [...prev.selectedUploaders, id],
    }))
  }

  const setDateRange = (range: { from: string | null, to: string | null } | null) => {
    setSettings(prev => ({ ...prev, selectedDateRange: range }))
  }

  const setCustomDate = (key: 'from' | 'to', value: string) => {
    const current = settings.selectedDateRange ?? { from: null, to: null }
    setDateRange({ ...current, [key]: value || null })
  }

  const clearAll = () => {
    setSettings(prev => ({
      ...prev,
      selectedCameras: [],
      selectedLenses: [],
      selectedUploaders: [],
      selectedRatings: null,
      selectedDateRange: null,
    }))
  }

  return (
    <>
      <div className="pointer-events-none fixed right-4 bottom-5 z-100 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6">
        <AnimatePresence>
          {scrolled && (
            <m.button
              key="back-to-top"
              type="button"
              onClick={() => scrollElement?.scrollTo({ top: 0, behavior: 'smooth' })}
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.9 }}
              transition={Spring.presets.snappy}
              aria-label="返回顶部"
              title="返回顶部"
              className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/85 shadow-lg backdrop-blur-xl transition-colors hover:border-white/30 hover:text-white"
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </m.button>
          )}
        </AnimatePresence>

        <m.button
          type="button"
          onClick={() => setOpen(true)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={Spring.presets.snappy}
          aria-label="筛选照片"
          title="筛选照片"
          className="pointer-events-auto relative flex h-12 items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 text-sm font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors hover:border-white/30"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">筛选</span>
          {filterCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-white">
              {filterCount}
            </span>
          )}
        </m.button>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-200">
            <m.div
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <m.div
              role="dialog"
              aria-modal="true"
              aria-label="筛选照片"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 32 }}
              transition={Spring.presets.smooth}
              className="absolute inset-x-0 bottom-0 flex max-h-[86vh] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#111214]/95 text-white shadow-[0_-20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:inset-y-4 sm:right-4 sm:left-auto sm:max-h-[calc(100vh-2rem)] sm:w-[420px] sm:rounded-2xl"
            >
              <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-[var(--color-accent)]" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-semibold">筛选照片</h2>
                    <p className="mt-0.5 text-xs text-white/45">
                      {filterCount > 0 ? `已启用 ${filterCount} 个条件` : '按相机、镜头、时间和上传者组合筛选'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="关闭"
                  className="flex size-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </header>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <section>
                  <SectionTitle icon={Camera} title="相机" count={settings.selectedCameras.length} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cameras.map(camera => (
                      <FilterPill
                        key={camera.displayName}
                        active={settings.selectedCameras.includes(camera.displayName)}
                        onClick={() => toggleCamera(camera.displayName)}
                      >
                        {camera.displayName}
                      </FilterPill>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionTitle icon={Aperture} title="镜头" count={settings.selectedLenses.length} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lenses.map(lens => (
                      <FilterPill
                        key={lens.displayName}
                        active={settings.selectedLenses.includes(lens.displayName)}
                        onClick={() => toggleLens(lens.displayName)}
                      >
                        {lens.displayName}
                      </FilterPill>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionTitle icon={CalendarDays} title="时间" count={settings.selectedDateRange ? 1 : 0} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DATE_PRESETS.map((preset) => {
                      const range = presetRange(preset)
                      const active
                        = preset.id === 'all'
                          ? settings.selectedDateRange === null
                          : settings.selectedDateRange?.from === range?.from
                            && settings.selectedDateRange?.to === range?.to
                      return (
                        <FilterPill key={preset.id} active={active} onClick={() => setDateRange(range)}>
                          {preset.label}
                        </FilterPill>
                      )
                    })}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-white/45">
                      开始日期
                      <input
                        type="date"
                        value={settings.selectedDateRange?.from ?? ''}
                        onChange={event => setCustomDate('from', event.target.value)}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-white/40"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-white/45">
                      结束日期
                      <input
                        type="date"
                        value={settings.selectedDateRange?.to ?? ''}
                        onChange={event => setCustomDate('to', event.target.value)}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-white/40"
                      />
                    </label>
                  </div>
                </section>

                {showMembers && (
                  <section>
                    <SectionTitle icon={UserRound} title="上传者" count={settings.selectedUploaders.length} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {members.map(member => (
                        <FilterPill
                          key={member.id}
                          active={settings.selectedUploaders.includes(member.id)}
                          onClick={() => toggleUploader(member.id)}
                        >
                          <span className="size-2 rounded-full" style={{ backgroundColor: member.color }} />
                          {member.name}
                        </FilterPill>
                      ))}
                    </div>
                    {members.length <= 1 && (
                      <p className="mt-2 text-xs text-white/40">当前是个人模式，启用团队模式后可按成员筛选。</p>
                    )}
                  </section>
                )}
              </div>

              <footer className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-4">
                <button
                  type="button"
                  onClick={clearAll}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/55 transition-colors hover:text-white"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  清除筛选
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  <Check className="size-4" aria-hidden="true" />
                  完成
                </button>
              </footer>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

const SectionTitle = ({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Camera
  title: string
  count: number
}) => (
  <div className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-white/40 uppercase">
    <Icon className="size-3.5" aria-hidden="true" />
    <span>{title}</span>
    {count > 0 && (
      <span className="rounded-full bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
        {count}
      </span>
    )}
  </div>
)

const FilterPill = ({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    style={
      active
        ? {
            borderColor: 'color-mix(in srgb, var(--color-accent) 60%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
          }
        : undefined
    }
    className={
      active
        ? 'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-white transition-colors'
        : 'flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65 transition-colors hover:border-white/25 hover:text-white'
    }
  >
    {children}
  </button>
)
