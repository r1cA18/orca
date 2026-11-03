import { expect, it } from 'vitest'
import { buildAiVaultResumeCommand } from './ai-vault-resume-command'
import { dshHomeFromTranscript } from './dsh-session-paths'

it('pins the actual DSH home when resuming a custom-home transcript', () => {
  const resumeFilePath = '/private/user home/sessions/encoded-cwd/session-123/session.v4.jsonl.zstd'
  expect(dshHomeFromTranscript(resumeFilePath)).toBe('/private/user home')
  expect(
    buildAiVaultResumeCommand({
      agent: 'dsh',
      sessionId: 'session-123',
      cwd: '/repo',
      platform: 'darwin',
      resumeFilePath
    })
  ).toBe(
    "cd '/repo' && env DSH_HOME='/private/user home' dsh-tui --backend=dsh --resume 'session-123'"
  )
})

it('uses the actual Windows shell grammar and rejects unrelated paths', () => {
  const resumeFilePath = 'C:\\user home\\sessions\\cwd\\session-123\\session.v4.jsonl.zstd'
  const base = {
    agent: 'dsh' as const,
    sessionId: 'session-123',
    cwd: null,
    platform: 'win32' as const,
    resumeFilePath
  }
  expect(buildAiVaultResumeCommand({ ...base, shell: 'cmd' })).toContain(
    'set "DSH_HOME=C:\\user home" && dsh-tui'
  )
  expect(buildAiVaultResumeCommand({ ...base, shell: 'powershell' })).toContain(
    "$env:DSH_HOME='C:\\user home'; dsh-tui"
  )
  expect(dshHomeFromTranscript('/unknown/session.jsonl')).toBeNull()
})
