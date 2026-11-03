import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { missingMacReleaseCredentials } from './verify-macos-release-env.mjs'

describe('macOS release credentials', () => {
  it('fails the actual CLI before packaging when credentials are absent', () => {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./verify-macos-release-env.mjs', import.meta.url))],
      { env: {}, encoding: 'utf8' }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Missing macOS release credentials')
  })
  it('accepts a local signing identity and notarization Keychain profile without exporting a key', () => {
    expect(
      missingMacReleaseCredentials({
        APPLE_TEAM_ID: 'EXAMPLE1234',
        CSC_NAME: 'Developer ID Application: Example',
        APPLE_KEYCHAIN_PROFILE: 'fixture-profile'
      })
    ).toEqual([])
  })
  it('preserves certificate-file signing and Apple ID notarization', () => {
    expect(
      missingMacReleaseCredentials({
        APPLE_TEAM_ID: 'EXAMPLE1234',
        CSC_LINK: '/fixture/cert.p12',
        CSC_KEY_PASSWORD: 'fixture',
        APPLE_ID: 'example@example.invalid',
        APPLE_APP_SPECIFIC_PASSWORD: 'fixture'
      })
    ).toEqual([])
  })
  it('does not accept signing credentials as notarization credentials', () => {
    expect(
      missingMacReleaseCredentials({ APPLE_TEAM_ID: 'EXAMPLE1234', CSC_NAME: 'fixture' })
    ).toEqual(['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD'])
  })
  it('requires the expected signing team and a complete certificate source', () => {
    expect(
      missingMacReleaseCredentials({ APPLE_KEYCHAIN_PROFILE: 'fixture', CSC_LINK: 'fixture' })
    ).toEqual(['APPLE_TEAM_ID', 'CSC_KEY_PASSWORD'])
  })
})
