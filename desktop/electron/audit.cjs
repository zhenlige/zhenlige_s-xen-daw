const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

app.setPath('userData', path.join(os.tmpdir(), 'ji-daw-electron-audit-v2'))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } })
  await win.webContents.session.clearStorageData({ storages: ['localstorage'] })
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  await new Promise(resolve => setTimeout(resolve, 250))

  const overviewReport = await win.webContents.executeJavaScript(`(() => ({
    trackViewVisible: !document.querySelector('#track-view').classList.contains('hidden'),
    pianoViewHidden: document.querySelector('#piano-view').classList.contains('hidden'),
    tracks: document.querySelectorAll('.track-row').length,
    pianoEntries: document.querySelectorAll('.open-piano').length,
    bodyOverflow: [document.body.scrollWidth - innerWidth, document.body.scrollHeight - innerHeight],
    entryText: [...document.querySelectorAll('.open-piano')].every(button => button.textContent.includes('钢琴窗')),
    noteLabels: document.querySelectorAll('.overview-note span').length,
    notesContainNoText: [...document.querySelectorAll('.overview-note')].every(note => !note.textContent.trim()),
    resizeHandles: document.querySelectorAll('.track-resize').length,
    defaultSources: [...document.querySelectorAll('.source-name')].map(node => node.textContent)
  }))()`)
  const overviewPath = path.join(os.tmpdir(), 'ji-daw-overview-audit.png')
  await fs.writeFile(overviewPath, (await win.capturePage()).toPNG())

  const menuReport = await win.webContents.executeJavaScript(`(async () => {
    document.querySelector('.open-piano').click()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const firstRoot = [...document.querySelectorAll('g[data-note-id]')].find(group => group.textContent.includes('C4'))
    const hit = firstRoot.querySelector('.note-hit')
    const box = hit.getBoundingClientRect()
    const x = box.left + Math.min(30, box.width / 2), y = box.top + box.height / 2
    hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: y }))
    await new Promise(resolve => requestAnimationFrame(resolve))
    const menu = document.querySelector('#root-menu')
    const rect = menu.getBoundingClientRect()
    return {
      rootMenuOpen: menu.classList.contains('open'),
      fieldsVisible: Boolean(document.querySelector('#root-numerator').offsetParent),
      hasMoveAction: Boolean(document.querySelector('#root-move-ratio')),
      hasAddAction: Boolean(document.querySelector('#root-add-ratio')),
      removedRatioEdit: !document.querySelector('#note-apply-ratio'),
      menuRect: [rect.x, rect.y, rect.width, rect.height], menuDisplay: getComputedStyle(menu).display, menuZ: getComputedStyle(menu).zIndex
    }
  })()`)
  await new Promise(resolve => setTimeout(resolve, 120))
  const menuPath = path.join(os.tmpdir(), 'ji-daw-menu-audit.png')
  await fs.writeFile(menuPath, (await win.capturePage()).toPNG())

  const pianoReport = await win.webContents.executeJavaScript(`(async () => {
    document.querySelector('#root-numerator').value = '19'
    document.querySelector('#root-denominator').value = '16'
    document.querySelector('#root-add-ratio').click()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const rootAfter = [...document.querySelectorAll('g[data-note-id]')].find(group => group.textContent.trim() === 'C4')
    const rootHit = rootAfter.querySelector('.note-hit')
    const initialX = Number(rootHit.getAttribute('x1'))
    const dragY = Number(rootHit.getAttribute('y1'))
    rootHit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: initialX + 50, clientY: dragY }))
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, clientX: initialX + 98, clientY: dragY }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: initialX + 98, clientY: dragY }))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const movedRoot = [...document.querySelectorAll('g[data-note-id]')].find(group => group.textContent.trim() === 'C4')
    const dragDelta = Number(movedRoot.querySelector('.note-hit').getAttribute('x1')) - initialX
    const labels = [...document.querySelectorAll('.piano-label')].map(node => node.textContent)
    return {
      pianoViewVisible: !document.querySelector('#piano-view').classList.contains('hidden'),
      trackViewHidden: document.querySelector('#track-view').classList.contains('hidden'),
      noteLinesAfter: document.querySelectorAll('g[data-note-id]').length,
      intervalCurves: document.querySelectorAll('.interval-curve').length,
      hasRootMarker: Boolean(document.querySelector('.root-marker')),
      hasBottomToolbar: Boolean(document.querySelector('.piano-toolbar')),
      labels,
      forbiddenLabelsAbsent: !labels.some(label => /独立基音|纯五度|纯律|质数限/.test(label)),
      dragDelta,
      bodyOverflow: [document.body.scrollWidth - innerWidth, document.body.scrollHeight - innerHeight]
    }
  })()`)
  const pianoPath = path.join(os.tmpdir(), 'ji-daw-piano-audit.png')
  await fs.writeFile(pianoPath, (await win.capturePage()).toPNG())

  const geometryReport = await win.webContents.executeJavaScript(`(async () => {
    const openRoot = () => {
      const root = [...document.querySelectorAll('g[data-note-id]')].find(group => group.textContent.trim() === 'C4')
      const hit = root.querySelector('.note-hit'), box = hit.getBoundingClientRect()
      const x = box.left + Math.min(30, box.width / 2), y = box.top + box.height / 2
      hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y }))
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: y }))
    }
    const add = async (n, d, direction = 'up') => {
      openRoot(); await new Promise(resolve => requestAnimationFrame(resolve))
      document.querySelector('#root-numerator').value = String(n)
      document.querySelector('#root-denominator').value = String(d)
      document.querySelector('#root-direction').value = direction
      document.querySelector('#root-add-ratio').click()
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
    await add(7, 4); await add(11, 8); await add(13, 8); await add(7, 4, 'down')
    return [...document.querySelectorAll('.interval-curve')].map(path => ({
      limit: path.dataset.primeLimit,
      child: path.dataset.childAnchor,
      parent: path.dataset.parentAnchor,
      middle: path.dataset.middleOffset,
      color: path.style.getPropertyValue('--interval-color'),
      width: path.getAttribute('stroke-width')
    }))
  })()`)

  const featureReport = await win.webContents.executeJavaScript(`(async () => { try {
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const clickNote = async label => {
      const group = [...document.querySelectorAll('g[data-note-id]')].find(node => node.textContent.includes(label))
      const hit = group.querySelector('.note-hit'), box = hit.getBoundingClientRect()
      const x = box.left + Math.min(30, box.width / 2), y = box.top + box.height / 2
      hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y }))
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: y }))
      await frame(); return group
    }
    const connectionLinecap = getComputedStyle(document.querySelector('.interval-curve')).strokeLinecap
    document.querySelector('#piano-settings').click(); await frame()
    const defaultSource = document.querySelector('#settings-source').value
    const sourceChoices = document.querySelector('#settings-source').options.length
    document.querySelector('#settings-scale').click(); await frame()
    const scaleRows = document.querySelectorAll('.scale-ratio-row').length
    const scaleValues = [...document.querySelectorAll('.scale-ratio-row')].map(row => [...row.querySelectorAll('input')].map(input => input.value).join('/'))
    document.querySelector('#piano-overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    document.querySelector('#piano-settings').click(); await frame()
    const snapSelect = document.querySelector('#settings-snap'); snapSelect.value = '0.25'; snapSelect.dispatchEvent(new Event('change', { bubbles: true })); await frame()
    const snapGuides = document.querySelectorAll('.snap-grid').length
    document.querySelector('#piano-overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    const beforeMove = document.querySelectorAll('g[data-note-id]').length
    await clickNote('E4 · 5/4')
    document.querySelector('#note-move-numerator').value = '9'
    document.querySelector('#note-move-denominator').value = '8'
    document.querySelector('#note-move-ratio').click(); await frame()
    const afterMove = document.querySelectorAll('g[data-note-id]').length
    const ghostNotes = document.querySelectorAll('g[data-ghost="true"] .pitch-line.ghost').length
    const ghostConnections = document.querySelectorAll('.interval-curve.ghost').length
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true, bubbles: true }))
    const temporarySelect = document.querySelector('#tool-select').classList.contains('active')
    const groups = [...document.querySelectorAll('g[data-note-id]')]
    const boxes = groups.map(group => group.querySelector('.note-hit').getBoundingClientRect())
    const left = Math.min(...boxes.map(box => box.left)) - 5, right = Math.max(...boxes.map(box => box.right)) + 5
    const top = Math.min(...boxes.map(box => box.top)) - 5, bottom = Math.max(...boxes.map(box => box.bottom)) + 5
    const svg = document.querySelector('#piano-svg')
    svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: left, clientY: top }))
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, clientX: right, clientY: bottom }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: right, clientY: bottom }))
    await frame()
    const selectedByMarquee = document.querySelectorAll('.pitch-line.selected').length
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', ctrlKey: true, bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', code: 'ControlLeft', bubbles: true }))
    await frame()
    const notesAfterDelete = document.querySelectorAll('g[data-note-id]').length
    document.querySelector('#back-to-tracks').click(); await frame()
    const row = document.querySelector('.track-row'), lane = document.querySelector('.overview-lane'), handle = row.querySelector('.track-resize'), beforeHeight = row.getBoundingClientRect().height
    const handleBox = handle.getBoundingClientRect(), resizeX = handleBox.left + 5, resizeY = handleBox.top + 2
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: resizeX, clientY: resizeY }))
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, clientX: resizeX, clientY: resizeY + 64 }))
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: resizeX, clientY: resizeY + 64 }))
    await frame()
    return {
      connectionLinecap, defaultSource, sourceChoices, scaleRows, scaleValues, snapGuides,
      movedCreatesNote: afterMove === beforeMove + 1, ghostNotes, ghostConnections,
      temporarySelect, selectedByMarquee, notesAfterDelete,
      trackHeightBefore: beforeHeight, trackHeightAfter: document.querySelector('.track-row').getBoundingClientRect().height,
      laneHeightAfter: document.querySelector('.overview-lane').getBoundingClientRect().height,
      overviewStillTextFree: [...document.querySelectorAll('.overview-note')].every(note => !note.textContent.trim())
    }
    } catch (error) { return { error: String(error), stack: error && error.stack } }
  })()`)

  console.log(JSON.stringify({ overview: overviewReport, menu: menuReport, piano: pianoReport, geometry: geometryReport, features: featureReport, overviewPath, menuPath, pianoPath }, null, 2))
  win.destroy(); app.quit()
})
