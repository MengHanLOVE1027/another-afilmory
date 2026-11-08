import { useTranslation } from 'react-i18next'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import { DataManagementPanel } from '~/modules/data-management'
import { SettingsNavigation } from '~/modules/settings'

export function Component() {
  const { t } = useTranslation()
  return (
    <MainPageLayout title={t('settings.data.title')} description={t('settings.data.description')}>
      <div className="space-y-6">
        <SettingsNavigation active="data" />
        <DataManagementPanel />
      </div>
    </MainPageLayout>
  )
}
