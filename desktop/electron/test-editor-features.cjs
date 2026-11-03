const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs/promises')
const { readBuiltinSound } = require('./asset-files.cjs')
ipcMain.handle('file:read-builtin-sound', (_event, relativePath) => readBuiltinSound(relativePath))
app.setPath('userData', path.join(os.tmpdir(), 'ji-daw-editor-feature-tests'))
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  let server, win
  try {
    win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true } })
    const run = fn => win.webContents.executeJavaScript(`(${fn.toString()})()`)
    const capture = async file => {
      await run(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      await new Promise(resolve => setTimeout(resolve, 150))
      await fs.writeFile(file, (await win.webContents.capturePage()).toPNG())
    }
    // Smoke-test the exact file entry used by the desktop launcher, without HTTP.
    await win.webContents.session.clearStorageData({ storages: ['localstorage'] })
    await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    await run(() => { if (!document.querySelector('.track-row') || document.querySelectorAll('[data-chord-menu]').length !== 2) throw new Error('Local file entry failed') })
    const defaults = await require('../tests/default-project-ui.cjs')(win)
    await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    await run(async () => {
      const deadline = performance.now() + 60000
      while (![...document.querySelectorAll('.track-instrument')].every(select => select.options.length > 100)) { if (performance.now() > deadline) throw new Error('PC-98 native restore timed out'); await new Promise(resolve => setTimeout(resolve, 40)) }
      if (document.querySelector('#project-name').value !== 'PC-98 自动恢复测试') throw new Error('Existing autosave was replaced by the template')
    })
    const folder = path.join(__dirname, '..', 'tests', 'artifacts')
    await fs.mkdir(folder, { recursive: true })
    await capture(path.join(folder, 'pc98-default-project.png'))
    win.destroy()
    win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true } })
    const { createServer } = await import('vite')
    server = await createServer({ root: path.join(__dirname, '..'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
    await server.listen()
    await win.loadURL(server.resolvedUrls.local[0])
    await run(() => { localStorage.removeItem('ji-daw-default-tuning-v1'); localStorage.removeItem('ji-daw-autosave-v2') })
    // Keep the feature fixtures independent of the user-supplied startup template.
    const fixture = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'DEMO.jidaw'), 'utf8'))
    fixture.tracks = fixture.tracks.slice(0, 3)
    fixture.pitchTonic = 0; fixture.pitchMode = 'chromatic'; fixture.tuningSystem = 'preset'; fixture.pitchNames = []
    fixture.tracks.forEach(track => { track.type = 'instrument'; track.notes = []; track.annotations = []; track.audioClips = []; track.instrument = { kind: 'synth', name: 'Test', synthId: 'classic-triangle', programIndex: 0 } })
    const rootTrack = fixture.tracks[0]
    rootTrack.notes = [
      { id: 'feature-root', trackId: rootTrack.id, beat: 0, duration: 4, frequency: 261.626, velocity: .82 },
      { id: 'feature-third', trackId: rootTrack.id, beat: 0, duration: 4, frequency: 327.0325, velocity: .72, parentId: 'feature-root', ratio: { numerator: 5, denominator: 4, direction: 'up' } },
      { id: 'feature-fifth', trackId: rootTrack.id, beat: 0, duration: 4, frequency: 392.439, velocity: .72, parentId: 'feature-root', ratio: { numerator: 3, denominator: 2, direction: 'up' } }
    ]
    await win.webContents.executeJavaScript(`localStorage.setItem('ji-daw-autosave-v2', ${JSON.stringify(JSON.stringify(fixture))})`)
    await win.loadURL(server.resolvedUrls.local[0])
    const chordResult = await run(async () => {
      const check = (value, message) => { if (!value) throw new Error(message) }
      const saved = () => JSON.parse(localStorage.getItem('ji-daw-autosave-v2'))
      const gesture = id => {
        const node = document.querySelector('#piano-svg [data-note-id="' + id + '"] .note-hit'), rect = document.querySelector('#piano-canvas').getBoundingClientRect()
        const x = rect.left + (Number(node.getAttribute('x1')) + Number(node.getAttribute('x2'))) / 2, y = rect.top + Number(node.getAttribute('y1'))
        node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 1 }))
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 1 }))
      }
      document.querySelector('.overview-lane .overview-note').click()
      const root = document.querySelector('#piano-svg [data-note-id]').dataset.noteId
      gesture(root)
      document.querySelector('#root-numerator').value = '10'
      document.querySelector('#root-denominator').value = '9'
      document.querySelector('#root-add-ratio').click()
      check([...document.querySelectorAll('.piano-label')].some(label => label.textContent.includes('D⁵4')), 'Off-grid 10/9 did not display D with a superscript 5')
      check(![...document.querySelectorAll('.piano-label')].some(label => label.textContent.includes('≈')), 'Note names still contain approximation signs')
      document.querySelector('#piano-undo').click(); gesture(root)
      document.querySelector('#root-menu [data-chord-limit="11"]').click()
      check(document.querySelector('#root-menu [data-chord="otonal-neutral"]'), '11-limit chord menu missing')
      const chords = document.querySelector('#root-menu [data-chord-menu]')
      check(!chords.querySelector('a,p') && !chords.textContent.includes('Wiki'), 'Chord menu contains unwanted links or introductions')
      check(chords.querySelector('.ratio-quick') && chords.querySelector('.ratio-preset-panel'), 'Chord menu does not share the ratio controls style')
      document.querySelector('#root-menu [data-chord="otonal-neutral"]').click()
      let track = saved().tracks[0]
      const count = track.notes.length
      check(count === 4 && track.notes.some(note => note.parentId === root && note.ratio.numerator === 11 && note.ratio.denominator === 9), 'Exact 11-limit chord not created (existing fifth should be reused)')
      document.querySelector('#piano-undo').click()
      check(saved().tracks[0].notes.length === 3, 'Chord did not undo atomically')
      document.querySelector('#redo-button').click()
      check(saved().tracks[0].notes.length === count, 'Chord redo failed')
      const child = saved().tracks[0].notes.find(note => note.parentId === root && note.ratio.numerator === 11).id
      gesture(child)
      check(document.querySelector('#note-menu').classList.contains('open'), 'Child note menu missing')
      document.querySelector('#note-menu [data-chord-limit="7"]').click()
      document.querySelector('#note-menu [data-chord="harmonic-seventh"]').click()
      check(saved().tracks[0].notes.length === count + 3, 'Child-note chord failed')
      gesture(root)
      document.querySelector('#root-menu [data-chord-limit="11"]').click()
      return { localFileEntry: true, rootChord: true, childChord: true, undoRedo: true, gestureRoot: root }
    })
    await capture(path.join(folder, 'one-click-chords.png'))
    const tuningResult = await run(async () => {
      const check = (value, message) => { if (!value) throw new Error(message) }
      const set = (selector, value) => { const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) }
      document.querySelector('#piano-overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      document.querySelector('#global-scale').click()
      let exportedPreset
      window.desktop = { saveTuning: async payload => { exportedPreset = payload.text; return { path: 'preset.jituning' } } }
      set('[data-pitch-name="0"]', 'Do'); set('[data-pitch-name="2"]', 'Re')
      document.querySelector('#scale-export').click(); await new Promise(resolve => setTimeout(resolve, 20))
      check(JSON.parse(exportedPreset).pitchNames[2] === 'Re', 'Preset tuning export lost custom note names')
      document.querySelector('#scale-apply').click()
      check(JSON.parse(localStorage.getItem('ji-daw-autosave-v2')).pitchNames[2] === 'Re', 'Project did not save preset note names')
      check([...document.querySelectorAll('.piano-label')].some(label => label.textContent.includes('Do')), 'Preset note labels ignore custom names')
      document.querySelector('#global-scale').click()
      check(document.querySelector('[data-pitch-name="2"]').value === 'Re', 'Reopening the tuning editor lost preset note names')
      window.desktop.openTuning = async () => ({ text: exportedPreset, path: 'preset.jituning' })
      document.querySelector('#scale-import').click(); await new Promise(resolve => setTimeout(resolve, 20))
      check(document.querySelector('[data-pitch-name="2"]').value === 'Re', 'Preset tuning import lost custom names')
      set('#scale-system', 'ratio'); document.querySelector('#scale-add-interval').click()
      set('[data-part="n"]', '11'); set('[data-part="d"]', '9')
      check(document.querySelector('[data-tuning-name]').textContent === 'C · 11/9', 'Ratio still uses a guessed 12-EDO name')
      set('[data-part="name"]', '中性音 <N>')
      let exported
      window.desktop = { saveTuning: async payload => { exported = payload.text; return { path: 'test.jituning' } } }
      document.querySelector('#scale-export').click(); await new Promise(resolve => setTimeout(resolve, 20))
      check(JSON.parse(exported).intervals[0].name === '中性音 <N>', 'Tuning export lost custom name')
      document.querySelector('#scale-apply').click()
      check(JSON.parse(localStorage.getItem('ji-daw-autosave-v2')).tuningIntervals[0].name === '中性音 <N>', 'Project lost custom name')
      check([...document.querySelectorAll('.piano-label')].some(label => label.textContent.includes('中性音 <N>')), 'Note labels disagree with custom tuning')
      check(!document.querySelector('.piano-label n'), 'Custom name interpreted as markup')
      document.querySelector('#global-scale').click()
      window.desktop.openTuning = async () => ({ text: exported, path: 'test.jituning' })
      document.querySelector('#scale-import').click(); await new Promise(resolve => setTimeout(resolve, 20))
      check(document.querySelector('[data-part="name"]').value === '中性音 <N>', 'Tuning import lost custom name')
      delete window.desktop
      return { customLabels: true, presetLabels: true, exportImport: true, labelEscaping: true }
    })
    await capture(path.join(folder, 'custom-tuning.png'))
    const sf2Result = await run(async () => {
      const check = (value, message) => { if (!value) throw new Error(message) }
      const saved = () => JSON.parse(localStorage.getItem('ji-daw-autosave-v2')).tracks[0]
      const wait = async predicate => { const deadline = performance.now() + 90000; while (!predicate()) { if (performance.now() > deadline) throw new Error('Timed out: ' + document.querySelector('#toast').textContent); await new Promise(resolve => setTimeout(resolve, 40)) } }
      document.querySelector('#piano-overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      document.querySelector('#back-to-tracks').click()
      let input = document.querySelector('.track-instrument')
      input.value = 'bundled:touhou'; input.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(() => saved().instrument.bundledId === 'touhou')
      input = document.querySelector('.track-instrument')
      const percussion = [...input.options].find(option => option.textContent.includes('[128:'))
      check(percussion, 'No percussion preset')
      input.value = percussion.value; input.dispatchEvent(new Event('change', { bubbles: true }))
      check(saved().type === 'drum' && saved().instrument.bank === 128, 'SF2 drum preset did not change editor type')
      document.querySelector('.overview-lane .overview-note').click()
      check(document.querySelector('#piano-view').classList.contains('drum-mode'), 'SF2 still opens harmony editor')
      const id = saved().notes[0].id, node = document.querySelector('#piano-svg [data-note-id="' + id + '"] .note-hit'), rect = document.querySelector('#piano-canvas').getBoundingClientRect()
      // Converted melodic notes can lie below the first screen: scroll to their row.
      const y = Number(node?.getAttribute('y1') || 0)
      if (!node) document.querySelector('#piano-canvas').dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 1000 }))
      const pad = document.querySelector('[data-drum-pad="midi-51"]')
      if (!pad) document.querySelector('#piano-canvas').dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 700 }))
      const hit = document.querySelector('#piano-svg .note-hit')
      if (hit) {
        const x = rect.left + Number(hit.getAttribute('x1')) + 8, cy = rect.top + Number(hit.getAttribute('y1'))
        hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: cy, pointerId: 1 }))
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: cy, pointerId: 1 }))
      } else {
        const canvas = document.querySelector('#piano-canvas'), row = document.querySelector('[data-drum-pad] rect')
        const x = rect.left + 400, cy = rect.top + Number(row.getAttribute('y')) + 20
        canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: cy, pointerId: 1 }))
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: cy, pointerId: 1 }))
        const note = document.querySelector('#piano-svg .note-hit')
        note.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: cy, pointerId: 1 }))
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: cy, pointerId: 1 }))
      }
      const select = document.querySelector('#drum-note-voice')
      check(select.options.length > 10 && [...select.options].some(option => option.value === 'midi-81'), 'SF2 kit limited to ten voices')
      select.value = 'midi-81'; select.dispatchEvent(new Event('change', { bubbles: true }))
      check(saved().notes.some(note => note.drumId === 'midi-81'), 'High percussion key not saved')
      check(document.querySelector('#root-menu').classList.contains('drum-menu'), 'Drum note shows ratio/chord controls')
      const labels = [...select.options].slice(0, 5).map(option => option.textContent)
      document.querySelector('#piano-overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      return { automaticDrumEditor: true, voices: select.options.length, key81: true, labels }
    })
    await capture(path.join(folder, 'sf2-percussion.png'))
    // Reload exercises persisted MIDI keys, labels and preset classification.
    await win.loadURL(server.resolvedUrls.local[0])
    await run(async () => {
      const deadline = performance.now() + 90000
      while (!document.querySelector('.track-instrument')?.selectedOptions[0]?.textContent.includes('[128:')) { if (performance.now() > deadline) throw new Error('SF2 restore timed out'); await new Promise(resolve => setTimeout(resolve, 40)) }
      document.querySelector('.overview-lane .overview-note').click()
      if (!document.querySelector('#piano-view').classList.contains('drum-mode')) throw new Error('Reload lost drum editor')
      if (!JSON.parse(localStorage.getItem('ji-daw-autosave-v2')).tracks[0].notes.some(note => note.drumId === 'midi-81')) throw new Error('Reload lost key 81')
    })
    console.log(JSON.stringify({ ok: true, defaults, chords: chordResult, tuning: tuningResult, sf2: sf2Result, reload: true }, null, 2))
  } catch (error) { console.error(error); process.exitCode = 1 }
  finally { win?.destroy(); await server?.close(); app.exit(process.exitCode || 0) }
})
