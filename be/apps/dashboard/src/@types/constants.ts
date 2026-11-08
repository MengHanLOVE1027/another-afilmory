const langs = ['en', 'zh-CN'] as const

export const currentSupportedLanguages = [...langs].sort() as string[]
export type DashboardSupportedLanguages = (typeof langs)[number]

export const ns = ['dashboard'] as const
export const defaultNS = 'dashboard' as const
