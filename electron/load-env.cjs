'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * Parse a simple KEY=VALUE .env file into process.env (does not override existing vars).
 * Lines starting with # are comments. Values may be optionally quoted.
 */
function applyEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false
  const text = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (process.env[key] !== undefined && process.env[key] !== '') continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
  return true
}

/**
 * Load desktop secrets for Electron.
 * Priority (first existing wins per key; existing process.env always wins):
 * 1. %APPDATA%/Accounting AI/desktop.env (userData)
 * 2. resources/desktop.env (packaged next to the exe resources)
 * 3. project-root/desktop.env (dev)
 */
function loadDesktopEnv({ userDataPath, resourcesPath, projectRoot, isPackaged }) {
  const candidates = []
  if (userDataPath) candidates.push(path.join(userDataPath, 'desktop.env'))
  if (isPackaged && resourcesPath) candidates.push(path.join(resourcesPath, 'desktop.env'))
  if (!isPackaged && projectRoot) candidates.push(path.join(projectRoot, 'desktop.env'))

  const loaded = []
  for (const file of candidates) {
    if (applyEnvFile(file)) loaded.push(file)
  }
  return loaded
}

module.exports = { applyEnvFile, loadDesktopEnv }
