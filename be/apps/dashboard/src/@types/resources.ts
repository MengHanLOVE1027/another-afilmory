import en from '@locales/dashboard/en.json'
import zhCn from '@locales/dashboard/zh-CN.json'

import type { DashboardSupportedLanguages, ns } from './constants'

export const resources = {
  en: {
    dashboard: en,
  },
  'zh-CN': {
    dashboard: zhCn,
  },
} satisfies Record<DashboardSupportedLanguages, Record<(typeof ns)[number], Record<string, string>>>
