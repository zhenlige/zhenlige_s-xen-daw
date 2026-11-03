import { AudioEngine, type RenderChunk } from '../src/audio'
import { encodeMp3 } from '../src/mp3-export'
import { scheduleSynthVoice } from '../src/synth'
import { scheduleDrumHit } from '../src/drums'
import { createTrackBus } from '../src/mixer'
import { encodeTrackCode, decodeTrackCode } from '../src/track-code'
import { createSF2Player } from '@gwegash/sf2-player'
import type { AudioClip, JiProject, Track } from '../src/types'

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message) }
const rate = 44100
const track = (id: string): Track => ({ id, name: id, color: '#fff', volume: .6, pan: -.2, muted: false, solo: false, height: 80,
  instrument: { kind: 'synth', name: 'test', synthId: 'warm-pad', programIndex: 0 }, notes: [], audioClips: [], annotations: [] })
const project = (tracks: Track[]): JiProject => ({ version: 2, name: 'export-test', bpm: 60, bars: 16, signature: '4/4',
  swingEnabled: false, swingAmount: 0, pitchRatios: [[1, 1]], tuningIntervals: [], tracks } as unknown as JiProject)

async function* buffers(buffer: AudioBuffer, sizes: number[]): AsyncGenerator<RenderChunk> {
  let from = 0, index = 0
  while (from < buffer.length) {
    const length = Math.min(sizes[index++ % sizes.length], buffer.length - from)
    yield { buffer, from, length, completedFrames: from, totalFrames: buffer.length }
    from += length
  }
}

function wav(): Uint8Array<ArrayBuffer> {
  const count = rate * 25, bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer)
  const word = (at: number, text: string) => [...text].forEach((c, i) => bytes[at + i] = c.charCodeAt(0))
  word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt '); view.setUint32(16, 16, true)
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, count * 2, true)
  for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 113 / rate) * 8000, true)
  return bytes
}

// A tiny looping SoundFont keeps SF2 coverage deterministic and independent of
// external sound banks, including 128+ sequential notes and release tails.
function sf2(): Uint8Array<ArrayBuffer> {
  const join = (...arrays: Uint8Array[]): Uint8Array<ArrayBuffer> => {
    const result = new Uint8Array(arrays.reduce((n, array) => n + array.length, 0)); let at = 0
    for (const array of arrays) { result.set(array, at); at += array.length }; return result
  }
  const text = (value: string) => Uint8Array.from(value, c => c.charCodeAt(0))
  const chunk = (id: string, data: Uint8Array) => {
    const head = new Uint8Array(8); head.set(text(id)); new DataView(head.buffer).setUint32(4, data.length, true)
    return join(head, data, new Uint8Array(data.length % 2))
  }
  const records = (size: number, entries: Array<(v: DataView) => void>) => {
    const bytes = new Uint8Array(size * entries.length)
    entries.forEach((entry, i) => entry(new DataView(bytes.buffer, size * i, size))); return bytes
  }
  const pcm = new Uint8Array(4410 * 2), pv = new DataView(pcm.buffer)
  for (let i = 0; i < 4410; i++) pv.setInt16(i * 2, Math.sin(2 * Math.PI * 440 * i / rate) * 10000, true)
  const phdr = records(38, [v => { v.setUint8(0, 80); v.setUint16(24, 0, true) }, v => v.setUint16(24, 1, true)])
  const inst = records(22, [v => v.setUint8(0, 73), v => v.setUint16(20, 1, true)])
  const bags = (end: number) => records(4, [() => {}, v => v.setUint16(0, end, true)])
  const gens = (entries: number[][]) => records(4, entries.map(([op, value]) => v => { v.setUint16(0, op, true); v.setInt16(2, value, true) }))
  const shdr = records(46, [v => {
    v.setUint8(0, 83); v.setUint32(24, 4410, true); v.setUint32(28, 0, true); v.setUint32(32, 4410, true)
    v.setUint32(36, rate, true); v.setUint8(40, 69); v.setUint16(44, 1, true)
  }, () => {}])
  const pdta = join(text('pdta'), chunk('phdr', phdr), chunk('pbag', bags(1)), chunk('pmod', new Uint8Array()), chunk('pgen', gens([[41, 0]])),
    chunk('inst', inst), chunk('ibag', bags(3)), chunk('imod', new Uint8Array()), chunk('igen', gens([[38, 1200], [54, 1], [53, 0]])), chunk('shdr', shdr))
  return chunk('RIFF', join(text('sfbk'), chunk('LIST', text('INFO')), chunk('LIST', join(text('sdta'), chunk('smpl', pcm))), chunk('LIST', pdta)))
}

