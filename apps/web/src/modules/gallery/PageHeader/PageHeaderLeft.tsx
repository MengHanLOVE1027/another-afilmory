import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { useAtomValue } from 'jotai'
import { NavLink } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { siteConfig } from '~/config'
import { usePhotos } from '~/hooks/usePhotoViewer'

import { resolveSocialUrl, SocialIconButton } from './utils'

export const PageHeaderLeft = ({ photoCount }: { photoCount?: number }) => {
  const visiblePhotoCount = usePhotos().length
  const count = photoCount ?? visiblePhotoCount
  const { showAlbumsEntry, showCategoriesEntry } = useAtomValue(gallerySettingAtom)

  const githubUrl =
    siteConfig.social && siteConfig.social.github
      ? resolveSocialUrl(siteConfig.social.github, { baseUrl: 'https://github.com/' })
      : undefined
  const twitterUrl =
    siteConfig.social && siteConfig.social.twitter
      ? resolveSocialUrl(siteConfig.social.twitter, { baseUrl: 'https://twitter.com/', stripAt: true })
      : undefined
  const hasRss = true

  return (
    <div className="flex items-center gap-2">
      {siteConfig.author.avatar ? (
        <AvatarPrimitive.Root>
          <AvatarPrimitive.Image
            src={siteConfig.author.avatar}
            className="size-7 rounded-lg lg:size-8"
            alt={siteConfig.author.name}
          />
          <AvatarPrimitive.Fallback>
            <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--header-hover)] lg:size-8">
              <i className="i-mingcute-camera-2-line text-sm text-[var(--header-muted)] lg:text-base" />
            </div>
          </AvatarPrimitive.Fallback>
        </AvatarPrimitive.Root>
      ) : (
        <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--header-hover)] lg:size-8">
          <i className="i-mingcute-camera-2-line text-sm text-[var(--header-muted)] lg:text-base" />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <h1 className="truncate text-sm font-semibold text-[var(--header-fg)] lg:text-base">{siteConfig.name}</h1>
        <span className="text-xs text-[var(--header-muted)] lg:text-sm">{count}</span>
      </div>
      <nav className="ml-1 hidden items-center gap-0.5 border-l border-[var(--header-border)] pl-2 sm:flex">
        <NavEntry to="/" label="首页" />
        <NavEntry to="/gallery" label="作品" />
        {showAlbumsEntry && <NavEntry to="/albums" label="摄影集" />}
        {showCategoriesEntry && <NavEntry to="/categories" label="分类" />}
        <NavEntry to="/booking" label="预约" />
        <NavEntry to="/about" label="关于" />
      </nav>
      {(githubUrl || twitterUrl || hasRss) && (
        <div className="ml-1 hidden items-center gap-1 border-l border-[var(--header-border)] pl-2 lg:flex">
          {githubUrl && <SocialIconButton icon="i-mingcute-github-fill" title="GitHub" href={githubUrl} />}
          {twitterUrl && <SocialIconButton icon="i-mingcute-twitter-fill" title="Twitter" href={twitterUrl} />}
          {hasRss && <SocialIconButton icon="i-mingcute-rss-2-fill" title="RSS" href="/feed.xml" />}
        </div>
      )}
    </div>
  )
}

const NavEntry = ({ to, label }: { to: string, label: string }) => (
  <NavLink
    to={to}
    end={to === '/'}
    className={({ isActive }) =>
      `rounded-full px-2 py-1 text-xs transition-colors ${
        isActive
          ? 'bg-[var(--header-hover)] text-[var(--header-fg)]'
          : 'text-[var(--header-muted)] hover:bg-[var(--header-hover)] hover:text-[var(--header-fg)]'
      }`}
  >
    {label}
  </NavLink>
)
