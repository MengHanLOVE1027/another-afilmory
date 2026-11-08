import i18next from 'i18next'
import { useAtom } from 'jotai'
import type { FC, PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'

import { EventBus } from '~/lib/event-bus'

import { i18nAtom } from '../i18n'

export const I18nProvider: FC<PropsWithChildren> = ({ children }) => {
  const [currentI18nInstance, setInstance] = useAtom(i18nAtom)

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    return EventBus.subscribe('I18N_UPDATE', () => {
      const nextI18n = i18next.cloneInstance({})
      setInstance(nextI18n)
    })
  }, [setInstance])

  return <I18nextProvider i18n={currentI18nInstance}>{children}</I18nextProvider>
}

declare module '~/lib/event-bus' {
  interface CustomEvent {
    I18N_UPDATE: string
  }
}
