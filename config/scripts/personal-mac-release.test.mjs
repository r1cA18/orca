import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import {
  personalMacReleaseEnvironment,
  personalMacBuildArguments,
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
    expect(selectDeveloperIdentity(output, 'Fixture (EXAMPL1234)')).toEqual(identity)
    expect(() => selectDeveloperIdentity('')).toThrow('Exactly one')
  })
  it('uses Keychain credentials without exporting private keys or inheriting conflicting login methods', () => {
    const env = personalMacReleaseEnvironment(
      { APPLE_ID: 'fixture', CSC_LINK: 'fixture', PATH: '/fixture' },
      identity
    )
    expect(env.APPLE_KEYCHAIN_PROFILE).toBe('orca-personal')
    expect(env.APPLE_TEAM_ID).toBe(identity.team)
    expect(env.CSC_NAME).toBe('Fixture (EXAMPL1234)')
    expect(env.ORCA_REQUIRE_ORCAD_TEMPLATE).toBe('1')
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

const require = createRequire(import.meta.url)
const {
  configureBuildCommand,
  createYargs,
  normalizeOptions
} = require('electron-builder/out/builder.js')
it.each(['arm64', 'x64'])(
  'pins explicit packaging targets for %s despite the dual-architecture config',
  (arch) => {
    const argv = configureBuildCommand(createYargs()).parse([
      '--config',
      'config/electron-builder.config.cjs',
      '--mac',
      ...personalMacBuildArguments(arch, '1.4.247-personal.1').slice(2)
    ])
    const targets = [...normalizeOptions(argv).targets.values()]
    expect(targets).toHaveLength(1)
    expect([...targets[0].values()]).toEqual([['dmg', 'zip']])
    expect(argv.mac).toEqual([`dmg:${arch}`, `zip:${arch}`])
  }
)
