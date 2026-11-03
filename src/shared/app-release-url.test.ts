import { describe, expect, it } from 'vitest'
import { releaseTagFromUrl } from './app-release-url'

describe('personal release URL validation', () => {
  it('accepts only this distribution on GitHub', () => {
    expect(releaseTagFromUrl('https://github.com/r1cA18/orca/releases/tag/v1.4.247')).toBe(
      'v1.4.247'
    )
    expect(releaseTagFromUrl('https://github.com/stablyai/orca/releases/tag/v1.4.247')).toBeNull()
    expect(
      releaseTagFromUrl('https://github.com.evil.invalid/r1cA18/orca/releases/tag/v1.4.247')
    ).toBeNull()
    expect(
      releaseTagFromUrl('https://github.com/r1cA18/orca/releases/tag/v1.4.247/extra')
    ).toBeNull()
    expect(releaseTagFromUrl('https://github.com/r1cA18/orca/releases/tag/')).toBeNull()
    expect(releaseTagFromUrl('not a URL')).toBeNull()
  })
})
