import type { SiteConfig } from '@config'
import defaultSiteConfig from '@config'
import { merge } from 'es-toolkit/compat'

import { getAdminData } from '~/lib/admin/store'

const defaultInjectConfig = {
  useApi: false,
  useNext: false,
  useCloud: false,
}

export const injectConfig = merge(defaultInjectConfig, __CONFIG__)

const getInjectedSiteConfig = (): Partial<SiteConfig> | undefined => {
  if (window.__SITE_CONFIG__) {
    return window.__SITE_CONFIG__
  }

  if (typeof globalThis !== 'undefined' && '__SITE_CONFIG__' in globalThis) {
    return (globalThis as typeof globalThis & { __SITE_CONFIG__?: Partial<SiteConfig> }).__SITE_CONFIG__
  }

  return undefined
}

/**
 * The built-in admin stores its editable settings in content/admin-data.json.
 * Map those fields onto the static SiteConfig shape so a save followed by a
 * reload immediately changes the public site.
 */
const getAdminSiteConfig = (): Partial<SiteConfig> => {
  const { site } = getAdminData()
  return {
    name: site.name,
    title: site.title,
    description: site.description,
    url: site.url,
    accentColor: site.accentColor,
    author: {
      name: site.authorName,
      url: site.authorUrl,
      avatar: site.authorAvatar || undefined,
    },
    social: {
      github: site.github,
      twitter: site.twitter,
    },
    beian: {
      icp: { enabled: !!site.icp, number: site.icp },
      police: { enabled: !!site.police, number: site.police },
    },
  }
}

const runtimeSiteConfig = getInjectedSiteConfig() ?? {}

export const siteConfig: SiteConfig = merge(defaultSiteConfig, runtimeSiteConfig, getAdminSiteConfig())
