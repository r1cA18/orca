import { quoteCmdDoubleQuoted } from './shell-argument-quoting'
import { quoteStartupArg, type AgentStartupShell } from './tui-agent-startup-shell'

/** DSH stores sessions as <home>/sessions/<encoded-cwd>/<session-id>/session.v4.jsonl.zstd. */
export function dshHomeFromTranscript(filePath: string | undefined): string | null {
  return (
    filePath?.match(
      /^(.*)[\\/]sessions[\\/][^\\/]+[\\/]session-[^\\/]+[\\/]session\.v4\.jsonl\.zstd$/
    )?.[1] || null
  )
}

export function dshResumeCommandBase(
  command: string,
  filePath: string | undefined,
  platform: NodeJS.Platform,
  shell?: AgentStartupShell
): string {
  const home = dshHomeFromTranscript(filePath)
  if (!home) {
    return command
  }
  const dialect = shell ?? (platform === 'win32' ? 'cmd' : 'posix')
  if (dialect === 'cmd') {
    return `set ${quoteCmdDoubleQuoted(`DSH_HOME=${home}`)} && ${command}`
  }
  if (dialect === 'powershell') {
    return `$env:DSH_HOME=${quoteStartupArg(home, dialect)}; ${command}`
  }
  return `env DSH_HOME=${quoteStartupArg(home, dialect)} ${command}`
}
