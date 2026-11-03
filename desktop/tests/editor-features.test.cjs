const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
const { CHORD_PRESETS, chordRatios, createChordNotes } = require('../src/chords.ts')
const { tuningPitches, tuningFrequencyName, tuningNoteName, generateTwelveToneRatios, customPitchName } = require('../src/tuning.ts')
const { drumVoice } = require('../src/drums.ts')
const { exportMidi } = require('../src/midi-export.ts')
const { sf2PercussionMaps } = require('../src/sf2-percussion.ts')
const { primeLimit } = require('../src/ratio.ts')
const { defaultSf2Instrument, bundledSoundfontId } = require('../src/soundfonts.ts')
const tuning = { pitchTonic: 0, pitchMode: 'chromatic', pitchRatios: generateTwelveToneRatios('chromatic'), tuningSystem: 'ratio', tuningEdo: 31, tuningIntervals: [{ numerator: 11, denominator: 9 }, { numerator: 5, denominator: 4, name: '自定三度' }] }
const tonic = 261.625565

test('PC-98 default project retains its six presets and portable bundled source', () => {
  const project = JSON.parse(fs.readFileSync('东方旧作音色预制.jidaw', 'utf8'))
  assert.deepEqual(project.tracks.map(track => track.name), ['鼓组', 'FM钢琴', 'A.钢琴', 'Bass', '吉他', '方波'])
  assert.deepEqual(project.tracks.map(track => track.instrument.programIndex), [143, 5, 0, 36, 27, 80])
  assert.ok(project.tracks.every(track => track.instrument.bundledId === 'pc98' && !track.instrument.path))
  assert.equal(defaultSf2Instrument().programName, 'Acoustic Piano')
  assert.equal(defaultSf2Instrument(true).bank, 128)
  assert.equal(bundledSoundfontId({ name: 'PC-98 Soundfont.sf2' }), 'pc98')
  assert.equal(bundledSoundfontId({ name: 'PC-98 Soundfont.sf2', path: 'custom/PC-98 Soundfont.sf2' }), undefined)
})

test('custom pitch names preserve exact ratios, EDO steps, labels and octaves', () => {
  const pitches = tuningPitches(tuning)
  assert.equal(pitches[1].name, 'E♭')
  assert.equal(pitches[2].name, '自定三度')
  assert.equal(tuningFrequencyName(tonic * 5 / 4, tuning), '自定三度4')
  assert.equal(tuningFrequencyName(tonic * 5 / 8, tuning), '自定三度3')
  assert.equal(customPitchName(2, { steps: 9 }, 'edo', 31), 'F')
  const edo = { ...tuning, tuningSystem: 'edo', tuningIntervals: [{ steps: 9 }] }
  assert.equal(tuningFrequencyName(tonic * 2 ** (9 / 31), edo), 'E♭4')
  assert.equal(tuningFrequencyName(tonic * 2 ** (1 / 31), edo), 'C4')
  assert.equal(tuningFrequencyName(tonic * 2 ** (-1 / 31), edo), 'C4')
  assert.equal(tuningFrequencyName(440, tuning), 'A4')
})

test('preset spelling follows the tuning degree rather than nearest semitone, with correct B-sharp octave', () => {
  const preset = { ...tuning, tuningSystem: 'preset', pitchTonic: 1, pitchMode: 'ionian', pitchRatios: generateTwelveToneRatios('ionian') }
  assert.equal(tuningFrequencyName(tonic * 2 ** (1 / 12) * 15 / 8, preset), 'B♯4')
  assert.equal(tuningPitches(preset).at(-1).name, 'B♯')
})

