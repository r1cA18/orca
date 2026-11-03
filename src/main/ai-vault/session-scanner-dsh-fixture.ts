import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

export function dshFixtureRecords(): Record<string, unknown>[] {
  const message = (role: string, text: string) => ({ role, content: [{ type: 'text', text }] })
  const events = [
    {
      type: 'user/message',
      data: { ...message('user', 'Inspect the DSH fixture'), source: { kind: 'user' } }
    },
    {
      type: 'user/message',
      data: { ...message('user', 'Hidden runtime context'), source: { kind: 'runtime-context' } }
    },
    { type: 'request/context', data: { provider: 'claude', model: 'fixture-model' } },
    {
      type: 'assistant/message',
      data: {
        message: {
          role: 'assistant',
          source: { provider: 'claude' },
          content: [
            {
              type: 'tool-call',
              id: 'read-1',
              name: 'read',
              arguments: '{"file_path":"fixture.txt"}'
            }
          ]
        },
        usage: { inputTokens: 2, outputTokens: 3, cacheReadTokens: 5, cacheWriteTokens: 7 }
      }
    },
    {
      type: 'tool/call',
      data: { name: 'read', callId: 'read-1', arguments: '{"file_path":"fixture.txt"}' }
    },
    {
      type: 'tool/result',
      data: {
        message: {
          ...message('tool', 'uniquedshoutputtoken'),
          toolCallId: 'read-1',
          isError: false
        }
      }
    },
    {
      type: 'assistant/message',
      data: {
        message: { ...message('assistant', 'DSH final response'), source: { provider: 'claude' } },
        usage: { inputTokens: 2, outputTokens: 4 }
      }
    },
    { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }
  ]
  return [
    {
      type: 'session',
      version: 4,
      id: 'session-dsh-fixture',
      cwd: '/tmp/dsh-project',
      createdAt: 1790000000000
    },
    ...events.map((event, seq) => ({ ...event, seq, time: 1790000001000 + seq }))
  ]
}

export async function writeDshFixture(
  root: string,
  records = dshFixtureRecords()
): Promise<string> {
  const file = join(root, 'encoded-cwd', 'session-dsh-fixture', 'session.v4.jsonl.zstd')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(
    file,
    Buffer.concat(records.map((record) => zstdCompressSync(`${JSON.stringify(record)}\n`)))
  )
  return file
}
