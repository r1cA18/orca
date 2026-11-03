import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REVIEW_PATHS = [
  'config/electron-builder.config.cjs',
  'config/scripts/sign-mac-app.mjs',
  'config/scripts/verify-macos-release-env.mjs',
  'src/main/updater/',
  'src/main/updater-',
  'src/main/updater.ts',
  'src/shared/release-channel.ts',
  'src/shared/app-distribution.json',
  'src/shared/app-release-url.ts',
  'src/main/persistence/profile-state/',
  'src/main/orca-profiles/'
]

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  }).trimEnd()
}

function commit(root, ref) {
  return git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])
}

export function inspectForkUpdate(root, upstreamRef, forkBaseRef) {
  const head = commit(root, 'HEAD')
  const upstream = commit(root, upstreamRef)
  const base = commit(root, forkBaseRef)
  const forkAncestry = spawnSync('git', ['merge-base', '--is-ancestor', base, head], { cwd: root })
  if (forkAncestry.status !== 0) {
    throw new Error('The pinned fork base must be an ancestor of HEAD.')
  }
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', upstream, head], {
    cwd: root
  })
  if (ancestor.status === 0) {
    return { status: 'up-to-date', head, upstream, reasons: [] }
  }
  if (ancestor.status !== 1) {
    throw new Error('Could not check upstream ancestry.')
  }

  const baseResult = spawnSync('git', ['merge-base', head, upstream], {
    cwd: root,
    encoding: 'utf8'
  })
  if (baseResult.status !== 0) {
    throw new Error('No common ancestor. Fetch enough upstream history before checking again.')
  }
  const commonAncestor = baseResult.stdout.trim()
  const changedFiles = git(root, ['diff', '--name-only', '-z', base, upstream])
    .split('\0')
    .filter(Boolean)
  const stats = git(root, ['diff', '--numstat', base, upstream])
  const changedLines = stats.split('\n').reduce((total, line) => {
    const [added, removed] = line.split('\t')
    return total + (Number(added) || 0) + (Number(removed) || 0)
  }, 0)
  const reviewPaths = changedFiles.filter((file) =>
    REVIEW_PATHS.some(
      (prefix) =>
        file === prefix ||
        ((prefix.endsWith('/') || prefix.endsWith('-')) && file.startsWith(prefix))
    )
  )
  const reasons = []
  if (changedFiles.length > 200 || changedLines > 15000) {
    reasons.push('large-upstream-change')
  }
  if (reviewPaths.length > 0) {
    reasons.push('migration-signing-or-updater-change')
  }

  const merge = spawnSync(
    'git',
    [
      'merge-tree',
      '--write-tree',
      '--name-only',
      '--no-messages',
      '-z',
      `--merge-base=${base}`,
      upstream,
      head
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  )
  if (merge.status !== 0 && merge.status !== 1) {
    throw new Error(`Could not compute the merge: ${merge.stderr.trim()}`)
  }
  const [tree, ...paths] = merge.stdout.split('\0')
  const conflicts = paths.filter(Boolean)
  if (merge.status === 1) {
    reasons.push('merge-conflict')
  }
  return {
    status:
      merge.status === 1 ? 'conflict' : reasons.length ? 'review-required' : 'ready-for-validation',
    head,
    upstream,
    base,
    commonAncestor,
    tree: merge.status === 0 ? tree : null,
    changedFileCount: changedFiles.length,
    changedLines,
    reviewPaths,
    conflicts,
    reasons
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 3) {
      throw new Error('Usage: node fork-update-preflight.mjs <upstream-ref>')
    }
    const forkBase = readFileSync(new URL('../fork-upstream-base', import.meta.url), 'utf8').trim()
    const report = inspectForkUpdate(process.cwd(), process.argv[2], forkBase)
    console.log(JSON.stringify(report, null, 2))
    if (report.status === 'conflict' || report.status === 'review-required') {
      process.exitCode = 2
    }
  } catch (error) {
    console.log(JSON.stringify({ status: 'error', message: error.message }, null, 2))
    process.exitCode = 1
  }
}
