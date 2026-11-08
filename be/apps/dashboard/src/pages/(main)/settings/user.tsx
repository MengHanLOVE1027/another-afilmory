import { useTranslation } from 'react-i18next'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import { SettingsNavigation } from '~/modules/settings'
import { SiteUserProfileForm } from '~/modules/site-settings'

export function Component() {
  const { t } = useTranslation()
  return (
    <MainPageLayout title={t('settings.user.title')} description={t('settings.user.description')}>
      <div className="space-y-6">
        <SettingsNavigation active="user" />
        <SiteUserProfileForm />
      </div>
    </MainPageLayout>
  )
}
