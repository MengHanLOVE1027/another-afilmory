import { coreApi } from '~/lib/api-client'
import { camelCaseKeys } from '~/lib/case'

import type { BillingPlanResponse } from './types'

export async function getCurrentBillingPlan(): Promise<BillingPlanResponse> {
  const response = await coreApi<BillingPlanResponse>('/billing/plan')
  return camelCaseKeys<BillingPlanResponse>(response)
}
