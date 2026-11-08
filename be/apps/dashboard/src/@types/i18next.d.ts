import type { defaultNS, ns } from './constants'
import type { resources } from './resources'

declare module 'i18next' {
  interface CustomTypeOptions {
    ns: typeof ns
    defaultNS: typeof defaultNS
    resources: (typeof resources)['en']
  }
}
