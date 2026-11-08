import { useTranslation } from 'react-i18next'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import { SocialConnectionSettings } from '~/modules/auth/components/SocialConnectionSettings'
import { SettingsNavigation } from '~/modules/settings'

export function Component() {
  const { t } = useTranslation()
  return (
    <MainPageLayout title={t('settings.account.title')} description={t('settings.account.description')}>
      <div className="space-y-6">
        <SettingsNavigation active="account" />
        <SocialConnectionSettings />
      </div>
    </MainPageLayout>
  )
}
