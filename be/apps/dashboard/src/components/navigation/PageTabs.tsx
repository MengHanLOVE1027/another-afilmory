import { clsxm } from '@afilmory/utils'
import type { MouseEventHandler, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

type PageTabItem = {
  id: string
  label?: ReactNode
  labelKey?: I18nKeys
  to?: string
  end?: boolean
  onSelect?: () => void
  disabled?: boolean
}

export interface PageTabsProps {
  items: PageTabItem[]
  activeId?: string
  onSelect?: (id: string) => void
  className?: string
}

export function PageTabs({ items, activeId, onSelect, className }: PageTabsProps) {
  const { t } = useTranslation()
  const resolveLabel = (item: PageTabItem): ReactNode => (item.labelKey ? t(item.labelKey) : (item.label ?? item.id))

  const renderTabContent = (selected: boolean, label: ReactNode) => (
    <span
      className={clsxm(
        'inline-flex items-center shape-squircle px-3 py-1.5 text-xs font-medium transition-all',
        selected ? 'bg-accent/15 text-accent' : 'bg-fill/10 text-text-secondary hover:bg-fill/20 hover:text-text',
      )}
    >
      {label}
    </span>
  )

  return (
    <div className={clsxm('flex flex-wrap items-center gap-2', className)}>
      {items.map((item) => {
        if (item.to) {
          return (
            <NavLink key={item.id} to={item.to} end={item.end}>
              {({ isActive }) => {
                const selected = isActive || activeId === item.id
                return renderTabContent(selected, resolveLabel(item))
              }}
            </NavLink>
          )
        }

        const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
          event.preventDefault()
          if (item.disabled) return
          onSelect?.(item.id)
          item.onSelect?.()
        }

        const selected = activeId === item.id

        return (
          <button
            key={item.id}
            type="button"
            onClick={handleClick}
            disabled={item.disabled}
            className="focus-visible:outline-none shape-squircle"
          >
            {renderTabContent(selected, resolveLabel(item))}
          </button>
        )
      })}
    </div>
  )
}
