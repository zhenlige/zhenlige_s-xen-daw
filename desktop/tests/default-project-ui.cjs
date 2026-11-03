module.exports = async function defaultProjectUi(win) {
  return win.webContents.executeJavaScript(`(${(async function () {
    const check = (value, message) => { if (!value) throw new Error(message) }
    const wait = async predicate => {
      const deadline = performance.now() + 60000
      while (!predicate()) { if (performance.now() > deadline) throw new Error('Default PC-98 loading timed out: ' + document.querySelector('#toast').textContent); await new Promise(resolve => setTimeout(resolve, 40)) }
    }
    const sources = () => [...document.querySelectorAll('.track-instrument')]
    const ready = count => sources().length === count && sources().every(select => select.options.length > 100 && !select.selectedOptions[0].textContent.includes('⚠'))
    const selectedNames = () => sources().map(select => select.selectedOptions[0].textContent)
    const saved = () => JSON.parse(localStorage.getItem('ji-daw-autosave-v2'))
    await wait(() => ready(6))
    check(document.querySelector('#project-name').value === '东方旧作音色预制', 'Startup did not load the supplied default project')
    const expected = ['Standard Drums', 'FM Piano', 'Acoustic Piano', 'Slap Bass 1', 'Clean Guitar', 'Square Wave']
    check(selectedNames().every((name, index) => name.includes(expected[index])), 'Template preset mismatch: ' + selectedNames())
    document.querySelector('#add-track').click(); await wait(() => ready(7))
    check(saved().tracks.at(-1).instrument.bundledId === 'pc98' && selectedNames().at(-1).includes('Acoustic Piano'), 'New instrument track did not load PC-98')
    document.querySelector('#add-drum-track').click(); await wait(() => ready(8))
    check(saved().tracks.at(-1).instrument.bundledId === 'pc98' && selectedNames().at(-1).includes('Standard Drums'), 'New drum track did not load PC-98')
    const newProject = async (selector, count) => {
      document.querySelector('#new-project-picker').open = true
      document.querySelector(selector).click()
      if (document.querySelector('#confirm-dialog').open) document.querySelector('#confirm-ok').click()
      await wait(() => ready(count))
    }
    const previousIds = saved().tracks.map(track => track.id)
    await newProject('#new-default-project', 6)
    check(selectedNames().every((name, index) => name.includes(expected[index])), 'New default project lost its presets')
    check(saved().tracks.every(track => !previousIds.includes(track.id)), 'New default project reused old track identities')
    await newProject('#new-project', 3)
    check(saved().tracks.every(track => !track.notes.length && track.instrument.bundledId === 'pc98'), 'Blank project did not use the default SF2')
    check(selectedNames().every(name => name.includes('Acoustic Piano')), 'Blank project default preset mismatch')
    await newProject('#new-default-project', 6)
    const name = document.querySelector('#project-name'); name.value = 'PC-98 自动恢复测试'; name.dispatchEvent(new Event('change', { bubbles: true }))
    return { startupTemplate: true, nativeSf2Loading: true, templatePresets: expected, newDefault: true, newBlank: true, newTracks: true }
  }).toString()})()`)
}
