#!/usr/bin/env node
import { isDirectInvocation } from './script-entry-detection.mjs'

export function missingMacReleaseCredentials(env) {
  const present = (key) => typeof env[key] === 'string' && env[key].trim().length > 0
  const missing = []
  if (!present('APPLE_TEAM_ID')) {
    missing.push('APPLE_TEAM_ID')
  }
  if (!present('CSC_NAME')) {
    for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD']) {
      if (!present(key)) {
        missing.push(key)
      }
    }
  }
  if (!present('APPLE_KEYCHAIN_PROFILE')) {
    for (const key of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD']) {
      if (!present(key)) {
        missing.push(key)
      }
    }
  }
  return missing
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  const missing = missingMacReleaseCredentials(process.env)
  if (missing.length > 0) {
    console.error(`Missing macOS release credentials: ${missing.join(', ')}`)
    console.error(
      'Use a Developer ID identity (CSC_NAME) and a notarization Keychain profile, or the certificate-file and Apple ID credentials.'
    )
    process.exitCode = 1
  }
}
