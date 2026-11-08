import { StorageProvidersManager } from '~/modules/storage-providers'

import { PhotoPageScaffold } from '../PhotoPageScaffold'

export function PhotoStorageTab() {
  return (
    <PhotoPageScaffold activeTab="storage">
      <StorageProvidersManager />
    </PhotoPageScaffold>
  )
}
