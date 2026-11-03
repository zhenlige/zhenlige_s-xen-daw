const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { resolveAsset, readBuiltinSound } = require('../electron/asset-files.cjs')

test('desktop bridge reads bundled PC-98 and rejects arbitrary paths', async () => {
  const result = await readBuiltinSound('PC-98 Soundfont.sf2')
  assert.equal(path.basename(result.path), 'PC-98 Soundfont.sf2')
  assert.equal(result.bytes.toString('ascii', 0, 4), 'RIFF')
  assert.equal(result.bytes.toString('ascii', 8, 12), 'sfbk')
  await assert.rejects(readBuiltinSound('../PC-98 Soundfont.sf2'), /路径/)
  await assert.rejects(readBuiltinSound('C:/PC-98 Soundfont.sf2'), /路径/)
})

test('moved projects resolve relative, nearby and remembered assets', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ji-daw-asset-test-'))
  try {
    const folder = path.join(root, 'moved-project'), fonts = path.join(folder, 'fonts')
    await fs.mkdir(fonts, { recursive: true })
    const font = path.join(fonts, 'Touhou.sf2'), projectPath = path.join(folder, 'song.jidaw')
    await fs.writeFile(font, 'test')
    assert.deepEqual(await resolveAsset({ kind: 'sf2', name: 'Touhou.sf2', path: 'fonts/Touhou.sf2', projectPath }), { path: font })
    assert.deepEqual(await resolveAsset({ kind: 'sf2', name: 'Touhou.sf2', path: path.join(root, 'old-folder', 'Touhou.sf2'), projectPath }), { path: font })
    assert.deepEqual(await resolveAsset({ kind: 'sf2', name: 'Touhou.sf2', projectPath: path.join(root, 'elsewhere', 'song.jidaw') }, { 'touhou.sf2': font }), { path: font })
    assert.equal(await resolveAsset({ kind: 'sf2', name: 'missing.sf2', projectPath }), null)
    assert.equal(await resolveAsset({ kind: 'audio', name: 'Touhou.sf2', path: font, projectPath }), null)
  } finally {
    if (!path.resolve(root).startsWith(`${path.resolve(os.tmpdir())}${path.sep}ji-daw-asset-test-`)) throw new Error('Unexpected test cleanup target')
    await fs.rm(root, { recursive: true, force: true })
  }
})
