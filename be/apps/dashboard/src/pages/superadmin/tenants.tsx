import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { SuperAdminTenantManager } from '~/modules/super-admin'

export function Component() {
  const { t } = useTranslation()
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="space-y-6 mx-[calc(1/2*-1*(100vw-min(var(--container-5xl),100vw)))]"
    >
      <header className="space-y-2">
        <h1 className="text-text text-2xl font-semibold">{t('superadmin.tenants.title')}</h1>
        <p className="text-text-secondary text-sm">{t('superadmin.tenants.description')}</p>
      </header>

      <SuperAdminTenantManager />
    </m.div>
  )
}
