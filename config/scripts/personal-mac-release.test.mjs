import { describe, expect, it } from 'vitest'
import {
  personalMacReleaseEnvironment,
  selectDeveloperIdentity,
  validatePersonalBuildVersion
} from './personal-mac-release.mjs'

const name = 'Developer ID Application: Fixture (EXAMPL1234)'
const identity = { name, team: 'EXAMPL1234' }
describe('personal macOS release setup', () => {
  it('selects Developer ID rather than an Apple Development identity', () => {
    expect(
      selectDeveloperIdentity(
        `1) HASH "Apple Development: Fixture (EXAMPL1234)"\n2) HASH "${name}"`
      )
    ).toEqual(identity)
  })
  it('requires an explicit selection when several release identities are present', () => {
    const output = `1) HASH "${name}"\n2) HASH "Developer ID Application: Other (OTHER12345)"`
    expect(() => selectDeveloperIdentity(output)).toThrow('Exactly one')
    expect(selectDeveloperIdentity(output, name)).toEqual(identity)
    expect(() => selectDeveloperIdentity('')).toThrow('Exactly one')
  })
  it('uses Keychain credentials without exporting private keys or inheriting conflicting login methods', () => {
    const env = personalMacReleaseEnvironment(
      { APPLE_ID: 'fixture', CSC_LINK: 'fixture', PATH: '/fixture' },
      identity
    )
    expect(env.APPLE_KEYCHAIN_PROFILE).toBe('orca-personal')
    expect(env.APPLE_TEAM_ID).toBe(identity.team)
    expect(env.CSC_NAME).toBe(name)
    expect(env.PATH).toBe('/fixture')
    expect(env.APPLE_ID).toBeUndefined()
    expect(env.CSC_LINK).toBeUndefined()
    expect(() => personalMacReleaseEnvironment({ APPLE_TEAM_ID: 'OTHER12345' }, identity)).toThrow(
      'does not match'
    )
  })
  it('requires an ordered personal revision based on the selected upstream version', () => {
    expect(validatePersonalBuildVersion('1.4.247-personal.1', '1.4.247')).toBe('1.4.247-personal.1')
    expect(() => validatePersonalBuildVersion('1.4.247', '1.4.247')).toThrow('form')
    expect(() => validatePersonalBuildVersion('1.4.247-personal.0', '1.4.247')).toThrow('form')
    expect(() => validatePersonalBuildVersion('1.4.248-personal.1', '1.4.247')).toThrow('form')
  })
})
