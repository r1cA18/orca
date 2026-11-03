import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { parseAgentSessionFile } from '../ai-vault/session-scanner-agent-parser'
import { resetTranscriptConsumersForTests } from '../ai-vault/session-transcript-consumers'
import { resetSessionParseCacheForTests } from '../ai-vault/session-scanner-parse-cache'
import { registerSessionSearchIndexConsumer } from './session-search-index-consumer'
import { openSessionSearchHarness } from './session-search-engine-test-fixture'
import { parseTranscript, sessionCandidate } from './session-search-transcript-fixtures'

const manifest = process.env.ORCA_DSH_TRANSCRIPT_FIXTURES

it.skipIf(!manifest)(
  'reads and searches saved DSH subscription conversations without invoking a model',
  async () => {
    const fixtures: {
      transcriptPath: string
      sessionId: string
      provider: string
      expectedReply: string
      expectedCwd: string
    }[] = JSON.parse(await readFile(manifest!, 'utf8'))
    expect(fixtures.length).toBeGreaterThan(0)
    const harness = await openSessionSearchHarness('dsh-saved-acceptance')
    try {
      registerSessionSearchIndexConsumer(harness.store)
      for (const fixture of fixtures) {
        const session = await parseAgentSessionFile(
          await sessionCandidate('dsh', fixture.transcriptPath),
          process.platform
        )
        expect(session?.sessionId).toBe(fixture.sessionId)
        expect(session?.cwd).toBe(fixture.expectedCwd)
        expect(session?.model?.startsWith(`${fixture.provider}/`)).toBe(true)
        expect(
          session?.previewMessages.some(
            (message) =>
              message.role === 'assistant' && message.text.trim() === fixture.expectedReply
          )
        ).toBe(true)
        await parseTranscript(fixture.transcriptPath, 'dsh')
        const result = harness.engine.search({
          query: `"${fixture.expectedReply}"`,
          scope: 'conversation',
          filters: { agents: ['dsh'] }
        })
        expect(result.hits.some((hit) => hit.sessionId === fixture.sessionId)).toBe(true)
      }
    } finally {
      resetTranscriptConsumersForTests()
      resetSessionParseCacheForTests()
      await harness.close()
    }
  }
)
