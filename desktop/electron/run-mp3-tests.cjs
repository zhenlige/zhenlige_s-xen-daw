const { spawn } = require('node:child_process')
const path = require('node:path')
const environment = { ...process.env }
delete environment.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), [path.join(__dirname, 'test-mp3-export.cjs')], {
  cwd: path.join(__dirname, '..'), env: environment, stdio: 'inherit', windowsHide: true
})
child.on('exit', code => { process.exitCode = code ?? 1 })
child.on('error', error => { console.error(error); process.exitCode = 1 })
