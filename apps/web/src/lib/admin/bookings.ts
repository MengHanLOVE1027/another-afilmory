import type { BookingRecord, BookingStatus } from './types'

export interface BookingDraft {
  name: string
  qq: string
  email: string
  wechat: string
  phone: string
  date: string
  time: string
  content: string
  paid: boolean
  note: string
}

interface ApiResult {
  ok: boolean
  error?: string
}

export async function submitBooking(draft: BookingDraft): Promise<ApiResult & { id?: string }> {
  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const result = (await response.json()) as ApiResult & { id?: string }
    return { ...result, ok: response.ok && result.ok !== false }
  }
  catch {
    return { ok: false, error: '网络异常，请稍后再试' }
  }
}

export async function fetchBookings(): Promise<BookingRecord[]> {
  const response = await fetch('/api/admin/bookings', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('无法加载预约列表')
  }
  const result = (await response.json()) as { bookings?: BookingRecord[] }
  return Array.isArray(result.bookings) ? result.bookings : []
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<ApiResult> {
  const response = await fetch('/api/admin/bookings/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  const result = (await response.json()) as ApiResult
  return { ...result, ok: response.ok && result.ok !== false }
}

export async function removeBooking(id: string): Promise<ApiResult> {
  const response = await fetch('/api/admin/bookings/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const result = (await response.json()) as ApiResult
  return { ...result, ok: response.ok && result.ok !== false }
}
