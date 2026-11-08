import { Modal, Prompt } from '@afilmory/ui'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useBeforeUnload, useBlocker } from 'react-router'

type UseBlockOptions = {
  when: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'info'
  beforeUnloadMessage?: string
}

const blockerI18nKeys = {
  title: 'blocker.unsaved.title',
  description: 'blocker.unsaved.description',
  confirm: 'blocker.unsaved.confirm',
  cancel: 'blocker.unsaved.cancel',
  beforeUnload: 'blocker.unsaved.before-unload',
} as const

export function useBlock({
  when,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'danger',
  beforeUnloadMessage,
}: UseBlockOptions) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t(blockerI18nKeys.title)
  const resolvedDescription = description ?? t(blockerI18nKeys.description)
  const resolvedConfirmText = confirmText ?? t(blockerI18nKeys.confirm)
  const resolvedCancelText = cancelText ?? t(blockerI18nKeys.cancel)
  const resolvedBeforeUnload = beforeUnloadMessage ?? t(blockerI18nKeys.beforeUnload)
  const promptIdRef = useRef<string | null>(null)
  const isPromptOpenRef = useRef(false)

  const blocker = useBlocker(when)

  const closePrompt = useCallback((dismissModal = false) => {
    if (!isPromptOpenRef.current) {
      promptIdRef.current = null
      return
    }

    if (dismissModal && promptIdRef.current) {
      Modal.dismiss(promptIdRef.current)
    }

    promptIdRef.current = null
    isPromptOpenRef.current = false
  }, [])

  const openPrompt = useCallback(() => {
    if (isPromptOpenRef.current) {
      return
    }

    if (blocker.state !== 'blocked') {
      return
    }

    isPromptOpenRef.current = true
    promptIdRef.current = Prompt.prompt({
      title: resolvedTitle,
      description: resolvedDescription,
      onConfirmText: resolvedConfirmText,
      onCancelText: resolvedCancelText,
      variant,
      onConfirm: async () => {
        closePrompt()
        blocker.proceed?.()
      },
      onCancel: async () => {
        closePrompt()
        blocker.reset?.()
      },
    })
  }, [blocker, closePrompt, resolvedCancelText, resolvedConfirmText, resolvedDescription, resolvedTitle, variant])

  useEffect(() => {
    if (!when) {
      if (blocker.state === 'blocked') {
        blocker.reset?.()
      }
      closePrompt(true)
      return
    }

    if (blocker.state === 'blocked') {
      openPrompt()
      return
    }

    if (blocker.state === 'unblocked' || blocker.state === 'proceeding') {
      closePrompt()
    }
  }, [blocker, closePrompt, openPrompt, when])

  useBeforeUnload((event) => {
    if (!when) {
      return
    }

    event.preventDefault()
    event.returnValue = resolvedBeforeUnload
  })
}
