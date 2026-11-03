import { zstdDecompressSync } from 'node:zlib'
import { StringDecoder } from 'node:string_decoder'
import { setImmediate as yieldToEventLoop } from 'node:timers/promises'
import { openTranscriptReadStream } from '../native-chat/wsl-transcript-fs-access'
import type { AiVaultSession } from '../../shared/ai-vault-types'
import type { FileWithMtime, SessionAccumulator } from './session-scanner-types'
import type { TranscriptMessageSink } from './session-transcript-consumers'
import { createAccumulator, finalizeSession, updateTimeline } from './session-scanner-accumulator'
import { addSessionContent } from './session-scanner-messages'
import { asRecord, extractString, numberValue, normalizeTitleText } from './session-scanner-values'

const MAX_COMPRESSED_BYTES = 64 * 1024 * 1024
const MAX_FRAME_BYTES = 16 * 1024 * 1024
const MAX_DECODED_BYTES = 256 * 1024 * 1024

function contentBlocks(content: unknown): unknown[] {
  if (!Array.isArray(content)) {
    return []
  }
  return content.map((value) => {
    const block = asRecord(value)
    if (block?.type !== 'tool-call') {
      return value
    }
    let input: unknown = block.arguments
    if (typeof input === 'string') {
      try {
        input = JSON.parse(input)
      } catch {
        /* Preserve malformed arguments as text. */
      }
    }
    return { type: 'tool_use', name: block.name, input }
  })
}

function foldDshEvent(accumulator: SessionAccumulator, record: Record<string, unknown>): void {
  const data = asRecord(record.data)
  if (!data) {
    return
  }
  updateTimeline(accumulator, record.time)
  // Context replacement checkpoints are not new conversation turns.
  if (record.surfaceOp !== undefined && record.surfaceOp !== 'append') {
    return
  }
  if (record.type === 'session/title') {
    accumulator.title = extractString(data.title) ?? accumulator.title
  } else if (record.type === 'request/context') {
    const model = extractString(data.model)
    const provider = extractString(data.provider)
    if (model) {
      accumulator.model = provider ? `${provider}/${model}` : model
    }
  } else if (record.type === 'user/message' && asRecord(data.source)?.kind === 'user') {
    if (addSessionContent(accumulator, 'user', data.content, record.time)) {
      accumulator.messageCount++
      const first = accumulator.previewMessages.at(-1)?.text
      accumulator.fallbackTitle ??= normalizeTitleText(first ?? '')
    }
  } else if (record.type === 'assistant/message') {
    const message = asRecord(data.message)
    if (!message) {
      return
    }
    addSessionContent(accumulator, 'assistant', contentBlocks(message.content), record.time)
    accumulator.messageCount++
    const usage = asRecord(data.usage)
    if (usage) {
      let tokens = numberValue(usage.inputTokens) + numberValue(usage.outputTokens)
      if (asRecord(message.source)?.provider === 'claude') {
        tokens += numberValue(usage.cacheReadTokens) + numberValue(usage.cacheWriteTokens)
      }
      accumulator.totalTokens += tokens
    }
  } else if (record.type === 'tool/result') {
    const message = asRecord(data.message)
    if (message) {
      addSessionContent(
        accumulator,
        'tool',
        [{ type: 'tool_result', content: message.content }],
        record.time
      )
    }
  }
}

export async function parseDshSessionFile(
  file: FileWithMtime,
  platform: NodeJS.Platform,
  messages?: TranscriptMessageSink,
  signal?: AbortSignal
): Promise<AiVaultSession | null> {
  const chunks: Buffer[] = []
  let compressedBytes = 0
  for await (const value of openTranscriptReadStream(file.path, {}, 'scan', signal)) {
    const chunk = Buffer.from(value)
    compressedBytes += chunk.length
    if (compressedBytes > MAX_COMPRESSED_BYTES) {
      throw new Error('DSH transcript exceeds the compressed size limit')
    }
    chunks.push(chunk)
  }
  const compressed = Buffer.concat(chunks)
  const accumulator = createAccumulator({ agent: 'dsh', file, sessionId: '', messages })
  const decoder = new StringDecoder('utf8')
  let offset = 0
  let decodedBytes = 0
  let pending = ''
  let sequence = 0
  let header = false
  while (offset < compressed.length) {
    signal?.throwIfAborted()
    // Node stops after one Zstandard frame; bytesWritten locates the next frame.
    const result = asRecord(
      zstdDecompressSync(compressed.subarray(offset), {
        info: true,
        maxOutputLength: MAX_FRAME_BYTES
      })
    )
    const decoded = result?.buffer
    const consumed = asRecord(result?.engine)?.bytesWritten
    if (!Buffer.isBuffer(decoded) || typeof consumed !== 'number' || consumed <= 0) {
      throw new Error('Invalid DSH frame decoder result')
    }
    offset += consumed
    decodedBytes += decoded.length
    if (decodedBytes > MAX_DECODED_BYTES) {
      throw new Error('DSH transcript exceeds the decoded size limit')
    }
    pending += decoder.write(decoded)
    for (;;) {
      const end = pending.indexOf('\n')
      if (end === -1) {
        break
      }
      const line = pending.slice(0, end)
      pending = pending.slice(end + 1)
      if (!line.trim()) {
        continue
      }
      const record = asRecord(JSON.parse(line))
      if (!record) {
        throw new Error('Invalid DSH session record')
      }
      if (!header) {
        if (record.type !== 'session' || record.version !== 4 || !extractString(record.id)) {
          throw new Error('Unsupported DSH session header')
        }
        accumulator.sessionId = extractString(record.id)!
        accumulator.cwd = extractString(record.cwd)
        updateTimeline(accumulator, record.createdAt)
        header = true
      } else {
        if (record.seq !== sequence++) {
          throw new Error('DSH session event sequence is incomplete')
        }
        foldDshEvent(accumulator, record)
      }
    }
    if (Buffer.byteLength(pending) > MAX_FRAME_BYTES) {
      throw new Error('DSH session record exceeds the size limit')
    }
    await yieldToEventLoop()
  }
  pending += decoder.end()
  if (pending.trim()) {
    throw new Error('DSH session has an incomplete final record')
  }
  return header ? finalizeSession(accumulator, platform) : null
}
