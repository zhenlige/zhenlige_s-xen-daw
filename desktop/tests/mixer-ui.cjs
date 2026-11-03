const fs = require('node:fs/promises')
const path = require('node:path')

module.exports = async function mixerUi(win, url, fixture) {
  const drum = fixture.tracks[0]
  drum.type = 'drum'; drum.name = '鼓组测试'; drum.instrument = { kind: 'synth', synthId: 'fc-noise-8', name: 'FC 8-bit 808 鼓组', programIndex: 0 }
  drum.eq = { low: 2, mid: -3, high: -4 }; drum.reverb = { mix: .2, decay: 1.7 }; drum.drumVolumes = { snare: 1.3 }
  drum.notes = [{ id: 'd1', trackId: drum.id, drumId: 'snare', beat: 2, duration: 2, frequency: 440, velocity: .8 }, { id: 'd2', trackId: drum.id, drumId: 'kick', beat: 6, duration: 2, frequency: 440, velocity: .7 }]
  await win.loadURL(url)
  await win.webContents.executeJavaScript(`localStorage.setItem('ji-daw-autosave-v2', ${JSON.stringify(JSON.stringify(fixture))})`)
  const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve)); win.reload(); await loaded
  const result = await win.webContents.executeJavaScript(`(${(async function () {
    const check = (value, message) => { if (!value) throw new Error(message) }
    const saved = () => JSON.parse(localStorage.getItem('ji-daw-autosave-v2')).tracks[0]
    const get = id => document.querySelector('#piano-svg [data-note-id="' + id + '"]')
    const point = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 1 }))
    const gesture = (id, mode, beats, rows = 0) => {
      const node = get(id), line = node.querySelector('.pitch-line'), rect = document.querySelector('#piano-canvas').getBoundingClientRect()
      const x1 = Number(line.getAttribute('x1')), x2 = Number(line.getAttribute('x2')), y = Number(line.getAttribute('y1'))
      const step = (x2 - x1) / saved().notes.find(note => note.id === id).duration
      const x = rect.left + (mode === 'head' ? x1 : mode === 'tail' ? x2 : (x1 + x2) / 2), cy = rect.top + y
      point('pointerdown', node.querySelector('.note-hit'), x, cy)
      if (beats || rows) point('pointermove', document, x + beats * step, cy + rows * step)
      point('pointerup', document, x + beats * step, cy + rows * step)
    }
    const set = (selector, value) => {
      const input = document.querySelector(selector); input.value = String(value)
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const edge = document.querySelector('.track-list').getBoundingClientRect().right
    if ([...document.querySelectorAll('.track-row button')].some(button => button.getBoundingClientRect().right > edge)) throw new Error('Track buttons overflow the track list')
    document.querySelector('.overview-lane [data-note-id="d1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    gesture('d1', 'body', 0)
    check(document.querySelector('#root-menu').classList.contains('open') && saved().notes.length === 2, 'Click deleted a drum note or did not open editor')
    set('#root-volume', 55)
    check(saved().notes[0].velocity === .55, 'Drum note velocity editor failed')
    document.querySelector('#piano-overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    gesture('d1', 'body', 1, -1)
    check(saved().notes[0].beat === 3 && saved().notes[0].drumId === 'rim', 'Drum body time/row drag failed')
    gesture('d1', 'tail', 1)
    check(saved().notes[0].duration === 3, 'Drum tail resize failed')
    gesture('d1', 'head', 1)
    check(saved().notes[0].beat === 4 && saved().notes[0].duration === 2, 'Drum head resize failed')
    document.querySelector('#tool-select').click()
    const node = get('d2'), line = node.querySelector('.pitch-line'), rect = document.querySelector('#piano-canvas').getBoundingClientRect()
    const x1 = rect.left + Number(line.getAttribute('x1')) + 12, x2 = rect.left + Number(line.getAttribute('x2')) - 12, y = rect.top + Number(line.getAttribute('y1'))
    point('pointerdown', node, x1, y - 10); point('pointermove', document, x2, y + 10); point('pointerup', document, x2, y + 10)
    check(document.querySelectorAll('.drum-pitch-line.selected').length === 2, 'Marquee failed to intersect the body of a drum note')
    document.querySelector('#tool-pen').click(); gesture('d1', 'body', 1)
    check(saved().notes[0].beat === 5 && saved().notes[1].beat === 7, 'Selected drum group did not move together')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    check(saved().notes.length === 0, 'Delete did not delete the selection')
    document.querySelector('#piano-undo').click(); check(saved().notes.length === 2, 'Drum undo failed')
    set('[data-drum-volume="snare"]', .42)
    check(saved().drumVolumes.snare === .42, 'Drum pad volume failed')
    document.querySelector('#piano-mixer').click()
    check(document.querySelector('#mixer-dialog').open && document.querySelectorAll('.mixer-channel').length === 1, 'Mixer did not open')
    const input = document.querySelector('[data-mix="low"]')
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    set('[data-mix="low"]', 5); set('[data-mix="mix"]', .35); set('[data-mix="volume"]', .45)
    check(saved().eq.low === 5 && saved().reverb.mix === .35 && saved().volume === .45, 'Mixer settings did not persist')
    return { clickEditor: true, velocity: true, headTailResize: true, rowDrag: true, bodyMarquee: true, groupMoveDeleteUndo: true, drumGain: true, mixer: true }
  }).toString()})()`)
  const folder = path.join(__dirname, 'artifacts'); await fs.mkdir(folder, { recursive: true })
  await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  await fs.writeFile(path.join(folder, 'mixer.png'), (await win.webContents.capturePage()).toPNG())
  await win.webContents.executeJavaScript(`document.querySelector('#close-mixer').click()`)
  await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  await fs.writeFile(path.join(folder, 'drum-editor.png'), (await win.webContents.capturePage()).toPNG())
  const preset = await win.webContents.executeJavaScript(`(${(async function () {
    const waitFor = async predicate => {
      const deadline = performance.now() + 90000
      while (!predicate()) { if (performance.now() > deadline) throw new Error('Touhou loading timed out: ' + document.querySelector('#toast').textContent); await new Promise(resolve => setTimeout(resolve, 50)) }
    }
    document.querySelector('#back-to-tracks').click()
    const source = document.querySelector('.track-instrument')
    if (![...source.options].some(option => option.value === 'sf2-import')) throw new Error('Drum SF2 import missing')
    source.value = 'bundled:touhou'; source.dispatchEvent(new Event('change', { bubbles: true }))
    await waitFor(() => JSON.parse(localStorage.getItem('ji-daw-autosave-v2')).tracks[0].instrument.bundledId === 'touhou')
    const saved = JSON.parse(localStorage.getItem('ji-daw-autosave-v2')).tracks[0]
    const programs = [...document.querySelector('.track-instrument').options].filter(option => option.value.startsWith('sf2-program:'))
    const selected = programs.find(option => option.selected)
    if (!selected?.textContent.includes('[128:')) throw new Error('Touhou did not select a percussion bank: ' + selected?.textContent)
    return { source: saved.instrument, programs: programs.length, selected: selected.textContent }
  }).toString()})()`)
  // Reload exercises serialization, preset restoration and copied sound assets.
  const reload = new Promise(resolve => win.webContents.once('did-finish-load', resolve)); win.reload(); await reload
  const restored = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const text = document.querySelector('.track-instrument')?.selectedOptions[0]?.textContent
      if (text?.includes('[128:')) { clearInterval(timer); resolve(text) }
    }, 50)
    setTimeout(() => { clearInterval(timer); reject(new Error('Bundled preset restore timed out')) }, 90000)
  })`)
  const rendered = await win.webContents.executeJavaScript(`(${(async function () {
    let payload
    window.desktop = { saveAudio: async value => { payload = value; return { path: 'touhou-test.mp3' } } }
    document.querySelector('#export-mp3').click()
    const deadline = performance.now() + 30000
    while (document.querySelector('#export-mp3').disabled) {
      if (performance.now() > deadline) throw new Error('Touhou export timed out')
      await new Promise(resolve => setTimeout(resolve, 30))
    }
    if (!payload?.bytes?.length) throw new Error('Touhou MP3 export failed: ' + document.querySelector('#toast').textContent)
    const context = new AudioContext(), buffer = await context.decodeAudioData(payload.bytes.buffer.slice(0))
    const energy = buffer.getChannelData(0).reduce((sum, value) => sum + value * value, 0)
    await context.close()
    if (energy <= .001) throw new Error('Touhou drum export is silent')
    return { bytes: payload.bytes.length, seconds: buffer.duration, energy }
  }).toString()})()`)
  return { ...result, touhou: preset, restored, rendered }
}
