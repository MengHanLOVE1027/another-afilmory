import { useTranslation } from 'react-i18next'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import { BuilderSettingsForm } from '~/modules/builder-settings'

export function Component() {
  const { t } = useTranslation()
  return (
    <MainPageLayout title={t('superadmin.builder.title')}>
      <BuilderSettingsForm />
    </MainPageLayout>
  )
}
