const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')

app.setPath('userData', path.join(os.tmpdir(), 'ji-daw-complete-web-tests'))
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  let server, win
  try {
    const { createServer } = await import('vite')
    server = await createServer({ root: path.join(__dirname, '..', 'JI-DAW web'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
    await server.listen()
    win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true } })
    const fixture = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'DEMO.jidaw'), 'utf8'))
    fixture.tracks = fixture.tracks.slice(0, 1)
    const result = await require('../tests/mixer-ui.cjs')(win, `${server.resolvedUrls.local[0]}complete.html`, fixture)
    console.log(JSON.stringify({ deployedCompleteMode: result }, null, 2))
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { win?.destroy(); await server?.close(); app.exit(process.exitCode || 0) }
})
