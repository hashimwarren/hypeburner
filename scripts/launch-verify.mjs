#!/usr/bin/env node
import { spawn } from 'node:child_process'
import process from 'node:process'

const port = process.env.PORT || '3000'
const baseUrl = process.env.SMOKE_URL || `http://127.0.0.1:${port}`
const isWindows = process.platform === 'win32'
const yarnBin = 'yarn'

const apiTestFiles = [
  '__tests__/api/polar-signature.test.ts',
  '__tests__/api/polar-routes.test.ts',
  '__tests__/api/newsletter.test.ts',
  '__tests__/api/contact.test.ts',
]

function runYarn(args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(yarnBin, args, {
      stdio: 'inherit',
      shell: isWindows,
      env: {
        ...process.env,
        ...extraEnv,
      },
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`yarn ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`))
    })
  })
}

function waitForServer(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs

  return new Promise((resolve, reject) => {
    async function poll() {
      try {
        const response = await fetch(url)
        if (response.ok || response.status === 401 || response.status === 403) {
          resolve()
          return
        }
      } catch {
        // Ignore transient startup connection failures.
      }

      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for server at ${url}`))
        return
      }

      setTimeout(poll, 500)
    }

    poll()
  })
}

function stopServer(serverProcess) {
  return new Promise((resolve) => {
    if (!serverProcess || serverProcess.exitCode !== null) {
      resolve()
      return
    }

    serverProcess.once('exit', () => resolve())

    if (isWindows) {
      const killer = spawn('taskkill', ['/pid', String(serverProcess.pid), '/t', '/f'], {
        stdio: 'ignore',
      })
      killer.once('exit', () => resolve())
      return
    }

    serverProcess.kill('SIGTERM')
    setTimeout(() => {
      if (serverProcess.exitCode === null) {
        serverProcess.kill('SIGKILL')
      }
    }, 5000)
  })
}

async function main() {
  console.log('[launch:verify] checking environment contract')
  await runYarn(['env:check'])

  console.log('[launch:verify] running launch-critical API tests')
  await runYarn(['test', '--', ...apiTestFiles])

  console.log('[launch:verify] building app and postbuild artifacts')
  await runYarn(['build'])

  console.log(`[launch:verify] starting server on :${port}`)
  const serverProcess = spawn(yarnBin, ['serve'], {
    stdio: 'inherit',
    shell: isWindows,
    env: {
      ...process.env,
      PORT: port,
    },
  })

  try {
    await waitForServer(baseUrl)
    console.log(`[launch:verify] running smoke checks against ${baseUrl}`)
    await runYarn(['deploy:smoke', '--url', baseUrl], {
      SMOKE_URL: baseUrl,
    })
  } finally {
    await stopServer(serverProcess)
  }

  console.log('[launch:verify] all launch checks passed')
}

main().catch((error) => {
  console.error('[launch:verify] failed')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
