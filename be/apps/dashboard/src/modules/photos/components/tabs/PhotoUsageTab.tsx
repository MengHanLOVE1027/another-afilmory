import { usePhotoUsageOverviewQuery } from '../../hooks'
import { PhotoPageScaffold } from '../PhotoPageScaffold'
import { PhotoUsagePanel } from '../usage/PhotoUsagePanel'

export function PhotoUsageTab() {
  const usageOverviewQuery = usePhotoUsageOverviewQuery({
    enabled: true,
    limit: 100,
  })

  return (
    <PhotoPageScaffold activeTab="usage">
      <PhotoUsagePanel
        overview={usageOverviewQuery.data}
        isLoading={usageOverviewQuery.isLoading}
        isFetching={usageOverviewQuery.isFetching}
        onRefresh={() => usageOverviewQuery.refetch()}
      />
    </PhotoPageScaffold>
  )
}
