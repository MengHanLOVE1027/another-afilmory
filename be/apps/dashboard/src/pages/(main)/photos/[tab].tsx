import { redirect } from 'react-router'

import { PhotoPage } from '~/modules/photos'

const VALID_TABS = ['sync', 'library', 'storage', 'usage'] as const
const isValidTab = (value: string | undefined): value is (typeof VALID_TABS)[number] =>
  VALID_TABS.includes(value as (typeof VALID_TABS)[number])

export function Component() {
  return <PhotoPage />
}

export const loader = ({
  params,
}: {
  params: {
    tab?: string
  }
}) => {
  const { tab } = params

  if (!isValidTab(tab)) {
    return redirect(`/photos/sync`)
  }

  return null
}
