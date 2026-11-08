import { getI18n } from '~/i18n'

import type { BillingUsageEventType, PhotoSyncAction, PhotoSyncConflictType } from './types'

const photoConflictKeys = {
  generic: 'photos.conflict.generic',
} as const

export const PHOTO_CONFLICT_TYPE_CONFIG: Record<
  PhotoSyncConflictType,
  { labelKey: I18nKeys; descriptionKey: I18nKeys }
> = {
  'missing-in-storage': {
    labelKey: 'photos.conflict.missing.label',
    descriptionKey: 'photos.conflict.missing.description',
  },
  'metadata-mismatch': {
    labelKey: 'photos.conflict.metadata.label',
    descriptionKey: 'photos.conflict.metadata.description',
  },
  'photo-id-conflict': {
    labelKey: 'photos.conflict.id.label',
    descriptionKey: 'photos.conflict.id.description',
  },
}

export function getConflictTypeLabel(type: PhotoSyncConflictType | null | undefined): string {
  const i18n = getI18n()
  if (!type) {
    return i18n.t(photoConflictKeys.generic)
  }
  const key = PHOTO_CONFLICT_TYPE_CONFIG[type]?.labelKey
  return key ? i18n.t(key) : i18n.t(photoConflictKeys.generic)
}

export function getActionTypeMeta(type: PhotoSyncAction['type']) {
  const i18n = getI18n()
  const config = PHOTO_ACTION_TYPE_CONFIG[type]
  if (!config) {
    return { label: type, badgeClass: '' }
  }
  return { label: i18n.t(config.labelKey), badgeClass: config.badgeClass }
}

export const PHOTO_ACTION_TYPE_CONFIG: Record<PhotoSyncAction['type'], { labelKey: I18nKeys; badgeClass: string }> = {
  insert: { labelKey: 'photos.actions.insert', badgeClass: 'bg-emerald-500/10 text-emerald-400' },
  update: { labelKey: 'photos.actions.update', badgeClass: 'bg-sky-500/10 text-sky-400' },
  delete: { labelKey: 'photos.actions.delete', badgeClass: 'bg-rose-500/10 text-rose-400' },
  conflict: { labelKey: 'photos.actions.conflict', badgeClass: 'bg-amber-500/10 text-amber-400' },
  error: { labelKey: 'photos.actions.error', badgeClass: 'bg-rose-500/20 text-rose-200' },
  noop: { labelKey: 'photos.actions.noop', badgeClass: 'bg-slate-500/10 text-slate-400' },
}

export const BILLING_USAGE_EVENT_CONFIG: Record<
  BillingUsageEventType,
  { labelKey: I18nKeys; descriptionKey: I18nKeys; tone: 'accent' | 'warning' | 'muted' }
> = {
  'photo.asset.created': {
    labelKey: 'photos.usage.photo-created.label',
    descriptionKey: 'photos.usage.photo-created.description',
    tone: 'accent',
  },
  'photo.asset.deleted': {
    labelKey: 'photos.usage.photo-deleted.label',
    descriptionKey: 'photos.usage.photo-deleted.description',
    tone: 'warning',
  },
  'data.sync.completed': {
    labelKey: 'photos.usage.sync-completed.label',
    descriptionKey: 'photos.usage.sync-completed.description',
    tone: 'muted',
  },
}

export function getUsageEventLabel(eventType: BillingUsageEventType): string {
  const i18n = getI18n()
  const key = BILLING_USAGE_EVENT_CONFIG[eventType]?.labelKey
  return key ? i18n.t(key) : eventType
}

export function getUsageEventDescription(eventType: BillingUsageEventType): string {
  const i18n = getI18n()
  const key = BILLING_USAGE_EVENT_CONFIG[eventType]?.descriptionKey ?? null
  return key ? i18n.t(key) : ''
}
