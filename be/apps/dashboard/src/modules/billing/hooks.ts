import { useQuery } from '@tanstack/react-query'

import { getCurrentBillingPlan } from './api'

export const BILLING_PLAN_QUERY_KEY = ['billing', 'plan'] as const

export function useTenantPlanQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: BILLING_PLAN_QUERY_KEY,
    queryFn: getCurrentBillingPlan,
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
  })
}
