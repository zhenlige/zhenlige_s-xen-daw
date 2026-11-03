const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs/promises')

app.setPath('userData', path.join(os.tmpdir(), 'ji-daw-mp3-export-tests'))
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  let server, win
  try {
    const { createServer } = await import('vite')
    server = await createServer({ root: path.join(__dirname, '..'), optimizeDeps: { force: true }, server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
    await server.listen()
    win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true } })
    const url = server.resolvedUrls.local[0]
    await win.loadURL(`${url}tests/mp3-export.html`)
    const result = await win.webContents.executeJavaScript('window.mp3ExportTests')
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.ok ? 0 : 1
    if (result.ok) {
      const fixture = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'DEMO.jidaw'), 'utf8'))
      fixture.name = 'MP3 UI test'; fixture.tracks = fixture.tracks.slice(0, 1)
      fixture.tracks[0].instrument = { kind: 'synth', synthId: 'classic-triangle', name: 'Test', programIndex: 0 }
      fixture.tracks[0].notes = fixture.tracks[0].notes.slice(0, 8).map((note, i) => ({ ...note, beat: i, duration: .5 }))
      await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
      await win.webContents.executeJavaScript(`localStorage.setItem('ji-daw-autosave-v2', ${JSON.stringify(JSON.stringify(fixture))})`)
      await win.reload()
      await new Promise(resolve => win.webContents.once('did-finish-load', resolve))
      const ui = await win.webContents.executeJavaScript(`(async () => {
        const waitFor = async predicate => {
          const deadline = performance.now() + 15000
          while (!predicate()) { if (performance.now() > deadline) throw new Error('UI export timed out'); await new Promise(resolve => setTimeout(resolve, 20)) }
        }
        let saved = 0, payload
        window.desktop = { saveAudio: async value => { saved++; payload = value; return { path: 'test.mp3' } } }
        const button = document.querySelector('#export-mp3')
        button.click()
        const statusVisible = Boolean(document.querySelector('.mp3-export-status')) && button.disabled
        document.querySelector('.mp3-export-status button').click()
        await waitFor(() => !button.disabled)
        if (saved || document.querySelector('.mp3-export-status')) throw new Error('Cancellation left stale UI or saved a file')
        button.click()
        await waitFor(() => !button.disabled)
        if (saved !== 1 || !payload?.bytes?.length) throw new Error(document.querySelector('#toast').textContent)
        const decoder = new AudioContext()
        const buffer = await decoder.decodeAudioData(payload.bytes.buffer.slice(0)); await decoder.close()
        window.desktop.saveAudio = async () => { throw new Error('test-save-failure') }
        button.click(); await waitFor(() => !button.disabled)
        const errorPanel = document.querySelector('.mp3-export-status')
        if (!document.querySelector('#toast').textContent.includes('test-save-failure') || !errorPanel?.querySelector('.export-error').textContent.includes('test-save-failure')) throw new Error('Save error was not retained')
        const log = JSON.parse(localStorage.getItem('ji-daw-last-mp3-export-log'))
        if (!log.events.some(event => event.details?.stack?.includes('test-save-failure'))) throw new Error('Error stack was not persisted')
        errorPanel.querySelector('[data-action="close"]').click()
        return { statusVisible, cancelled: true, retried: true, saveErrorRetained: true, logPersisted: true, mp3Bytes: payload.bytes.length, channels: buffer.numberOfChannels, seconds: buffer.duration }
      })()`)
      console.log(JSON.stringify({ productionFileUi: ui }, null, 2))
      const mixerUi = await require('../tests/mixer-ui.cjs')(win, url, fixture)
      console.log(JSON.stringify({ mixerUi }, null, 2))
    }
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { win?.destroy(); await server?.close(); app.exit(process.exitCode || 0) }
})
