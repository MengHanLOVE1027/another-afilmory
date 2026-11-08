import type { CSSProperties } from 'react'

import { PageHeaderCenter } from './PageHeaderCenter'
import { PageHeaderLeft } from './PageHeaderLeft'
import { PageHeaderRight } from './PageHeaderRight'
import { ViewModeSegment } from './ViewModeSegment'

interface PageHeaderProps {
  dateRange?: string
  location?: string
  showDateRange?: boolean
  photoCount?: number
  showViewControls?: boolean
  transparent?: boolean
}

export const PageHeader = ({
  dateRange,
  location,
  showDateRange,
  photoCount,
  showViewControls = true,
  transparent = false,
}: PageHeaderProps) => {
  const transparentVars = transparent
    ? ({
        '--header-bg': 'rgba(0,0,0,0.5)',
        '--header-fg': '#fff',
        '--header-muted': 'rgba(255,255,255,0.62)',
        '--header-hover': 'rgba(255,255,255,0.12)',
        '--header-border': 'rgba(255,255,255,0.12)',
      } as CSSProperties)
    : undefined
  return (
    <header className="fixed top-0 right-0 left-0 z-100" style={transparentVars}>
      {transparent
        ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-[-1] h-24"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)' }}
            />
          )
        : (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[-1] h-15 border-b border-[var(--header-border)] bg-[var(--header-bg)] backdrop-blur-xl" />
          )}
      <div
        className={`flex h-12 items-center justify-between gap-2 px-3 lg:h-12 lg:gap-3 lg:px-4 text-[var(--header-fg)]`}
      >
        <PageHeaderLeft photoCount={photoCount} />
        <PageHeaderCenter dateRange={dateRange} location={location} showDateRange={showDateRange} />
        <div className="flex items-center gap-1.5 lg:gap-2">
          {showViewControls && <ViewModeSegment />}
          <PageHeaderRight />
        </div>
      </div>
    </header>
  )
}
