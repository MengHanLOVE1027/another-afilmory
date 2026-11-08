import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
export const MANIFEST_PATH = path.resolve(dirname, '../../../../../packages/data/src/photos-manifest.json')

export const MONOREPO_ROOT_PATH = path.resolve(dirname, '../../../../..')
