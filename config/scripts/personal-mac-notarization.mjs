import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function dialog(message, { hidden = false, input = false } = {}) {
  const script = `on run argv
    set response to display dialog (item 1 of argv) with title "Orcaの公証設定" ${input ? 'default answer ""' : ''} ${hidden ? 'with hidden answer' : ''} buttons {"キャンセル", "続ける"} default button "続ける" cancel button "キャンセル"
    ${input ? 'return text returned of response' : 'return "ok"'}
  end run`
  return execFileSync('osascript', ['-e', script, message], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

export function storeNotarizationCredentials(spawn, { profile, team, appleId, password, env }) {
  return new Promise((resolve) => {
    const child = spawn(
      'xcrun',
      ['notarytool', 'store-credentials', profile, '--team-id', team, '--apple-id', appleId],
      { name: 'xterm', cols: 100, rows: 24, env }
    )
    let buffer = ''
    let sent = false
    let invalidCredentials = false
    let completed = false
    const finish = (status) => {
      if (completed) {
        return
      }
      completed = true
      clearTimeout(timer)
      password = ''
      resolve(status)
    }
    const timer = setTimeout(() => {
      child.kill()
      finish('timeout')
    }, 60000)
    child.onData((data) => {
      buffer = (buffer + data).slice(-1500)
      invalidCredentials ||= /Invalid credentials|HTTP status code: 401/i.test(buffer)
      if (!sent && /App-specific password[^\r\n]*:/i.test(buffer)) {
        sent = true
        child.write(`${password}\r`)
        password = ''
      }
    })
    child.onExit(({ exitCode }) =>
      finish(
        exitCode === 0 && sent ? 'saved' : invalidCredentials ? 'invalid-credentials' : 'failed'
      )
    )
  })
}

export async function setupMacNotarization(env, identity) {
  try {
    execFileSync('open', ['-a', 'Google Chrome', 'https://account.apple.com/account/manage'])
    dialog(
      'Appleの画面で「サインインとセキュリティ」→「アプリ用パスワード」を開き、Orca用のパスワードを作成してください。作成したら、この画面の「続ける」を押してください。'
    )
    const appleId = dialog(
      'Apple Developer契約に使っているApple Accountのメールアドレスを入力してください。',
      { input: true }
    )
    const password = dialog(
      'Appleの画面で作成したアプリ用パスワードを貼り付けてください。通常のログインパスワードではありません。入力内容はKeychainへの登録にだけ使用します。',
      { input: true, hidden: true }
    )
    const { spawn } = require('node-pty')
    const status = await storeNotarizationCredentials(spawn, {
      profile: env.APPLE_KEYCHAIN_PROFILE,
      team: identity.team,
      appleId,
      password,
      env
    })
    const message =
      status === 'saved'
        ? '公証用のログインをKeychainに保存しました。以後のビルドでは再入力は不要です。'
        : status === 'invalid-credentials'
          ? 'Appleの認証に失敗しました。Apple Accountと新しく作成したアプリ用パスワードを確認して、設定をやり直してください。'
          : '公証用のログインを保存できませんでした。ネットワークとKeychainの利用状態を確認して、設定をやり直してください。'
    execFileSync(
      'osascript',
      [
        '-e',
        'on run argv\ndisplay dialog (item 1 of argv) with title "Orcaの公証設定" buttons {"閉じる"} default button "閉じる"\nend run',
        message
      ],
      { stdio: 'ignore' }
    )
    return status
  } catch {
    return 'cancelled-or-unavailable'
  }
}
