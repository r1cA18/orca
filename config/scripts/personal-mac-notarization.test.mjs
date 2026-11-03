import { describe, expect, it } from 'vitest'
import { storeNotarizationCredentials } from './personal-mac-notarization.mjs'

function fixture(exitCode) {
  const writes = []
  const launches = []
  let onData
  let onExit
  const spawn = (command, args, options) => {
    launches.push({ command, args, options })
    return {
      onData(callback) {
        onData = callback
      },
      onExit(callback) {
        onExit = callback
      },
      kill() {},
      write(value) {
        writes.push(value)
      }
    }
  }
  const pending = storeNotarizationCredentials(spawn, {
    profile: 'fixture',
    team: 'EXAMPL1234',
    appleId: 'fixture@example.invalid',
    password: 'fixture-secret',
    env: { PATH: '/fixture' }
  })
  onData('App-specific pass')
  onData('word for fixture@example.invalid:')
  onData('App-specific password for fixture@example.invalid:')
  if (exitCode) {
    onData('HTTP status code: 401. Invalid credentials.')
  }
  onExit({ exitCode })
  return { pending, launches, writes }
}

describe('notarization GUI credential transport', () => {
  it('sends the password once over the terminal without putting it in argv or environment', async () => {
    const { pending, launches, writes } = fixture(0)
    expect(await pending).toBe('saved')
    expect(writes).toEqual(['fixture-secret\r'])
    expect(JSON.stringify(launches)).not.toContain('fixture-secret')
  })
  it('returns only a failure category when Apple rejects credentials', async () => {
    expect(await fixture(1).pending).toBe('invalid-credentials')
  })
})
