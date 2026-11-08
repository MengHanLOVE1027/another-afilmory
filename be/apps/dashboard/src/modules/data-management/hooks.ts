import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ROUTE_PATHS } from '~/constants/routes'
import { getRequestErrorMessage } from '~/lib/errors'
import { AUTH_SESSION_QUERY_KEY } from '~/modules/auth/api/session'
import { signOutBySource } from '~/modules/auth/auth-client'
import { DASHBOARD_OVERVIEW_QUERY_KEY } from '~/modules/dashboard/hooks'
import { PHOTO_ASSET_LIST_QUERY_KEY, PHOTO_ASSET_SUMMARY_QUERY_KEY } from '~/modules/photos/hooks'

import { deleteTenantAccount, truncatePhotoAssetRecords } from './api'

export function useTruncatePhotoAssetsMutation() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: truncatePhotoAssetRecords,
    onSuccess: async (result) => {
      toast.success(t('data-management.truncate.success.title'), {
        description:
          result.deleted > 0
            ? t('data-management.truncate.success.deleted', { count: result.deleted })
            : t('data-management.truncate.success.empty'),
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PHOTO_ASSET_LIST_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: PHOTO_ASSET_SUMMARY_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DASHBOARD_OVERVIEW_QUERY_KEY }),
      ])
    },
    onError: (error) => {
      const message = getRequestErrorMessage(error, t('data-management.truncate.error.fallback'))
      toast.error(t('data-management.truncate.error.title'), { description: message })
    },
  })
}

export function useDeleteTenantAccountMutation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: deleteTenantAccount,
    onSuccess: async () => {
      toast.success(t('data-management.delete.success.title'), {
        description: t('data-management.delete.success.description'),
      })

      try {
        await signOutBySource()
      } catch (error) {
        console.error('Failed to sign out after account deletion', error)
      } finally {
        queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, null)
        queryClient.clear()
        navigate(ROUTE_PATHS.TENANT_MISSING, { replace: true })
      }
    },
    onError: (error) => {
      const message = getRequestErrorMessage(error, t('data-management.delete.error.fallback'))
      toast.error(t('data-management.delete.error.title'), { description: message })
    },
  })
}
