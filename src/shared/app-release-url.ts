import appDistribution from './app-distribution.json'

export const APP_RELEASE_REPO = appDistribution.repository

export function releaseTagFromUrl(value: string): string | null {
  try {
    const url = new URL(value)
    const prefix = `/${APP_RELEASE_REPO}/releases/tag/`
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith(prefix)) {
      return null
    }
    const tag = url.pathname.slice(prefix.length)
    return tag && !tag.includes('/') ? decodeURIComponent(tag) : null
  } catch {
    return null
  }
}
