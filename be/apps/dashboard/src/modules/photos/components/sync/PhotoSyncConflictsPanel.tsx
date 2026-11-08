import { Button, Checkbox, Prompt } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'
import { startTransition, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getRequestErrorMessage } from '~/lib/errors'

import { getConflictTypeLabel, PHOTO_CONFLICT_TYPE_CONFIG } from '../../constants'
import type { PhotoSyncConflict, PhotoSyncResolution, PhotoSyncSnapshot } from '../../types'
import { BorderOverlay, MetadataSnapshot } from './PhotoSyncResultPanel'

const photoSyncConflictsKeys = {
  title: 'photos.sync.conflicts.title',
  description: 'photos.sync.conflicts.description',
  total: 'photos.sync.conflicts.total',
  selection: {
    selected: 'photos.sync.conflicts.selection.selected',
    none: 'photos.sync.conflicts.selection.none',
    clear: 'photos.sync.conflicts.selection.clear',
  },
  strategy: {
    storage: 'photos.sync.conflicts.strategy.storage',
    database: 'photos.sync.conflicts.strategy.database',
  },
  actions: {
    selectedStorage: 'photos.sync.conflicts.actions.selected-storage',
    selectedDatabase: 'photos.sync.conflicts.actions.selected-database',
    allStorage: 'photos.sync.conflicts.actions.all-storage',
    allDatabase: 'photos.sync.conflicts.actions.all-database',
    preferStorage: 'photos.sync.conflicts.actions.prefer-storage',
    preferDatabase: 'photos.sync.conflicts.actions.prefer-database',
    viewDetails: 'photos.sync.conflicts.actions.view-details',
    hideDetails: 'photos.sync.conflicts.actions.hide-details',
    clearSelection: 'photos.sync.conflicts.actions.clear-selection',
    openStorage: 'photos.sync.conflicts.actions.open-storage',
    viewOriginal: 'photos.sync.conflicts.actions.view-original',
  },
  prompts: {
    title: 'photos.sync.conflicts.prompts.title',
    confirm: 'photos.sync.conflicts.prompts.confirm',
    cancel: 'photos.sync.conflicts.prompts.cancel',
    scopeAll: 'photos.sync.conflicts.prompts.scope-all',
    scopeSelected: 'photos.sync.conflicts.prompts.scope-selected',
    bulk: 'photos.sync.conflicts.prompts.bulk',
    single: 'photos.sync.conflicts.prompts.single',
  },
  toast: {
    selectRequired: 'photos.sync.conflicts.toast.select-required',
    none: 'photos.sync.conflicts.toast.none',
    noOriginal: 'photos.sync.conflicts.toast.no-original',
    openStorageFailed: 'photos.sync.conflicts.toast.open-storage-failed',
  },
  info: {
    lastUpdated: 'photos.sync.conflicts.info.last-updated',
    firstDetected: 'photos.sync.conflicts.info.first-detected',
    storageKey: 'photos.sync.conflicts.info.storage-key',
    conflictKey: 'photos.sync.conflicts.info.conflict-key',
    photoIdFallback: 'photos.sync.conflicts.info.photo-id-fallback',
  },
  preview: {
    databaseTitle: 'photos.sync.conflicts.preview.database.title',
    databaseEmpty: 'photos.sync.conflicts.preview.database.empty',
    storageTitle: 'photos.sync.conflicts.preview.storage.title',
    storageKey: 'photos.sync.conflicts.preview.storage.key',
    idLabel: 'photos.sync.conflicts.preview.common.id',
    dimensions: 'photos.sync.conflicts.preview.common.dimensions',
    size: 'photos.sync.conflicts.preview.common.size',
    updatedAt: 'photos.sync.conflicts.preview.common.updated-at',
  },
  metadata: {
    database: 'photos.sync.metadata.database',
    storage: 'photos.sync.metadata.storage',
    size: 'photos.sync.metadata.size',
    etag: 'photos.sync.metadata.etag',
    updatedAt: 'photos.sync.metadata.updated-at',
    hash: 'photos.sync.metadata.hash',
    unknown: 'photos.sync.metadata.unknown',
    none: 'photos.sync.metadata.none',
  },
} as const satisfies {
  title: I18nKeys
  description: I18nKeys
  total: I18nKeys
  selection: { selected: I18nKeys; none: I18nKeys; clear: I18nKeys }
  strategy: { storage: I18nKeys; database: I18nKeys }
  actions: {
    selectedStorage: I18nKeys
    selectedDatabase: I18nKeys
    allStorage: I18nKeys
    allDatabase: I18nKeys
    preferStorage: I18nKeys
    preferDatabase: I18nKeys
    viewDetails: I18nKeys
    hideDetails: I18nKeys
    clearSelection: I18nKeys
    openStorage: I18nKeys
    viewOriginal: I18nKeys
  }
  prompts: {
    title: I18nKeys
    confirm: I18nKeys
    cancel: I18nKeys
    scopeAll: I18nKeys
    scopeSelected: I18nKeys
    bulk: I18nKeys
    single: I18nKeys
  }
  toast: {
    selectRequired: I18nKeys
    none: I18nKeys
    noOriginal: I18nKeys
    openStorageFailed: I18nKeys
  }
  info: {
    lastUpdated: I18nKeys
    firstDetected: I18nKeys
    storageKey: I18nKeys
    conflictKey: I18nKeys
    photoIdFallback: I18nKeys
  }
  preview: {
    databaseTitle: I18nKeys
    databaseEmpty: I18nKeys
    storageTitle: I18nKeys
    storageKey: I18nKeys
    idLabel: I18nKeys
    dimensions: I18nKeys
    size: I18nKeys
    updatedAt: I18nKeys
  }
  metadata: {
    database: I18nKeys
    storage: I18nKeys
    size: I18nKeys
    etag: I18nKeys
    updatedAt: I18nKeys
    hash: I18nKeys
    unknown: I18nKeys
    none: I18nKeys
  }
}

