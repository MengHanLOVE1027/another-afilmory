import { useTranslation } from 'react-i18next'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import { SettingsNavigation } from '~/modules/settings'
import { SiteSettingsForm } from '~/modules/site-settings'

export function Component() {
  const { t } = useTranslation()
  return (
    <MainPageLayout title={t('settings.site.title')} description={t('settings.site.description')}>
      <div className="space-y-6">
        <SettingsNavigation active="site" />
        <SiteSettingsForm />
      </div>
    </MainPageLayout>
  )
}