async function reference(tracks: Track[], audioBuffer?: AudioBuffer, fontBytes?: Uint8Array): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(2, 29 * rate, rate)
  const compressor = context.createDynamicsCompressor(), master = context.createGain()
  compressor.threshold.value = -14; compressor.knee.value = 12; compressor.ratio.value = 8
  compressor.attack.value = .002; compressor.release.value = .16; master.gain.value = .82
  compressor.connect(master); master.connect(context.destination)
  const fonts: any[] = []
  try {
    for (const track of tracks) {
      const gain = createTrackBus(context, compressor, track).input
      let font: any
      if (fontBytes && track.instrument.kind === 'sf2') {
        font = await createSF2Player(context, fontBytes); fonts.push(font)
        const attenuation = context.createGain(), limiter = context.createDynamicsCompressor()
        attenuation.gain.value = .48; limiter.threshold.value = -10; limiter.knee.value = 4; limiter.ratio.value = 12; limiter.attack.value = .0015; limiter.release.value = .12
        font.output.connect(attenuation); attenuation.connect(limiter); limiter.connect(gain)
      }
      for (const note of [...track.notes].sort((a, b) => a.beat - b.beat)) {
        if (track.type === 'drum') scheduleDrumHit(context, gain, note.drumId, note.velocity, note.beat, track.instrument.synthId)
        else if (font) { const id = font.noteOnExact(69, 69, 100, note.beat); font.noteOffVoice(id, note.beat + note.duration) }
        else scheduleSynthVoice(context, gain, note.frequency, note.velocity, note.beat, note.duration, track.instrument.synthId)
      }
      if (audioBuffer && track.type === 'audio') {
        const source = context.createBufferSource(); source.buffer = audioBuffer; source.connect(gain); source.start(0)
      }
    }
    return await context.startRendering()
  } finally { for (const font of fonts) font.dispose() }
}

