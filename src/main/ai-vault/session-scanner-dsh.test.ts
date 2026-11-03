import { appendFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { afterEach, expect, it } from 'vitest'
import { scanAiVaultSessions } from './session-scanner'
import { isolatedScanRoots } from './session-scanner-test-fixtures'
import { dshFixtureRecords, writeDshFixture } from './session-scanner-dsh-fixture'
import { parseDshSessionFile } from './session-scanner-dsh-parser'
import {
  registerTranscriptConsumer,
  resetTranscriptConsumersForTests,
  type TranscriptMessage
} from './session-transcript-consumers'
import { resetSessionParseCacheForTests } from './session-scanner-parse-cache'

const roots: string[] = []
afterEach(async () => {
  resetTranscriptConsumersForTests()
  resetSessionParseCacheForTests()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture(records = dshFixtureRecords()) {
  const root = await mkdtemp(join(tmpdir(), 'orca-dsh-'))
  roots.push(root)
  const scanRoots = isolatedScanRoots(root)
  const path = await writeDshFixture(scanRoots.dshSessionsDir, records)
  const info = await stat(path)
  return {
    scanRoots,
    path,
    file: {
      path,
      mtimeMs: info.mtimeMs,
      modifiedAt: info.mtime.toISOString(),
      sizeBytes: info.size
    }
  }
}

it('discovers all concatenated DSH frames and publishes only real conversation messages', async () => {
  const f = await fixture()
  const messages: TranscriptMessage[] = []
  registerTranscriptConsumer({
    beginRead: (start) =>
      start.candidate.agent === 'dsh'
        ? { message: (m) => messages.push(m), finish: () => {} }
        : null
  })
  const result = await scanAiVaultSessions({ ...f.scanRoots, platform: 'darwin', limit: 20 })
  expect(result.issues).toEqual([])
  expect(result.sessions).toHaveLength(1)
  const session = result.sessions[0]
  expect(session.agent).toBe('dsh')
  expect(session.sessionId).toBe('session-dsh-fixture')
  expect(session.cwd).toBe('/tmp/dsh-project')
  expect(session.model).toBe('claude/fixture-model')
  expect(session.totalTokens).toBe(23)
  expect(session.previewMessages.map((m) => m.text)).toContain('DSH final response')
  expect(messages.some((m) => m.role === 'tool' && m.text.includes('uniquedshoutputtoken'))).toBe(
    true
  )
  expect(messages.some((m) => m.role === 'tool' && m.text.includes('fixture.txt'))).toBe(true)
  expect(messages.filter((m) => m.role === 'user').map((m) => m.text)).toEqual([
    'Inspect the DSH fixture'
  ])
})

it('rejects missing and duplicate event sequences instead of publishing a complete session', async () => {
  for (const invalid of [99, 0]) {
    const records = dshFixtureRecords()
    records[3].seq = invalid
    const f = await fixture(records)
    await expect(parseDshSessionFile(f.file, 'linux')).rejects.toThrow('sequence')
  }
})

it('rejects truncated and corrupt compressed tails', async () => {
  const f = await fixture()
  const original = await readFile(f.path)
  await writeFile(f.path, original.subarray(0, -2))
  await expect(parseDshSessionFile(f.file, 'darwin')).rejects.toThrow()
  await writeFile(f.path, original)
  await appendFile(f.path, Buffer.from('corrupt frame'))
  await expect(parseDshSessionFile(f.file, 'darwin')).rejects.toThrow()
})

it('rejects unknown formats and preserves UTF-8 split across frames', async () => {
  const f = await fixture([{ type: 'session', version: 5, id: 'future-session' }])
  await expect(parseDshSessionFile(f.file, 'linux')).rejects.toThrow('Unsupported')
  const records = dshFixtureRecords()
  records[1]!.data = {
    role: 'user',
    source: { kind: 'user' },
    content: [{ type: 'text', text: '日本語の依頼' }]
  }
  const bytes = Buffer.from(`${records.map((record) => JSON.stringify(record)).join('\n')}\n`)
  const boundary = bytes.indexOf(Buffer.from('日本語')) + 1
  await writeFile(
    f.path,
    Buffer.concat([
      zstdCompressSync(bytes.subarray(0, boundary)),
      zstdCompressSync(bytes.subarray(boundary))
    ])
  )
  expect((await parseDshSessionFile(f.file, 'linux'))?.title).toBe('日本語の依頼')
})