test('derived pitches hide grid dimensions and mark exact off-grid ratio dimensions', () => {
  const preset = { ...tuning, tuningSystem: 'preset', pitchMode: 'ionian', pitchNames: [] }
  const root = { id: 'c', frequency: tonic }
  const child = (id, parent, n, d, direction = 'up') => ({ id, parentId: parent.id, frequency: parent.frequency * (direction === 'up' ? n / d : d / n), ratio: { numerator: n, denominator: d, direction } })
  const gridD = child('d3', root, 9, 8), d5 = child('d5', root, 10, 9), highD = child('high-d', d5, 2, 1)
  const g = child('g', root, 3, 2), chainedD = child('chain-d', g, 27, 20, 'down')
  const e = child('e', root, 5, 4), pythE = child('pyth-e', e, 81, 80)
  const notes = new Map([root, gridD, d5, highD, g, chainedD, e, pythE].map(note => [note.id, note]))
  assert.equal(tuningNoteName(gridD, notes, preset), 'D4')
  assert.equal(tuningNoteName(d5, notes, preset), 'D4⁵')
  assert.equal(tuningNoteName(highD, notes, preset), 'D5⁵')
  assert.equal(tuningNoteName(chainedD, notes, preset), 'D4⁵')
  assert.equal(tuningNoteName(e, notes, preset), 'E4')
  assert.equal(tuningNoteName(pythE, notes, preset), 'E4³')
  const custom = { ...tuning, tuningIntervals: [{ numerator: 10, denominator: 9, name: 'D' }] }
  assert.equal(tuningNoteName(d5, notes, custom), 'D4')
  const renamed = { ...preset, pitchNames: ['', '', 'Re'] }
  assert.equal(tuningNoteName(gridD, notes, renamed), 'Re4')
  const transposed = { ...preset, pitchTonic: 2 }
  const transposedRoot = { ...root, frequency: tonic * 2 ** (2 / 12) }, transposedChild = child('off-e', transposedRoot, 10, 9)
  assert.equal(tuningNoteName(transposedChild, new Map([[root.id, transposedRoot]]), transposed), 'E4⁵')
})

test('A 19edo uses compact names and preserves the original seventh spelling after harmonization', () => {
  const edo = { ...tuning, pitchTonic: 9, tuningSystem: 'edo', tuningEdo: 19, tuningIntervals: Array.from({ length: 18 }, (_, index) => ({ steps: index + 1 })) }
  const root = { id: 'a', frequency: 440 }
  const seventh = { id: 'g', parentId: root.id, frequency: 770, ratio: { numerator: 7, denominator: 4, direction: 'up' } }
  const projected = 440 * 2 ** (15 / 19)
  const notes = new Map([[root.id, root], [seventh.id, seventh]])
  assert.equal(tuningFrequencyName(440, edo), 'A4')
  assert.equal(tuningFrequencyName(261.625565, edo), 'C4')
  assert.equal(tuningNoteName(seventh, notes, edo, projected), 'G4⁷')
})

test('all sourced chords have correct prime limit and exact atomic voices', () => {
  const root = { id: 'root', trackId: 'track', frequency: 220, beat: 3, duration: 2, velocity: .65 }
  for (const chord of CHORD_PRESETS) {
    assert.equal(Math.max(...chordRatios(chord).map(primeLimit)), chord.limit)
    const track = { id: 'track', type: 'instrument', notes: [root] }
    let serial = 0
    const voices = createChordNotes(root, track, chord, () => `new-${++serial}`)
    assert.equal(voices.length, chord.harmonics.length - 1)
    assert.equal(track.notes.length, 1)
    voices.forEach((note, index) => {
      assert.equal(note.frequency, 220 * chord.harmonics[index + 1] / chord.harmonics[0])
      assert.equal(note.parentId, root.id); assert.equal(note.beat, 3); assert.equal(note.duration, 2); assert.equal(note.velocity, .65)
    })
    track.notes.push(...voices)
    assert.equal(createChordNotes(root, track, chord, () => 'duplicate').length, 0)
    assert.throws(() => createChordNotes({ ...root, frequency: 23000 }, track, chord, () => 'bad'), /24000/)
  }
})

test('actual Touhou percussion zones expose names and keys outside the built-in ten', () => {
  const maps = sf2PercussionMaps(fs.readFileSync('sound/Touhou.sf2'))
  const kits = [...maps].filter(([key]) => key.startsWith('128:'))
  assert.ok(kits.length)
  const voices = kits[0][1]
  assert.ok(voices.length > 10)
  assert.ok(voices.every(voice => voice.name && drumVoice(voice.id).midi === voice.midi))
  assert.ok(voices.some(voice => voice.midi === 51))
  console.log(JSON.stringify({ kit: kits[0][0], keys: voices.length, ride: voices.find(voice => voice.midi === 51) }))
})

test('MIDI export preserves SF2 percussion keys on channel 10', () => {
  const project = { name: 'test', bpm: 120, signature: '4/4', tracks: [{ type: 'drum', instrument: {}, notes: [{ drumId: 'midi-81', beat: 0, duration: 1, velocity: .8, frequency: 440 }] }] }
  const bytes = exportMidi(project)
  assert.ok(bytes.some((value, index) => value === 0x99 && bytes[index + 1] === 81))
})
