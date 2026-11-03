import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { resolveAbsoluteDirOverride } from '../../shared/absolute-dir-override'
import { sessionRootDirs } from './session-scanner-roots'
import type { AiVaultAgentSource } from './session-scanner-agent-sources'

export const DSH_AGENT_SOURCE: AiVaultAgentSource = {
  rootDirs: (options, wslHomeDirs) =>
    sessionRootDirs(
      options.dshSessionsDir ??
        join(resolveAbsoluteDirOverride(process.env.DSH_HOME, join(homedir(), '.dsh')), 'sessions'),
      wslHomeDirs,
      ['.dsh', 'sessions']
    ),
  extensions: ['.zstd'],
  filePredicate: (filePath) => basename(filePath) === 'session.v4.jsonl.zstd'
}