async function run() {
  const results: object[] = []
  const sample = new AudioBuffer({ numberOfChannels: 2, length: rate * 2 + 17, sampleRate: rate })
  for (let i = 0; i < sample.length; i++) { sample.getChannelData(0)[i] = .25 * Math.sin(i * 2 * Math.PI * 440 / rate); sample.getChannelData(1)[i] = .2 * Math.sin(i * 2 * Math.PI * 660 / rate) }
  sample.getChannelData(0)[33] = NaN; sample.getChannelData(1)[34] = Infinity
  const progress: number[] = [], started = performance.now()
  const whole = await encodeMp3(buffers(sample, [sample.length]))
  const split = await encodeMp3(buffers(sample, [1, 1234, 65536, 7011]), { onProgress: fraction => progress.push(fraction) })
  const a = new Uint8Array(await whole.arrayBuffer()), b = new Uint8Array(await split.arrayBuffer())
  assert(a.length === b.length && a.every((value, i) => value === b[i]), 'MP3 chunks changed the encoded audio or inserted padding')
  assert(progress.at(-1) === 1 && progress.every((value, i) => !i || value >= progress[i - 1]), 'Non-monotonic progress')
  const decoder = new AudioContext(), decoded = await decoder.decodeAudioData(await split.arrayBuffer())
  assert(decoded.numberOfChannels === 2 && Math.abs(decoded.duration - sample.duration) < .1, 'MP3 stereo/duration decode failed')
  await decoder.close()
  results.push({ test: 'worker / MPEG continuity / invalid samples / decode', bytes: a.length, seconds: decoded.duration, ms: performance.now() - started })

  const synth = track('synth')
  synth.eq = { low: 3, mid: -4, high: 2 }; synth.reverb = { mix: .4, decay: 2.4 }
  synth.notes = [{ id: 'held', trackId: synth.id, beat: 18.125, duration: 6.875, frequency: 330, velocity: .5 }]
  const bell = track('bell'); bell.instrument.synthId = 'crystal-bell'
  bell.notes = [{ id: 'tail', trackId: bell.id, beat: 18.75, duration: .5, frequency: 440, velocity: .6 }]
  const drums = track('drums'); drums.type = 'drum'
  drums.eq = { low: 2, mid: 0, high: -6 }; drums.reverb = { mix: .3, decay: 1.8 }
  drums.notes = [19.7, 20.125, 24.5].map((beat, i) => ({ id: `drum-${i}`, trackId: drums.id, beat, duration: .5, frequency: 440, velocity: .5, drumId: 'crash' }))
  const audio = track('audio'); audio.type = 'audio'; audio.pan = .3
  const clip: AudioClip = { id: 'clip', trackId: audio.id, name: 'test', beat: 0, sourceDuration: 25, gain: 1 }; audio.audioClips = [clip]
  const engine = new AudioEngine(); await engine.loadAudioClip(clip, wav())
  const audioBuffer = (engine as any).audioBuffers.get(clip.id) as AudioBuffer
  const tracks = [synth, bell, drums, audio], expected = await reference(tracks, audioBuffer)
  let count = 0, maxPcmSeconds = 0, maximumError = 0, errorAt = 0
  for await (const chunk of engine.renderChunks(project(tracks))) {
    count++; maxPcmSeconds = Math.max(maxPcmSeconds, chunk.buffer.duration)
    for (let channel = 0; channel < 2; channel++) {
      const actual = chunk.buffer.getChannelData(channel), wanted = expected.getChannelData(channel)
      for (let i = 0; i < chunk.length; i++) {
        const error = Math.abs(actual[chunk.from + i] - wanted[chunk.completedFrames + i])
        if (error > maximumError) { maximumError = error; errorAt = (chunk.completedFrames + i) / rate }
      }
    }
  }
  assert(count === 2 && maximumError < .002, `Cross-boundary audio mismatch: ${maximumError} at ${errorAt}s`)
  results.push({ test: 'EQ / stereo reverb / held synth / drums / audio clips across boundary', count, maxPcmSeconds, maximumError })

  const font = track('sf2'); font.instrument.kind = 'sf2'
  font.notes = Array.from({ length: 150 }, (_, i) => ({ id: `sf-${i}`, trackId: font.id, beat: i / 6, duration: .1, frequency: 440, velocity: 100 / 127 }))
  font.notes.reverse() // Existing projects need not store notes in chronological order.
  const fontBytes = sf2(); await engine.loadSf2(font, fontBytes, '/virtual/shared.sf2')
  const sharedTrack = track('shared-sf2'); sharedTrack.instrument.kind = 'sf2'
  await engine.loadSf2(sharedTrack, fontBytes, '/virtual/shared.sf2')
  assert((engine as any).fonts.get(font.id).bankKey === (engine as any).fonts.get(sharedTrack.id).bankKey, 'Same SoundFont was parsed separately for multiple tracks')
  const sfExpected = await reference([font], undefined, fontBytes)
  let sfError = 0
  for await (const chunk of engine.renderChunks(project([font]))) {
    const actual = chunk.buffer.getChannelData(0), wanted = sfExpected.getChannelData(0)
    for (let i = 0; i < chunk.length; i++) sfError = Math.max(sfError, Math.abs(actual[chunk.from + i] - wanted[chunk.completedFrames + i]))
  }
  assert(sfError < .002, `SF2 boundary/voice-limit mismatch: ${sfError}`)
  results.push({ test: 'SF2 shared bank / sorted 150 voices / release continuity', maximumError: sfError })

  const drumFont = track('sf2-drums'); drumFont.type = 'drum'; drumFont.instrument.kind = 'sf2'
  drumFont.volume = .005; drumFont.drumVolumes = { kick: .5 }
  drumFont.notes = [{ id: 'kick', trackId: drumFont.id, beat: 0, duration: .2, frequency: 440, velocity: .7, drumId: 'kick' }]
  await engine.loadSf2(drumFont, fontBytes)
  const collect = async (track: Track) => {
    const values: number[] = []
    for await (const chunk of engine.renderChunks(project([track]))) values.push(...Array.from(chunk.buffer.getChannelData(0).subarray(chunk.from, chunk.from + Math.min(chunk.length, rate))))
    return values
  }
  const quiet = await collect(drumFont)
  drumFont.volume = .01
  const louder = await collect(drumFont)
  const energy = (values: ArrayLike<number>) => Array.from(values).reduce((sum, value) => sum + value * value, 0)
  const ratio = Math.sqrt(energy(louder) / energy(quiet))
  assert(Math.abs(ratio - 2) < .001, `SF2 fader was not a linear post-synthesis gain: ${ratio}`)
  drumFont.drumVolumes.kick = 0
  const silentDrum = await collect(drumFont)
  assert(energy(silentDrum) === 0, 'SF2 per-drum mute did not silence the sample')
  drumFont.drumVolumes.kick = .5
  const loaded = (engine as any).fonts.get(drumFont.id), originalOn = loaded.player.noteOnExact
  const calls: unknown[][] = []
  loaded.player.noteOnExact = (...args: unknown[]) => { calls.push(args); return originalOn(...args) }
  await engine.audition(drumFont, drumFont.notes[0])
  drumFont.volume = .9; engine.syncTracks([drumFont]); await engine.audition(drumFont, drumFont.notes[0])
  assert(calls.length === 2 && calls.every(call => call[0] === 36 && call[1] === 36 && call[2] === Math.round(.7 * 127) && call[4] instanceof GainNode), 'SF2 drum mapping, velocity independence or per-drum routing failed')
  engine.stop()
  drumFont.eq = { low: 3, mid: -2, high: -5 }; drumFont.reverb = { mix: .3, decay: 2.1 }; drumFont.instrument.bundledId = 'touhou'
  const portable = await decodeTrackCode(await encodeTrackCode(project([drumFont]), drumFont))
  assert(portable.track.eq?.low === 3 && portable.track.reverb?.decay === 2.1 && portable.track.drumVolumes?.kick === .5 && portable.track.instrument.bundledId === 'touhou', 'Track code lost mixer or bundled SoundFont settings')
  results.push({ test: 'SF2 gain / independent velocity / GM drum key / per-drum gain / portable mixer', gainRatio: ratio })

  for (const kit of ['chip-drum-16', 'fc-noise-8']) {
    const ctx = new OfflineAudioContext(2, rate * 2, rate), merger = ctx.createChannelMerger(2)
    const kick = scheduleDrumHit(ctx, merger, 'kick', 1, 0, kit)
    kick.gain.disconnect(); kick.gain.connect(merger, 0, 0)
    const snare = scheduleDrumHit(ctx, merger, 'snare', 1, 0, kit)
    snare.gain.disconnect(); snare.gain.connect(merger, 0, 1); merger.connect(ctx.destination)
    const rendered = await ctx.startRendering(), bass = rendered.getChannelData(0), snareData = rendered.getChannelData(1)
    let crossings = 0
    for (let i = Math.round(rate * .2) + 1; i < Math.round(rate * .45); i++) if (bass[i - 1] < 0 && bass[i] >= 0) crossings++
    const bassHz = crossings / .25, snareRms = Math.sqrt(energy(snareData.subarray(0, rate * .15)) / (rate * .15))
    assert(bassHz >= 36 && bassHz <= 56 && snareRms > .12, `${kit} lost deep bass or snare body: ${bassHz} Hz, ${snareRms} RMS`)
    const cymbalChecks = []
    for (const id of ['hat-closed', 'hat-open', 'crash'] as const) {
      const context = new OfflineAudioContext(2, rate * 2, rate), merge = context.createChannelMerger(2), highpass = context.createBiquadFilter()
      highpass.type = 'highpass'; highpass.frequency.value = 8000; highpass.Q.value = .707
      const hit = scheduleDrumHit(context, highpass, id, 1, 0, kit)
      hit.gain.connect(merge, 0, 0); highpass.connect(merge, 0, 1); merge.connect(context.destination)
      const audio = await context.startRendering(), highRatio = energy(audio.getChannelData(1)) / energy(audio.getChannelData(0))
      assert(highRatio < .18, `${kit} ${id} has excessive >8kHz energy: ${highRatio}`)
      cymbalChecks.push({ id, highRatio })
    }
    results.push({ test: `${kit} bass / snare / softened cymbal spectrum`, bassHz, snareRms, cymbalChecks })
  }

  const long = track('long'); long.instrument.synthId = 'classic-triangle'
  long.notes = Array.from({ length: 300 }, (_, i) => ({ id: `long-${i}`, trackId: long.id, beat: i * 2, duration: .5, frequency: 220, velocity: .3 }))
  const longProject = project([long]); longProject.bars = 160
  let longChunks = 0, longPcmSeconds = 0, longFrames = 0
  const renderProgress: number[] = [], renderStages: string[] = []
  for await (const chunk of engine.renderChunks(longProject, { onProgress: value => renderProgress.push(value), onStatus: value => renderStages.push(value) })) {
    longChunks++; longPcmSeconds = Math.max(longPcmSeconds, chunk.buffer.duration); longFrames += chunk.length
  }
  assert(longChunks === 30 && longPcmSeconds < 23 && longFrames > 598 * rate, 'Long export allocated a full-song PCM buffer or lost frames')
  assert(renderStages.length >= 30 && renderProgress.some(value => value > 0 && value < 1) && renderProgress.at(-1) === 1, 'Render stage/progress events missing')
  results.push({ test: 'ten-minute project PCM working set', chunks: longChunks, maxPcmSeconds: longPcmSeconds, pcmMiB: longPcmSeconds * rate * 8 / 1024 ** 2 })

  let rejected = false
  try { for await (const _chunk of engine.renderChunks(project([]))) { /* empty */ } } catch { rejected = true }
  assert(rejected, 'Empty project did not fail')
  const missing = track('missing'); missing.type = 'audio'; missing.audioClips = [{ ...clip, id: 'missing' }]
  rejected = false
  try { for await (const _chunk of engine.renderChunks(project([missing]))) { /* missing */ } } catch (error) { rejected = String(error).includes('missing') }
  assert(rejected, 'Missing audio did not name its track')
  const controller = new AbortController()
  rejected = false
  try { await encodeMp3(engine.renderChunks(project(tracks), { signal: controller.signal }), { signal: controller.signal, onProgress: () => controller.abort() }) }
  catch (error) { rejected = error instanceof DOMException && error.name === 'AbortError' }
  assert(rejected, 'Mid-export cancellation did not reject with AbortError')
  const afterCancel = await encodeMp3(buffers(sample, [70000]))
  assert(afterCancel.size === split.size, 'Export did not recover after cancellation')
  results.push({ test: 'empty / missing asset errors / cancellation / retry', passed: true })
  return results
}

;(window as any).mp3ExportTests = run().then(results => ({ ok: true, results }), error => ({ ok: false, error: String(error), stack: error.stack }))
