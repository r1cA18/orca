import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectForkUpdate } from './fork-update-preflight.mjs'

const roots = []
function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}
function save(root, filename, text) {
  const target = join(root, filename)
  mkdirSync(join(target, '..'), { recursive: true })
  writeFileSync(target, text)
  git(root, 'add', filename)
  git(root, '-c', 'commit.gpgsign=false', 'commit', '-qm', filename)
}
function repository() {
  const root = mkdtempSync(join(tmpdir(), 'orca-fork-preflight-'))
  roots.push(root)
  git(root, 'init', '-q', '-b', 'fork')
  git(root, 'config', 'user.email', 'fixture@example.invalid')
  git(root, 'config', 'user.name', 'Fixture')
  git(root, 'config', 'core.hooksPath', join(root, 'no-hooks'))
  save(root, 'base.txt', 'base\n')
  git(root, 'branch', 'upstream')
  git(root, 'branch', 'fork-base')
  save(root, 'dsh.txt', 'fork feature\n')
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('fork update preflight', () => {
  it('computes a candidate without changing the branch, index or dirty files', () => {
    const root = repository()
    git(root, 'switch', '-q', 'upstream')
    save(root, 'upstream.txt', 'fix\n')
    git(root, 'switch', '-q', 'fork')
    writeFileSync(join(root, 'base.txt'), 'local work\n')
    const before = git(root, 'status', '--porcelain')
    const report = inspectForkUpdate(root, 'upstream', 'fork-base')
    expect(report.status).toBe('ready-for-validation')
    expect(report.changedFileCount).toBe(1)
    expect(git(root, 'show', `${report.tree}:dsh.txt`)).toBe('fork feature')
    expect(git(root, 'show', `${report.tree}:upstream.txt`)).toBe('fix')
    expect(git(root, 'status', '--porcelain')).toBe(before)
    expect(git(root, 'rev-parse', 'HEAD')).toBe(report.head)
    expect(readFileSync(join(root, 'base.txt'), 'utf8')).toBe('local work\n')
  })

  it('reports conflicts without exposing a promotable tree', () => {
    const root = repository()
    save(root, 'base.txt', 'fork\n')
    git(root, 'switch', '-q', 'upstream')
    save(root, 'base.txt', 'upstream\n')
    git(root, 'switch', '-q', 'fork')
    const report = inspectForkUpdate(root, 'upstream', 'fork-base')
    expect(report.status).toBe('conflict')
    expect(report.conflicts).toEqual(['base.txt'])
    expect(report.tree).toBeNull()
    expect(git(root, 'status', '--porcelain')).toBe('')
  })

  it('requires review for updater changes even when the merge is clean', () => {
    const root = repository()
    git(root, 'switch', '-q', 'upstream')
    save(root, 'src/main/updater/feed.ts', 'changed\n')
    git(root, 'switch', '-q', 'fork')
    const report = inspectForkUpdate(root, 'upstream', 'fork-base')
    expect(report.status).toBe('review-required')
    expect(report.reasons).toContain('migration-signing-or-updater-change')
  })

  it('requires review for large updates', () => {
    const root = repository()
    git(root, 'switch', '-q', 'upstream')
    save(root, 'large.txt', 'change\n'.repeat(15001))
    git(root, 'switch', '-q', 'fork')
    expect(inspectForkUpdate(root, 'upstream', 'fork-base').reasons).toContain(
      'large-upstream-change'
    )
  })

  it('does not propose downgrading to a release already in the fork', () => {
    const root = repository()
    expect(inspectForkUpdate(root, 'upstream', 'fork-base').status).toBe('up-to-date')
  })

  it('reapplies only the fork delta when upstream release history diverged', () => {
    const root = repository()
    save(root, 'base.txt', 'old upstream main branch\n')
    git(root, 'branch', 'diverged-base')
    save(root, 'custom.txt', 'custom integration\n')
    git(root, 'switch', '-q', 'upstream')
    save(root, 'base.txt', 'stable release\n')
    git(root, 'switch', '-q', 'fork')
    const report = inspectForkUpdate(root, 'upstream', 'diverged-base')
    expect(report.status).toBe('ready-for-validation')
    expect(git(root, 'show', `${report.tree}:base.txt`)).toBe('stable release')
    expect(git(root, 'show', `${report.tree}:custom.txt`)).toBe('custom integration')
  })

  it('rejects an incorrect patch base', () => {
    const root = repository()
    git(root, 'switch', '-q', 'upstream')
    save(root, 'new.txt', 'upstream\n')
    git(root, 'switch', '-q', 'fork')
    expect(() => inspectForkUpdate(root, 'upstream', 'upstream')).toThrow('pinned fork base')
  })

  it('refuses a missing or unrelated upstream history', () => {
    const root = repository()
    git(root, 'switch', '-q', '--orphan', 'unrelated')
    save(root, 'unrelated.txt', 'other\n')
    git(root, 'switch', '-q', 'fork')
    expect(() => inspectForkUpdate(root, 'unrelated', 'fork-base')).toThrow('No common ancestor')
  })
})
