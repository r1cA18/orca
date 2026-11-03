import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isDirectInvocation } from './script-entry-detection.mjs'

export function selectDeveloperIdentity(output, requestedName) {
  const identities = [
    ...output.matchAll(/"(Developer ID Application:[^"\n]+ \(([A-Z0-9]{10})\))"/g)
  ]
    .map((match) => ({ name: match[1], team: match[2] }))
    .filter(
      (identity) =>
        !requestedName ||
        identity.name === requestedName ||
        identity.name.replace(/^Developer ID Application: /, '') === requestedName
    )
  if (identities.length !== 1) {
    throw new Error(
      'Exactly one Developer ID Application identity is required; set CSC_NAME to select one.'
    )
  }
  return identities[0]
}

export function personalMacReleaseEnvironment(env, identity) {
  if (env.APPLE_TEAM_ID && env.APPLE_TEAM_ID !== identity.team) {
    throw new Error('APPLE_TEAM_ID does not match the selected Developer ID certificate.')
  }
  const child = {
    ...env,
    CSC_NAME: identity.name.replace(/^Developer ID Application: /, ''),
    APPLE_TEAM_ID: identity.team,
    APPLE_KEYCHAIN_PROFILE: env.APPLE_KEYCHAIN_PROFILE || 'orca-personal',
    ORCA_REQUIRE_ORCAD_TEMPLATE: '1'
  }
  for (const key of [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_API_KEY',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER'
  ]) {
    delete child[key]
  }
  return child
}

export function validatePersonalBuildVersion(version, base) {
  const prefix = `${base}-personal.`
  if (!version?.startsWith(prefix) || !/^[1-9][0-9]*$/.test(version.slice(prefix.length))) {
    throw new Error(`Use a version of the form ${base}-personal.<positive revision>.`)
  }
  return version
}

export function personalMacBuildArguments(arch, version) {
  return [
    'run',
    'build:mac:release',
    '--mac',
    `dmg:${arch}`,
    `zip:${arch}`,
    '--publish',
    'never',
    `--config.extraMetadata.version=${version}`
  ]
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  try {
    if (process.platform !== 'darwin') {
      throw new Error('Personal macOS releases require macOS.')
    }
    const [command, version] = process.argv.slice(2)
    if (!['setup', 'build'].includes(command)) {
      throw new Error('Usage: personal-mac-release.mjs setup | build <version>')
    }
    const identity = selectDeveloperIdentity(
      execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' }),
      process.env.CSC_NAME
    )
    const env = personalMacReleaseEnvironment(process.env, identity)
    if (command === 'setup') {
      const { setupMacNotarization } = await import('./personal-mac-notarization.mjs')
      const status = await setupMacNotarization(env, identity)
      console.log(`Notarization setup: ${status}`)
      if (status !== 'saved') {
        process.exitCode = 1
      }
    } else {
      const root = fileURLToPath(new URL('../..', import.meta.url))
      const { version: base } = JSON.parse(
        readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
      )
      const buildVersion = validatePersonalBuildVersion(version, base)
      execFileSync(
        'xcrun',
        [
          'notarytool',
          'history',
          '--keychain-profile',
          env.APPLE_KEYCHAIN_PROFILE,
          '--output-format',
          'json'
        ],
        { stdio: 'ignore', env }
      )
      execFileSync('pnpm', personalMacBuildArguments(process.arch, buildVersion), {
        cwd: root,
        stdio: 'inherit',
        env
      })
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
