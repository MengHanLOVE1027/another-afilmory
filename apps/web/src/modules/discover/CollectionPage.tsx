import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { RemoveScroll } from 'react-remove-scroll'

import { PhotoOpenContext } from '~/modules/gallery/MasonryPhotoItem'
import { MasonryView } from '~/modules/gallery/MasonryView'
import { PageHeader } from '~/modules/gallery/PageHeader'
import { PhotoViewer } from '~/modules/viewer'
import { PhotosProvider } from '~/providers/photos-provider'
import type { PhotoManifest } from '~/types/photo'

import type { CollectionHeroMeta } from './CollectionHero'
import { CollectionHero } from './CollectionHero'

interface ViewerState {
  index: number
  triggerElement: HTMLElement | null
}

export const CollectionPage = ({
  kind,
  title,
  description,
  photos,
  meta,
  accent,
}: {
  kind: 'album' | 'category'
  title: string
  description?: string
  photos: PhotoManifest[]
  meta?: CollectionHeroMeta[]
  accent?: string
}) => {
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const openPhoto = useCallback((index: number, triggerElement?: HTMLElement) => {
    setViewer({ index, triggerElement: triggerElement ?? null })
    setIsOpen(true)
  }, [])

  const closeViewer = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleExitComplete = useCallback(() => {
    setViewer(null)
    setIsOpen(false)
  }, [])

  useEffect(() => {
    if (!viewer) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeViewer()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeViewer, viewer])

  // 没有打开查看器时，Esc 返回摄影集/分类列表。
  useEffect(() => {
    if (viewer) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate(kind === 'album' ? '/albums' : '/categories')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [kind, navigate, viewer])

  return (
    <div className="scroll-smooth fixed inset-0 z-90 overflow-y-auto bg-[#0a0a0b] text-white">
      <PageHeader photoCount={photos.length} showViewControls={false} />
      <div className="page-emerge pt-12">
        <CollectionHero
          kind={kind}
          title={title}
          description={description}
          count={photos.length}
          photos={photos}
          meta={meta}
          accent={accent}
        />

        <main className="mx-auto w-full max-w-[1700px] px-1 pt-4 pb-24 sm:px-2">
          {photos.length > 0
            ? (
                <PhotosProvider photos={photos}>
                  <PhotoOpenContext.Provider value={openPhoto}>
                    <MasonryView photos={photos} />
                  </PhotoOpenContext.Provider>
                </PhotosProvider>
              )
            : (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/12 text-sm text-white/55">
                  <p>这个{kind === 'album' ? '摄影集' : '分类'}还没有照片</p>
                  <a href="/console" className="text-[var(--color-accent)] hover:underline">去附件库添加照片</a>
                </div>
              )}
        </main>
      </div>

      {viewer && typeof document !== 'undefined' && createPortal(
        <RemoveScroll className="fixed inset-0 z-9999" allowPinchZoom>
          <PhotoViewer
            photos={photos}
            currentIndex={viewer.index}
            isOpen={isOpen}
            triggerElement={viewer.triggerElement}
            onClose={closeViewer}
            onIndexChange={index => setViewer(prev => (prev ? { ...prev, index } : prev))}
            onExitComplete={handleExitComplete}
          />
        </RemoveScroll>,
        document.body,
      )}
    </div>
  )
}
