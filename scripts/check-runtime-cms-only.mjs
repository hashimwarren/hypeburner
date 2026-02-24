#!/usr/bin/env node
import { readdir, readFile } from 'fs/promises'
import path from 'path'

const rootDir = process.cwd()
const scanDirs = ['app', 'components', 'layouts', 'lib', 'src']
const targetExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const blockedPatterns = [
  'contentlayer/generated',
  'pliny/utils/contentlayer',
  'next-contentlayer2',
]

async function listFilesRecursive(directory) {
  const absoluteDir = path.resolve(rootDir, directory)
  const files = []
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(absoluteDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(path.relative(rootDir, fullPath))))
      continue
    }

    if (!entry.isFile()) continue
    if (!targetExtensions.has(path.extname(entry.name).toLowerCase())) continue
    files.push(fullPath)
  }
  return files
}

async function run() {
  const allFiles = []
  for (const dir of scanDirs) {
    allFiles.push(...(await listFilesRecursive(dir)))
  }

  const violations = []
  for (const filePath of allFiles) {
    const source = await readFile(filePath, 'utf8')
    for (const pattern of blockedPatterns) {
      if (source.includes(pattern)) {
        violations.push(`${path.relative(rootDir, filePath)} -> ${pattern}`)
      }
    }
  }

  if (violations.length > 0) {
    console.error('[guard:runtime-cms] Blocked runtime references detected:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('[guard:runtime-cms] no blocked runtime references found')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