type PhotoSyncConflictsPanelProps = {
  conflicts?: PhotoSyncConflict[]
  isLoading?: boolean
  resolvingId?: string | null
  isBatchResolving?: boolean
  onResolve?: (conflict: PhotoSyncConflict, strategy: PhotoSyncResolution) => Promise<void>
  onResolveBatch?: (conflicts: PhotoSyncConflict[], strategy: PhotoSyncResolution) => Promise<void>
  onRequestStorageUrl?: (storageKey: string) => Promise<string>
}

export function PhotoSyncConflictsPanel({
  conflicts,
  isLoading,
  resolvingId,
  isBatchResolving,
  onResolve,
  onResolveBatch,
  onRequestStorageUrl,
}: PhotoSyncConflictsPanelProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language ?? i18n.resolvedLanguage ?? 'en'
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  )
  const formatDate = (value: string | null | undefined) => {
    if (!value) {
      return t('common.unknown')
    }
    try {
      return dateTimeFormatter.format(new Date(value))
    } catch {
      return value
    }
  }
  const sortedConflicts = useMemo(() => {
    if (!conflicts) return []
    return conflicts.toSorted((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [conflicts])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    startTransition(() => {
      setSelectedIds((prev) => {
        if (prev.size === 0) {
          return prev
        }
        const next = new Set<string>()
        for (const conflict of sortedConflicts) {
          if (prev.has(conflict.id)) {
            next.add(conflict.id)
          }
        }
        if (next.size === prev.size) {
          let unchanged = true
          for (const id of prev) {
            if (!next.has(id)) {
              unchanged = false
              break
            }
          }
          if (unchanged) {
            return prev
          }
        }
        return next
      })
    })
  }, [sortedConflicts])

  const selectedConflicts = useMemo(
    () => sortedConflicts.filter((conflict) => selectedIds.has(conflict.id)),
    [sortedConflicts, selectedIds],
  )

  const hasSelection = selectedIds.size > 0
  const isAllSelected = sortedConflicts.length > 0 && selectedIds.size === sortedConflicts.length
  const allCheckboxState = isAllSelected ? true : hasSelection ? ('indeterminate' as const) : false

  const isProcessing = Boolean(resolvingId) || Boolean(isBatchResolving)

  const toggleSelection = (conflictId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(conflictId)
      } else {
        next.delete(conflictId)
      }
      return next
    })
  }

  const toggleAllSelection = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedConflicts.map((conflict) => conflict.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const toggleExpand = (conflictId: string) => {
    setExpandedId((prev) => (prev === conflictId ? null : conflictId))
  }

  const handleOpenStorage = async (storageKey?: string | null) => {
    if (!storageKey || !onRequestStorageUrl) return
    try {
      const url = await onRequestStorageUrl(storageKey)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      const fallback = t(photoSyncConflictsKeys.toast.openStorageFailed)
      const message = getRequestErrorMessage(error, fallback)
      toast.error(fallback, { description: message })
    }
  }

  const handleOpenManifest = (manifest?: PhotoSyncConflict['manifest']['data']) => {
    if (!manifest) {
      toast.info(t(photoSyncConflictsKeys.toast.noOriginal))
      return
    }
    const candidate = manifest.originalUrl ?? manifest.thumbnailUrl
    if (!candidate) {
      toast.info(t(photoSyncConflictsKeys.toast.noOriginal))
      return
    }
    window.open(candidate, '_blank', 'noopener,noreferrer')
  }

  const runBatchResolve = async (
    targets: PhotoSyncConflict[],
    strategy: PhotoSyncResolution,
    shouldClearSelection: boolean,
  ) => {
    if (targets.length === 0) {
      toast.info(t(photoSyncConflictsKeys.toast.selectRequired))
      return
    }

    if (onResolveBatch) {
      try {
        await onResolveBatch(targets, strategy)
        if (shouldClearSelection) {
          setSelectedIds(new Set())
        }
      } catch {
        // Error handling handled by caller
      }
      return
    }

    if (!onResolve) {
      return
    }

    for (const conflict of targets) {
      await onResolve(conflict, strategy)
    }

    if (shouldClearSelection) {
      setSelectedIds(new Set())
    }
  }

  const confirmAction = (message: string, onConfirm: () => void | Promise<void>) => {
    Prompt.prompt({
      title: t(photoSyncConflictsKeys.prompts.title),
      description: message,
      onConfirmText: t(photoSyncConflictsKeys.prompts.confirm),
      onCancelText: t(photoSyncConflictsKeys.prompts.cancel),
      onConfirm: async () => {
        await onConfirm()
      },
    })
  }

  const getStrategyLabel = (strategy: PhotoSyncResolution) =>
    strategy === 'prefer-storage'
      ? t(photoSyncConflictsKeys.strategy.storage)
      : t(photoSyncConflictsKeys.strategy.database)

  const buildBulkConfirmMessage = (strategy: PhotoSyncResolution, scope: 'all' | 'selected', count: number) => {
    const scopeLabel =
      scope === 'all'
        ? t(photoSyncConflictsKeys.prompts.scopeAll)
        : t(photoSyncConflictsKeys.prompts.scopeSelected, { count })
    return t(photoSyncConflictsKeys.prompts.bulk, {
      scope: scopeLabel,
      strategy: getStrategyLabel(strategy),
    })
  }

  const buildSingleConfirmMessage = (strategy: PhotoSyncResolution, conflict: PhotoSyncConflict) => {
    const identifier = conflict.photoId ?? conflict.id
    return t(photoSyncConflictsKeys.prompts.single, {
      identifier,
      strategy: getStrategyLabel(strategy),
    })
  }

  const handleAcceptSelected = async (strategy: PhotoSyncResolution) => {
    if (selectedConflicts.length === 0) {
      toast.info(t(photoSyncConflictsKeys.toast.selectRequired))
      return
    }

    return confirmAction(buildBulkConfirmMessage(strategy, 'selected', selectedConflicts.length), async () => {
      await runBatchResolve(selectedConflicts, strategy, true)
    })
  }

  const handleAcceptAll = async (strategy: PhotoSyncResolution) => {
    if (sortedConflicts.length === 0) {
      toast.info(t(photoSyncConflictsKeys.toast.none))
      return
    }

    return confirmAction(buildBulkConfirmMessage(strategy, 'all', sortedConflicts.length), async () => {
      await runBatchResolve(sortedConflicts, strategy, true)
    })
  }

  const handleResolve = async (conflict: PhotoSyncConflict, strategy: PhotoSyncResolution) => {
    if (!onResolve) return

    return confirmAction(buildSingleConfirmMessage(strategy, conflict), async () => {
      await onResolve(conflict, strategy)
      setSelectedIds((prev) => {
        if (!prev.has(conflict.id)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(conflict.id)
        return next
      })
    })
  }

  if (!isLoading && sortedConflicts.length === 0) {
    return null
  }

  return (
    <div className="bg-background-tertiary relative overflow-hidden rounded-lg">
      <BorderOverlay />
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-text text-base font-semibold">{t(photoSyncConflictsKeys.title)}</h3>
            <p className="text-text-tertiary mt-1 text-sm">{t(photoSyncConflictsKeys.description)}</p>
          </div>
          <span className="text-text-tertiary text-xs">
            {t(photoSyncConflictsKeys.total, { count: sortedConflicts.length })}
          </span>
        </div>

        {isLoading ? (
          <div className="mt-6 grid gap-3">
            {[...Array.from({ length: 3 }).keys()].map((index) => (
              <div key={`conflict-skeleton-${index}`} className="bg-fill/20 h-28 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allCheckboxState}
                  disabled={isProcessing || sortedConflicts.length === 0}
                  onCheckedChange={(checked) => toggleAllSelection(Boolean(checked))}
                />
                <span className="text-text-tertiary text-xs">
                  {hasSelection
                    ? t(photoSyncConflictsKeys.selection.selected, { count: selectedIds.size })
                    : t(photoSyncConflictsKeys.selection.none)}
                </span>
                {hasSelection ? (
                  <Button type="button" variant="ghost" size="xs" disabled={isProcessing} onClick={clearSelection}>
                    {t(photoSyncConflictsKeys.actions.clearSelection)}
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {hasSelection ? (
                  <>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={isProcessing}
                      onClick={() => void handleAcceptSelected('prefer-storage')}
                    >
                      {t(photoSyncConflictsKeys.actions.selectedStorage)}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={isProcessing}
                      onClick={() => void handleAcceptSelected('prefer-database')}
                    >
                      {t(photoSyncConflictsKeys.actions.selectedDatabase)}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={isProcessing || sortedConflicts.length === 0}
                      onClick={() => void handleAcceptAll('prefer-storage')}
                    >
                      {t(photoSyncConflictsKeys.actions.allStorage)}
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={isProcessing || sortedConflicts.length === 0}
                      onClick={() => void handleAcceptAll('prefer-database')}
                    >
                      {t(photoSyncConflictsKeys.actions.allDatabase)}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {sortedConflicts.map((conflict, index) => {
                const { payload } = conflict
                const typeLabel = getConflictTypeLabel(payload?.type)
                const typeConfig = payload?.type ? PHOTO_CONFLICT_TYPE_CONFIG[payload.type] : null
                const isSelected = selectedIds.has(conflict.id)
                const isResolving = Boolean(isBatchResolving) || resolvingId === conflict.id
                const storageKey = payload?.incomingStorageKey ?? conflict.storageKey

                return (
                  <m.div
                    key={`${conflict.id}-${conflict.updatedAt}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      ...Spring.presets.smooth,
                      delay: index * 0.04,
                    }}
                    className="border-border/20 bg-fill/10 relative overflow-hidden rounded-lg border"
                  >
                    <BorderOverlay />
                    <div className="flex items-start gap-3 p-5">
                      <Checkbox
                        checked={isSelected}
                        disabled={isProcessing}
                        onCheckedChange={(checked) => toggleSelection(conflict.id, Boolean(checked))}
                      />
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
                              {typeLabel}
                            </span>
                            <code className="text-text-secondary text-xs">
                              {conflict.photoId ?? t(photoSyncConflictsKeys.info.photoIdFallback)}
                            </code>
                            {typeConfig ? (
                              <span className="text-text-tertiary text-xs">{t(typeConfig.descriptionKey)}</span>
                            ) : null}
                          </div>
                          <div className="text-text-tertiary flex flex-wrap justify-end gap-2 text-xs">
                            <span>
                              {t(photoSyncConflictsKeys.info.lastUpdated, { time: formatDate(conflict.updatedAt) })}
                            </span>
                            <span>
                              {t(photoSyncConflictsKeys.info.firstDetected, { time: formatDate(conflict.syncedAt) })}
                            </span>
                          </div>
                        </div>

                        <div className="text-text-tertiary flex flex-wrap gap-3 text-xs">
                          <span>
                            {t(photoSyncConflictsKeys.info.storageKey)}
                            <code className="text-text ml-1 font-mono text-[11px]">{conflict.storageKey}</code>
                          </span>
                          {payload?.incomingStorageKey ? (
                            <span>
                              {t(photoSyncConflictsKeys.info.conflictKey)}
                              <code className="text-text ml-1 font-mono text-[11px]">{payload.incomingStorageKey}</code>
                            </span>
                          ) : null}
                        </div>

                        {expandedId === conflict.id ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <ConflictManifestPreview
                                manifest={conflict.manifest?.data}
                                disabled={isProcessing}
                                onOpenOriginal={() => handleOpenManifest(conflict.manifest?.data)}
                              />
                              <ConflictStoragePreview
                                storageKey={storageKey}
                                snapshot={payload?.storageSnapshot ?? null}
                                disabled={isProcessing}
                                onOpenStorage={() => void handleOpenStorage(storageKey)}
                              />
                            </div>
                            <div className="text-text-tertiary grid gap-3 text-xs md:grid-cols-2">
                              <div>
                                <p className="text-text font-semibold">{t(photoSyncConflictsKeys.metadata.database)}</p>
                                <MetadataSnapshot snapshot={payload?.recordSnapshot ?? null} />
                              </div>
                              <div>
                                <p className="text-text font-semibold">{t(photoSyncConflictsKeys.metadata.storage)}</p>
                                <MetadataSnapshot snapshot={payload?.storageSnapshot ?? null} />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            disabled={isResolving || isProcessing}
                            onClick={() => void handleResolve(conflict, 'prefer-storage')}
                          >
                            {t(photoSyncConflictsKeys.actions.preferStorage)}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            disabled={isResolving || isProcessing}
                            onClick={() => void handleResolve(conflict, 'prefer-database')}
                          >
                            {t(photoSyncConflictsKeys.actions.preferDatabase)}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="primary"
                            disabled={isProcessing}
                            onClick={() => toggleExpand(conflict.id)}
                          >
                            {expandedId === conflict.id
                              ? t(photoSyncConflictsKeys.actions.hideDetails)
                              : t(photoSyncConflictsKeys.actions.viewDetails)}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </m.div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ConflictManifestPreview({
  manifest,
  disabled,
  onOpenOriginal,
}: {
  manifest: PhotoSyncConflict['manifest']['data'] | null | undefined
  disabled?: boolean
  onOpenOriginal?: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language ?? i18n.resolvedLanguage ?? 'en'
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  )
  if (!manifest) {
    return (
      <div className="border-border/20 bg-background-secondary/60 text-text-tertiary rounded-md border p-3 text-xs">
        <p className="text-text text-sm font-semibold">{t(photoSyncConflictsKeys.preview.databaseTitle)}</p>
        <p className="mt-1">{t(photoSyncConflictsKeys.preview.databaseEmpty)}</p>
      </div>
    )
  }

  const dimensions = manifest.width && manifest.height ? `${manifest.width} × ${manifest.height}` : t('common.unknown')
  const sizeMB =
    typeof manifest.size === 'number' && manifest.size > 0
      ? `${(manifest.size / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 2 })} MB`
      : t('common.unknown')
  const updatedAt = manifest.lastModified
    ? dateTimeFormatter.format(new Date(manifest.lastModified))
    : t('common.unknown')

  return (
    <div className="border-border/20 bg-background-secondary/60 text-text-tertiary rounded-md border p-3 text-xs">
      <div className="flex items-center gap-3">
        {manifest.thumbnailUrl ? (
          <img src={manifest.thumbnailUrl} alt={manifest.id} className="h-16 w-20 rounded-md object-cover" />
        ) : null}
        <div className="space-y-1">
          <p className="text-text text-sm font-semibold">{t(photoSyncConflictsKeys.preview.databaseTitle)}</p>
          <div className="flex items-center gap-2">
            <span className="text-text">{t(photoSyncConflictsKeys.preview.idLabel)}</span>
            <span className="truncate">{manifest.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text">{t(photoSyncConflictsKeys.preview.dimensions)}</span>
            <span>{dimensions}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text">{t(photoSyncConflictsKeys.preview.size)}</span>
            <span>{sizeMB}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text">{t(photoSyncConflictsKeys.preview.updatedAt)}</span>
            <span>{updatedAt}</span>
          </div>
        </div>
      </div>
      {onOpenOriginal ? (
        <Button type="button" variant="ghost" size="xs" className="mt-3" disabled={disabled} onClick={onOpenOriginal}>
          {t(photoSyncConflictsKeys.actions.viewOriginal)}
        </Button>
      ) : null}
    </div>
  )
}

function ConflictStoragePreview({
  storageKey,
  snapshot,
  disabled,
  onOpenStorage,
}: {
  storageKey: string
  snapshot: PhotoSyncSnapshot | null | undefined
  disabled?: boolean
  onOpenStorage?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="border-border/20 bg-background-secondary/60 text-text-tertiary rounded-md border p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="text-text text-sm font-semibold">{t(photoSyncConflictsKeys.preview.storageTitle)}</p>
        {onOpenStorage ? (
          <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={onOpenStorage}>
            {t(photoSyncConflictsKeys.actions.openStorage)}
          </Button>
        ) : null}
      </div>
      <p className="mt-1 break-all">
        {t(photoSyncConflictsKeys.preview.storageKey)}
        <span className="text-text font-mono text-[11px]">{storageKey}</span>
      </p>
      <MetadataSnapshot snapshot={snapshot ?? null} />
    </div>
  )
}
