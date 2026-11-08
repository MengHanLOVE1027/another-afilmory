import type { ReactNode } from 'react'
import { createContext, use } from 'react'

import type { PhotoSyncProgressEvent, PhotoSyncResult } from '../../types'

type PhotoSyncControllerContextValue = {
  onCompleted: (result: PhotoSyncResult, context: { dryRun: boolean }) => void
  onProgress: (event: PhotoSyncProgressEvent) => void
  onError: (error: Error) => void
}

const PhotoSyncControllerContext = createContext<PhotoSyncControllerContextValue | null>(null)

type PhotoSyncControllerProviderProps = {
  value: PhotoSyncControllerContextValue
  children: ReactNode
}

export function PhotoSyncControllerProvider({ value, children }: PhotoSyncControllerProviderProps) {
  return <PhotoSyncControllerContext value={value}>{children}</PhotoSyncControllerContext>
}

export function usePhotoSyncController() {
  const context = use(PhotoSyncControllerContext)
  if (!context) {
    throw new Error('PhotoSyncControllerProvider is missing in the component tree')
  }
  return context
}
