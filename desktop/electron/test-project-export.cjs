const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const { resolveAsset } = require('./asset-files.cjs')

const projectPath = path.resolve(process.argv[2] || '')
const fontPath = path.resolve(process.argv[3] || '')
const output = path.resolve(process.argv[4] || path.join(os.tmpdir(), 'ji-daw-project-export'))
app.setPath('userData', path.join(os.tmpdir(), 'ji-daw-project-regression'))
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.on('window-all-closed', () => {})
let win, savedProject, savedAudio
let fontReads = 0
const readFont = async filePath => { fontReads++; return { path: filePath, name: path.basename(filePath), bytes: await fs.readFile(filePath) } }
ipcMain.handle('file:open-project', async () => ({ path: projectPath, text: await fs.readFile(projectPath, 'utf8') }))
ipcMain.handle('file:read-sf2', (_event, filePath) => readFont(filePath))
ipcMain.handle('file:open-sf2', () => readFont(fontPath))
ipcMain.handle('file:resolve-asset', (_event, payload) => resolveAsset(payload))
ipcMain.handle('file:read-builtin-sound', async (_event, relative) => ({ bytes: await fs.readFile(path.join(__dirname, '..', 'dist', 'sound', relative)) }))
ipcMain.handle('file:save-project', async (_event, payload) => {
  savedProject = JSON.parse(payload.text)
  const filePath = path.join(output, `${payload.name}-音源已恢复.jidaw`)
  await fs.writeFile(filePath, payload.text, 'utf8'); return { path: filePath }
})
ipcMain.handle('file:save-audio', async (_event, payload) => {
  savedAudio = path.join(output, `${payload.name}.mp3`)
  await fs.writeFile(savedAudio, payload.bytes); return { path: savedAudio }
})
ipcMain.handle('diagnostics:write-export-log', async (_event, payload) => {
  const filePath = path.join(output, `${payload.id}.log`)
  await fs.writeFile(filePath, payload.text, 'utf8'); return { path: filePath }
})
ipcMain.handle('diagnostics:save-log', async (_event, payload) => {
  const filePath = path.join(output, 'missing-sf2-export.log')
  await fs.writeFile(filePath, payload.text, 'utf8'); return { path: filePath }
})

app.whenReady().then(async () => {
  let code = 1
  try {
    await fs.mkdir(output, { recursive: true })
    win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true } })
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] })
    await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    const screenshotTimer = setTimeout(async () => {
      try { await fs.writeFile(path.join(output, 'mp3-export-progress.png'), (await win.capturePage()).toPNG()) } catch { /* Keep the export assertion as the test result. */ }
    }, 4000)
    const result = await win.webContents.executeJavaScript(`(async () => {
      const waitFor = async (predicate, label, timeout = 180000) => {
        const deadline = performance.now() + timeout
        while (!predicate()) { if (performance.now() > deadline) throw new Error(label + ': ' + document.querySelector('.mp3-export-status')?.textContent); await new Promise(resolve => setTimeout(resolve, 50)) }
      }
      const original = await window.desktop.openProject()
      document.querySelector('#open-project').click()
      await waitFor(() => document.querySelector('#toast').textContent.includes('工程已打开'), 'open')
      const button = document.querySelector('#export-mp3')
      button.click(); await waitFor(() => !button.disabled, 'missing font')
      const panel = document.querySelector('.mp3-export-status')
      if (!panel?.open || !panel.querySelector('.export-error').textContent.includes('SF2')) throw new Error('Missing-font error was not visible')
      const missingLog = JSON.parse(localStorage.getItem('ji-daw-last-mp3-export-log'))
      if (missingLog.projectPath !== original.path || !missingLog.events.some(event => event.details?.stack)) throw new Error('Missing-font log lacks project path or stack')
      panel.querySelector('[data-action="save-log"]').click()
      await waitFor(() => document.querySelector('#toast').textContent.includes('日志已保存'), 'save error log')
      panel.querySelector('[data-action="relink"]').click()
      await waitFor(() => panel.querySelector('[data-action="relink"]').hidden, 'relink font')
      panel.querySelector('[data-action="close"]').click()
      document.querySelector('#save-project').click()
      await waitFor(() => document.querySelector('#toast').textContent.includes('工程已保存'), 'save repaired project')
      const progressValues = [], stages = new Set()
      let ticks = 0
      const watch = setInterval(() => {
        ticks++
        const status = document.querySelector('.mp3-export-status')
        if (status) { progressValues.push(status.querySelector('progress').value); stages.add(status.querySelector('p').textContent) }
      }, 50)
      const started = performance.now()
      button.click(); await waitFor(() => !button.disabled, 'export full project')
      clearInterval(watch)
      if (!document.querySelector('#toast').textContent.includes('MP3 已导出')) throw new Error(document.querySelector('.export-error')?.textContent || document.querySelector('#toast').textContent)
      if (!progressValues.some(value => value > .05 && value < .95)) throw new Error('No intermediate progress visible')
      const log = JSON.parse(localStorage.getItem('ji-daw-last-mp3-export-log'))
      return { reproducedMissingFont: true, errorLogSaved: true, relinked: true, ms: performance.now() - started, uiTicks: ticks, intermediateProgress: progressValues.filter(value => value > 0 && value < .95).length, stages: [...stages], log }
    })()`)
    clearTimeout(screenshotTimer)
    const original = JSON.parse(await fs.readFile(projectPath, 'utf8'))
    if (!savedAudio || !savedProject) throw new Error('MP3 or repaired project was not saved')
    for (let i = 0; i < original.tracks.length; i++) {
      if (JSON.stringify(original.tracks[i].notes) !== JSON.stringify(savedProject.tracks[i].notes)) {
        // The application normalizes optional note properties on open. Musical
        // fields and note count must remain exactly the same.
        const musical = notes => notes.map(({ id, beat, duration, frequency, velocity, ratio, drumId, muted, ghost }) => ({ id, beat, duration, frequency, velocity, ratio, drumId, muted: !!muted, ghost: !!ghost }))
        if (JSON.stringify(musical(original.tracks[i].notes)) !== JSON.stringify(musical(savedProject.tracks[i].notes))) throw new Error('Relinking changed notes')
      }
      if (original.tracks[i].instrument.kind === 'sf2' && original.tracks[i].instrument.programName !== savedProject.tracks[i].instrument.programName) throw new Error('Relinking changed SF2 preset')
    }
    const decode = await win.webContents.executeJavaScript(`(async () => {
      const response = await fetch(${JSON.stringify(require('node:url').pathToFileURL(savedAudio).href)})
      const context = new AudioContext(), buffer = await context.decodeAudioData(await response.arrayBuffer())
      let peak = 0; const data = buffer.getChannelData(0)
      for (const sample of data) { if (!Number.isFinite(sample)) throw new Error('Invalid MP3 sample'); peak = Math.max(peak, Math.abs(sample)) }
      await context.close(); return { seconds: buffer.duration, channels: buffer.numberOfChannels, peak }
    })()`)
    console.log(JSON.stringify({ ...result, stages: result.stages.filter((_, i) => i % 30 === 0), log: undefined, fontReads, savedAudio, mp3Bytes: (await fs.stat(savedAudio)).size, decode }, null, 2))
    await fs.writeFile(path.join(output, 'regression-result.json'), JSON.stringify({ ...result, fontReads, savedAudio, decode }, null, 2))
    code = 0
  } catch (error) { console.error(error); await fs.writeFile(path.join(output, 'regression-error.log'), String(error.stack || error)) }
  finally { win?.destroy(); app.exit(code) }
})
