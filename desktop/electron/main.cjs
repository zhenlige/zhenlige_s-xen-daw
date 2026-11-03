const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { resolveAsset, readBuiltinSound } = require('./asset-files.cjs')

let knownAssetsPromise
function knownAssets() {
  return knownAssetsPromise ??= fs.readFile(path.join(app.getPath('userData'), 'asset-locations.json'), 'utf8').then(JSON.parse).catch(() => ({}))
}
async function rememberAsset(filePath) {
  const known = await knownAssets()
  known[path.basename(filePath).toLowerCase()] = filePath
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(path.join(app.getPath('userData'), 'asset-locations.json'), JSON.stringify(known), 'utf8')
}

ipcMain.handle('file:resolve-asset', async (_event, payload) => resolveAsset(payload, await knownAssets()))
ipcMain.handle('diagnostics:write-export-log', async (_event, payload) => {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(payload?.id) || typeof payload?.text !== 'string' || payload.text.length > 1024 * 1024) throw new Error('导出日志格式无效')
  const folder = path.join(app.getPath('userData'), 'logs')
  await fs.mkdir(folder, { recursive: true })
  const filePath = path.join(folder, `${payload.id}.log`)
  await fs.writeFile(filePath, payload.text, 'utf8')
  return { path: filePath }
})
ipcMain.handle('diagnostics:save-log', async (_event, payload) => {
  if (typeof payload?.text !== 'string' || payload.text.length > 1024 * 1024) throw new Error('日志内容无效')
  const result = await dialog.showSaveDialog({ title: '保存 MP3 导出日志', defaultPath: `${path.basename(payload.name || 'MP3-export')}.log`, filters: [{ name: '导出日志', extensions: ['log', 'txt'] }] })
  if (result.canceled || !result.filePath) return null
  await fs.writeFile(result.filePath, payload.text, 'utf8')
  return { path: result.filePath }
})

app.setName('纯律和音图 DAW')

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 680,
    backgroundColor: '#111419',
    title: '纯律和音图 DAW',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  Menu.setApplicationMenu(null)
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('file:open-project', async () => {
  const result = await dialog.showOpenDialog({
    title: '打开纯律和音图工程',
    properties: ['openFile'],
    filters: [{ name: '纯律和音图工程', extensions: ['jidaw', 'json'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  return { path: filePath, text: await fs.readFile(filePath, 'utf8') }
})

ipcMain.handle('file:open-midi', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入 MIDI',
    properties: ['openFile'],
    filters: [{ name: 'MIDI', extensions: ['mid', 'midi'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  return { path: filePath, name: path.basename(filePath), bytes: await fs.readFile(filePath) }
})

ipcMain.handle('file:open-tuning', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入调律表', properties: ['openFile'],
    filters: [{ name: 'JI-DAW 调律表', extensions: ['jituning', 'json'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  return { path: filePath, name: path.basename(filePath), text: await fs.readFile(filePath, 'utf8') }
})

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.webm'])

ipcMain.handle('file:open-audio', async () => {
  const result = await dialog.showOpenDialog({
    title: '导入音频轨',
    properties: ['openFile'],
    filters: [{ name: '音频', extensions: ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac', 'webm'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  return { path: filePath, name: path.basename(filePath), bytes: await fs.readFile(filePath) }
})

ipcMain.handle('file:read-audio', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    throw new Error('不支持的音频文件格式')
  }
  return { path: filePath, name: path.basename(filePath), bytes: await fs.readFile(filePath) }
})

ipcMain.handle('file:save-midi', async (_event, payload) => {
  const result = await dialog.showSaveDialog({
    title: '导出 MIDI',
    defaultPath: `${payload.name || '未命名工程'}.mid`,
    filters: [{ name: 'MIDI', extensions: ['mid'] }]
  })
  if (result.canceled || !result.filePath) return null
  await fs.writeFile(result.filePath, Buffer.from(payload.bytes))
  return { path: result.filePath }
})

ipcMain.handle('file:save-audio', async (_event, payload) => {
  const result = await dialog.showSaveDialog({
    title: '导出 MP3 音频',
    defaultPath: `${payload.name || '未命名工程'}.mp3`,
    filters: [{ name: 'MP3 音频', extensions: ['mp3'] }]
  })
  if (result.canceled || !result.filePath) return null
  const value = payload?.bytes
  const bytes = Buffer.isBuffer(value) ? value
    : value instanceof Uint8Array ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
      : value instanceof ArrayBuffer ? Buffer.from(value)
        : Array.isArray(value?.data) ? Buffer.from(value.data) : null
  if (!bytes?.length) throw new Error('没有可写入的 MP3 数据')
  await fs.writeFile(result.filePath, bytes)
  return { path: result.filePath }
})

ipcMain.handle('file:save-project', async (_event, payload) => {
  const result = await dialog.showSaveDialog({
    title: '保存纯律和音图工程',
    defaultPath: payload.path || `${payload.name || '未命名工程'}.jidaw`,
    filters: [{ name: '纯律和音图工程', extensions: ['jidaw'] }]
  })
  if (result.canceled || !result.filePath) return null
  await fs.writeFile(result.filePath, payload.text, 'utf8')
  return { path: result.filePath }
})

ipcMain.handle('file:save-tuning', async (_event, payload) => {
  const result = await dialog.showSaveDialog({
    title: '导出调律表', defaultPath: `${payload.name || '调律表'}.jituning`,
    filters: [{ name: 'JI-DAW 调律表', extensions: ['jituning'] }]
  })
  if (result.canceled || !result.filePath) return null
  await fs.writeFile(result.filePath, payload.text, 'utf8')
  return { path: result.filePath }
})

ipcMain.handle('file:open-sf2', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择 SoundFont 2 音源',
    properties: ['openFile'],
    filters: [{ name: 'SoundFont 2', extensions: ['sf2'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  const bytes = await fs.readFile(filePath)
  await rememberAsset(filePath)
  return { path: filePath, name: path.basename(filePath), bytes }
})

ipcMain.handle('file:read-sf2', async (_event, filePath) => {
  if (typeof filePath !== 'string' || path.extname(filePath).toLowerCase() !== '.sf2') {
    throw new Error('只允许读取 .sf2 文件')
  }
  const bytes = await fs.readFile(filePath)
  await rememberAsset(filePath)
  return { path: filePath, name: path.basename(filePath), bytes }
})

ipcMain.handle('file:read-builtin-sound', (_event, relativePath) => readBuiltinSound(relativePath))

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
