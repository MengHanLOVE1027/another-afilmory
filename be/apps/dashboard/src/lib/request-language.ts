import { getI18n } from '~/i18n'

const LANGUAGE_HEADER = 'x-lang'

function resolveLanguage(): string | null {
  const i18n = getI18n()
  const language = i18n.language ?? i18n.resolvedLanguage ?? null
  return language ? language.trim() || null : null
}

export function withLanguageHeader<T extends HeadersInit | undefined>(headers?: T): Headers {
  const next = new Headers(headers ?? {})
  const language = resolveLanguage()
  if (language && !next.has(LANGUAGE_HEADER)) {
    next.set(LANGUAGE_HEADER, language)
  }
  return next
}

export function withLanguageHeaderInit(init?: RequestInit): RequestInit {
  if (!init) {
    return { headers: withLanguageHeader() }
  }

  return {
    ...init,
    headers: withLanguageHeader(init.headers),
  }
}
