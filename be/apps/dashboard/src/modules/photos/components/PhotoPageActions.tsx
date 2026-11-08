import type { ReactNode } from 'react'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'

import { PhotoLibraryActionBar } from './library/PhotoLibraryActionBar'
import type { PhotoPageTab } from './PhotoPageTabs'
import { PhotoSyncActions } from './sync/PhotoSyncActions'

type PhotoPageActionsProps = {
  activeTab: PhotoPageTab
}

export function PhotoPageActions({ activeTab }: PhotoPageActionsProps) {
  if (activeTab === 'storage' || activeTab === 'usage') {
    return null
  }

  let actionContent: ReactNode | null = null

  switch (activeTab) {
    case 'sync': {
      actionContent = <PhotoSyncActions />
      break
    }
    case 'library': {
      actionContent = <PhotoLibraryActionBar />
      break
    }
    default: {
      actionContent = null
    }
  }

  if (!actionContent) {
    return null
  }

  return <MainPageLayout.Actions>{actionContent}</MainPageLayout.Actions>
}
