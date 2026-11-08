import { atom } from 'jotai'

import { createAtomHooks } from '~/lib/jotai'

export type PhotoSyncAutoRunMode = 'dry-run' | 'apply' | null

const basePhotoSyncAutoRunAtom = atom<PhotoSyncAutoRunMode>(null)

export const [
  photoSyncAutoRunAtom,
  usePhotoSyncAutoRun,
  usePhotoSyncAutoRunValue,
  useSetPhotoSyncAutoRun,
  getPhotoSyncAutoRun,
  setPhotoSyncAutoRun,
] = createAtomHooks(basePhotoSyncAutoRunAtom)
