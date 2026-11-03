import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { writeDshFixture } from '../ai-vault/session-scanner-dsh-fixture'
import { resetTranscriptConsumersForTests } from '../ai-vault/session-transcript-consumers'
import { resetSessionParseCacheForTests } from '../ai-vault/session-scanner-parse-cache'
import { registerSessionSearchIndexConsumer } from './session-search-index-consumer'
import { openSessionSearchHarness } from './session-search-engine-test-fixture'
import { parseTranscript } from './session-search-transcript-fixtures'

it('indexes the DSH transcript under DSH and searches assistant and tool content separately', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-dsh-search-'))
  const harness = await openSessionSearchHarness('dsh-search')
  try {
    registerSessionSearchIndexConsumer(harness.store)
    const path = await writeDshFixture(root)
    await parseTranscript(path, 'dsh')
    const conversation = harness.engine.search({
      query: '"DSH final response"',
      scope: 'conversation'
    })
    expect(conversation.hits).toHaveLength(1)
    expect(conversation.hits[0].agent).toBe('dsh')
    expect(
      harness.engine.search({ query: '"uniquedshoutputtoken"', scope: 'all' }).hits
    ).toHaveLength(1)
    expect(
      harness.engine.search({ query: '"uniquedshoutputtoken"', scope: 'conversation' }).hits
    ).toHaveLength(0)
    await parseTranscript(path, 'dsh')
    expect(harness.engine.search({ query: '"DSH final response"' }).hits).toHaveLength(1)
  } finally {
    resetTranscriptConsumersForTests()
    resetSessionParseCacheForTests()
    await harness.close()
    await rm(root, { recursive: true, force: true })
  }
})
