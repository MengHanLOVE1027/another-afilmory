import { CalendarDays, CheckCircle2, Clock, Loader2, Mail, MessageCircle, Phone, Send, User } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'

import { submitBooking } from '~/lib/admin/bookings'
import type { BookingDraft } from '~/lib/admin/bookings'
import { PageHeader } from '~/modules/gallery/PageHeader'

function todayString() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const initialDraft: BookingDraft = {
  name: '',
  qq: '',
  email: '',
  wechat: '',
  phone: '',
  date: todayString(),
  time: '10:00',
  content: '',
  paid: true,
  note: '',
}

const inputClass =
  'w-full rounded-xl border border-[var(--site-line)] bg-[var(--site-panel)] px-3.5 py-2.5 text-sm text-[var(--site-fg)] outline-none transition placeholder:text-[var(--site-muted)] focus:border-[var(--site-line)] focus:ring-2 focus:ring-black/5'

function BookingPage() {
  const [draft, setDraft] = useState<BookingDraft>(initialDraft)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [doneId, setDoneId] = useState('')

  const update = <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.name.trim() || draft.content.trim().length < 2) {
      setError('请填写称呼和拍摄内容')
      return
    }
    if (!draft.qq.trim() && !draft.email.trim() && !draft.wechat.trim() && !draft.phone.trim()) {
      setError('请至少留下一种联系方式')
      return
    }
    setSubmitting(true)
    const result = await submitBooking(draft)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error || '提交失败，请稍后再试')
      return
    }
    setDoneId(result.id || '')
  }

  if (doneId) {
    return (
      <div className="fixed inset-0 z-90 overflow-y-auto overscroll-contain bg-[var(--site-bg)] text-[var(--site-fg)]">
        <PageHeader showViewControls={false} />
        <main className="page-emerge mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-24 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-[var(--site-fg)] text-[var(--site-bg)]">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">预约已提交</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--site-muted)]">
            已收到你的约拍需求，会尽快通过留下的联系方式回复。预约编号：
            <span className="ml-1 font-mono text-[var(--site-muted)]">{doneId.slice(0, 8)}</span>
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/" className="rounded-full bg-[var(--site-fg)] px-5 py-2.5 text-sm text-[var(--site-bg)]">
              回首页
            </Link>
            <button
              type="button"
              onClick={() => {
                setDoneId('')
                setDraft(initialDraft)
              }}
              className="rounded-full border border-[var(--site-line)] px-5 py-2.5 text-sm"
            >
              再约一次
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-90 overflow-y-auto overscroll-contain bg-[var(--site-bg)] text-[var(--site-fg)]">
      <PageHeader showViewControls={false} />
      <main className="page-emerge mx-auto w-full max-w-5xl px-5 pt-16 pb-10 sm:px-8 sm:pt-20 sm:pb-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-[10px] tracking-[0.24em] text-[var(--site-muted)]">BOOKING</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">预约约拍</h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--site-muted)]">
              留下日期、想法和联系方式。可以说明想拍的内容、参考风格，以及是否接受付费拍摄，
              我会在确认档期后回复。
            </p>
            <dl className="mt-8 space-y-4 border-t border-[var(--site-line)] pt-6 text-sm">
              <div className="flex items-center gap-3">
                <CalendarDays className="size-4 text-[var(--site-muted)]" />
                <span className="text-[var(--site-muted)]">提前 1–3 天预约更稳妥</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-[var(--site-muted)]" />
                <span className="text-[var(--site-muted)]">默认拍摄时长 1–2 小时</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="size-4 text-[var(--site-muted)]" />
                <span className="text-[var(--site-muted)]">至少留下 QQ / 微信 / 邮箱 / 电话中的一种</span>
              </div>
            </dl>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-[var(--site-line)] bg-[var(--site-panel)] p-5 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.25)] sm:p-7"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs text-[var(--site-muted)]">怎么称呼你</span>
                <div className="relative">
                  <User className="pointer-events-none absolute top-3 left-3 size-4 text-[var(--site-muted)]" />
                  <input
                    value={draft.name}
                    onChange={event => update('name', event.target.value)}
                    placeholder="你的名字"
                    className={`${inputClass} pl-9`}
                    maxLength={40}
                  />
                </div>
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[var(--site-muted)]">日期</span>
                <input
                  type="date"
                  min={todayString()}
                  value={draft.date}
                  onChange={event => update('date', event.target.value)}
                  className={inputClass}
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[var(--site-muted)]">时间</span>
                <input
                  type="time"
                  value={draft.time}
                  onChange={event => update('time', event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs text-[var(--site-muted)]">拍摄内容</span>
                <textarea
                  value={draft.content}
                  onChange={event => update('content', event.target.value)}
                  placeholder="想拍什么风格、地点、人数，是否有参考图……"
                  rows={4}
                  className={`${inputClass} resize-none`}
                  maxLength={1000}
                />
              </label>
            </div>

            <fieldset className="mt-5">
              <legend className="mb-2 text-xs text-[var(--site-muted)]">是否付费</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => update('paid', true)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    draft.paid ? 'border-[#1d1d1b] bg-[var(--site-fg)] text-[var(--site-bg)]' : 'border-[var(--site-line)] bg-[var(--site-panel)] text-[var(--site-muted)]'
                  }`}
                >
                  <span className="block text-sm font-medium">付费拍摄</span>
                  <span className={`mt-0.5 block text-[11px] ${draft.paid ? 'text-[var(--site-bg)]' : 'text-[var(--site-muted)]'}`}>
                    按拍摄方案报价
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => update('paid', false)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    !draft.paid ? 'border-[#1d1d1b] bg-[var(--site-fg)] text-[var(--site-bg)]' : 'border-[var(--site-line)] bg-[var(--site-panel)] text-[var(--site-muted)]'
                  }`}
                >
                  <span className="block text-sm font-medium">免费约拍</span>
                  <span className={`mt-0.5 block text-[11px] ${!draft.paid ? 'text-[var(--site-bg)]' : 'text-[var(--site-muted)]'}`}>
                    互相商量的创作
                  </span>
                </button>
              </div>
            </fieldset>

            <div className="mt-6 border-t border-[var(--site-line)] pt-5">
              <p className="mb-3 text-xs text-[var(--site-muted)]">联系方式（至少填一种）</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <MessageCircle className="pointer-events-none absolute top-3 left-3 size-4 text-[var(--site-muted)]" />
                  <input
                    value={draft.qq}
                    onChange={event => update('qq', event.target.value)}
                    placeholder="QQ"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-3 left-3 size-4 text-[var(--site-muted)]" />
                  <input
                    value={draft.email}
                    onChange={event => update('email', event.target.value)}
                    placeholder="邮箱"
                    type="email"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <div className="relative">
                  <MessageCircle className="pointer-events-none absolute top-3 left-3 size-4 text-[var(--site-muted)]" />
                  <input
                    value={draft.wechat}
                    onChange={event => update('wechat', event.target.value)}
                    placeholder="微信"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <div className="relative">
                  <Phone className="pointer-events-none absolute top-3 left-3 size-4 text-[var(--site-muted)]" />
                  <input
                    value={draft.phone}
                    onChange={event => update('phone', event.target.value)}
                    placeholder="电话"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs text-[var(--site-muted)]">备注（选填）</span>
              <textarea
                value={draft.note}
                onChange={event => update('note', event.target.value)}
                rows={2}
                placeholder="其他需要提前说明的事情"
                className={`${inputClass} resize-none`}
                maxLength={500}
              />
            </label>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--site-fg)] px-5 py-3 text-sm font-medium text-[var(--site-bg)] transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {submitting ? '提交中…' : '提交预约'}
            </button>
            <p className="mt-3 text-center text-[11px] text-[var(--site-muted)]">提交即表示同意我通过以上方式联系你。</p>
          </form>
        </div>
      </main>
    </div>
  )
}

export const Component = BookingPage
