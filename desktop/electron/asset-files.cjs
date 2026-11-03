const path = require('node:path')
const fs = require('node:fs/promises')

async function resolveAsset(payload, known = {}) {
  const extensions = payload?.kind === 'sf2' ? new Set(['.sf2']) : new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.webm'])
  const original = typeof payload?.path === 'string' ? payload.path : ''
  const name = path.basename(original || String(payload?.name || ''))
  const candidates = []
  if (original && path.isAbsolute(original)) candidates.push(original)
  if (typeof payload?.projectPath === 'string' && path.isAbsolute(payload.projectPath)) {
    const folder = path.dirname(payload.projectPath)
    if (original && !path.isAbsolute(original)) candidates.push(path.resolve(folder, original))
    for (const subfolder of ['', 'sound', 'assets', 'fonts', 'audio']) candidates.push(path.join(folder, subfolder, name))
  }
  if (known[name.toLowerCase()]) candidates.push(known[name.toLowerCase()])
  for (const candidate of [...new Set(candidates)]) {
    if (!extensions.has(path.extname(candidate).toLowerCase())) continue
    try { if ((await fs.stat(candidate)).isFile()) return { path: candidate } } catch { /* Try the next project/known location. */ }
  }
  return null
}

async function readBuiltinSound(relativePath) {
  if (typeof relativePath !== 'string' || !(['PC-98 Soundfont.sf2', 'Touhou.sf2'].includes(relativePath) || /^[a-z0-9_-]+\/[A-Za-z0-9_-]+\.(mp3|ogg)$/i.test(relativePath))) throw new Error('内置音色路径无效')
  const soundRoot = path.resolve(__dirname, '..', 'dist', 'sound')
  const filePath = path.resolve(soundRoot, relativePath)
  if (!filePath.startsWith(`${soundRoot}${path.sep}`)) throw new Error('内置音色路径越界')
  return { path: filePath, bytes: await fs.readFile(filePath) }
}

module.exports = { resolveAsset, readBuiltinSound }
